from typing import List
from fastapi import APIRouter, HTTPException, status, Depends
from ..database import get_db_cursor
from ..schemas import SiteCreate, SiteUpdate, SiteResponse
from ..auth import get_current_user

router = APIRouter(prefix="/api/sites", tags=["Sites"], dependencies=[Depends(get_current_user)])

@router.get("", response_model=List[SiteResponse])
def get_all_sites(current_user: dict = Depends(get_current_user)):
    user_role = current_user.get("role")
    if user_role == "OPERATOR":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Sites are hidden for operators."
        )

    with get_db_cursor() as cur:
        if user_role == "OEM_MANAGER":
            cur.execute("SELECT * FROM sites ORDER BY site_code ASC;")
        else:
            user_org_id = current_user.get("organization_id")
            if not user_org_id:
                return []
            cur.execute("SELECT * FROM sites WHERE organization_id = %s ORDER BY site_code ASC;", (user_org_id,))

        rows = cur.fetchall()
        cols = [desc[0] for desc in cur.description]
        results = []
        for r in rows:
            d = dict(zip(cols, r))
            d["id"] = str(d["id"])
            d["organization_id"] = str(d["organization_id"])
            results.append(SiteResponse(**d))
        return results

@router.post("", response_model=SiteResponse, status_code=status.HTTP_201_CREATED)
def create_site(payload: SiteCreate, current_user: dict = Depends(get_current_user)):
    user_role = current_user.get("role")
    if user_role == "OPERATOR":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Operators cannot create sites.")

    target_org_id = payload.organization_id
    if user_role != "OEM_MANAGER":
        target_org_id = current_user.get("organization_id")

    if not target_org_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid client organization ID is required to register a facility site."
        )

    normalized_code = payload.site_code.strip().upper()

    with get_db_cursor(commit=True) as cur:
        # Check uniqueness constraint
        cur.execute(
            "SELECT id FROM sites WHERE organization_id = %s AND UPPER(site_code) = %s;",
            (target_org_id, normalized_code)
        )
        if cur.fetchone():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f'Site code "{normalized_code}" is already registered. Site codes must be unique.'
            )

        cur.execute("""
            INSERT INTO sites (organization_id, site_code, site_name, address, latitude, longitude, timezone, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *;
        """, (
            target_org_id,
            normalized_code,
            payload.site_name.strip(),
            payload.address.strip(),
            payload.latitude,
            payload.longitude,
            payload.timezone or 'Australia/Adelaide',
            payload.is_active if payload.is_active is not None else True
        ))
        row = cur.fetchone()
        cols = [desc[0] for desc in cur.description]
        d = dict(zip(cols, row))
        d["id"] = str(d["id"])
        d["organization_id"] = str(d["organization_id"])
        return SiteResponse(**d)

@router.put("/{site_id}", response_model=SiteResponse)
def update_site(site_id: str, payload: SiteUpdate, current_user: dict = Depends(get_current_user)):
    user_role = current_user.get("role")
    if user_role == "OPERATOR":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Operators cannot modify sites.")

    with get_db_cursor(commit=True) as cur:
        if user_role != "OEM_MANAGER":
            cur.execute("SELECT organization_id FROM sites WHERE id = %s;", (site_id,))
            target_site = cur.fetchone()
            if not target_site:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site not found.")
            if str(target_site[0] or "") != str(current_user.get("organization_id") or ""):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Cannot modify sites of another organization.")
        cur.execute("""
            UPDATE sites
            SET site_name = COALESCE(%s, site_name),
                address = COALESCE(%s, address),
                latitude = COALESCE(%s, latitude),
                longitude = COALESCE(%s, longitude),
                timezone = COALESCE(%s, timezone),
                is_active = COALESCE(%s, is_active),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING *;
        """, (
            payload.site_name.strip() if payload.site_name else None,
            payload.address.strip() if payload.address else None,
            payload.latitude,
            payload.longitude,
            payload.timezone,
            payload.is_active,
            site_id
        ))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site not found.")

        cols = [desc[0] for desc in cur.description]
        d = dict(zip(cols, row))
        d["id"] = str(d["id"])
        d["organization_id"] = str(d["organization_id"])
        return SiteResponse(**d)

@router.delete("/{site_id}")
def delete_site(site_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "OEM_MANAGER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only OEM Managers can delete sites."
        )
    with get_db_cursor(commit=True) as cur:
        cur.execute("DELETE FROM sites WHERE id = %s RETURNING id, site_code, site_name;", (site_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site not found.")
        return {"message": "Site deleted successfully.", "id": str(row[0]), "site_code": row[1]}
