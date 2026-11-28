from typing import Any, Optional, Tuple


def build_telemetry_scope(
    *,
    user_role: Optional[str],
    user_id: Optional[str],
    client_org_id: Optional[str],
) -> Tuple[str, str, tuple, bool]:
    """Return SQL JOIN/WHERE fragments and params scoped to the caller's role."""
    if user_role == "OPERATOR":
        scope_joins = """
            JOIN machine_assign_to_operators mato
              ON m.id = mato.machine_id
             AND mato.organization_id = m.organization_id
             AND mato.operator_id = %s
             AND mato.status = 'Active'
            JOIN machine_leases ml
              ON m.id = ml.machine_id
             AND ml.organization_id = m.organization_id
             AND ml.lease_status = 'Active'
        """
        scope_where = "(m.is_deleted IS NOT TRUE) AND m.organization_id = %s"
        return scope_joins, scope_where, (user_id, client_org_id), True

    if user_role != "OEM_MANAGER" and bool(client_org_id):
        return "", "(m.is_deleted IS NOT TRUE) AND m.organization_id = %s", (client_org_id,), True

    if user_role == "OEM_MANAGER":
        return "", "(m.is_deleted IS NOT TRUE)", (), True

    return "", "", (), False


def fetch_dashboard_telemetry(
    cur,
    *,
    user_role: Optional[str],
    user_id: Optional[str],
    client_org_id: Optional[str],
) -> Tuple[bool, Optional[float], Optional[float], Optional[float], list[dict[str, Any]]]:
    """Fetch scoped daily telemetry totals and 14-day energy history without fabricating missing readings."""
    telemetry_connected = False
    energy_today: Optional[float] = None
    waste_today: Optional[float] = None
    compost_today: Optional[float] = None
    energy_history: list[dict[str, Any]] = []

    cur.execute("SELECT to_regclass('public.machine_telemetry_daily');")
    has_telemetry_table = cur.fetchone()[0] is not None
    if not has_telemetry_table:
        return telemetry_connected, energy_today, waste_today, compost_today, energy_history

    scope_joins, scope_where, scope_params, has_valid_scope = build_telemetry_scope(
        user_role=user_role,
        user_id=user_id,
        client_org_id=client_org_id,
    )
    if not has_valid_scope:
        return telemetry_connected, energy_today, waste_today, compost_today, energy_history

    cur.execute(
        f"""
        SELECT EXISTS (
            SELECT 1
            FROM machine_telemetry_daily t
            JOIN machines m ON t.machine_id = m.id
            {scope_joins}
            WHERE {scope_where}
        );
        """,
        scope_params,
    )
    telemetry_connected = bool(cur.fetchone()[0])
    if not telemetry_connected:
        return telemetry_connected, energy_today, waste_today, compost_today, energy_history

    cur.execute(
        f"""
        SELECT
            SUM(t.energy_kwh),
            SUM(t.waste_intake_kg),
            SUM(t.compost_produced_kg)
        FROM machine_telemetry_daily t
        JOIN machines m ON t.machine_id = m.id
        {scope_joins}
        WHERE t.date = CURRENT_DATE
          AND {scope_where};
        """,
        scope_params,
    )
    row = cur.fetchone()
    if row:
        energy_today = float(row[0]) if row[0] is not None else None
        waste_today = float(row[1]) if row[1] is not None else None
        compost_today = float(row[2]) if row[2] is not None else None

    cur.execute(
        f"""
        SELECT
            t.date::text,
            TO_CHAR(t.date, 'FMDD Mon') AS display_date,
            TO_CHAR(t.date, 'FMDD Mon YYYY') AS full_date,
            SUM(t.energy_kwh) AS total_kwh
        FROM machine_telemetry_daily t
        JOIN machines m ON t.machine_id = m.id
        {scope_joins}
        WHERE t.date >= CURRENT_DATE - 13
          AND t.date <= CURRENT_DATE
          AND {scope_where}
        GROUP BY t.date
        HAVING SUM(t.energy_kwh) IS NOT NULL
        ORDER BY t.date ASC;
        """,
        scope_params,
    )
    energy_history = [
        {
            "date": r[0],
            "displayDate": r[1],
            "fullDate": r[2],
            "kwh": float(r[3]),
        }
        for r in cur.fetchall()
    ]
    return telemetry_connected, energy_today, waste_today, compost_today, energy_history

