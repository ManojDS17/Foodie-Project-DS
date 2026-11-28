from typing import List, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from ..auth import get_current_user
from ..database import get_db_cursor
from ..services.dashboard_queries import (
    fetch_attention_machines,
    fetch_client_metrics,
    fetch_fleet_machine_counts,
    fetch_open_alerts_summary,
    fetch_recent_clients,
    fetch_upcoming_maintenance,
)
from ..services.telemetry_service import fetch_dashboard_telemetry

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"], dependencies=[Depends(get_current_user)])


class EnergyHistoryPoint(BaseModel):
    date: str
    displayDate: str
    fullDate: str
    kwh: float


class AttentionMachine(BaseModel):
    id: str
    machine_code: str
    client: str
    issue: str
    status: str
    variant: str


class UpcomingMaintenance(BaseModel):
    id: str
    machine_code: str
    client: str
    task: str
    date: str


class RecentClient(BaseModel):
    id: str
    client_code: str
    company_name: str
    onboard_date: str
    machines_count: int
    status: str


class DashboardStatsResponse(BaseModel):
    total_clients: int
    clients_onboarded_this_month: int
    total_machines: int
    online_machines: int
    offline_machines: int
    telemetry_connected: bool = False
    energy_consumed_today_kwh: Optional[float] = None
    waste_intake_today_kg: Optional[float] = None
    compost_produced_today_kg: Optional[float] = None
    open_alerts_count: int
    alert_clients_count: int
    energy_history_14d: List[EnergyHistoryPoint]
    attention_machines: List[AttentionMachine]
    upcoming_maintenance: List[UpcomingMaintenance]
    recent_clients: List[RecentClient]


@router.get("/stats", response_model=DashboardStatsResponse)
def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    with get_db_cursor() as cur:
        user_role = current_user.get("role")
        user_id = current_user.get("id")
        is_client = user_role != "OEM_MANAGER"
        client_org_id = current_user.get("organization_id") if is_client else None

        total_clients, clients_this_month = fetch_client_metrics(cur, is_client=is_client)
        total_machines, online_machines, offline_machines = fetch_fleet_machine_counts(
            cur,
            user_role=user_role,
            user_id=user_id,
            is_client=is_client,
            client_org_id=client_org_id,
        )
        (
            telemetry_connected,
            energy_today,
            waste_today,
            compost_today,
            energy_history_rows,
        ) = fetch_dashboard_telemetry(
            cur,
            user_role=user_role,
            user_id=user_id,
            client_org_id=client_org_id,
        )
        open_alerts, alert_clients = fetch_open_alerts_summary(
            cur,
            is_client=is_client,
            client_org_id=client_org_id,
        )
        attention_rows = fetch_attention_machines(
            cur,
            user_role=user_role,
            user_id=user_id,
            is_client=is_client,
            client_org_id=client_org_id,
        )
        maintenance_rows = fetch_upcoming_maintenance(
            cur,
            user_role=user_role,
            user_id=user_id,
            is_client=is_client,
            client_org_id=client_org_id,
        )
        recent_client_rows = fetch_recent_clients(cur, is_client=is_client)

        return DashboardStatsResponse(
            total_clients=total_clients,
            clients_onboarded_this_month=clients_this_month,
            total_machines=total_machines,
            online_machines=online_machines,
            offline_machines=offline_machines,
            telemetry_connected=telemetry_connected,
            energy_consumed_today_kwh=round(energy_today, 1) if energy_today is not None else None,
            waste_intake_today_kg=round(waste_today, 1) if waste_today is not None else None,
            compost_produced_today_kg=round(compost_today, 1) if compost_today is not None else None,
            open_alerts_count=open_alerts,
            alert_clients_count=alert_clients,
            energy_history_14d=[EnergyHistoryPoint(**pt) for pt in energy_history_rows],
            attention_machines=[AttentionMachine(**item) for item in attention_rows],
            upcoming_maintenance=[UpcomingMaintenance(**item) for item in maintenance_rows],
            recent_clients=[RecentClient(**item) for item in recent_client_rows],
        )
