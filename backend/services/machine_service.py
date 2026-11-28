import re
from typing import Optional
from fastapi import HTTPException, Response, status
import psycopg2
from ..schemas import (
    MachineCreate,
    MachineModelResponse,
    MachineResponse,
    MachineUpdate,
)
from .lease_service import (
    apply_machine_lease_assignment,
    provision_initial_lease,
    update_active_machine_lease,
)

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

SQL_OPERATOR_MACHINE_FROM_JOIN = """
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
"""

SQL_SELECT_OPERATOR_MACHINE_JOINED = f"""
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
    {SQL_OPERATOR_MACHINE_FROM_JOIN}
"""

_MODEL_ALIAS_MAP = {
    "F25": "Foodie F25",
    "F100": "Foodie F100",
    "F500": "Foodie F500",
    "F1000": "Foodie F1000",
}


def row_to_machine_dict(cols, row) -> dict:
    d = dict(zip(cols, row))
    for key in ("id", "model_id", "organization_id", "created_by", "updated_by", "deleted_by"):
        if d.get(key):
            d[key] = str(d[key])
    return d


def compute_next_machine_code(cur) -> str:
    """Compute the next sequential machine code in the C001+ series across all rows."""
    cur.execute("SELECT machine_code, serial_number FROM machines;")
    nums = set()
    for m_code, s_num in cur.fetchall():
        for val in (m_code, s_num):
            if not val:
                continue
            m = re.match(r"^C(\d+)", val.strip(), re.IGNORECASE)
            if m:
                try:
                    nums.add(int(m.group(1)))
                except ValueError:
                    continue
    next_num = max(nums) + 1 if nums else 1
    return f"C{next_num:03d}"


def list_machine_models(cur) -> list[MachineModelResponse]:
    """Fetch machine models ordered by canonical series progression."""
    cur.execute(
        """
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
        """
    )
    rows = cur.fetchall()
    cols = [desc[0] for desc in cur.description]
    return [MachineModelResponse(**{**dict(zip(cols, r)), "id": str(r[0])}) for r in rows]


def list_machines(
    cur,
    *,
    response: Response,
    skip: int,
    limit: Optional[int],
    search: Optional[str],
    current_user: dict,
) -> list[MachineResponse]:
    """List machines scoped to caller role with search and pagination headers."""
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
            {SQL_OPERATOR_MACHINE_FROM_JOIN}
            WHERE {where_sql};
            """,
            tuple(op_params),
        )
        response.headers["X-Total-Count"] = str(cur.fetchone()[0])
        cur.execute(
            f"""
            {SQL_SELECT_OPERATOR_MACHINE_JOINED}
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


def get_machine_by_identifier(cur, *, machine_id: str, current_user: dict) -> MachineResponse:
    """Fetch a single machine by UUID, code, or serial number with tenant enforcement."""
    user_role = current_user.get("role")
    if user_role == "OPERATOR":
        user_org_id = current_user.get("organization_id")
        if not user_org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not have permission to access this machine.",
            )
        cur.execute(
            f"""
            {SQL_SELECT_OPERATOR_MACHINE_JOINED}
            WHERE (m.id::text = %s OR UPPER(m.machine_code) = UPPER(%s) OR UPPER(m.serial_number) = UPPER(%s))
              AND m.organization_id = %s
              AND (m.is_deleted IS NOT TRUE);
            """,
            (current_user.get("id"), machine_id, machine_id, machine_id, user_org_id),
        )
    elif user_role != "OEM_MANAGER":
        user_org_id = current_user.get("organization_id")
        cur.execute(
            f"{SQL_SELECT_MACHINE_JOINED} WHERE (m.id::text = %s OR UPPER(m.machine_code) = UPPER(%s) OR UPPER(m.serial_number) = UPPER(%s)) AND m.organization_id = %s AND (m.is_deleted IS NOT TRUE);",
            (machine_id, machine_id, machine_id, user_org_id),
        )
    else:
        cur.execute(
            f"{SQL_SELECT_MACHINE_JOINED} WHERE (m.id::text = %s OR UPPER(m.machine_code) = UPPER(%s) OR UPPER(m.serial_number) = UPPER(%s)) AND (m.is_deleted IS NOT TRUE);",
            (machine_id, machine_id, machine_id),
        )

    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Machine '{machine_id}' not found.")
    cols = [desc[0] for desc in cur.description]
    mach_dict = row_to_machine_dict(cols, row)

    if user_role != "OEM_MANAGER":
        user_org_id = str(current_user.get("organization_id") or "")
        mach_org_id = str(mach_dict.get("organization_id") or "")
        if not user_org_id or mach_org_id != user_org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not have permission to access this machine.",
            )

    return MachineResponse(**mach_dict)


