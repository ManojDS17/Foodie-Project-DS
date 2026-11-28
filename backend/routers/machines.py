from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from ..auth import get_current_user
from ..database import get_db_cursor
from ..schemas import (
    MachineCreate,
    MachineModelResponse,
    MachineResponse,
    MachineUpdate,
    OperatorMachineAssignmentCreate,
    OperatorMachineAssignmentResponse,
    TerminateLeaseRequest,
)
from ..services.lease_service import terminate_machine_lease
from ..services.machine_service import (
    SQL_SELECT_MACHINE_JOINED,
    compute_next_machine_code,
    create_machine_record,
    delete_machine_record,
    get_machine_by_identifier,
    list_machine_models,
    list_machines,
    row_to_machine_dict,
    update_machine_record,
)
from ..services.operator_assignment_service import (
    assign_operator_to_machine,
    list_operator_assignments,
    revoke_operator_assignment,
)

__all__ = [
    "SQL_SELECT_MACHINE_JOINED",
    "row_to_machine_dict",
    "router",
]

router = APIRouter(prefix="/api/machines", tags=["Machines"], dependencies=[Depends(get_current_user)])


@router.get("/next-code")
def get_next_machine_code(current_user: dict = Depends(get_current_user)):
    """Return the next sequential machine code in the C001 series without reusing prior IDs."""
    if current_user.get("role") != "OEM_MANAGER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only OEM Managers can generate machine codes.",
        )
    with get_db_cursor() as cur:
        return {"next_code": compute_next_machine_code(cur)}


@router.get("/models", response_model=List[MachineModelResponse])
def get_machine_models():
    """Fetch machine models ordered by series progression."""
    with get_db_cursor() as cur:
        return list_machine_models(cur)


@router.get("", response_model=List[MachineResponse])
def get_all_machines(
    response: Response,
    skip: int = Query(0, ge=0),
    limit: Optional[int] = Query(None, ge=1, le=500),
    search: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    with get_db_cursor() as cur:
        return list_machines(
            cur,
            response=response,
            skip=skip,
            limit=limit,
            search=search,
            current_user=current_user,
        )


@router.get("/operator-assignments", response_model=List[OperatorMachineAssignmentResponse])
def get_operator_machine_assignments(
    organization_id: Optional[str] = None,
    operator_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    with get_db_cursor() as cur:
        return list_operator_assignments(
            cur,
            organization_id=organization_id,
            operator_id=operator_id,
            current_user=current_user,
        )


@router.post("/operator-assignments", response_model=OperatorMachineAssignmentResponse, status_code=status.HTTP_201_CREATED)
def assign_machine_to_operator(
    payload: OperatorMachineAssignmentCreate,
    current_user: dict = Depends(get_current_user),
):
    with get_db_cursor(commit=True) as cur:
        return assign_operator_to_machine(cur, payload=payload, current_user=current_user)


@router.post("/operator-assignments/{assignment_id}/revoke")
def revoke_operator_machine_assignment(
    assignment_id: str,
    current_user: dict = Depends(get_current_user),
):
    with get_db_cursor(commit=True) as cur:
        return revoke_operator_assignment(cur, assignment_id=assignment_id, current_user=current_user)


@router.get("/{machine_id}", response_model=MachineResponse)
def get_machine(machine_id: str, current_user: dict = Depends(get_current_user)):
    with get_db_cursor() as cur:
        return get_machine_by_identifier(cur, machine_id=machine_id, current_user=current_user)


@router.post("", response_model=MachineResponse, status_code=status.HTTP_201_CREATED)
def create_machine(payload: MachineCreate, current_user: dict = Depends(get_current_user)):
    with get_db_cursor(commit=True) as cur:
        return create_machine_record(cur, payload=payload, current_user=current_user)


@router.put("/{machine_id}", response_model=MachineResponse)
def update_machine(machine_id: str, payload: MachineUpdate, current_user: dict = Depends(get_current_user)):
    with get_db_cursor(commit=True) as cur:
        return update_machine_record(cur, machine_id=machine_id, payload=payload, current_user=current_user)


@router.delete("/{machine_id}")
def delete_machine(machine_id: str, current_user: dict = Depends(get_current_user)):
    with get_db_cursor(commit=True) as cur:
        return delete_machine_record(cur, machine_id=machine_id, current_user=current_user)


@router.post("/{machine_id}/unassign")
def unassign_machine(
    machine_id: str,
    payload: Optional[TerminateLeaseRequest] = None,
    current_user: dict = Depends(get_current_user),
):
    """Terminate a machine lease and return the unit to the unassigned fleet."""
    with get_db_cursor(commit=True) as cur:
        remark = payload.termination_remark if payload else None
        return terminate_machine_lease(
            cur,
            machine_id=machine_id,
            termination_remark=remark,
            current_user=current_user,
        )
