import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, status
from ..database import (
    get_db_cursor,
    require_uuid_or_400,
    sync_active_machines_for_operator,
)
from ..schemas import UserCreate, UserUpdate, UserResponse
from ..auth import get_password_hash, get_current_user, hash_reset_token
from ..email_service import (
    dispatch_email_in_background,
    send_operator_welcome_email,
    send_password_reset_email,
)

router = APIRouter(prefix="/api/users", tags=["Users"], dependencies=[Depends(get_current_user)])

def compute_user_status(is_active: bool, last_login_at) -> str:
    if not is_active:
        return "Inactive"
    if not last_login_at:
        return "Pending"
    return "Active"

@router.get("", response_model=List[UserResponse])
def get_all_users(
    response: Response,
    skip: int = Query(0, ge=0),
    limit: Optional[int] = Query(None, ge=1, le=500),
    search: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    user_role = current_user.get("role")
    if user_role == "OPERATOR":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Users are hidden for operators."
        )

    where_clauses = ["u.is_deleted IS NOT TRUE"]
    params: list = []

    if user_role != "OEM_MANAGER":
        user_org_id = current_user.get("organization_id")
        if not user_org_id:
            response.headers["X-Total-Count"] = "0"
            return []
        where_clauses.append("u.organization_id = %s")
        params.append(user_org_id)

    search_term = search.strip() if search and search.strip() else None
    if search_term:
        pattern = f"%{search_term}%"
        where_clauses.append(
            "(u.first_name ILIKE %s OR COALESCE(u.last_name, '') ILIKE %s OR u.email ILIKE %s OR COALESCE(o.company_name, '') ILIKE %s)"
        )
        params.extend([pattern, pattern, pattern, pattern])

    where_sql = " AND ".join(where_clauses)

    with get_db_cursor() as cur:
        cur.execute(
            f"""
            SELECT COUNT(*)
            FROM users u
            LEFT JOIN organizations o ON u.organization_id = o.id
            WHERE {where_sql};
            """,
            tuple(params),
        )
        total_count = cur.fetchone()[0]
        response.headers["X-Total-Count"] = str(total_count)

        query = f"""
            SELECT u.id, u.organization_id, u.email, u.first_name, u.last_name, u.role, u.phone_number,
                   u.is_active, u.last_login_at, u.created_at, u.updated_at, u.created_by, u.updated_by, u.deleted_by,
                   o.company_name, o.client_code,
                   TRIM(CONCAT(cb.first_name, ' ', COALESCE(cb.last_name, ''))) as created_by_name
            FROM users u
            LEFT JOIN organizations o ON u.organization_id = o.id
            LEFT JOIN users cb ON u.created_by = cb.id
            WHERE {where_sql}
            ORDER BY u.first_name ASC
        """
        query_params = list(params)
        if limit is not None:
            query += " LIMIT %s OFFSET %s"
            query_params.extend([limit, skip])
        elif skip > 0:
            query += " OFFSET %s"
            query_params.append(skip)
        query += ";"

        cur.execute(query, tuple(query_params))
        rows = cur.fetchall()
        cols = [desc[0] for desc in cur.description]
        results = []
        for r in rows:
            d = dict(zip(cols, r))
            d["id"] = str(d["id"])
            if d.get("organization_id"):
                d["organization_id"] = str(d["organization_id"])
            if d.get("created_by"):
                d["created_by"] = str(d["created_by"])
            if d.get("updated_by"):
                d["updated_by"] = str(d["updated_by"])
            if d.get("deleted_by"):
                d["deleted_by"] = str(d["deleted_by"])
            if not d.get("created_by_name"):
                d["created_by_name"] = None
            d["status"] = compute_user_status(d.get("is_active", True), d.get("last_login_at"))
            results.append(UserResponse(**d))
        return results

