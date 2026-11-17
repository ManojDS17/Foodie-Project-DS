import secrets
from datetime import datetime, timedelta, timezone
from typing import List
from fastapi import APIRouter, HTTPException, status, Depends
from ..database import get_db_cursor
from ..schemas import UserCreate, UserUpdate, UserResponse
from ..auth import get_password_hash, get_current_user
from ..email_service import send_operator_welcome_email

router = APIRouter(prefix="/api/users", tags=["Users"], dependencies=[Depends(get_current_user)])

@router.get("", response_model=List[UserResponse])
def get_all_users(current_user: dict = Depends(get_current_user)):
    user_role = current_user.get("role")
    if user_role == "OPERATOR":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Users are hidden for operators."
        )

    with get_db_cursor() as cur:
        if user_role == "OEM_MANAGER":
            cur.execute("""
                SELECT u.id, u.organization_id, u.email, u.first_name, u.last_name, u.role, u.phone_number,
                       u.is_active, u.last_login_at, u.created_at, u.updated_at, u.created_by, u.updated_by, u.deleted_by,
                       o.company_name, o.client_code,
                       TRIM(CONCAT(cb.first_name, ' ', COALESCE(cb.last_name, ''))) as created_by_name
                FROM users u
                LEFT JOIN organizations o ON u.organization_id = o.id
                LEFT JOIN users cb ON u.created_by = cb.id
                WHERE u.is_deleted IS NOT TRUE
                ORDER BY u.first_name ASC;
            """)
        else:
            user_org_id = current_user.get("organization_id")
            if not user_org_id:
                return []
            cur.execute("""
                SELECT u.id, u.organization_id, u.email, u.first_name, u.last_name, u.role, u.phone_number,
                       u.is_active, u.last_login_at, u.created_at, u.updated_at, u.created_by, u.updated_by, u.deleted_by,
                       o.company_name, o.client_code,
                       TRIM(CONCAT(cb.first_name, ' ', COALESCE(cb.last_name, ''))) as created_by_name
                FROM users u
                LEFT JOIN organizations o ON u.organization_id = o.id
                LEFT JOIN users cb ON u.created_by = cb.id
                WHERE u.is_deleted IS NOT TRUE AND u.organization_id = %s
                ORDER BY u.first_name ASC;
            """, (user_org_id,))

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
            results.append(UserResponse(**d))
        return results