def create_machine_record(cur, *, payload: MachineCreate, current_user: dict) -> MachineResponse:
    """Commission a new machine record and optionally provision an active client lease."""
    if current_user.get("role") != "OEM_MANAGER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only OEM Managers can commission new machines.",
        )

    has_explicit_serial = bool(payload.serial_number and payload.serial_number.strip())
    explicit_serial = payload.serial_number.strip().upper() if has_explicit_serial else None
    explicit_code = (payload.machine_code or payload.serial_number or "").strip().upper() if has_explicit_serial else None

    raw_model = payload.model.strip()
    model_name = _MODEL_ALIAS_MAP.get(raw_model.upper(), raw_model)
    capacity = payload.capacity.strip() if (payload.capacity and payload.capacity.strip()) else None

    cur.execute("SELECT pg_advisory_xact_lock(hashtext('machines_next_code'));")
    if has_explicit_serial:
        normalized_serial = explicit_serial
        normalized_code = explicit_code
    else:
        next_code = compute_next_machine_code(cur)
        normalized_serial = next_code
        normalized_code = next_code

    for col_name, col_label, value in (
        ("machine_code", "Machine Code", normalized_code),
        ("serial_number", "Serial Number", normalized_serial),
    ):
        cur.execute(f"SELECT id, is_deleted FROM machines WHERE UPPER({col_name}) = %s;", (value,))
        dup = cur.fetchone()
        if dup:
            detail = (
                f'{col_label} "{value}" was previously assigned to an archived machine and cannot be reused.'
                if dup[1]
                else f'{col_label} "{value}" is already registered. It must be unique.'
            )
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)

    cur.execute(
        "SELECT id, display_name, capacity FROM machine_models WHERE UPPER(model_code) = %s OR UPPER(display_name) = %s;",
        (payload.model.strip().upper(), model_name.upper()),
    )
    model_row = cur.fetchone()
    resolved_model_id = model_row[0] if model_row else None
    if model_row:
        if model_row[1]:
            model_name = model_row[1]
        if not capacity and model_row[2]:
            capacity = model_row[2]

    try:
        cur.execute(
            """
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
            """,
            (
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
                payload.connectivity_status or "Offline",
                payload.operational_status or "Idle",
                True,
                current_user.get("id"),
            ),
        )
    except psycopg2.IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Machine code or serial number conflicts with an existing machine record.",
        ) from exc

    new_id = cur.fetchone()[0]
    if payload.organization_id:
        provision_initial_lease(
            cur,
            machine_id=new_id,
            organization_id=payload.organization_id,
            location_label=payload.location_label,
            actor_user_id=current_user.get("id"),
        )

    cur.execute(f"{SQL_SELECT_MACHINE_JOINED} WHERE m.id = %s;", (new_id,))
    row = cur.fetchone()
    cols = [desc[0] for desc in cur.description]
    return MachineResponse(**row_to_machine_dict(cols, row))


