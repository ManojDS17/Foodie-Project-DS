from datetime import date
from typing import Optional
from fastapi import HTTPException, status
from ..database import (
    calculate_one_year_end_date,
    parse_iso_date_or_400,
    require_uuid_or_400,
    resolve_lease_dates,
    sync_active_operators_for_machine,
)


def provision_initial_lease(
    cur,
    *,
    machine_id: str,
    organization_id: str,
    location_label: Optional[str],
    actor_user_id: Optional[str],
) -> None:
    """Create a default 1-year active lease and sync operators when onboarding directly to an org."""
    lease_ref = f"LSE-{machine_id[:8]}"
    today_dt = date.today()
    today_str = today_dt.strftime("%Y-%m-%d")
    end_str = calculate_one_year_end_date(today_dt).strftime("%Y-%m-%d")
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
        ) ON CONFLICT (lease_reference) DO UPDATE
        SET lease_status = 'Active';
        """,
        (
            machine_id,
            organization_id,
            location_label,
            today_str,
            end_str,
            lease_ref,
            actor_user_id,
            actor_user_id,
        ),
    )
    sync_active_operators_for_machine(
        cur,
        organization_id=organization_id,
        machine_id=machine_id,
        start_date=today_str,
        end_date=end_str,
        location=location_label,
        actor_user_id=actor_user_id,
    )


def apply_machine_lease_assignment(
    cur,
    *,
    machine_id: str,
    organization_id: Optional[str],
    lease_location_label: Optional[str],
    has_lease_loc: bool,
    lease_start_date: Optional[str],
    lease_end_date: Optional[str],
    actor_user_id: Optional[str],
) -> None:
    """Assign, transfer, or unassign a machine lease and synchronize active operator assignments."""
    cur.execute("UPDATE machines SET organization_id = %s WHERE id = %s;", (organization_id, machine_id))
    if organization_id is None:
        cur.execute(
            "UPDATE machine_leases SET lease_status = 'Terminated', terminated_at = CURRENT_TIMESTAMP, terminated_by = %s WHERE machine_id = %s AND lease_status = 'Active';",
            (actor_user_id, machine_id),
        )
        cur.execute(
            """
            UPDATE machine_assign_to_operators
            SET status = 'Revoked',
                revoked_at = CURRENT_TIMESTAMP,
                revoked_by = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE machine_id = %s AND status = 'Active';
            """,
            (actor_user_id, machine_id),
        )
        return

    cur.execute(
        """
        UPDATE machine_assign_to_operators
        SET status = 'Revoked',
            revoked_at = CURRENT_TIMESTAMP,
            revoked_by = %s,
            updated_at = CURRENT_TIMESTAMP
        WHERE machine_id = %s AND organization_id != %s AND status = 'Active';
        """,
        (actor_user_id, machine_id, organization_id),
    )
    l_start_str, l_end_str = resolve_lease_dates(
        lease_start_date,
        lease_end_date,
        default_start_today=True,
        default_end_one_year=True,
    )

    lease_loc = lease_location_label.strip() if lease_location_label and lease_location_label.strip() else None
    lease_ref = f"LSE-{machine_id[:8]}"
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
        ) ON CONFLICT (lease_reference) DO UPDATE
        SET organization_id = EXCLUDED.organization_id,
            location_label = CASE WHEN %s IS TRUE THEN %s ELSE machine_leases.location_label END,
            lease_start_date = EXCLUDED.lease_start_date,
            lease_end_date = EXCLUDED.lease_end_date,
            lease_status = 'Active',
            updated_by = EXCLUDED.assigned_by,
            updated_at = CURRENT_TIMESTAMP;
        """,
        (
            machine_id,
            organization_id,
            lease_loc,
            l_start_str,
            l_end_str,
            lease_ref,
            actor_user_id,
            actor_user_id,
            has_lease_loc,
            lease_loc,
        ),
    )

    sync_active_operators_for_machine(
        cur,
        organization_id=organization_id,
        machine_id=machine_id,
        start_date=l_start_str,
        end_date=l_end_str,
        location=lease_loc,
        actor_user_id=actor_user_id,
        force_location_update=has_lease_loc,
    )