@router.get("/{user_id}", response_model=UserResponse)
def get_user_by_id(user_id: str, current_user: dict = Depends(get_current_user)):
    user_role = current_user.get("role")
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
        """, (user_id,))
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
            user_org_id = str(current_user.get("organization_id") or "")
            target_org_id = str(d.get("organization_id") or "")
            if not user_org_id or target_org_id != user_org_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

        return UserResponse(**d)

@router.post("/{user_id}/resend-invite")
def resend_invite(user_id: str, current_user: dict = Depends(get_current_user)):
    user_role = current_user.get("role")
    if user_role not in ("OEM_MANAGER", "SITE_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    with get_db_cursor(commit=True) as cur:
        cur.execute("SELECT id, organization_id, email, first_name, last_name, role FROM users WHERE id = %s AND (is_deleted IS NOT TRUE);", (user_id,))
        u = cur.fetchone()
        if not u:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

        if user_role == "SITE_ADMIN":
            if str(current_user.get("organization_id")) != str(u[1]):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

        welcome_token = secrets.token_urlsafe(32)
        welcome_token_expires = datetime.now(timezone.utc) + timedelta(days=7)

        cur.execute("""
            UPDATE users
            SET reset_token = %s,
                reset_token_expires_at = %s,
                updated_at = CURRENT_TIMESTAMP,
                updated_by = %s
            WHERE id = %s;
        """, (welcome_token, welcome_token_expires, current_user.get("id"), user_id))

        return {"message": f"Invitation link successfully resent to {u[2]}."}

@router.post("/{user_id}/reset-password")
def trigger_password_reset(user_id: str, current_user: dict = Depends(get_current_user)):
    user_role = current_user.get("role")
    if user_role not in ("OEM_MANAGER", "SITE_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    with get_db_cursor(commit=True) as cur:
        cur.execute("SELECT id, organization_id, email, first_name, last_name FROM users WHERE id = %s AND (is_deleted IS NOT TRUE);", (user_id,))
        u = cur.fetchone()
        if not u:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

        if user_role == "SITE_ADMIN":
            if str(current_user.get("organization_id")) != str(u[1]):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

        reset_token = secrets.token_urlsafe(32)
        reset_token_expires = datetime.now(timezone.utc) + timedelta(hours=24)

        cur.execute("""
            UPDATE users
            SET reset_token = %s,
                reset_token_expires_at = %s,
                updated_at = CURRENT_TIMESTAMP,
                updated_by = %s
            WHERE id = %s;
        """, (reset_token, reset_token_expires, current_user.get("id"), user_id))

        return {"message": f"Password reset instructions generated for {u[2]}."}

@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, current_user: dict = Depends(get_current_user)):
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

        raw_password = (payload.password or "").strip()
        if not raw_password:
            raw_password = "Password@123"
        pw_hash = get_password_hash(raw_password)

        if user_role != "OEM_MANAGER":
            org_id = current_user.get("organization_id")
        else:
            org_id = None if payload.role == "OEM_MANAGER" else payload.organization_id

        company_name = None
        client_code = None
        if org_id:
            cur.execute("SELECT company_name, client_code FROM organizations WHERE id = %s AND (is_deleted IS NOT TRUE);", (org_id,))
            org_row = cur.fetchone()
            if not org_row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Selected client organization was not found or is inactive."
                )
            company_name = org_row[0]
            client_code = org_row[1]

        welcome_token = secrets.token_urlsafe(32)
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
            welcome_token,
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
            cur.execute("""
                SELECT m.id, ml.location_label, ml.lease_start_date, ml.lease_end_date
                FROM machines m
                JOIN machine_leases ml ON m.id = ml.machine_id AND ml.lease_status = 'Active'
                WHERE m.organization_id = %s 
                  AND (m.is_deleted IS NOT TRUE);
            """, (org_id,))
            org_leased_machines = cur.fetchall()
            for lm in org_leased_machines:
                mach_id, loc, s_dt, e_dt = lm[0], lm[1], lm[2], lm[3]
                cur.execute("""
                    INSERT INTO machine_assign_to_operators (
                        organization_id, operator_id, machine_id,
                        start_date, end_date, location, created_by, assigned_by, status
                    ) VALUES (
                        %s, %s, %s,
                        %s, %s, %s, %s, %s, 'Active'
                    ) ON CONFLICT (operator_id, machine_id) DO UPDATE
                    SET status = 'Active',
                        start_date = EXCLUDED.start_date,
                        end_date = EXCLUDED.end_date,
                        location = COALESCE(EXCLUDED.location, machine_assign_to_operators.location),
                        revoked_at = NULL,
                        revoked_by = NULL,
                        updated_by = EXCLUDED.assigned_by,
                        updated_at = CURRENT_TIMESTAMP;
                """, (org_id, d["id"], mach_id, s_dt, e_dt, loc, current_user.get("id"), current_user.get("id")))

        if payload.role == "OPERATOR":
            poc_name = f"{payload.first_name.strip()} {(payload.last_name or '').strip()}".strip()
            try:
                send_operator_welcome_email(
                    to_email=normalized_email,
                    raw_password=raw_password,
                    company_name=company_name or "Assigned Client",
                    client_code=client_code or "",
                    recipient_name=poc_name,
                    reset_token=welcome_token
                )
            except Exception as e:
                print(f"[Operator Welcome Email Notice] Failed to dispatch welcome email: {e}")

        return UserResponse(**d)

@router.put("/{user_id}", response_model=UserResponse)
def update_user(user_id: str, payload: UserUpdate, current_user: dict = Depends(get_current_user)):
    if payload.role == "OEM_MANAGER" and current_user.get("role") != "OEM_MANAGER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Cannot elevate permissions to OEM_MANAGER."
        )

    with get_db_cursor(commit=True) as cur:
        if current_user.get("role") != "OEM_MANAGER":
            cur.execute("SELECT organization_id FROM users WHERE id = %s AND is_deleted IS NOT TRUE;", (user_id,))
            target_row = cur.fetchone()
            if not target_row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
            user_org_id = str(current_user.get("organization_id") or "")
            target_org_id = str(target_row[0] or "")
            if not user_org_id or target_org_id != user_org_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: Cannot modify users of another organization."
                )

        clean_email = None
        if payload.email:
            clean_email = payload.email.strip().lower()
            cur.execute("""
                SELECT id FROM users
                WHERE LOWER(email) = %s AND id != %s AND (is_deleted IS NOT TRUE);
            """, (clean_email, user_id))
            if cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f'An account with email "{clean_email}" is already registered. Email must be unique.'
                )

        cur.execute("""
            UPDATE users
            SET first_name = COALESCE(%s, first_name),
                last_name = COALESCE(%s, last_name),
                email = COALESCE(%s, email),
                role = COALESCE(%s, role),
                phone_number = %s,
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
            payload.phone_number.strip() if payload.phone_number else None,
            payload.is_active,
            current_user.get("id"),
            user_id
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
        return UserResponse(**d)

@router.delete("/{user_id}")
def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    user_role = current_user.get("role")
    if user_role not in ["OEM_MANAGER", "SITE_ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only OEM Managers and Site Admins can remove team members."
        )

    if str(current_user.get("id")) == str(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Operation rejected: You cannot remove your currently active account."
        )

    with get_db_cursor(commit=True) as cur:
        cur.execute("SELECT id, organization_id, role, first_name, last_name, email FROM users WHERE id = %s AND (is_deleted IS NOT TRUE);", (user_id,))
        target_user = cur.fetchone()
        if not target_user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

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
        """, (current_user.get("id"), user_id))
        row = cur.fetchone()

        return {"message": "User removed successfully.", "id": str(row[0]), "email": row[1]}
