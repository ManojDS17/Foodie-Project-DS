import logging
import secrets
import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Response, status, Depends
from ..database import get_db_cursor
from ..schemas import UserResponse, ForgotPasswordRequest, ResetPasswordRequest, LoginRequest
from ..auth import (
    ACCESS_TOKEN_EXPIRE_HOURS,
    AUTH_COOKIE_NAME,
    verify_password,
    create_access_token_with_expiry,
    get_current_user,
    get_password_hash,
    hash_reset_token,
)
from ..email_service import send_password_reset_email

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
logger = logging.getLogger(__name__)

MAX_FAILED_LOGINS = 5
MAX_FAILED_LOGINS_PER_IP = 20
LOCKOUT_WINDOW_SECONDS = 900

MAX_FORGOT_REQUESTS = 3
MAX_FORGOT_REQUESTS_PER_IP = 10
FORGOT_WINDOW_SECONDS = 600

_DUMMY_PASSWORD_HASH = get_password_hash(secrets.token_urlsafe(24))
_RATE_LIMIT_SCHEMA_READY = False


def _ensure_rate_limit_schema():
    global _RATE_LIMIT_SCHEMA_READY
    if _RATE_LIMIT_SCHEMA_READY:
        return
    with get_db_cursor(commit=True) as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS auth_rate_limits (
                id BIGSERIAL PRIMARY KEY,
                scope VARCHAR(64) NOT NULL,
                rate_key VARCHAR(320) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_lookup
                ON auth_rate_limits (scope, rate_key, created_at);
        """)
    _RATE_LIMIT_SCHEMA_READY = True


def _get_client_ip(request: Request) -> str:
    return request.client.host if (request.client and request.client.host) else "unknown"


def _is_secure_cookie(request: Request) -> bool:
    is_prod = os.getenv("ENVIRONMENT", "").lower() in ("production", "prod") or os.getenv("DB_NAME", "").lower() in ("foodie_prod", "prod")
    forwarded_proto = request.headers.get("x-forwarded-proto", "").lower()
    return is_prod or request.url.scheme == "https" or forwarded_proto == "https"


def _is_rate_limited(rules: list[tuple[str, str, int, int]]) -> bool:
    _ensure_rate_limit_schema()
    with get_db_cursor() as cur:
        for scope, rate_key, limit, window_sec in rules:
            cur.execute("""
                SELECT COUNT(*)
                FROM auth_rate_limits
                WHERE scope = %s
                  AND rate_key = %s
                  AND created_at > CURRENT_TIMESTAMP - (%s * INTERVAL '1 second');
            """, (scope, rate_key, window_sec))
            if cur.fetchone()[0] >= limit:
                return True
    return False


def _record_rate_limit_hits(entries: list[tuple[str, str]]):
    _ensure_rate_limit_schema()
    with get_db_cursor(commit=True) as cur:
        cur.execute(
            "DELETE FROM auth_rate_limits WHERE created_at < CURRENT_TIMESTAMP - (%s * INTERVAL '1 second');",
            (max(LOCKOUT_WINDOW_SECONDS, FORGOT_WINDOW_SECONDS),),
        )
        for scope, rate_key in entries:
            cur.execute(
                "INSERT INTO auth_rate_limits (scope, rate_key) VALUES (%s, %s);",
                (scope, rate_key),
            )


def _clear_login_rate_limit(client_ip: str, email: str):
    _ensure_rate_limit_schema()
    with get_db_cursor(commit=True) as cur:
        cur.execute(
            "DELETE FROM auth_rate_limits WHERE scope = 'login_ip_email' AND rate_key = %s;",
            (f"{client_ip}:{email}",),
        )


def _normalize_expiry(expires_at: Optional[datetime]) -> Optional[datetime]:
    if expires_at is None:
        return None
    if expires_at.tzinfo is None:
        return expires_at.replace(tzinfo=timezone.utc)
    return expires_at


def _is_org_suspended(
    role: Optional[str],
    organization_id,
    org_is_active: Optional[bool],
    org_is_deleted: Optional[bool],
    org_status: Optional[str],
) -> bool:
    if role == "OEM_MANAGER" or not organization_id:
        return False
    return (
        org_is_active is False
        or org_is_deleted is True
        or str(org_status or "").strip().lower() in ("inactive", "archived")
    )


@router.post("/login")
def login(payload: LoginRequest, request: Request, response: Response):
    email = payload.email.strip().lower()
    client_ip = _get_client_ip(request)
    ip_email_key = f"{client_ip}:{email}"

    if _is_rate_limited([
        ("login_ip_email", ip_email_key, MAX_FAILED_LOGINS, LOCKOUT_WINDOW_SECONDS),
        ("login_ip", client_ip, MAX_FAILED_LOGINS_PER_IP, LOCKOUT_WINDOW_SECONDS),
    ]):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. For security reasons, please wait 15 minutes or reset your password."
        )

    user_dict = None
    with get_db_cursor() as cur:
        cur.execute("SELECT * FROM users WHERE LOWER(email) = %s AND (is_deleted IS NOT TRUE);", (email,))
        row = cur.fetchone()
        if row:
            cols = [desc[0] for desc in cur.description]
            user_dict = dict(zip(cols, row))

    if not user_dict or not user_dict.get("is_active"):
        verify_password(payload.password, _DUMMY_PASSWORD_HASH)
        _record_rate_limit_hits([("login_ip_email", ip_email_key), ("login_ip", client_ip)])
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    if not verify_password(payload.password, user_dict.get("password_hash", "")):
        _record_rate_limit_hits([("login_ip_email", ip_email_key), ("login_ip", client_ip)])
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    _clear_login_rate_limit(client_ip, email)

    with get_db_cursor(commit=True) as cur:
        if user_dict.get("role") == "OPERATOR" and user_dict.get("organization_id"):
            cur.execute("""
                SELECT count(*) FROM users
                WHERE organization_id = %s AND role = 'SITE_ADMIN' AND is_active IS TRUE AND (is_deleted IS NOT TRUE);
            """, (user_dict["organization_id"],))
            active_admin_count = cur.fetchone()[0]
            if active_admin_count == 0:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Client administrator account is inactive or removed. Operator access is temporarily suspended."
                )

        user_dict["company_name"] = None
        user_dict["client_code"] = None
        if user_dict.get("organization_id"):
            cur.execute("SELECT company_name, client_code, is_active, status FROM organizations WHERE id = %s AND (is_deleted IS NOT TRUE);", (user_dict["organization_id"],))
            org_row = cur.fetchone()
            if not org_row or org_row[2] is False or str(org_row[3]).lower() in ('inactive', 'archived'):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Your company account is inactive. Please contact your administrator."
                )
            user_dict["company_name"] = org_row[0]
            user_dict["client_code"] = org_row[1]

        cur.execute("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = %s;", (user_dict["id"],))

    token_data = {
        "id": str(user_dict["id"]),
        "email": user_dict["email"],
        "role": user_dict["role"],
        "first_name": user_dict["first_name"],
        "last_name": user_dict["last_name"],
        "organization_id": str(user_dict["organization_id"]) if user_dict.get("organization_id") else None,
        "company_name": user_dict.get("company_name"),
        "client_code": user_dict.get("client_code"),
        "token_version": user_dict.get("token_version", 1),
    }
    token, expire_dt = create_access_token_with_expiry(token_data)

    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=_is_secure_cookie(request),
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_HOURS * 3600 if payload.remember_me else None,
        path="/api",
    )

    user_dict.pop("password_hash", None)
    user_dict["id"] = str(user_dict["id"])
    if user_dict.get("organization_id"):
        user_dict["organization_id"] = str(user_dict["organization_id"])

    return {
        "user": UserResponse(**user_dict).model_dump(mode="json"),
        "expires_at": expire_dt.isoformat(),
    }


@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    user_dict = current_user.copy()
    token_expires_at = user_dict.pop("token_expires_at", None)
    user_dict["id"] = str(user_dict["id"])
    user_dict["company_name"] = None
    user_dict["client_code"] = None
    if user_dict.get("organization_id"):
        user_dict["organization_id"] = str(user_dict["organization_id"])
        with get_db_cursor() as cur:
            cur.execute("SELECT company_name, client_code FROM organizations WHERE id = %s;", (user_dict["organization_id"],))
            org_row = cur.fetchone()
            if org_row:
                user_dict["company_name"] = org_row[0]
                user_dict["client_code"] = org_row[1]
    payload = UserResponse(**user_dict).model_dump(mode="json")
    payload["expires_at"] = token_expires_at
    return payload


@router.post("/logout")
def logout(request: Request, response: Response, current_user: dict = Depends(get_current_user)):
    """Invalidates active session tokens server-side and clears auth cookie."""
    with get_db_cursor(commit=True) as cur:
        cur.execute("UPDATE users SET token_version = token_version + 1 WHERE id = %s;", (current_user["id"],))
    response.delete_cookie(
        key=AUTH_COOKIE_NAME,
        path="/api",
        httponly=True,
        samesite="lax",
        secure=_is_secure_cookie(request),
    )
    return {"message": "Successfully logged out. Session invalidated."}


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, request: Request):
    email = payload.email.strip().lower()
    client_ip = _get_client_ip(request)
    ip_email_key = f"{client_ip}:{email}"

    if _is_rate_limited([
        ("forgot_ip_email", ip_email_key, MAX_FORGOT_REQUESTS, FORGOT_WINDOW_SECONDS),
        ("forgot_ip", client_ip, MAX_FORGOT_REQUESTS_PER_IP, FORGOT_WINDOW_SECONDS),
    ]):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many password reset requests. Please wait 10 minutes before requesting another reset email."
        )

    _record_rate_limit_hits([("forgot_ip_email", ip_email_key), ("forgot_ip", client_ip)])

    generic_response = {
        "success": True,
        "message": "If an active account is associated with this email address, a password reset link has been sent.",
        "expires_in_minutes": 30,
    }

    user_row = None
    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT u.id, u.first_name, u.last_name, u.is_active, u.role, u.organization_id,
                   o.is_active, o.is_deleted, o.status
            FROM users u
            LEFT JOIN organizations o ON u.organization_id = o.id
            WHERE LOWER(u.email) = %s AND (u.is_deleted IS NOT TRUE);
            """,
            (email,),
        )
        user_row = cur.fetchone()

    if (
        not user_row
        or not user_row[3]
        or _is_org_suspended(user_row[4], user_row[5], user_row[6], user_row[7], user_row[8])
    ):
        return generic_response

    user_id, first_name, last_name = user_row[0], user_row[1], user_row[2]
    token = secrets.token_urlsafe(32)
    token_hash = hash_reset_token(token)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)

    with get_db_cursor(commit=True) as cur:
        cur.execute("""
            UPDATE users 
            SET reset_token = %s, reset_token_expires_at = %s 
            WHERE id = %s;
        """, (token_hash, expires_at, user_id))

    recipient_name = f"{first_name} {last_name}".strip()
    email_result = send_password_reset_email(to_email=email, token=token, recipient_name=recipient_name)

    if not email_result.get("sent"):
        logger.error("SMTP reset delivery failed for user_id=%s: %s", user_id, email_result.get("error", "unknown SMTP error"))
        with get_db_cursor(commit=True) as cur:
            cur.execute("""
                UPDATE users 
                SET reset_token = NULL, reset_token_expires_at = NULL 
                WHERE id = %s;
            """, (user_id,))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to process password reset email at this time. Please try again later."
        )

    return generic_response


