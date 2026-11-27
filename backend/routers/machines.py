from datetime import date
import re
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
import psycopg2
from ..database import (
    calculate_one_year_end_date,
    get_db_cursor,
    parse_iso_date_or_400,
    parse_uuid_or_400,
    require_uuid_or_400,
    resolve_lease_dates,
    sync_active_operators_for_machine,
    upsert_operator_machine_assignment,
)
from ..schemas import (
    MachineCreate,
    MachineUpdate,
    MachineResponse,
    MachineModelResponse,
    TerminateLeaseRequest,
    OperatorMachineAssignmentCreate,
    OperatorMachineAssignmentResponse,
)
from ..auth import get_current_user

router = APIRouter(prefix="/api/machines", tags=["Machines"], dependencies=[Depends(get_current_user)])

SQL_SELECT_MACHINE_JOINED = """
    SELECT 
        m.id, m.machine_code, m.serial_number, m.model_id, m.model, m.capacity, m.hardware_version,
        m.organization_id, o.client_code, o.company_name,
        m.location_label, m.location_description,
        ml.location_label AS lease_location_label,
        m.plc_software_version, m.energy_meter_model, m.deodor_model, m.extractor_model,
        COALESCE(m.has_stairs, false) AS has_stairs, m.notes,
        TO_CHAR(ml.lease_start_date, 'YYYY-MM-DD') AS lease_start_date,
        TO_CHAR(ml.lease_end_date, 'YYYY-MM-DD') AS lease_end_date,
        COALESCE(ml.lease_status, 'Available') AS lease_status,
        ml.lease_reference,
        m.connectivity_status, 
        COALESCE(m.operational_status, 'Idle') AS operational_status, m.is_active,
        m.created_by, m.updated_by, m.deleted_by,
        m.created_at, m.updated_at
    FROM machines m
    LEFT JOIN organizations o ON m.organization_id = o.id
    LEFT JOIN machine_leases ml ON m.id = ml.machine_id AND ml.lease_status = 'Active' AND (m.organization_id IS NULL OR ml.organization_id = m.organization_id)
"""

def row_to_machine_dict(cols, row) -> dict:
    d = dict(zip(cols, row))
    d["id"] = str(d["id"])
    if d.get("model_id"):
        d["model_id"] = str(d["model_id"])
    if d.get("organization_id"):
        d["organization_id"] = str(d["organization_id"])
    if d.get("created_by"):
        d["created_by"] = str(d["created_by"])
    if d.get("updated_by"):
        d["updated_by"] = str(d["updated_by"])
    if d.get("deleted_by"):
        d["deleted_by"] = str(d["deleted_by"])
    return d


def _compute_next_machine_code(cur) -> str:
    """Compute the next sequential machine code in C001+ series across all rows."""
    cur.execute("SELECT machine_code, serial_number FROM machines;")
    rows = cur.fetchall()
    nums = set()
    for m_code, s_num in rows:
        for val in (m_code, s_num):
            if not val:
                continue
            m = re.match(r'^C(\d+)', val.strip(), re.IGNORECASE)
            if m:
                try:
                    nums.add(int(m.group(1)))
                except ValueError:
                    continue
    next_num = max(nums) + 1 if nums else 1
    return f"C{next_num:03d}"


@router.get("/next-code")
def get_next_machine_code():
    """Calculates the next sequential machine code in C001 series, preserving series order and never reusing any deleted or existing machine ID."""
    with get_db_cursor() as cur:
        return {"next_code": _compute_next_machine_code(cur)}

