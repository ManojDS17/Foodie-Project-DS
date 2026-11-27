from datetime import datetime, timedelta, timezone
import secrets
import re
from typing import List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, status
import psycopg2
from ..database import (
    get_db_cursor,
    parse_iso_date_or_400,
    resolve_lease_dates,
    sync_active_operators_for_machine,
)
from ..schemas import OrganizationCreate, OrganizationUpdate, OrganizationResponse, BulkDeleteRequest
from ..auth import get_current_user, get_password_hash, hash_reset_token
from ..email_service import dispatch_email_in_background, send_client_welcome_email

router = APIRouter(prefix="/api/organizations", tags=["Organizations"], dependencies=[Depends(get_current_user)])


def _compute_next_client_code(cur) -> str:
    """Compute the next sequential client code in CL-0001+ series across all rows."""
    cur.execute("SELECT client_code FROM organizations;")
    rows = cur.fetchall()
    nums = set()
    for (code,) in rows:
        if not code:
            continue
        m = re.match(r'^CL-(\d+)', code.strip(), re.IGNORECASE)
        if m:
            try:
                nums.add(int(m.group(1)))
            except ValueError:
                continue
    next_num = max(nums) + 1 if nums else 1
    return f"CL-{next_num:04d}"


@router.get("/next-code")
def get_next_client_code():
    """Calculates the next sequential client code in CL-0001 series, preserving series order and never reusing any deleted or existing client ID."""
    with get_db_cursor() as cur:
        return {"next_code": _compute_next_client_code(cur)}

