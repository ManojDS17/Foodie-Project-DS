from typing import Any, Optional, Tuple


_OPERATOR_MACHINE_SCOPE_JOIN = """
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


def fetch_client_metrics(cur, *, is_client: bool) -> Tuple[int, int]:
    """Return total client count and current-month onboarded count."""
    if is_client:
        return 1, 0

    cur.execute("SELECT COUNT(*) FROM organizations WHERE is_deleted IS NOT TRUE;")
    total_clients = cur.fetchone()[0]

    cur.execute("""
        SELECT COUNT(*) FROM organizations
        WHERE is_deleted IS NOT TRUE
          AND EXTRACT(MONTH FROM COALESCE(onboarding_date, created_at::DATE)) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(YEAR FROM COALESCE(onboarding_date, created_at::DATE)) = EXTRACT(YEAR FROM CURRENT_DATE);
    """)
    clients_this_month = cur.fetchone()[0]
    return total_clients, clients_this_month


def fetch_fleet_machine_counts(
    cur,
    *,
    user_role: Optional[str],
    user_id: Optional[str],
    is_client: bool,
    client_org_id: Optional[str],
) -> Tuple[int, int, int]:
    """Return (total, online, offline) machine counts scoped to the current user."""
    if is_client:
        if user_role == "OPERATOR":
            cur.execute(
                f"""
                SELECT COUNT(*) FROM machines m
                {_OPERATOR_MACHINE_SCOPE_JOIN}
                WHERE m.is_deleted IS NOT TRUE
                  AND m.organization_id = %s;
                """,
                (user_id, client_org_id),
            )
            total_machines = cur.fetchone()[0]

            cur.execute(
                f"""
                SELECT COUNT(*) FROM machines m
                {_OPERATOR_MACHINE_SCOPE_JOIN}
                WHERE m.is_deleted IS NOT TRUE
                  AND m.organization_id = %s
                  AND LOWER(COALESCE(m.connectivity_status, 'offline')) = 'online';
                """,
                (user_id, client_org_id),
            )
            online_machines = cur.fetchone()[0]
        else:
            cur.execute(
                "SELECT COUNT(*) FROM machines WHERE is_deleted IS NOT TRUE AND organization_id = %s;",
                (client_org_id,),
            )
            total_machines = cur.fetchone()[0]

            cur.execute(
                "SELECT COUNT(*) FROM machines WHERE is_deleted IS NOT TRUE AND organization_id = %s AND LOWER(COALESCE(connectivity_status, 'offline')) = 'online';",
                (client_org_id,),
            )
            online_machines = cur.fetchone()[0]
    else:
        cur.execute("SELECT COUNT(*) FROM machines WHERE is_deleted IS NOT TRUE;")
        total_machines = cur.fetchone()[0]

        cur.execute(
            "SELECT COUNT(*) FROM machines WHERE is_deleted IS NOT TRUE AND LOWER(COALESCE(connectivity_status, 'offline')) = 'online';"
        )
        online_machines = cur.fetchone()[0]

    offline_machines = max(total_machines - online_machines, 0)
    return total_machines, online_machines, offline_machines


def fetch_open_alerts_summary(
    cur,
    *,
    is_client: bool,
    client_org_id: Optional[str],
) -> Tuple[int, int]:
    """Return active alert count and distinct affected clients count when alerts table exists."""
    cur.execute("SELECT to_regclass('public.alerts');")
    has_alerts = cur.fetchone()[0] is not None
    if not has_alerts:
        return 0, 0

    if is_client:
        cur.execute(
            """
            SELECT COUNT(*) FROM alerts a
            JOIN machines m ON a.machine_id = m.id
            WHERE a.status = 'Active' AND a.is_deleted IS NOT TRUE AND m.organization_id = %s;
            """,
            (client_org_id,),
        )
        open_alerts = cur.fetchone()[0]
        return open_alerts, (1 if open_alerts > 0 else 0)

    cur.execute("SELECT COUNT(*) FROM alerts WHERE status = 'Active' AND is_deleted IS NOT TRUE;")
    open_alerts = cur.fetchone()[0]
    cur.execute("SELECT COUNT(DISTINCT organization_id) FROM alerts WHERE status = 'Active' AND is_deleted IS NOT TRUE;")
    alert_clients = cur.fetchone()[0]
    return open_alerts, alert_clients


def fetch_attention_machines(
    cur,
    *,
    user_role: Optional[str],
    user_id: Optional[str],
    is_client: bool,
    client_org_id: Optional[str],
) -> list[dict[str, Any]]:
    """Return top offline machines requiring attention within the caller's scope."""
    if is_client:
        if user_role == "OPERATOR":
            cur.execute(
                f"""
                SELECT
                    m.id::text,
                    m.machine_code,
                    COALESCE(o.company_name, 'PowerTech Fleet') AS client,
                    'Machine Offline — No Telemetry Ping' AS issue,
                    'Offline' AS status,
                    'offline' AS variant
                FROM machines m
                {_OPERATOR_MACHINE_SCOPE_JOIN}
                LEFT JOIN organizations o ON m.organization_id = o.id
                WHERE LOWER(COALESCE(m.connectivity_status, 'offline')) = 'offline'
                  AND m.is_deleted IS NOT TRUE
                  AND m.organization_id = %s
                ORDER BY m.machine_code ASC
                LIMIT 5;
                """,
                (user_id, client_org_id),
            )
        else:
            cur.execute(
                """
                SELECT
                    m.id::text,
                    m.machine_code,
                    COALESCE(o.company_name, 'PowerTech Fleet') AS client,
                    'Machine Offline — No Telemetry Ping' AS issue,
                    'Offline' AS status,
                    'offline' AS variant
                FROM machines m
                LEFT JOIN organizations o ON m.organization_id = o.id
                WHERE LOWER(COALESCE(m.connectivity_status, 'offline')) = 'offline'
                  AND m.is_deleted IS NOT TRUE
                  AND m.organization_id = %s
                ORDER BY m.machine_code ASC
                LIMIT 5;
                """,
                (client_org_id,),
            )
    else:
        cur.execute(
            """
            SELECT
                m.id::text,
                m.machine_code,
                COALESCE(o.company_name, 'PowerTech Fleet') AS client,
                'Machine Offline — No Telemetry Ping' AS issue,
                'Offline' AS status,
                'offline' AS variant
            FROM machines m
            LEFT JOIN organizations o ON m.organization_id = o.id
            WHERE LOWER(COALESCE(m.connectivity_status, 'offline')) = 'offline'
              AND m.is_deleted IS NOT TRUE
            ORDER BY m.machine_code ASC
            LIMIT 5;
            """
        )

    return [
        {
            "id": r[0],
            "machine_code": r[1],
            "client": r[2],
            "issue": r[3],
            "status": r[4],
            "variant": r[5],
        }
        for r in cur.fetchall()
    ]