@router.get("/{user_id}", response_model=UserResponse)
def get_user_by_id(user_id: str, current_user: dict = Depends(get_current_user)):
    user_role = current_user.get("role")
    if user_role == "OPERATOR" and str(current_user.get("id")).strip().lower() != str(user_id).strip().lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Operators can only view their own user profile."
        )
    valid_user_id = require_uuid_or_400(user_id, "user ID")
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT u.id, u.organization_id, u.email, u.first_name, u.last_name, u.role, u.phone_number,
                   u.is_active, u.last_login_at, u.created_at, u.updated_at, u.created_by, u.updated_by, u.deleted_by,
                   o.company_name, o.client_code,
                   TRIM(CONCAT(cb.first_name, ' ', COALESCE(cb.last_name, ''))) as created_by_name
            FROM users u
            LEFT JOIN organizations o ON u.organization_id = o.id
            LEFT JOIN users cb ON u.created_by = cb.id
            WHERE u.id = %s AND (u.is_deleted IS NOT TRUE);
        """, (valid_user_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        cols = [desc[0] for desc in cur.description]
        d = dict(zip(cols, row))
        d["id"] = str(d["id"])
        if d.get("organization_id"):
            d["organization_id"] = str(d["organization_id"])
        if d.get("created_by"):
            d["created_by"] = str(d["created_by"])
        if d.get("updated_by"):
            d["updated_by"] = str(d["updated_by"])
        if d.get("deleted_by"):
            d["deleted_by"] = str(d["deleted_by"])
        if not d.get("created_by_name"):
            d["created_by_name"] = None

        if user_role != "OEM_MANAGER":
            if user_role == "OPERATOR" and str(current_user.get("id")).strip().lower() != d["id"].lower():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: Operators can only view their own user profile."
                )
            user_org_id = str(current_user.get("organization_id") or "")
            target_org_id = str(d.get("organization_id") or "")
            if not user_org_id or target_org_id != user_org_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

        d["status"] = compute_user_status(d.get("is_active", True), d.get("last_login_at"))
        return UserResponse(**d)

@router.post("/{user_id}/resend-invite")
def resend_invite(user_id: str, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    user_role = current_user.get("role")
    if user_role not in ("OEM_MANAGER", "SITE_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
    valid_user_id = require_uuid_or_400(user_id, "user ID")

    with get_db_cursor(commit=True) as cur:
        cur.execute("SELECT id, organization_id, email, first_name, last_name, role FROM users WHERE id = %s AND (is_deleted IS NOT TRUE);", (valid_user_id,))
        u = cur.fetchone()
        if not u:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

        if user_role == "SITE_ADMIN":
            if str(current_user.get("organization_id")) != str(u[1]) or u[5] in ("SITE_ADMIN", "OEM_MANAGER"):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

        welcome_token = secrets.token_urlsafe(32)
        welcome_token_hash = hash_reset_token(welcome_token)
        welcome_token_expires = datetime.now(timezone.utc) + timedelta(days=7)

        cur.execute("""
            UPDATE users
            SET reset_token = %s,
                reset_token_expires_at = %s,
                updated_at = CURRENT_TIMESTAMP,
                updated_by = %s
            WHERE id = %s;
        """, (welcome_token_hash, welcome_token_expires, current_user.get("id"), valid_user_id))

        cur.execute("SELECT company_name, client_code FROM organizations WHERE id = %s;", (u[1],))
        org_info = cur.fetchone()
        c_name = org_info[0] if org_info else "PowerTech Client"
        c_code = org_info[1] if org_info else ""

    background_tasks.add_task(
        dispatch_email_in_background,
        send_operator_welcome_email,
        "Resend Invite",
        to_email=u[2],
        company_name=c_name,
        client_code=c_code,
        recipient_name=f"{u[3]} {u[4] or ''}".strip(),
        reset_token=welcome_token,
    )
    return {"message": f"Invitation link successfully resent to {u[2]}."}

@router.post("/{user_id}/reset-password")
def trigger_password_reset(user_id: str, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    user_role = current_user.get("role")
    if user_role not in ("OEM_MANAGER", "SITE_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
    valid_user_id = require_uuid_or_400(user_id, "user ID")

    with get_db_cursor(commit=True) as cur:
        cur.execute("SELECT id, organization_id, email, first_name, last_name, role FROM users WHERE id = %s AND (is_deleted IS NOT TRUE);", (valid_user_id,))
        u = cur.fetchone()
        if not u:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

        if user_role == "SITE_ADMIN":
            if str(current_user.get("organization_id")) != str(u[1]) or u[5] in ("SITE_ADMIN", "OEM_MANAGER"):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

        reset_token = secrets.token_urlsafe(32)
        reset_token_hash = hash_reset_token(reset_token)
        reset_token_expires = datetime.now(timezone.utc) + timedelta(hours=24)

        cur.execute("""
            UPDATE users
            SET reset_token = %s,
                reset_token_expires_at = %s,
                updated_at = CURRENT_TIMESTAMP,
                updated_by = %s
            WHERE id = %s;
        """, (reset_token_hash, reset_token_expires, current_user.get("id"), valid_user_id))

    background_tasks.add_task(
        dispatch_email_in_background,
        send_password_reset_email,
        "Admin Password Reset",
        to_email=u[2],
        token=reset_token,
        recipient_name=f"{u[3]} {u[4] or ''}".strip(),
    )
    return {"message": f"Password reset instructions generated for {u[2]}."}

@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    user_role = current_user.get("role")
    if user_role not in ("OEM_MANAGER", "SITE_ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only OEM Managers and Site Admins can provision users."
        )

    if payload.role == "OEM_MANAGER" and user_role != "OEM_MANAGER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only OEM Managers can provision OEM Manager accounts."
        )

    if payload.role == "OPERATOR" and user_role == "OEM_MANAGER" and not payload.organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please select a client organization to assign the operator."
        )

    normalized_email = payload.email.strip().lower()

    with get_db_cursor(commit=True) as cur:
        cur.execute("SELECT id FROM users WHERE LOWER(email) = %s AND (is_deleted IS NOT TRUE);", (normalized_email,))
        if cur.fetchone():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f'An account with email "{normalized_email}" is already registered. Email must be unique.'
            )

        cur.execute("SELECT id, client_code, company_name FROM organizations WHERE LOWER(email) = %s AND (is_deleted IS NOT TRUE);", (normalized_email,))
        dup_org = cur.fetchone()
        if dup_org:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This email address is already registered to another client organization."
            )

        raw_password = (payload.password or "").strip()
        if not raw_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password is required and must meet complexity requirements."
            )
        pw_hash = get_password_hash(raw_password)

        if user_role != "OEM_MANAGER":
            org_id = current_user.get("organization_id")
        else:
            org_id = None if payload.role == "OEM_MANAGER" else payload.organization_id

        company_name = None
        client_code = None
        if org_id:
            cur.execute("SELECT company_name, client_code FROM organizations WHERE id = %s AND is_active = TRUE AND (is_deleted IS NOT TRUE);", (org_id,))
            org_row = cur.fetchone()
            if not org_row:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Selected client organization was not found or is currently suspended/inactive."
                )
            company_name = org_row[0]
            client_code = org_row[1]

        welcome_token = secrets.token_urlsafe(32)
        welcome_token_hash = hash_reset_token(welcome_token)
        welcome_token_expires = datetime.now(timezone.utc) + timedelta(days=7)

        cur.execute("""
            INSERT INTO users (
                organization_id, email, password_hash, first_name, last_name, role, phone_number, is_active,
                reset_token, reset_token_expires_at, created_by
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, true, %s, %s, %s)
            RETURNING id, organization_id, email, first_name, last_name, role, phone_number, is_active, last_login_at, created_at, updated_at, created_by, updated_by, deleted_by;
        """, (
            org_id,
            normalized_email,
            pw_hash,
            payload.first_name.strip(),
            (payload.last_name or "").strip(),
            payload.role,
            payload.phone_number.strip() if payload.phone_number else None,
            welcome_token_hash,
            welcome_token_expires,
            current_user.get("id")
        ))
        row = cur.fetchone()
        cols = [desc[0] for desc in cur.description]
        d = dict(zip(cols, row))
        d["id"] = str(d["id"])
        if d.get("organization_id"):
            d["organization_id"] = str(d["organization_id"])
        if d.get("created_by"):
            d["created_by"] = str(d["created_by"])
        if d.get("updated_by"):
            d["updated_by"] = str(d["updated_by"])
        if d.get("deleted_by"):
            d["deleted_by"] = str(d["deleted_by"])
        d["company_name"] = company_name
        d["client_code"] = client_code

        if payload.role == "OPERATOR" and org_id:
            sync_active_machines_for_operator(
                cur,
                organization_id=org_id,
                operator_id=d["id"],
                actor_user_id=current_user.get("id"),
            )

        d["status"] = compute_user_status(d.get("is_active", True), d.get("last_login_at"))

    if payload.role == "OPERATOR":
        poc_name = f"{payload.first_name.strip()} {(payload.last_name or '').strip()}".strip()
        background_tasks.add_task(
            dispatch_email_in_background,
            send_operator_welcome_email,
            "Operator Welcome Email",
            to_email=normalized_email,
            company_name=company_name or "Assigned Client",
            client_code=client_code or "",
            recipient_name=poc_name,
            reset_token=welcome_token,
        )

    return UserResponse(**d)

@router.put("/{user_id}", response_model=UserResponse)
def update_user(user_id: str, payload: UserUpdate, current_user: dict = Depends(get_current_user)):
    user_role = current_user.get("role")

    if user_role == "OPERATOR":
        if str(current_user.get("id")) != str(user_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Operators can only modify their own profile."
            )
        if payload.role is not None and payload.role != "OPERATOR":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Operators cannot change user roles."
            )
        if payload.is_active is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Operators cannot change account activation status."
            )
        if payload.email is not None and payload.email.strip().lower() != current_user.get("email", "").lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Operators cannot modify their email address."
            )

    if payload.role == "OEM_MANAGER" and user_role != "OEM_MANAGER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Cannot elevate permissions to OEM_MANAGER."
        )

    valid_user_id = require_uuid_or_400(user_id, "user ID")

    with get_db_cursor(commit=True) as cur:
        cur.execute("SELECT organization_id, email, role FROM users WHERE id = %s AND is_deleted IS NOT TRUE;", (valid_user_id,))
        target_row = cur.fetchone()
        if not target_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        target_org_id = str(target_row[0] or "") if target_row[0] else None
        target_current_email = str(target_row[1] or "").lower()
        target_role = str(target_row[2] or "")

        if current_user.get("role") != "OEM_MANAGER":
            user_org_id = str(current_user.get("organization_id") or "")
            if not user_org_id or target_org_id != user_org_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: Cannot modify users of another organization."
                )
            if target_role == "OEM_MANAGER":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: Site Administrators cannot modify OEM Manager accounts."
                )
            is_self = str(current_user.get("id")).strip().lower() == str(valid_user_id).strip().lower()
            if target_role == "SITE_ADMIN":
                if not is_self:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Access denied: Site Administrators cannot modify or deactivate other Site Administrator accounts."
                    )
                if payload.is_active is not None:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Access denied: Site Administrators cannot change activation status on Site Administrator accounts."
                    )
                if payload.role is not None and payload.role != "SITE_ADMIN":
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Access denied: Site Administrators cannot modify Site Administrator roles."
                    )
            if is_self and payload.email and payload.email.strip().lower() != target_current_email:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: Site Administrators cannot modify their own email address."
                )

        clean_email = None
        if payload.email:
            clean_email = payload.email.strip().lower()
            cur.execute("""
                SELECT id FROM users
                WHERE LOWER(email) = %s AND id != %s AND (is_deleted IS NOT TRUE);
            """, (clean_email, valid_user_id))
            if cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f'An account with email "{clean_email}" is already registered. Email must be unique.'
                )

            cur.execute("SELECT id, client_code, company_name FROM organizations WHERE LOWER(email) = %s AND (is_deleted IS NOT TRUE);", (clean_email,))
            dup_org = cur.fetchone()
            if dup_org:
                is_same_org = target_org_id and str(dup_org[0]) == str(target_org_id)
                if not (is_same_org and target_role == "SITE_ADMIN"):
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="This email address is already registered to another client organization."
                    )
                if is_same_org and clean_email != target_current_email:
                    cur.execute("UPDATE organizations SET email = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s;", (clean_email, target_org_id))

        has_phone_update = "phone_number" in payload.model_fields_set
        clean_phone = payload.phone_number.strip() if payload.phone_number else None

        cur.execute("""
            UPDATE users
            SET first_name = COALESCE(%s, first_name),
                last_name = COALESCE(%s, last_name),
                email = COALESCE(%s, email),
                role = COALESCE(%s, role),
                phone_number = CASE WHEN %s IS TRUE THEN %s ELSE phone_number END,
                is_active = COALESCE(%s, is_active),
                updated_by = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING id, organization_id, email, first_name, last_name, role, phone_number, is_active, last_login_at, created_at, updated_at, created_by, updated_by, deleted_by;
        """, (
            payload.first_name.strip() if payload.first_name else None,
            payload.last_name.strip() if payload.last_name else None,
            clean_email,
            payload.role,
            has_phone_update,
            clean_phone,
            payload.is_active,
            current_user.get("id"),
            valid_user_id
        ))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

        cols = [desc[0] for desc in cur.description]
        d = dict(zip(cols, row))
        d["id"] = str(d["id"])
        if d.get("organization_id"):
            d["organization_id"] = str(d["organization_id"])
        if d.get("created_by"):
            d["created_by"] = str(d["created_by"])
        if d.get("updated_by"):
            d["updated_by"] = str(d["updated_by"])
        if d.get("deleted_by"):
            d["deleted_by"] = str(d["deleted_by"])

        if payload.is_active is False and d.get("role") == "SITE_ADMIN" and d.get("organization_id"):
            cur.execute("""
                UPDATE users
                SET is_active = FALSE,
                    updated_at = CURRENT_TIMESTAMP,
                    updated_by = %s
                WHERE organization_id = %s AND role = 'OPERATOR' AND (is_deleted IS NOT TRUE);
            """, (current_user.get("id"), d["organization_id"]))

        d["status"] = compute_user_status(d.get("is_active", True), d.get("last_login_at"))
        return UserResponse(**d)

@router.delete("/{user_id}")
def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    user_role = current_user.get("role")
    if user_role not in ["OEM_MANAGER", "SITE_ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only OEM Managers and Site Admins can remove team members."
        )

    valid_user_id = require_uuid_or_400(user_id, "user ID")
    if str(current_user.get("id")) == str(valid_user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Operation rejected: You cannot remove your currently active account."
        )

    with get_db_cursor(commit=True) as cur:
        cur.execute("SELECT id, organization_id, role, first_name, last_name, email FROM users WHERE id = %s AND (is_deleted IS NOT TRUE);", (valid_user_id,))
        target_user = cur.fetchone()
        if not target_user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

        if target_user[2] == "SITE_ADMIN":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Site Admin accounts cannot be deleted as they manage client operations."
            )

        if user_role == "SITE_ADMIN":
            site_admin_org = str(current_user.get("organization_id") or "")
            target_org = str(target_user[1] or "")
            if not site_admin_org or site_admin_org != target_org:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Cannot remove team members outside your organization.")
            if target_user[2] == "OEM_MANAGER":
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Cannot remove OEM Managers.")

        cur.execute("""
            UPDATE users
            SET is_deleted = TRUE,
                deleted_at = CURRENT_TIMESTAMP,
                deleted_by = %s,
                is_active = FALSE
            WHERE id = %s AND is_deleted IS NOT TRUE
            RETURNING id, email, first_name, last_name;
        """, (current_user.get("id"), valid_user_id))
        row = cur.fetchone()

        return {"message": "User removed successfully.", "id": str(row[0]), "email": row[1]}
