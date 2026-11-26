import hashlib
import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from dotenv import load_dotenv
import jwt
import bcrypt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

_WEAK_JWT_SECRETS = {
    "PTE_FOODIE_DEV_SECRET_KEY",
    "your_jwt_secret_key_here",
    "foodie_super_secret_jwt_key_2026_operations_platform",
    "changeme",
    "secret",
}


def _load_jwt_secret() -> str:
    secret = os.getenv("JWT_SECRET", "").strip()
    if not secret:
        raise RuntimeError(
            "JWT_SECRET environment variable is required and cannot be empty. "
            "Set a cryptographically random secret (>= 32 bytes) in the environment or backend/.env."
        )
    if secret in _WEAK_JWT_SECRETS or len(secret.encode("utf-8")) < 32:
        raise RuntimeError(
            "JWT_SECRET is too short or uses an insecure default/placeholder value. "
            "Configure a random secret of at least 32 bytes."
        )
    return secret


JWT_SECRET = _load_jwt_secret()
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

from .database import get_db_cursor

AUTH_COOKIE_NAME = "foodie_access_token"
security = HTTPBearer(auto_error=False)


def hash_reset_token(token: str) -> str:
    """Return a SHA-256 hex digest so raw reset/setup tokens are never persisted in DB."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Secure password verification using bcrypt.
    Strictly verifies candidate password against stored hash.
    No backdoors, bypasses, or fallback shortcuts.
    """
    if not plain_password or not hashed_password:
        return False
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """
    Secure password hashing using bcrypt with 12 salt rounds (industry standard).
    """
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(12)).decode('utf-8')


def create_access_token_with_expiry(data: dict, expires_delta: Optional[timedelta] = None) -> Tuple[str, datetime]:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM), expire


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    token, _ = create_access_token_with_expiry(data, expires_delta=expires_delta)
    return token


def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    token = request.cookies.get(AUTH_COOKIE_NAME) or (credentials.credentials if credentials else None)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication credentials were not provided.")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("id")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload.")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token.")

    with get_db_cursor() as cur:
        cur.execute("""
            SELECT u.id, u.organization_id, u.email, u.first_name, u.last_name, u.role, 
                   u.phone_number, u.is_active, u.is_deleted, u.last_login_at, u.created_at, u.updated_at, 
                   u.token_version, o.is_active AS org_is_active, o.is_deleted AS org_is_deleted,
                   o.status AS org_status
            FROM users u
            LEFT JOIN organizations o ON u.organization_id = o.id
            WHERE u.id = %s;
        """, (user_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account not found.")

        cols = [desc[0] for desc in cur.description]
        user_dict = dict(zip(cols, row))

        if user_dict.get("is_deleted"):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account has been deleted.")

        if not user_dict.get("is_active"):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account is deactivated.")

        # Check client organization status for non-OEM accounts
        if user_dict.get("role") != "OEM_MANAGER" and user_dict.get("organization_id"):
            org_status = str(user_dict.get("org_status") or "").lower()
            if user_dict.get("org_is_active") is False or user_dict.get("org_is_deleted") is True or org_status in ("inactive", "archived"):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Client organization account has been suspended or deactivated."
                )

        # Enforce token revocation check
        raw_token_version = payload.get("token_version")
        token_version = int(raw_token_version) if raw_token_version is not None else 1
        db_token_version = user_dict.get("token_version") or 1

        if token_version != db_token_version:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been revoked or invalidated. Please sign in again."
            )

        exp_ts = payload.get("exp")
        if exp_ts is not None:
            user_dict["token_expires_at"] = datetime.fromtimestamp(float(exp_ts), tz=timezone.utc).isoformat()

        return user_dict