def fetch_upcoming_maintenance(
    cur,
    *,
    user_role: Optional[str],
    user_id: Optional[str],
    is_client: bool,
    client_org_id: Optional[str],
) -> list[dict[str, Any]]:
    """Return scheduled upcoming maintenance tasks within the caller's scope."""
    cur.execute("SELECT to_regclass('public.maintenance_schedules');")
    has_maint = cur.fetchone()[0] is not None
    if not has_maint:
        return []

    if is_client:
        if user_role == "OPERATOR":
            cur.execute(
                f"""
                SELECT
                    m.id::text,
                    m.machine_code,
                    COALESCE(o.company_name, 'PowerTech Fleet') AS client,
                    ms.task_name AS task,
                    TO_CHAR(ms.scheduled_date, 'FMDD Mon YYYY') AS date
                FROM maintenance_schedules ms
                JOIN machines m ON ms.machine_id = m.id
                {_OPERATOR_MACHINE_SCOPE_JOIN}
                LEFT JOIN organizations o ON ms.organization_id = o.id
                WHERE ms.status = 'Scheduled'
                  AND ms.is_deleted IS NOT TRUE
                  AND m.is_deleted IS NOT TRUE
                  AND m.organization_id = %s
                ORDER BY ms.scheduled_date ASC
                LIMIT 5;
                """,
                (user_id, client_org_id),
            )
        else:
            cur.execute(
                """
                SELECT
                    m.id::text,
                    m.machine_code,
                    COALESCE(o.company_name, 'PowerTech Fleet') AS client,
                    ms.task_name AS task,
                    TO_CHAR(ms.scheduled_date, 'FMDD Mon YYYY') AS date
                FROM maintenance_schedules ms
                JOIN machines m ON ms.machine_id = m.id
                LEFT JOIN organizations o ON ms.organization_id = o.id
                WHERE ms.status = 'Scheduled'
                  AND ms.is_deleted IS NOT TRUE
                  AND m.is_deleted IS NOT TRUE
                  AND m.organization_id = %s
                ORDER BY ms.scheduled_date ASC
                LIMIT 5;
                """,
                (client_org_id,),
            )
    else:
        cur.execute(
            """
            SELECT
                m.id::text,
                m.machine_code,
                COALESCE(o.company_name, 'PowerTech Fleet') AS client,
                ms.task_name AS task,
                TO_CHAR(ms.scheduled_date, 'FMDD Mon YYYY') AS date
            FROM maintenance_schedules ms
            JOIN machines m ON ms.machine_id = m.id
            LEFT JOIN organizations o ON ms.organization_id = o.id
            WHERE ms.status = 'Scheduled'
              AND ms.is_deleted IS NOT TRUE
              AND m.is_deleted IS NOT TRUE
            ORDER BY ms.scheduled_date ASC
            LIMIT 5;
            """
        )

    return [
        {
            "id": r[0],
            "machine_code": r[1],
            "client": r[2],
            "task": r[3],
            "date": r[4],
        }
        for r in cur.fetchall()
    ]


def fetch_recent_clients(cur, *, is_client: bool) -> list[dict[str, Any]]:
    """Return recently onboarded organizations for OEM managers."""
    if is_client:
        return []

    cur.execute(
        """
        SELECT
            o.id::text,
            o.client_code,
            o.company_name,
            TO_CHAR(COALESCE(o.onboarding_date, o.created_at::DATE), 'FMDD Mon YYYY') AS onboard_date,
            COUNT(m.id) AS machines_count,
            COALESCE(o.status, 'Active') AS status
        FROM organizations o
        LEFT JOIN machines m ON o.id = m.organization_id AND m.is_deleted IS NOT TRUE
        WHERE o.is_deleted IS NOT TRUE
        GROUP BY o.id, o.client_code, o.company_name, o.onboarding_date, o.created_at, o.status
        ORDER BY COALESCE(o.onboarding_date, o.created_at::DATE) DESC, o.client_code DESC
        LIMIT 5;
        """
    )
    return [
        {
            "id": r[0],
            "client_code": r[1],
            "company_name": r[2],
            "onboard_date": r[3],
            "machines_count": r[4],
            "status": r[5],
        }
        for r in cur.fetchall()
    ]