def update_machine_record(
    cur,
    *,
    machine_id: str,
    payload: MachineUpdate,
    current_user: dict,
) -> MachineResponse:
    """Update machine hardware details or manage client lease assignment/edits."""
    if current_user.get("role") != "OEM_MANAGER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only OEM Managers can modify machine configurations or lease terms.",
        )

    cur.execute(
        "SELECT id, model, capacity, organization_id FROM machines WHERE (id::text = %s OR UPPER(machine_code) = UPPER(%s) OR UPPER(serial_number) = UPPER(%s)) AND is_deleted IS NOT TRUE;",
        (machine_id, machine_id, machine_id),
    )
    existing = cur.fetchone()
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Machine '{machine_id}' not found.")
    real_machine_id = str(existing[0])

    if payload.serial_number:
        normalized_serial = payload.serial_number.strip().upper()
        cur.execute("SELECT id FROM machines WHERE UPPER(serial_number) = %s AND id != %s;", (normalized_serial, real_machine_id))
        if cur.fetchone():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f'Serial Number "{normalized_serial}" is already registered (or was previously used).',
            )

    capacity = payload.capacity
    model_name = payload.model
    resolved_model_id = None
    if payload.model:
        cur.execute(
            "SELECT id, display_name, capacity FROM machine_models WHERE UPPER(model_code) = %s OR UPPER(display_name) = %s;",
            (payload.model.strip().upper(), payload.model.strip().upper()),
        )
        m_row = cur.fetchone()
        if m_row:
            resolved_model_id = m_row[0]
            model_name = m_row[1]
            if not capacity and m_row[2]:
                capacity = m_row[2]

    is_lease_assign = "organization_id" in payload.model_fields_set
    is_lease_edit = any(
        field in payload.model_fields_set
        for field in ("lease_location_label", "lease_start_date", "lease_end_date")
    )

    if is_lease_assign:
        apply_machine_lease_assignment(
            cur,
            machine_id=real_machine_id,
            organization_id=payload.organization_id,
            lease_location_label=payload.lease_location_label,
            has_lease_loc="lease_location_label" in payload.model_fields_set,
            lease_start_date=payload.lease_start_date,
            lease_end_date=payload.lease_end_date,
            actor_user_id=current_user.get("id"),
        )
    elif is_lease_edit:
        update_active_machine_lease(
            cur,
            machine_id=real_machine_id,
            lease_location_label=payload.lease_location_label,
            has_lease_loc="lease_location_label" in payload.model_fields_set,
            lease_start_date=payload.lease_start_date,
            lease_end_date=payload.lease_end_date,
            actor_user_id=current_user.get("id"),
        )

    should_update_mach_loc = "location_label" in payload.model_fields_set and not is_lease_assign and not is_lease_edit
    cur.execute(
        """
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
        """,
        (
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
            real_machine_id,
        ),
    )

    cur.execute(f"{SQL_SELECT_MACHINE_JOINED} WHERE m.id = %s;", (real_machine_id,))
    row = cur.fetchone()
    cols = [desc[0] for desc in cur.description]
    return MachineResponse(**row_to_machine_dict(cols, row))


def delete_machine_record(cur, *, machine_id: str, current_user: dict) -> dict:
    """Soft-delete an unassigned machine from fleet inventory."""
    if current_user.get("role") != "OEM_MANAGER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only OEM Managers can delete machines.",
        )

    cur.execute(
        "SELECT id, machine_code, organization_id FROM machines WHERE (id::text = %s OR UPPER(machine_code) = UPPER(%s) OR UPPER(serial_number) = UPPER(%s)) AND (is_deleted IS NOT TRUE);",
        (machine_id, machine_id, machine_id),
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Machine '{machine_id}' not found.")

    real_machine_id, code, org_id = str(row[0]), row[1], row[2]
    if org_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Machine '{code}' is currently assigned to a client. Only unassigned available machines can be deleted.",
        )

    cur.execute(
        """
        UPDATE machines
        SET is_deleted = TRUE,
            deleted_at = CURRENT_TIMESTAMP,
            deleted_by = %s,
            is_active = FALSE
        WHERE id = %s;
        """,
        (current_user.get("id"), real_machine_id),
    )
    cur.execute("UPDATE machine_leases SET lease_status = 'Terminated' WHERE machine_id = %s;", (real_machine_id,))
    return {"success": True, "message": f"Machine '{code}' successfully removed from fleet inventory."}