@router.get("", response_model=List[OrganizationResponse])
def get_organizations(
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
            detail="Access denied: Organizations are hidden for operators."
        )

    where_clauses = ["o.is_deleted IS NOT TRUE"]
    params: list = []

    if user_role != "OEM_MANAGER":
        user_org_id = current_user.get("organization_id")
        if not user_org_id:
            response.headers["X-Total-Count"] = "0"
            return []
        where_clauses.append("o.id = %s")
        params.append(user_org_id)

    search_term = search.strip() if search and search.strip() else None
    if search_term:
        pattern = f"%{search_term}%"
        where_clauses.append(
            "(o.company_name ILIKE %s OR o.client_code ILIKE %s OR COALESCE(o.contact_poc, '') ILIKE %s OR COALESCE(o.email, '') ILIKE %s)"
        )
        params.extend([pattern, pattern, pattern, pattern])

    where_sql = " AND ".join(where_clauses)

    with get_db_cursor() as cur:
        cur.execute(f"SELECT COUNT(*) FROM organizations o WHERE {where_sql};", tuple(params))
        total_count = cur.fetchone()[0]
        response.headers["X-Total-Count"] = str(total_count)

        query = f"""
            SELECT o.*,
                   COALESCE((SELECT count(*) FROM machines m WHERE m.organization_id = o.id AND (m.is_deleted IS NOT TRUE)), 0) AS total_machines
            FROM organizations o
            WHERE {where_sql}
            ORDER BY o.created_at DESC, o.client_code DESC
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
            if d.get("created_by"):
                d["created_by"] = str(d["created_by"])
            if d.get("updated_by"):
                d["updated_by"] = str(d["updated_by"])
            if d.get("deleted_by"):
                d["deleted_by"] = str(d["deleted_by"])
            if d.get("onboarding_date"):
                d["onboarding_date"] = str(d["onboarding_date"])
            results.append(OrganizationResponse(**d))
        return results

@router.get("/{org_id}", response_model=OrganizationResponse)
def get_organization(org_id: str, current_user: dict = Depends(get_current_user)):
    user_role = current_user.get("role")
    if user_role == "OPERATOR":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Organizations are hidden for operators.")

    with get_db_cursor() as cur:
        cur.execute("""
            SELECT o.*,
                   COALESCE((SELECT count(*) FROM machines m WHERE m.organization_id = o.id AND (m.is_deleted IS NOT TRUE)), 0) AS total_machines
            FROM organizations o
            WHERE (o.id::text = %s OR UPPER(o.client_code) = UPPER(%s)) AND o.is_deleted IS NOT TRUE;
        """, (org_id, org_id))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Client organization '{org_id}' not found.")
        cols = [desc[0] for desc in cur.description]
        d = dict(zip(cols, row))
        d["id"] = str(d["id"])

        if user_role != "OEM_MANAGER" and str(current_user.get("organization_id")) != d["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not have permission to access another client's organization."
            )

        if d.get("created_by"):
            d["created_by"] = str(d["created_by"])
        if d.get("updated_by"):
            d["updated_by"] = str(d["updated_by"])
        if d.get("deleted_by"):
            d["deleted_by"] = str(d["deleted_by"])
        if d.get("onboarding_date"):
            d["onboarding_date"] = str(d["onboarding_date"])
        return OrganizationResponse(**d)

@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
def create_organization(payload: OrganizationCreate, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "OEM_MANAGER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only OEM Managers can register new client organizations."
        )
    requested_code = (payload.client_code or "").strip().upper()
    company = payload.company_name.strip()

    # Safe date sanitization (rejects invalid dates cleanly with 400)
    parsed_onboarding = parse_iso_date_or_400(payload.onboarding_date, "Onboarding date")
    onboarding_d = parsed_onboarding.strftime("%Y-%m-%d") if parsed_onboarding else None
    pending_welcome_email = None

    with get_db_cursor(commit=True) as cur:
        cur.execute("SELECT pg_advisory_xact_lock(hashtext('organizations_next_code'));")
        code = requested_code or _compute_next_client_code(cur)

        # Check uniqueness of client_code across all records (including archived/deleted)
        cur.execute("SELECT id, is_deleted FROM organizations WHERE UPPER(client_code) = %s;", (code,))
        row = cur.fetchone()
        if row:
            if row[1]:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Client ID '{code}' was previously assigned to an archived client and cannot be reused. Please use the next sequential code."
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Client Code '{code}' is already registered."
                )

        # Check uniqueness of company_name
        cur.execute("SELECT id FROM organizations WHERE LOWER(company_name) = %s AND is_deleted IS NOT TRUE;", (company.lower(),))
        if cur.fetchone():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Company name '{company}' is already registered.")

        # Check uniqueness of Tax ID (ABN) across active organizations
        if payload.tax_id and payload.tax_id.strip():
            raw_abn_digits = re.sub(r'\D', '', payload.tax_id.strip())
            if raw_abn_digits:
                cur.execute("""
                    SELECT id, client_code, company_name 
                    FROM organizations 
                    WHERE REGEXP_REPLACE(tax_id, '[^0-9]', '', 'g') = %s 
                      AND (is_deleted IS NOT TRUE);
                """, (raw_abn_digits,))
                dup_abn = cur.fetchone()
                if dup_abn:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="This Tax ID (ABN) is already registered to another client organization."
                    )

        # Check uniqueness of email across organizations and users
        if payload.email and payload.email.strip():
            clean_email = payload.email.strip().lower()
            cur.execute("""
                SELECT id, client_code, company_name, is_deleted 
                FROM organizations 
                WHERE LOWER(email) = %s;
            """, (clean_email,))
            dup_org = cur.fetchone()
            if dup_org:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="This email address is already registered to another client organization."
                )

            cur.execute("SELECT id, email, is_deleted FROM users WHERE LOWER(email) = %s AND (is_deleted IS NOT TRUE);", (clean_email,))
            dup_user = cur.fetchone()
            if dup_user:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"An account with email '{clean_email}' is already registered. Email must be unique."
                )

        billing_addr = payload.billing_address.strip() if payload.billing_address else None
        if not billing_addr:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please enter the billing address."
            )

        raw_shipping = payload.shipping_address.strip() if payload.shipping_address else None
        shipping_addr = None
        if raw_shipping and raw_shipping.lower() not in ('same as billing', 'same as billing address'):
            shipping_addr = raw_shipping

        try:
            cur.execute("""
                INSERT INTO organizations (
                    client_code, company_name, business_type, status, onboarding_date, tax_id, contact_poc, email, phone_number,
                    website, billing_address, shipping_address, payment_terms, comms_preference, is_active,
                    created_by
                ) VALUES (
                    %s, %s, %s, %s, COALESCE(%s::DATE, CURRENT_DATE), %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s
                ) RETURNING *;
            """, (
                code,
                company,
                payload.business_type or 'Corporate',
                payload.status or 'Active',
                onboarding_d,
                payload.tax_id.strip() if payload.tax_id else None,
                payload.contact_poc.strip() if payload.contact_poc else None,
                payload.email.strip() if payload.email else None,
                payload.phone_number.strip() if payload.phone_number else None,
                payload.website.strip() if payload.website else None,
                billing_addr,
                shipping_addr,
                payload.payment_terms or '30 days',
                payload.comms_preference or 'Email',
                payload.is_active if payload.is_active is not None else True,
                current_user.get("id")
            ))
        except psycopg2.IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Client code or organization identifier conflicts with an existing organization record.",
            ) from exc

        row = cur.fetchone()
        cols = [desc[0] for desc in cur.description]
        d = dict(zip(cols, row))
        new_org_id = str(d["id"])
        d["id"] = new_org_id
        if d.get("created_by"):
            d["created_by"] = str(d["created_by"])
        if d.get("updated_by"):
            d["updated_by"] = str(d["updated_by"])
        if d.get("deleted_by"):
            d["deleted_by"] = str(d["deleted_by"])
        if d.get("onboarding_date"):
            d["onboarding_date"] = str(d["onboarding_date"])

        # Automatically create a fresh client login user account (never resurrect soft-deleted users)
        if payload.email and payload.email.strip():
            clean_email = payload.email.strip().lower()

            raw_password = (payload.password or "").strip()
            if not raw_password:
                raw_password = f"Pte@{secrets.token_hex(4)}!26"
            pw_hash = get_password_hash(raw_password)

            poc_name = (payload.contact_poc or payload.company_name or "Client Admin").strip()
            name_parts = poc_name.split(maxsplit=1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ""

            welcome_token = secrets.token_urlsafe(32)
            welcome_token_hash = hash_reset_token(welcome_token)
            welcome_token_expires = datetime.now(timezone.utc) + timedelta(days=7)

            cur.execute("""
                INSERT INTO users (
                    organization_id, email, password_hash, first_name, last_name, role, phone_number, is_active,
                    reset_token, reset_token_expires_at, created_by
                ) VALUES (
                    %s, %s, %s, %s, %s, 'SITE_ADMIN', %s, TRUE,
                    %s, %s, %s
                );
            """, (
                new_org_id,
                clean_email,
                pw_hash,
                first_name,
                last_name,
                payload.phone_number.strip() if payload.phone_number else None,
                welcome_token_hash,
                welcome_token_expires,
                current_user.get("id")
            ))

            pending_welcome_email = {
                "to_email": clean_email,
                "company_name": company,
                "client_code": code,
                "recipient_name": poc_name,
                "reset_token": welcome_token,
            }

        # Validate availability and assign machines atomically without overwriting prior leases
        if payload.assigned_machines:
            seen_machine_ids = set()
            for m in payload.assigned_machines:
                m_ident = (m.machine_id or "").strip()
                if not m_ident:
                    continue
                loc = m.location.strip() if m.location and m.location.strip() else None
                l_start_str, l_end_str = resolve_lease_dates(
                    m.lease_start_date,
                    m.lease_end_date,
                    default_start_today=True,
                    default_end_one_year=True,
                )

                cur.execute(
                    """
                    SELECT id, machine_code, serial_number, organization_id, is_deleted, is_active
                    FROM machines
                    WHERE id::text = %s OR UPPER(machine_code) = UPPER(%s) OR UPPER(serial_number) = UPPER(%s)
                    FOR UPDATE;
                    """,
                    (m_ident, m_ident, m_ident),
                )
                m_row = cur.fetchone()
                if not m_row:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Machine '{m_ident}' was not found.",
                    )

                mach_uuid = str(m_row[0])
                m_code = m_row[1] or m_row[2] or m_ident
                current_owner_id = m_row[3]
                is_mach_deleted = bool(m_row[4])
                is_mach_active = True if m_row[5] is None else bool(m_row[5])

                if mach_uuid in seen_machine_ids:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Machine '{m_code}' was selected more than once.",
                    )
                seen_machine_ids.add(mach_uuid)

                if is_mach_deleted:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Machine '{m_code}' is deleted/archived and cannot be leased.",
                    )
                if not is_mach_active:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Machine '{m_code}' is inactive and cannot be leased.",
                    )
                if current_owner_id is not None:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Machine '{m_code}' is already assigned to another client. Terminate its current lease before reassigning.",
                    )

                cur.execute(
                    """
                    SELECT id FROM machine_leases
                    WHERE machine_id = %s AND lease_status = 'Active'
                    FOR UPDATE;
                    """,
                    (mach_uuid,),
                )
                if cur.fetchone():
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Machine '{m_code}' already has an active lease record. Terminate the existing lease before reassigning.",
                    )

                cur.execute(
                    """
                    UPDATE machines
                    SET organization_id = %s,
                        updated_by = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                      AND organization_id IS NULL
                      AND (is_deleted IS NOT TRUE)
                      AND COALESCE(is_active, TRUE) IS TRUE;
                    """,
                    (new_org_id, current_user.get("id"), mach_uuid),
                )
                if cur.rowcount != 1:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Machine '{m_code}' is no longer available for onboarding.",
                    )

                lease_ref = f"LSE-{code}-{mach_uuid[:8]}"
                cur.execute(
                    """
                    INSERT INTO machine_leases (
                        machine_id, organization_id, location_label,
                        lease_start_date, lease_end_date, lease_status, lease_reference,
                        created_by, assigned_by, assigned_at
                    ) VALUES (
                        %s, %s, %s,
                        %s::DATE, %s::DATE, 'Active', %s,
                        %s, %s, CURRENT_TIMESTAMP
                    );
                    """,
                    (
                        mach_uuid,
                        new_org_id,
                        loc,
                        l_start_str,
                        l_end_str,
                        lease_ref,
                        current_user.get("id"),
                        current_user.get("id"),
                    ),
                )

                sync_active_operators_for_machine(
                    cur,
                    organization_id=new_org_id,
                    machine_id=mach_uuid,
                    start_date=l_start_str,
                    end_date=l_end_str,
                    location=loc,
                    actor_user_id=current_user.get("id"),
                )

    if pending_welcome_email:
        background_tasks.add_task(
            dispatch_email_in_background,
            send_client_welcome_email,
            "Client Welcome Email",
            **pending_welcome_email,
        )

    return OrganizationResponse(**d)

@router.put("/{org_id}", response_model=OrganizationResponse)
def update_organization(org_id: str, payload: OrganizationUpdate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "OEM_MANAGER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only OEM Managers can modify client organization details or billing terms."
        )

    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields provided for update.")

    if 'billing_address' in update_data and (not update_data['billing_address'] or not str(update_data['billing_address']).strip()):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please enter the billing address.")

    if 'shipping_address' in update_data:
        raw_ship = update_data['shipping_address']
        if raw_ship and str(raw_ship).strip().lower() in ('same as billing', 'same as billing address'):
            update_data['shipping_address'] = None

    with get_db_cursor(commit=True) as cur:
        cur.execute(
            "SELECT id FROM organizations WHERE (id::text = %s OR UPPER(client_code) = UPPER(%s)) AND is_deleted IS NOT TRUE;",
            (org_id, org_id)
        )
        existing = cur.fetchone()
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Client organization '{org_id}' not found.")
        real_org_id = str(existing[0])

        set_clauses = []
        params = []
        for k, v in update_data.items():
            if k == 'onboarding_date':
                parsed_d = parse_iso_date_or_400(v, "Onboarding date")
                if not parsed_d:
                    set_clauses.append("onboarding_date = NULL")
                else:
                    set_clauses.append("onboarding_date = %s::DATE")
                    params.append(parsed_d.strftime("%Y-%m-%d"))
            else:
                set_clauses.append(f"{k} = %s")
                params.append(v)
        set_clauses.append("updated_by = %s")
        params.append(current_user.get("id"))
        params.append(real_org_id)

        # Check uniqueness of company_name if updated
        if 'company_name' in update_data and update_data['company_name']:
            comp_name = str(update_data['company_name']).strip()
            cur.execute("SELECT id FROM organizations WHERE LOWER(company_name) = %s AND id != %s AND is_deleted IS NOT TRUE;", (comp_name.lower(), real_org_id))
            if cur.fetchone():
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Company name '{comp_name}' is already registered.")

        # Check uniqueness of Tax ID (ABN) across active organizations if updated
        if 'tax_id' in update_data and update_data['tax_id']:
            raw_abn_digits = re.sub(r'\D', '', str(update_data['tax_id']).strip())
            if raw_abn_digits:
                cur.execute("""
                    SELECT id, client_code, company_name 
                    FROM organizations 
                    WHERE REGEXP_REPLACE(tax_id, '[^0-9]', '', 'g') = %s 
                      AND id != %s 
                      AND (is_deleted IS NOT TRUE);
                """, (raw_abn_digits, real_org_id))
                dup_abn = cur.fetchone()
                if dup_abn:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="This Tax ID (ABN) is already registered to another client organization."
                    )

        # Check uniqueness of email across organizations and users if updated
        if 'email' in update_data and update_data['email']:
            clean_email = str(update_data['email']).strip().lower()
            cur.execute("""
                SELECT id, client_code, company_name 
                FROM organizations 
                WHERE LOWER(email) = %s AND id != %s AND (is_deleted IS NOT TRUE);
            """, (clean_email, real_org_id))
            dup_org = cur.fetchone()
            if dup_org:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="This email address is already registered to another client organization."
                )

            cur.execute("""
                SELECT id FROM users 
                WHERE LOWER(email) = %s AND (organization_id IS NULL OR organization_id != %s) AND (is_deleted IS NOT TRUE);
            """, (clean_email, real_org_id))
            dup_user = cur.fetchone()
            if dup_user:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"An account with email '{clean_email}' is already registered. Email must be unique."
                )

        is_becoming_inactive = (
            ('is_active' in update_data and update_data['is_active'] is False) or
            ('status' in update_data and str(update_data['status']).lower() in ('inactive', 'archived'))
        )
        if is_becoming_inactive:
            cur.execute("SELECT COUNT(*) FROM machines WHERE organization_id = %s AND (is_deleted IS NOT TRUE);", (real_org_id,))
            mach_count = cur.fetchone()[0]
            if mach_count > 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot deactivate client: This client still has {mach_count} active machine(s) assigned. Please terminate all machine leases before deactivating the client."
                )

            # Separate org suspension from individual user disablement: revoke active JWTs without mutating per-user is_active
            cur.execute("""
                UPDATE users
                SET token_version = token_version + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE organization_id = %s AND (is_deleted IS NOT TRUE);
            """, (real_org_id,))

        cur.execute(f"""
            UPDATE organizations
            SET {', '.join(set_clauses)}, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING *;
        """, tuple(params))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client organization not found.")
        cols = [desc[0] for desc in cur.description]
        d = dict(zip(cols, row))
        d["id"] = str(d["id"])
        if d.get("created_by"):
            d["created_by"] = str(d["created_by"])
        if d.get("updated_by"):
            d["updated_by"] = str(d["updated_by"])
        if d.get("deleted_by"):
            d["deleted_by"] = str(d["deleted_by"])
        if d.get("onboarding_date"):
            d["onboarding_date"] = str(d["onboarding_date"])
        return OrganizationResponse(**d)

@router.delete("/{org_id}", status_code=status.HTTP_200_OK)
def delete_organization(org_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "OEM_MANAGER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only OEM Managers can delete client organizations."
        )
    with get_db_cursor(commit=True) as cur:
        cur.execute(
            "SELECT id FROM organizations WHERE (id::text = %s OR UPPER(client_code) = UPPER(%s)) AND is_deleted IS NOT TRUE;",
            (org_id, org_id)
        )
        existing = cur.fetchone()
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Client organization '{org_id}' not found.")
        real_org_id = str(existing[0])

        cur.execute("""
            SELECT count(*) FROM machines
            WHERE organization_id = %s AND (is_deleted IS NOT TRUE);
        """, (real_org_id,))
        assigned_machines_count = cur.fetchone()[0]
        if assigned_machines_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete client: {assigned_machines_count} machine(s) are currently assigned to this client. Please unassign all machines first."
            )

        cur.execute("""
            UPDATE users
            SET is_active = FALSE,
                is_deleted = TRUE,
                deleted_at = CURRENT_TIMESTAMP,
                deleted_by = %s,
                token_version = token_version + 1
            WHERE organization_id = %s AND (is_deleted IS NOT TRUE);
        """, (current_user.get("id"), real_org_id))

        cur.execute("""
            UPDATE organizations
            SET is_deleted = TRUE,
                deleted_at = CURRENT_TIMESTAMP,
                deleted_by = %s,
                is_active = FALSE,
                status = 'Archived'
            WHERE id = %s;
        """, (current_user.get("id"), real_org_id))
        return {"success": True, "message": "Client organization deleted successfully.", "id": real_org_id}

@router.post("/bulk-delete", status_code=status.HTTP_200_OK)
def bulk_delete_organizations(payload: BulkDeleteRequest, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "OEM_MANAGER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only OEM Managers can perform bulk deletion."
        )
    if not payload.ids:
        return {"message": "No organizations provided", "deleted_count": 0}
    with get_db_cursor(commit=True) as cur:
        cur.execute("""
            SELECT o.company_name, count(m.id)
            FROM organizations o
            JOIN machines m ON m.organization_id = o.id AND (m.is_deleted IS NOT TRUE)
            WHERE o.id::text = ANY(%s) AND (o.is_deleted IS NOT TRUE)
            GROUP BY o.company_name;
        """, (payload.ids,))
        blocked = cur.fetchall()
        if blocked:
            names = ", ".join([f"{b[0]} ({b[1]} machine{'s' if b[1] != 1 else ''})" for b in blocked])
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete clients with assigned machines: {names}. Please unassign all machines first."
            )

        cur.execute("""
            UPDATE users
            SET is_active = FALSE,
                is_deleted = TRUE,
                deleted_at = CURRENT_TIMESTAMP,
                deleted_by = %s,
                token_version = token_version + 1
            WHERE organization_id::text = ANY(%s) AND (is_deleted IS NOT TRUE);
        """, (current_user.get("id"), payload.ids))

        cur.execute("""
            UPDATE organizations
            SET is_deleted = TRUE,
                deleted_at = CURRENT_TIMESTAMP,
                deleted_by = %s,
                is_active = FALSE,
                status = 'Archived'
            WHERE id::text = ANY(%s)
            RETURNING id;
        """, (current_user.get("id"), payload.ids))
        deleted_ids = [str(r[0]) for r in cur.fetchall()]
        return {"message": f"Successfully deleted {len(deleted_ids)} client(s).", "deleted_ids": deleted_ids}