def update_active_machine_lease(
    cur,
    *,
    machine_id: str,
    lease_location_label: Optional[str],
    has_lease_loc: bool,
    lease_start_date: Optional[str],
    lease_end_date: Optional[str],
    actor_user_id: Optional[str],
) -> None:
    """Update date bounds or location on an existing active lease."""
    cur.execute(
        "SELECT lease_start_date, lease_end_date FROM machine_leases WHERE machine_id = %s AND lease_status = 'Active';",
        (machine_id,),
    )
    existing_lease = cur.fetchone()
    existing_start = existing_lease[0] if existing_lease else None
    existing_end = existing_lease[1] if existing_lease else None

    start_dt = parse_iso_date_or_400(lease_start_date, "Lease start date")
    end_dt = parse_iso_date_or_400(lease_end_date, "Lease end date")

    eff_start = start_dt if start_dt else existing_start
    eff_end = end_dt if end_dt else existing_end
    if eff_start and eff_end and eff_end < eff_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Lease end date ({eff_end}) cannot be earlier than lease start date ({eff_start}).",
        )

    l_start_str = start_dt.strftime("%Y-%m-%d") if start_dt else None
    l_end_str = end_dt.strftime("%Y-%m-%d") if end_dt else None
    lease_loc = lease_location_label.strip() if lease_location_label and lease_location_label.strip() else None

    cur.execute(
        """
        UPDATE machine_leases SET
            location_label = CASE WHEN %s IS TRUE THEN %s ELSE location_label END,
            lease_start_date = COALESCE(%s::DATE, lease_start_date),
            lease_end_date = COALESCE(%s::DATE, lease_end_date),
            updated_by = %s,
            updated_at = CURRENT_TIMESTAMP
        WHERE machine_id = %s AND lease_status = 'Active';
        """,
        (has_lease_loc, lease_loc, l_start_str, l_end_str, actor_user_id, machine_id),
    )


def terminate_machine_lease(
    cur,
    *,
    machine_id: str,
    termination_remark: Optional[str],
    current_user: dict,
) -> dict:
    """Terminate a machine's active lease, unassign the org, and revoke operator access."""
    if current_user.get("role") != "OEM_MANAGER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only OEM Managers can terminate machine leases.",
        )
    valid_machine_id = require_uuid_or_400(machine_id, "machine ID")
    remark = termination_remark.strip() if termination_remark and termination_remark.strip() else None

    cur.execute(
        "SELECT id, serial_number, organization_id FROM machines WHERE id = %s AND (is_deleted IS NOT TRUE);",
        (valid_machine_id,),
    )
    if not cur.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Machine not found.")

    cur.execute(
        "UPDATE machines SET organization_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = %s RETURNING serial_number;",
        (valid_machine_id,),
    )
    serial = cur.fetchone()[0]

    cur.execute(
        """
        UPDATE machine_leases
        SET lease_status = 'Terminated',
            terminated_at = CURRENT_TIMESTAMP,
            terminated_by = %s,
            termination_remark = %s,
            updated_at = CURRENT_TIMESTAMP
        WHERE machine_id = %s AND lease_status = 'Active';
        """,
        (current_user.get("id"), remark, valid_machine_id),
    )
    cur.execute(
        """
        UPDATE machine_assign_to_operators
        SET status = 'Revoked',
            revoked_at = CURRENT_TIMESTAMP,
            revoked_by = %s,
            updated_at = CURRENT_TIMESTAMP
        WHERE machine_id = %s AND status = 'Active';
        """,
        (current_user.get("id"), valid_machine_id),
    )

    return {
        "success": True,
        "message": f"Machine '{serial}' lease terminated successfully and returned to fleet.",
        "id": valid_machine_id,
    }

