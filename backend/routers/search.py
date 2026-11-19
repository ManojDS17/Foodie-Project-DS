from fastapi import APIRouter, Query, Depends
from ..database import get_db_cursor
from ..schemas import SearchResponse, SearchResultItemClient, SearchResultItemMachine
from ..auth import get_current_user

router = APIRouter(prefix="/api/search", tags=["Global Search"], dependencies=[Depends(get_current_user)])

@router.get("", response_model=SearchResponse)
def search_entities(
    q: str = Query("", description="Search term for clients and machines"),
    current_user: dict = Depends(get_current_user)
):
    query = q.strip()
    if not query:
        return SearchResponse(clients=[], machines=[], sites=[], users=[])

    user_role = current_user.get("role")
    user_org_id = current_user.get("organization_id")
    search_pattern = f"%{query}%"

    with get_db_cursor() as cur:
        # 1. Search Clients (Organizations)
        clients = []
        if user_role == "OEM_MANAGER":
            cur.execute("""
                SELECT id, client_code, company_name, contact_poc, email, phone_number, status
                FROM organizations
                WHERE (is_deleted IS NOT TRUE)
                  AND (
                    company_name ILIKE %s
                    OR client_code ILIKE %s
                    OR COALESCE(contact_poc, '') ILIKE %s
                    OR COALESCE(email, '') ILIKE %s
                    OR COALESCE(phone_number, '') ILIKE %s
                    OR COALESCE(tax_id, '') ILIKE %s
                  )
                ORDER BY created_at DESC
                LIMIT 8;
            """, (search_pattern, search_pattern, search_pattern, search_pattern, search_pattern, search_pattern))
            for r in cur.fetchall():
                clients.append(SearchResultItemClient(
                    id=str(r[0]),
                    client_code=r[1] or "",
                    company_name=r[2] or "",
                    contact_poc=r[3],
                    email=r[4],
                    phone_number=r[5],
                    status=r[6] or "Active"
                ))
        elif user_org_id:
            cur.execute("""
                SELECT id, client_code, company_name, contact_poc, email, phone_number, status
                FROM organizations
                WHERE (is_deleted IS NOT TRUE)
                  AND id = %s
                  AND (
                    company_name ILIKE %s
                    OR client_code ILIKE %s
                    OR COALESCE(contact_poc, '') ILIKE %s
                    OR COALESCE(email, '') ILIKE %s
                    OR COALESCE(phone_number, '') ILIKE %s
                    OR COALESCE(tax_id, '') ILIKE %s
                  )
                LIMIT 1;
            """, (user_org_id, search_pattern, search_pattern, search_pattern, search_pattern, search_pattern, search_pattern))
            for r in cur.fetchall():
                clients.append(SearchResultItemClient(
                    id=str(r[0]),
                    client_code=r[1] or "",
                    company_name=r[2] or "",
                    contact_poc=r[3],
                    email=r[4],
                    phone_number=r[5],
                    status=r[6] or "Active"
                ))

        # 2. Search Machines
        machines = []
        if user_role == "OEM_MANAGER":
            cur.execute("""
                SELECT m.id, m.machine_code, m.serial_number, m.model,
                       COALESCE(m.location_label, '') AS location,
                       o.company_name,
                       m.operational_status, m.connectivity_status,
                       m.organization_id
                FROM machines m
                LEFT JOIN organizations o ON m.organization_id = o.id
                WHERE (m.is_deleted IS NOT TRUE)
                  AND (
                    m.machine_code ILIKE %s
                    OR m.serial_number ILIKE %s
                    OR m.model ILIKE %s
                    OR COALESCE(m.location_label, '') ILIKE %s
                    OR COALESCE(o.company_name, '') ILIKE %s
                  )
                ORDER BY m.created_at DESC
                LIMIT 8;
            """, (search_pattern, search_pattern, search_pattern, search_pattern, search_pattern))
            for r in cur.fetchall():
                status = r[6] or "Idle"
                machines.append(SearchResultItemMachine(
                    id=str(r[0]),
                    machine_code=r[1] or "",
                    serial_number=r[2] or "",
                    model=r[3] or "",
                    location=r[4] or "",
                    company_name=r[5] or "Unassigned",
                    status=status,
                    connectivity_status=r[7] or "Offline",
                    temp="62°C"
                ))
        elif user_org_id:
            cur.execute("""
                SELECT m.id, m.machine_code, m.serial_number, m.model,
                       COALESCE(m.location_label, '') AS location,
                       o.company_name,
                       m.operational_status, m.connectivity_status
                FROM machines m
                LEFT JOIN organizations o ON m.organization_id = o.id
                WHERE (m.is_deleted IS NOT TRUE)
                  AND m.organization_id = %s
                  AND (
                    m.machine_code ILIKE %s
                    OR m.serial_number ILIKE %s
                    OR m.model ILIKE %s
                    OR COALESCE(m.location_label, '') ILIKE %s
                  )
                ORDER BY m.created_at DESC
                LIMIT 8;
            """, (user_org_id, search_pattern, search_pattern, search_pattern, search_pattern))
            for r in cur.fetchall():
                machines.append(SearchResultItemMachine(
                    id=str(r[0]),
                    machine_code=r[1] or "",
                    serial_number=r[2] or "",
                    model=r[3] or "",
                    location=r[4] or "",
                    company_name=r[5] or "",
                    status=r[6] or "Idle",
                    connectivity_status=r[7] or "Offline",
                    temp="62°C"
                ))

        return SearchResponse(
            clients=clients,
            machines=machines,
            sites=[],
            users=[]
        )