@router.post("/verify-reset-token")
def verify_reset_token(payload: dict):
    token = (payload.get("token") or "").strip() if isinstance(payload, dict) else ""
    if not token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token is required.")

    token_hash = hash_reset_token(token)

    with get_db_cursor(commit=False) as cur:
        cur.execute("""
            SELECT u.id, u.email, u.reset_token_expires_at, u.role, u.organization_id,
                   o.is_active, o.is_deleted, o.status
            FROM users u
            LEFT JOIN organizations o ON u.organization_id = o.id
            WHERE u.reset_token = %s AND (u.is_deleted IS NOT TRUE) AND u.is_active IS TRUE;
        """, (token_hash,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired password reset link.")

        _, email, expires_at, role, org_id, org_active, org_deleted, org_status = row
        if _is_org_suspended(role, org_id, org_active, org_deleted, org_status):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Client organization account has been suspended or deactivated.")
        norm_expires = _normalize_expiry(expires_at)
        if not norm_expires or norm_expires < datetime.now(timezone.utc):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This link has expired. Please request a new one or contact your administrator.")

        return {"valid": True, "email": email}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, request: Request):
    token_hash = hash_reset_token(payload.token)
    client_ip = _get_client_ip(request)

    with get_db_cursor(commit=True) as cur:
        cur.execute("""
            SELECT u.id, u.email, u.reset_token_expires_at, u.password_hash, u.is_active,
                   u.role, u.organization_id, o.is_active, o.is_deleted, o.status
            FROM users u
            LEFT JOIN organizations o ON u.organization_id = o.id
            WHERE u.reset_token = %s AND (u.is_deleted IS NOT TRUE)
            FOR UPDATE OF u;
        """, (token_hash,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token.")

        user_id, email, expires_at, current_hash, is_active, role, org_id, org_active, org_deleted, org_status = row
        if not is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account has been deactivated.")
        if _is_org_suspended(role, org_id, org_active, org_deleted, org_status):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Client organization account has been suspended or deactivated.")

        norm_expires = _normalize_expiry(expires_at)
        if not norm_expires or norm_expires < datetime.now(timezone.utc):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This link has expired. Please request a new one.")

        if verify_password(payload.new_password, current_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password cannot be the same as your current password. Please choose a different password."
            )

        new_hash = get_password_hash(payload.new_password)

        cur.execute("""
            UPDATE users 
            SET password_hash = %s,
                reset_token = NULL,
                reset_token_expires_at = NULL,
                token_version = token_version + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
              AND reset_token = %s
              AND (is_deleted IS NOT TRUE)
              AND is_active IS TRUE
              AND reset_token_expires_at IS NOT NULL
              AND reset_token_expires_at >= CURRENT_TIMESTAMP
            RETURNING id;
        """, (new_hash, user_id, token_hash))
        if cur.fetchone() is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token.")

    _clear_login_rate_limit(client_ip, email.strip().lower())

    return {"success": True, "message": "Password has been updated successfully."}