@router.get("/models", response_model=List[MachineModelResponse])
def get_machine_models():
    """Fetch all machine models dynamically in standard series order (F25, F100, F500, F1000)."""
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT id, model_code, display_name, capacity, is_active 
            FROM machine_models 
            ORDER BY 
                CASE model_code
                    WHEN 'F25' THEN 1
                    WHEN 'F100' THEN 2
                    WHEN 'F500' THEN 3
                    WHEN 'F1000' THEN 4
                    ELSE 5
                END ASC, 
                model_code ASC;
        """)
        rows = cur.fetchall()
        cols = [desc[0] for desc in cur.description]
        return [MachineModelResponse(**{**dict(zip(cols, r)), "id": str(r[0])}) for r in rows]

@router.get("", response_model=List[MachineResponse])
def get_all_machines(
    response: Response,
    skip: int = Query(0, ge=0),
    limit: Optional[int] = Query(None, ge=1, le=500),
    search: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    user_role = current_user.get("role")
    where_clauses = ["(m.is_deleted IS NOT TRUE)"]
    params: list = []

    search_term = search.strip() if search and search.strip() else None
    if search_term:
        pattern = f"%{search_term}%"
        where_clauses.append(
            "(m.machine_code ILIKE %s OR m.serial_number ILIKE %s OR m.model ILIKE %s OR COALESCE(o.company_name, '') ILIKE %s OR COALESCE(m.location_label, '') ILIKE %s)"
        )
        params.extend([pattern, pattern, pattern, pattern, pattern])

    pagination_sql = ""
    pagination_params: list = []
    if limit is not None:
        pagination_sql = " LIMIT %s OFFSET %s"
        pagination_params = [limit, skip]
    elif skip > 0:
        pagination_sql = " OFFSET %s"
        pagination_params = [skip]

    with get_db_cursor() as cur:
        if user_role == "OEM_MANAGER":
            where_sql = " AND ".join(where_clauses)
            cur.execute(
                f"SELECT COUNT(*) FROM machines m LEFT JOIN organizations o ON m.organization_id = o.id WHERE {where_sql};",
                tuple(params),
            )
            response.headers["X-Total-Count"] = str(cur.fetchone()[0])
            cur.execute(
                f"{SQL_SELECT_MACHINE_JOINED} WHERE {where_sql} ORDER BY m.created_at DESC, m.machine_code DESC{pagination_sql};",
                tuple(params + pagination_params),
            )
        elif user_role == "OPERATOR":
            user_org_id = current_user.get("organization_id")
            if not user_org_id:
                response.headers["X-Total-Count"] = "0"
                return []
            where_sql = " AND ".join(where_clauses + ["m.organization_id = %s"])
            op_params = [current_user.get("id")] + params + [user_org_id]
            cur.execute(
                f"""
                SELECT COUNT(*)
                FROM machines m
                JOIN organizations o
                  ON m.organization_id = o.id
                 AND (o.is_deleted IS NOT TRUE)
                 AND COALESCE(o.is_active, TRUE) IS TRUE
                 AND LOWER(COALESCE(o.status, 'active')) NOT IN ('inactive', 'archived')
                JOIN machine_leases ml
                  ON m.id = ml.machine_id
                 AND ml.organization_id = m.organization_id
                 AND ml.lease_status = 'Active'
                JOIN machine_assign_to_operators mato
                  ON m.id = mato.machine_id
                 AND mato.organization_id = m.organization_id
                 AND mato.operator_id = %s
                 AND mato.status = 'Active'
                WHERE {where_sql};
                """,
                tuple(op_params),
            )
            response.headers["X-Total-Count"] = str(cur.fetchone()[0])
            cur.execute(
                f"""
                SELECT 
                    m.id, m.machine_code, m.serial_number, m.model_id, m.model, m.capacity, m.hardware_version,
                    m.organization_id, o.client_code, o.company_name,
                    m.location_label, m.location_description,
                    COALESCE(ml.location_label, mato.location) AS lease_location_label,
                    m.plc_software_version, m.energy_meter_model, m.deodor_model, m.extractor_model,
                    COALESCE(m.has_stairs, false) AS has_stairs, m.notes,
                    TO_CHAR(ml.lease_start_date, 'YYYY-MM-DD') AS lease_start_date,
                    TO_CHAR(ml.lease_end_date, 'YYYY-MM-DD') AS lease_end_date,
                    COALESCE(ml.lease_status, 'Available') AS lease_status,
                    ml.lease_reference,
                    m.connectivity_status, 
                    COALESCE(m.operational_status, 'Idle') AS operational_status, m.is_active,
                    m.created_by, m.updated_by, m.deleted_by,
                    m.created_at, m.updated_at
                FROM machines m
                JOIN organizations o
                  ON m.organization_id = o.id
                 AND (o.is_deleted IS NOT TRUE)
                 AND COALESCE(o.is_active, TRUE) IS TRUE
                 AND LOWER(COALESCE(o.status, 'active')) NOT IN ('inactive', 'archived')
                JOIN machine_leases ml
                  ON m.id = ml.machine_id
                 AND ml.organization_id = m.organization_id
                 AND ml.lease_status = 'Active'
                JOIN machine_assign_to_operators mato 
                  ON m.id = mato.machine_id 
                 AND mato.organization_id = m.organization_id
                 AND mato.operator_id = %s 
                 AND mato.status = 'Active'
                WHERE {where_sql}
                ORDER BY m.created_at DESC, m.machine_code DESC{pagination_sql};
                """,
                tuple(op_params + pagination_params),
            )
        else:
            user_org_id = current_user.get("organization_id")
            if not user_org_id:
                response.headers["X-Total-Count"] = "0"
                return []
            org_where = " AND ".join(where_clauses + ["m.organization_id = %s"])
            org_params = params + [user_org_id]
            cur.execute(
                f"SELECT COUNT(*) FROM machines m LEFT JOIN organizations o ON m.organization_id = o.id WHERE {org_where};",
                tuple(org_params),
            )
            response.headers["X-Total-Count"] = str(cur.fetchone()[0])
            cur.execute(
                f"{SQL_SELECT_MACHINE_JOINED} WHERE {org_where} ORDER BY m.created_at DESC, m.machine_code DESC{pagination_sql};",
                tuple(org_params + pagination_params),
            )
        rows = cur.fetchall()
        cols = [desc[0] for desc in cur.description]
        return [MachineResponse(**row_to_machine_dict(cols, r)) for r in rows]

@router.get("/operator-assignments", response_model=List[OperatorMachineAssignmentResponse])
def get_operator_machine_assignments(
    organization_id: Optional[str] = None,
    operator_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    valid_org_filter = parse_uuid_or_400(organization_id, "organization ID")
    valid_op_filter = parse_uuid_or_400(operator_id, "operator ID")
    user_role = current_user.get("role")
    with get_db_cursor() as cur:
        query = """
            SELECT 
                mato.id, mato.organization_id, mato.operator_id,
                TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))) AS operator_name,
                u.email AS operator_email,
                mato.machine_id, m.machine_code, m.serial_number, m.model,
                TO_CHAR(mato.start_date, 'YYYY-MM-DD') AS start_date,
                TO_CHAR(mato.end_date, 'YYYY-MM-DD') AS end_date,
                COALESCE(mato.location, ml.location_label) AS location,
                mato.created_by, mato.assigned_by, mato.assigned_at,
                mato.updated_by, mato.updated_at,
                mato.revoked_by, mato.revoked_at,
                mato.status, mato.created_at
            FROM machine_assign_to_operators mato
            JOIN users u ON mato.operator_id = u.id AND (u.is_deleted IS NOT TRUE)
            JOIN machines m ON mato.machine_id = m.id AND (m.is_deleted IS NOT TRUE)
            LEFT JOIN machine_leases ml ON m.id = ml.machine_id AND ml.lease_status = 'Active' AND ml.organization_id = mato.organization_id
            WHERE 1=1
        """
        params = []

        if user_role == "OPERATOR":
            user_org_id = current_user.get("organization_id")
            if not user_org_id:
                return []
            query += " AND mato.operator_id = %s AND mato.organization_id = %s AND m.organization_id = mato.organization_id"
            params.extend([current_user.get("id"), user_org_id])
        elif user_role != "OEM_MANAGER":
            user_org_id = current_user.get("organization_id")
            if not user_org_id:
                return []
            query += " AND mato.organization_id = %s"
            params.append(user_org_id)
            if valid_op_filter:
                query += " AND mato.operator_id = %s"
                params.append(valid_op_filter)
        elif valid_org_filter:
            query += " AND mato.organization_id = %s"
            params.append(valid_org_filter)
            if valid_op_filter:
                query += " AND mato.operator_id = %s"
                params.append(valid_op_filter)
        elif valid_op_filter:
            query += " AND mato.operator_id = %s"
            params.append(valid_op_filter)

        query += " ORDER BY mato.created_at DESC;"
        cur.execute(query, tuple(params))
        rows = cur.fetchall()
        cols = [desc[0] for desc in cur.description]
        result = []
        for r in rows:
            d = dict(zip(cols, r))
            d["id"] = str(d["id"])
            d["organization_id"] = str(d["organization_id"])
            d["operator_id"] = str(d["operator_id"])
            d["machine_id"] = str(d["machine_id"])
            if d.get("created_by"):
                d["created_by"] = str(d["created_by"])
            if d.get("assigned_by"):
                d["assigned_by"] = str(d["assigned_by"])
            if d.get("updated_by"):
                d["updated_by"] = str(d["updated_by"])
            if d.get("revoked_by"):
                d["revoked_by"] = str(d["revoked_by"])
            result.append(OperatorMachineAssignmentResponse(**d))
        return result

@router.post("/operator-assignments", response_model=OperatorMachineAssignmentResponse, status_code=status.HTTP_201_CREATED)
def assign_machine_to_operator(
    payload: OperatorMachineAssignmentCreate,
    current_user: dict = Depends(get_current_user)
):
    user_role = current_user.get("role")
    if user_role == "OPERATOR":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Operators cannot assign machines.")

    with get_db_cursor(commit=True) as cur:
        cur.execute("SELECT id, organization_id, role, first_name, last_name, email FROM users WHERE id = %s AND (is_deleted IS NOT TRUE);", (payload.operator_id,))
        op_row = cur.fetchone()
        if not op_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Operator user not found.")
        if op_row[2] != "OPERATOR":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assigned user must have the OPERATOR role.")
        op_org_id = str(op_row[1])

        cur.execute("SELECT id, organization_id, machine_code, serial_number, model, location_label FROM machines WHERE id = %s AND (is_deleted IS NOT TRUE);", (payload.machine_id,))
        mach_row = cur.fetchone()
        if not mach_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Machine not found.")
        if not mach_row[1] or str(mach_row[1]) != op_org_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Machine is not leased to this operator's client organization.")

        if user_role != "OEM_MANAGER":
            user_org_id = str(current_user.get("organization_id") or "")
            if user_org_id != op_org_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Cannot assign machines outside your organization.")

        s_date, e_date = resolve_lease_dates(
            payload.start_date,
            payload.end_date,
            default_start_today=True,
            default_end_one_year=True,
        )

        location = payload.location.strip() if payload.location and payload.location.strip() else None
        if not location:
            cur.execute("SELECT location_label FROM machine_leases WHERE machine_id = %s AND lease_status = 'Active' ORDER BY created_at DESC LIMIT 1;", (payload.machine_id,))
            lease_row = cur.fetchone()
            if lease_row and lease_row[0]:
                location = lease_row[0]
            else:
                location = None

        row = upsert_operator_machine_assignment(
            cur,
            organization_id=op_org_id,
            operator_id=payload.operator_id,
            machine_id=payload.machine_id,
            start_date=s_date,
            end_date=e_date,
            location=location,
            actor_user_id=current_user.get("id"),
            returning_details=True,
        )

        return OperatorMachineAssignmentResponse(
            id=str(row[0]),
            organization_id=str(row[1]),
            operator_id=str(row[2]),
            operator_name=f"{op_row[3]} {op_row[4] or ''}".strip(),
            operator_email=op_row[5],
            machine_id=str(row[3]),
            machine_code=mach_row[2],
            serial_number=mach_row[3],
            model=mach_row[4],
            start_date=row[4],
            end_date=row[5],
            location=row[6],
            created_by=str(row[7]) if row[7] else None,
            assigned_by=str(row[8]) if row[8] else None,
            assigned_at=row[9],
            updated_by=str(row[10]) if row[10] else None,
            updated_at=row[11],
            revoked_by=str(row[12]) if row[12] else None,
            revoked_at=row[13],
            status=row[14],
            created_at=row[15]
        )

@router.post("/operator-assignments/{assignment_id}/revoke")
def revoke_operator_machine_assignment(
    assignment_id: str,
    current_user: dict = Depends(get_current_user)
):
    user_role = current_user.get("role")
    if user_role == "OPERATOR":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Operators cannot revoke machine assignments.")
    valid_assignment_id = require_uuid_or_400(assignment_id, "assignment ID")

    with get_db_cursor(commit=True) as cur:
        cur.execute("SELECT id, organization_id FROM machine_assign_to_operators WHERE id = %s;", (valid_assignment_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment record not found.")

        if user_role != "OEM_MANAGER":
            user_org_id = str(current_user.get("organization_id") or "")
            if user_org_id != str(row[1]):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Cannot modify assignments outside your organization.")

        cur.execute("""
            UPDATE machine_assign_to_operators
            SET status = 'Revoked',
                revoked_at = CURRENT_TIMESTAMP,
                revoked_by = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s;
        """, (current_user.get("id"), valid_assignment_id))

        return {"success": True, "message": "Operator machine assignment revoked successfully."}

@router.get("/{machine_id}", response_model=MachineResponse)
def get_machine(machine_id: str, current_user: dict = Depends(get_current_user)):
    user_role = current_user.get("role")
    with get_db_cursor() as cur:
        if user_role == "OPERATOR":
            user_org_id = current_user.get("organization_id")
            if not user_org_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You do not have permission to access this machine.",
                )
            cur.execute(
                """
                SELECT 
                    m.id, m.machine_code, m.serial_number, m.model_id, m.model, m.capacity, m.hardware_version,
                    m.organization_id, o.client_code, o.company_name,
                    m.location_label, m.location_description,
                    COALESCE(ml.location_label, mato.location) AS lease_location_label,
                    m.plc_software_version, m.energy_meter_model, m.deodor_model, m.extractor_model,
                    COALESCE(m.has_stairs, false) AS has_stairs, m.notes,
                    TO_CHAR(ml.lease_start_date, 'YYYY-MM-DD') AS lease_start_date,
                    TO_CHAR(ml.lease_end_date, 'YYYY-MM-DD') AS lease_end_date,
                    COALESCE(ml.lease_status, 'Available') AS lease_status,
                    ml.lease_reference,
                    m.connectivity_status, 
                    COALESCE(m.operational_status, 'Idle') AS operational_status, m.is_active,
                    m.created_by, m.updated_by, m.deleted_by,
                    m.created_at, m.updated_at
                FROM machines m
                JOIN organizations o
                  ON m.organization_id = o.id
                 AND (o.is_deleted IS NOT TRUE)
                 AND COALESCE(o.is_active, TRUE) IS TRUE
                 AND LOWER(COALESCE(o.status, 'active')) NOT IN ('inactive', 'archived')
                JOIN machine_leases ml
                  ON m.id = ml.machine_id
                 AND ml.organization_id = m.organization_id
                 AND ml.lease_status = 'Active'
                JOIN machine_assign_to_operators mato 
                  ON m.id = mato.machine_id 
                 AND mato.organization_id = m.organization_id
                 AND mato.operator_id = %s 
                 AND mato.status = 'Active'
                WHERE (m.id::text = %s OR UPPER(m.machine_code) = UPPER(%s) OR UPPER(m.serial_number) = UPPER(%s)) 
                  AND m.organization_id = %s
                  AND (m.is_deleted IS NOT TRUE);
                """,
                (current_user.get("id"), machine_id, machine_id, machine_id, user_org_id)
            )
        elif user_role != "OEM_MANAGER":
            user_org_id = current_user.get("organization_id")
            cur.execute(
                f"{SQL_SELECT_MACHINE_JOINED} WHERE (m.id::text = %s OR UPPER(m.machine_code) = UPPER(%s) OR UPPER(m.serial_number) = UPPER(%s)) AND m.organization_id = %s AND (m.is_deleted IS NOT TRUE);",
                (machine_id, machine_id, machine_id, user_org_id)
            )
        else:
            cur.execute(
                f"{SQL_SELECT_MACHINE_JOINED} WHERE (m.id::text = %s OR UPPER(m.machine_code) = UPPER(%s) OR UPPER(m.serial_number) = UPPER(%s)) AND (m.is_deleted IS NOT TRUE);",
                (machine_id, machine_id, machine_id)
            )
        row = cur.fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Machine '{machine_id}' not found."
            )
        cols = [desc[0] for desc in cur.description]
        mach_dict = row_to_machine_dict(cols, row)

        # Cross-tenant scoping check
        if user_role != "OEM_MANAGER":
            user_org_id = str(current_user.get("organization_id") or "")
            mach_org_id = str(mach_dict.get("organization_id") or "")
            if not user_org_id or mach_org_id != user_org_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You do not have permission to access this machine."
                )

        return MachineResponse(**mach_dict)

@router.post("", response_model=MachineResponse, status_code=status.HTTP_201_CREATED)
def create_machine(payload: MachineCreate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "OEM_MANAGER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only OEM Managers can commission new machines."
        )

    has_explicit_serial = bool(payload.serial_number and payload.serial_number.strip())
    explicit_serial = payload.serial_number.strip().upper() if has_explicit_serial else None
    explicit_code = (payload.machine_code or payload.serial_number or "").strip().upper() if has_explicit_serial else None

    model_name = payload.model.strip()
    if model_name.upper() == 'F25':
        model_name = 'Foodie F25'
    elif model_name.upper() == 'F100':
        model_name = 'Foodie F100'
    elif model_name.upper() == 'F500':
        model_name = 'Foodie F500'
    elif model_name.upper() == 'F1000':
        model_name = 'Foodie F1000'

    # Do not prefill or default capacity until user inputs it
    capacity = payload.capacity.strip() if (payload.capacity and payload.capacity.strip()) else None

    with get_db_cursor(commit=True) as cur:
        cur.execute("SELECT pg_advisory_xact_lock(hashtext('machines_next_code'));")
        if has_explicit_serial:
            normalized_serial = explicit_serial
            normalized_code = explicit_code
        else:
            next_code = _compute_next_machine_code(cur)
            normalized_serial = next_code
            normalized_code = next_code

        # Check duplicate machine_code across all records (including archived/deleted)
        cur.execute("SELECT id, is_deleted FROM machines WHERE UPPER(machine_code) = %s;", (normalized_code,))
        row = cur.fetchone()
        if row:
            if row[1]:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f'Machine Code "{normalized_code}" was previously assigned to an archived machine and cannot be reused.'
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f'Machine Code "{normalized_code}" is already registered. It must be unique.'
                )

        # Check duplicate serial_number across all records (including archived/deleted)
        cur.execute("SELECT id, is_deleted FROM machines WHERE UPPER(serial_number) = %s;", (normalized_serial,))
        row = cur.fetchone()
        if row:
            if row[1]:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f'Serial Number "{normalized_serial}" was previously assigned to an archived machine and cannot be reused.'
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f'Serial Number "{normalized_serial}" is already registered. It must be unique.'
                )

        # Look up model_id, display_name and fallback capacity from machine_models
        cur.execute(
            "SELECT id, display_name, capacity FROM machine_models WHERE UPPER(model_code) = %s OR UPPER(display_name) = %s;",
            (payload.model.strip().upper(), model_name.upper())
        )
        model_row = cur.fetchone()
        resolved_model_id = model_row[0] if model_row else None
        if model_row:
            if model_row[1]:
                model_name = model_row[1]
            if not capacity and model_row[2]:
                capacity = model_row[2]

        try:
            cur.execute("""
                INSERT INTO machines (
                    machine_code, serial_number, model_id, model, capacity, hardware_version,
                    organization_id, location_label, location_description,
                    plc_software_version, energy_meter_model, deodor_model, extractor_model,
                    has_stairs, notes, connectivity_status, operational_status, is_active,
                    created_by
                ) VALUES (
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s
                ) RETURNING id;
            """, (
                normalized_code,
                normalized_serial,
                resolved_model_id,
                model_name,
                capacity,
                payload.hardware_version.strip() if (payload.hardware_version and payload.hardware_version.strip()) else None,
                payload.organization_id or None,
                payload.location_label.strip() if payload.location_label else None,
                payload.location_description.strip() if payload.location_description else None,
                payload.plc_software_version.strip() if payload.plc_software_version else None,
                payload.energy_meter_model.strip() if payload.energy_meter_model else None,
                payload.deodor_model.strip() if payload.deodor_model else None,
                payload.extractor_model.strip() if payload.extractor_model else None,
                bool(payload.has_stairs),
                payload.notes.strip() if payload.notes else None,
                payload.connectivity_status or 'Offline',
                payload.operational_status or 'Idle',
                True,
                current_user.get("id")
            ))
        except psycopg2.IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Machine code or serial number conflicts with an existing machine record.",
            ) from exc
        new_id = cur.fetchone()[0]

        if payload.organization_id:
            lease_ref = f"LSE-{new_id[:8]}"
            today_dt = date.today()
            today_str = today_dt.strftime("%Y-%m-%d")
            end_str = calculate_one_year_end_date(today_dt).strftime("%Y-%m-%d")
            cur.execute("""
                INSERT INTO machine_leases (
                    machine_id, organization_id, location_label,
                    lease_start_date, lease_end_date, lease_status, lease_reference,
                    created_by, assigned_by, assigned_at
                ) VALUES (
                    %s, %s, %s,
                    %s::DATE, %s::DATE, 'Active', %s,
                    %s, %s, CURRENT_TIMESTAMP
                ) ON CONFLICT (lease_reference) DO UPDATE
                SET lease_status = 'Active';
            """, (new_id, payload.organization_id, payload.location_label, today_str, end_str, lease_ref, current_user.get("id"), current_user.get("id")))

            sync_active_operators_for_machine(
                cur,
                organization_id=payload.organization_id,
                machine_id=new_id,
                start_date=today_str,
                end_date=end_str,
                location=payload.location_label,
                actor_user_id=current_user.get("id"),
            )

        cur.execute(f"{SQL_SELECT_MACHINE_JOINED} WHERE m.id = %s;", (new_id,))
        row = cur.fetchone()
        cols = [desc[0] for desc in cur.description]
        return MachineResponse(**row_to_machine_dict(cols, row))

@router.put("/{machine_id}", response_model=MachineResponse)
def update_machine(machine_id: str, payload: MachineUpdate, current_user: dict = Depends(get_current_user)):
    user_role = current_user.get("role")

    # user_role = current_user.get("role")
    # if user_role == "OPERATOR":
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Access denied: Operators cannot modify machine configurations."
    #     )

    
    if user_role != "OEM_MANAGER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only OEM Managers can modify machine configurations or lease terms."
        )

    with get_db_cursor(commit=True) as cur:
        cur.execute(
            "SELECT id, model, capacity, organization_id FROM machines WHERE (id::text = %s OR UPPER(machine_code) = UPPER(%s) OR UPPER(serial_number) = UPPER(%s)) AND is_deleted IS NOT TRUE;",
            (machine_id, machine_id, machine_id)
        )
        existing = cur.fetchone()
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Machine '{machine_id}' not found."
            )
        real_machine_id = str(existing[0])

            #   if user_role != "OEM_MANAGER":
            # user_org_id = str(current_user.get("organization_id") or "")
            # mach_org_id = str(existing[3] or "")
            # if not user_org_id or mach_org_id != user_org_id:
            #     raise HTTPException(
            #         status_code=status.HTTP_403_FORBIDDEN,
            #         detail="Access denied: You do not have permission to modify this machine."
            #     )


        if payload.serial_number:
            normalized_serial = payload.serial_number.strip().upper()
            cur.execute("SELECT id FROM machines WHERE UPPER(serial_number) = %s AND id != %s;", (normalized_serial, real_machine_id))
            if cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f'Serial Number "{normalized_serial}" is already registered (or was previously used).'
                )

        capacity = payload.capacity
        model_name = payload.model
        resolved_model_id = None

        if payload.model:
            cur.execute(
                "SELECT id, display_name, capacity FROM machine_models WHERE UPPER(model_code) = %s OR UPPER(display_name) = %s;",
                (payload.model.strip().upper(), payload.model.strip().upper())
            )
            m_row = cur.fetchone()
            if m_row:
                resolved_model_id = m_row[0]
                model_name = m_row[1]
                if not capacity and m_row[2]:
                    capacity = m_row[2]

        is_lease_assign = "organization_id" in payload.model_fields_set
        is_lease_edit = ("lease_location_label" in payload.model_fields_set or "lease_start_date" in payload.model_fields_set or "lease_end_date" in payload.model_fields_set)

        if is_lease_assign:
            # if user_role != "OEM_MANAGER":
            #     raise HTTPException(
            #         status_code=status.HTTP_403_FORBIDDEN,
            #         detail="Access denied: Only OEM Managers can assign, transfer, or unassign machine leases."
            #     )
            cur.execute("UPDATE machines SET organization_id = %s WHERE id = %s;", (payload.organization_id, real_machine_id))
            if payload.organization_id is None:
                cur.execute("UPDATE machine_leases SET lease_status = 'Terminated', terminated_at = CURRENT_TIMESTAMP, terminated_by = %s WHERE machine_id = %s AND lease_status = 'Active';", (current_user.get("id"), real_machine_id))
                cur.execute("""
                    UPDATE machine_assign_to_operators
                    SET status = 'Revoked',
                        revoked_at = CURRENT_TIMESTAMP,
                        revoked_by = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE machine_id = %s AND status = 'Active';
                """, (current_user.get("id"), real_machine_id))
            else:
                cur.execute("""
                    UPDATE machine_assign_to_operators
                    SET status = 'Revoked',
                        revoked_at = CURRENT_TIMESTAMP,
                        revoked_by = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE machine_id = %s AND organization_id != %s AND status = 'Active';
                """, (current_user.get("id"), real_machine_id, payload.organization_id))
                l_start_str, l_end_str = resolve_lease_dates(
                    payload.lease_start_date,
                    payload.lease_end_date,
                    default_start_today=True,
                    default_end_one_year=True,
                )

                has_lease_loc = "lease_location_label" in payload.model_fields_set
                lease_loc = payload.lease_location_label.strip() if payload.lease_location_label and payload.lease_location_label.strip() else None
                lease_ref = f"LSE-{real_machine_id[:8]}"
                cur.execute("""
                    INSERT INTO machine_leases (
                        machine_id, organization_id, location_label,
                        lease_start_date, lease_end_date, lease_status, lease_reference,
                        created_by, assigned_by, assigned_at
                    ) VALUES (
                        %s, %s, %s,
                        %s::DATE, %s::DATE, 'Active', %s,
                        %s, %s, CURRENT_TIMESTAMP
                    ) ON CONFLICT (lease_reference) DO UPDATE
                    SET organization_id = EXCLUDED.organization_id,
                        location_label = CASE WHEN %s IS TRUE THEN %s ELSE machine_leases.location_label END,
                        lease_start_date = EXCLUDED.lease_start_date,
                        lease_end_date = EXCLUDED.lease_end_date,
                        lease_status = 'Active',
                        updated_by = EXCLUDED.assigned_by,
                        updated_at = CURRENT_TIMESTAMP;
                """, (real_machine_id, payload.organization_id, lease_loc, l_start_str, l_end_str, lease_ref, current_user.get("id"), current_user.get("id"), has_lease_loc, lease_loc))

                sync_active_operators_for_machine(
                    cur,
                    organization_id=payload.organization_id,
                    machine_id=real_machine_id,
                    start_date=l_start_str,
                    end_date=l_end_str,
                    location=lease_loc,
                    actor_user_id=current_user.get("id"),
                    force_location_update=has_lease_loc,
                )

        elif is_lease_edit:
            cur.execute("SELECT lease_start_date, lease_end_date FROM machine_leases WHERE machine_id = %s AND lease_status = 'Active';", (real_machine_id,))
            existing_lease = cur.fetchone()
            existing_start = existing_lease[0] if existing_lease else None
            existing_end = existing_lease[1] if existing_lease else None

            start_dt = parse_iso_date_or_400(payload.lease_start_date, "Lease start date")
            end_dt = parse_iso_date_or_400(payload.lease_end_date, "Lease end date")

            eff_start = start_dt if start_dt else existing_start
            eff_end = end_dt if end_dt else existing_end

            if eff_start and eff_end and eff_end < eff_start:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Lease end date ({eff_end}) cannot be earlier than lease start date ({eff_start})."
                )

            l_start_str = start_dt.strftime("%Y-%m-%d") if start_dt else None
            l_end_str = end_dt.strftime("%Y-%m-%d") if end_dt else None

            lease_loc = payload.lease_location_label.strip() if payload.lease_location_label and payload.lease_location_label.strip() else None
            has_lease_loc = "lease_location_label" in payload.model_fields_set

            cur.execute("""
                UPDATE machine_leases SET
                    location_label = CASE WHEN %s IS TRUE THEN %s ELSE location_label END,
                    lease_start_date = COALESCE(%s::DATE, lease_start_date),
                    lease_end_date = COALESCE(%s::DATE, lease_end_date),
                    updated_by = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE machine_id = %s AND lease_status = 'Active';
            """, (
                has_lease_loc,
                lease_loc,
                l_start_str,
                l_end_str,
                current_user.get("id"),
                real_machine_id
            ))

        should_update_mach_loc = ('location_label' in payload.model_fields_set and not is_lease_assign and not is_lease_edit)
        cur.execute("""
            UPDATE machines SET
                serial_number = COALESCE(%s, serial_number),
                model_id = COALESCE(%s, model_id),
                model = COALESCE(%s, model),
                capacity = COALESCE(%s, capacity),
                hardware_version = COALESCE(%s, hardware_version),
                location_label = CASE WHEN %s IS TRUE THEN %s ELSE location_label END,
                location_description = COALESCE(%s, location_description),
                plc_software_version = COALESCE(%s, plc_software_version),
                energy_meter_model = COALESCE(%s, energy_meter_model),
                deodor_model = COALESCE(%s, deodor_model),
                extractor_model = COALESCE(%s, extractor_model),
                has_stairs = COALESCE(%s, has_stairs),
                notes = COALESCE(%s, notes),
                connectivity_status = COALESCE(%s, connectivity_status),
                operational_status = COALESCE(%s, operational_status),
                is_active = COALESCE(%s, is_active),
                updated_by = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s;
        """, (
            payload.serial_number.strip().upper() if payload.serial_number else None,
            resolved_model_id,
            model_name,
            capacity,
            payload.hardware_version,
            should_update_mach_loc,
            payload.location_label.strip() if payload.location_label and payload.location_label.strip() else None,
            payload.location_description.strip() if payload.location_description else None,
            payload.plc_software_version.strip() if payload.plc_software_version else None,
            payload.energy_meter_model.strip() if payload.energy_meter_model else None,
            payload.deodor_model.strip() if payload.deodor_model else None,
            payload.extractor_model.strip() if payload.extractor_model else None,
            payload.has_stairs,
            payload.notes.strip() if payload.notes else None,
            payload.connectivity_status,
            payload.operational_status,
            payload.is_active,
            current_user.get("id"),
            real_machine_id
        ))

        cur.execute(f"{SQL_SELECT_MACHINE_JOINED} WHERE m.id = %s;", (real_machine_id,))
        row = cur.fetchone()
        cols = [desc[0] for desc in cur.description]
        return MachineResponse(**row_to_machine_dict(cols, row))

@router.delete("/{machine_id}")
def delete_machine(machine_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "OEM_MANAGER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only OEM Managers can delete machines."
        )
    with get_db_cursor(commit=True) as cur:
        cur.execute(
            "SELECT id, machine_code, organization_id FROM machines WHERE (id::text = %s OR UPPER(machine_code) = UPPER(%s) OR UPPER(serial_number) = UPPER(%s)) AND (is_deleted IS NOT TRUE);",
            (machine_id, machine_id, machine_id)
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Machine '{machine_id}' not found."
            )
        real_machine_id, code, org_id = str(row[0]), row[1], row[2]
        # Ensure only available machines can be deleted
        if org_id is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Machine '{code}' is currently assigned to a client. Only unassigned available machines can be deleted."
            )
        cur.execute("""
            UPDATE machines 
            SET is_deleted = TRUE, 
                deleted_at = CURRENT_TIMESTAMP, 
                deleted_by = %s,
                is_active = FALSE
            WHERE id = %s;
        """, (current_user.get("id"), real_machine_id))
        cur.execute("UPDATE machine_leases SET lease_status = 'Terminated' WHERE machine_id = %s;", (real_machine_id,))
        return {"success": True, "message": f"Machine '{code}' successfully removed from fleet inventory."}

@router.post("/{machine_id}/unassign")
def unassign_machine(machine_id: str, payload: Optional[TerminateLeaseRequest] = None, current_user: dict = Depends(get_current_user)):
    """Terminate machine lease from client organization and return to available fleet."""
    if current_user.get("role") != "OEM_MANAGER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only OEM Managers can terminate machine leases."
        )
    valid_machine_id = require_uuid_or_400(machine_id, "machine ID")

    remark = payload.termination_remark.strip() if payload and payload.termination_remark and payload.termination_remark.strip() else None

    with get_db_cursor(commit=True) as cur:
        cur.execute("SELECT id, serial_number, organization_id FROM machines WHERE id = %s AND (is_deleted IS NOT TRUE);", (valid_machine_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Machine not found.")

        cur.execute("UPDATE machines SET organization_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = %s RETURNING serial_number;", (valid_machine_id,))
        serial = cur.fetchone()[0]

        cur.execute("""
            UPDATE machine_leases 
            SET lease_status = 'Terminated',
                terminated_at = CURRENT_TIMESTAMP,
                terminated_by = %s,
                termination_remark = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE machine_id = %s AND lease_status = 'Active';
        """, (current_user.get("id"), remark, valid_machine_id))

        cur.execute("""
            UPDATE machine_assign_to_operators
            SET status = 'Revoked',
                revoked_at = CURRENT_TIMESTAMP,
                revoked_by = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE machine_id = %s AND status = 'Active';
        """, (current_user.get("id"), valid_machine_id))

        return {"success": True, "message": f"Machine '{serial}' lease terminated successfully and returned to fleet.", "id": valid_machine_id}
