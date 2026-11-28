from typing import Optional
from fastapi import HTTPException, status
from ..database import (
    parse_uuid_or_400,
    require_uuid_or_400,
    resolve_lease_dates,
    upsert_operator_machine_assignment,
)
from ..schemas import (
    OperatorMachineAssignmentCreate,
    OperatorMachineAssignmentResponse,
)


def list_operator_assignments(
    cur,
    *,
    organization_id: Optional[str],
    operator_id: Optional[str],
    current_user: dict,
) -> list[OperatorMachineAssignmentResponse]:
    """Return operator-machine assignments scoped by caller role and optional filters."""
    valid_org_filter = parse_uuid_or_400(organization_id, "organization ID")
    valid_op_filter = parse_uuid_or_400(operator_id, "operator ID")
    user_role = current_user.get("role")

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
        for key in ("created_by", "assigned_by", "updated_by", "revoked_by"):
            if d.get(key):
                d[key] = str(d[key])
        result.append(OperatorMachineAssignmentResponse(**d))
    return result


def assign_operator_to_machine(
    cur,
    *,
    payload: OperatorMachineAssignmentCreate,
    current_user: dict,
) -> OperatorMachineAssignmentResponse:
    """Validate tenancy/roles and create or reactivate an operator machine assignment."""
    user_role = current_user.get("role")
    if user_role == "OPERATOR":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Operators cannot assign machines.",
        )

    cur.execute(
        "SELECT id, organization_id, role, first_name, last_name, email FROM users WHERE id = %s AND (is_deleted IS NOT TRUE);",
        (payload.operator_id,),
    )
    op_row = cur.fetchone()
    if not op_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Operator user not found.")
    if op_row[2] != "OPERATOR":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assigned user must have the OPERATOR role.",
        )
    op_org_id = str(op_row[1])

    cur.execute(
        "SELECT id, organization_id, machine_code, serial_number, model, location_label FROM machines WHERE id = %s AND (is_deleted IS NOT TRUE);",
        (payload.machine_id,),
    )
    mach_row = cur.fetchone()
    if not mach_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Machine not found.")
    if not mach_row[1] or str(mach_row[1]) != op_org_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Machine is not leased to this operator's client organization.",
        )

    if user_role != "OEM_MANAGER":
        user_org_id = str(current_user.get("organization_id") or "")
        if user_org_id != op_org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Cannot assign machines outside your organization.",
            )

    s_date, e_date = resolve_lease_dates(
        payload.start_date,
        payload.end_date,
        default_start_today=True,
        default_end_one_year=True,
    )

    location = payload.location.strip() if payload.location and payload.location.strip() else None
    if not location:
        cur.execute(
            "SELECT location_label FROM machine_leases WHERE machine_id = %s AND lease_status = 'Active' ORDER BY created_at DESC LIMIT 1;",
            (payload.machine_id,),
        )
        lease_row = cur.fetchone()
        location = lease_row[0] if (lease_row and lease_row[0]) else None

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
        created_at=row[15],
    )


def revoke_operator_assignment(cur, *, assignment_id: str, current_user: dict) -> dict:
    """Revoke an active operator machine assignment."""
    user_role = current_user.get("role")
    if user_role == "OPERATOR":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Operators cannot revoke machine assignments.",
        )
    valid_assignment_id = require_uuid_or_400(assignment_id, "assignment ID")

    cur.execute("SELECT id, organization_id FROM machine_assign_to_operators WHERE id = %s;", (valid_assignment_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment record not found.")

    if user_role != "OEM_MANAGER":
        user_org_id = str(current_user.get("organization_id") or "")
        if user_org_id != str(row[1]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Cannot modify assignments outside your organization.",
            )

    cur.execute(
        """
        UPDATE machine_assign_to_operators
        SET status = 'Revoked',
            revoked_at = CURRENT_TIMESTAMP,
            revoked_by = %s,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = %s;
        """,
        (current_user.get("id"), valid_assignment_id),
    )
    return {"success": True, "message": "Operator machine assignment revoked successfully."}

