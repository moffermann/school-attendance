"""API endpoints for parent withdrawal requests.

Two sets of endpoints:
- Parent-facing: under /parents/{guardian_id}/withdrawal-requests
- Staff-facing: under /withdrawal-requests
"""

from __future__ import annotations

import logging
from datetime import date, time

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import deps
from app.core.deps import TenantAuthUser
from app.services.withdrawal_request_service import WithdrawalRequestService

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)

# Two routers: one for parent endpoints, one for staff endpoints
parent_router = APIRouter()
staff_router = APIRouter()


# ==================== Schemas ====================


class WithdrawalRequestCreate(BaseModel):
    student_id: int = Field(..., gt=0)
    authorized_pickup_id: int = Field(..., gt=0)
    scheduled_date: date
    scheduled_time: time | None = None
    reason: str | None = Field(None, max_length=500)

    @field_validator("scheduled_date")
    @classmethod
    def validate_not_past(cls, v: date) -> date:
        from datetime import UTC, datetime

        today = datetime.now(UTC).date()
        if v < today:
            raise ValueError("Fecha debe ser hoy o futura")
        return v


class WithdrawalRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    authorized_pickup_id: int
    status: str
    scheduled_date: date
    scheduled_time: time | None = None
    reason: str | None = None
    pickup_name: str | None = None
    pickup_relationship: str | None = None
    student_name: str | None = None
    review_notes: str | None = None
    reviewed_at: str | None = None
    created_at: str


class ReviewRequest(BaseModel):
    notes: str | None = Field(None, max_length=500)


# ==================== Helpers ====================


def _require_parent_or_admin(user: TenantAuthUser, guardian_id: int) -> None:
    """Validate user owns this guardian or is staff."""
    if user.role in ("ADMIN", "DIRECTOR", "INSPECTOR"):
        return
    if user.role != "PARENT":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Permisos insuficientes"
        )
    if user.guardian_id != guardian_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado"
        )


def _require_staff(user: TenantAuthUser) -> None:
    """Validate user is staff (admin, director, or inspector)."""
    if user.role not in ("ADMIN", "DIRECTOR", "INSPECTOR"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo personal autorizado puede realizar esta acción",
        )


def _to_response(req: object) -> WithdrawalRequestResponse:
    """Map a WithdrawalRequest ORM instance to the response schema."""
    pickup_name = None
    pickup_relationship = None
    student_name = None

    if hasattr(req, "authorized_pickup") and req.authorized_pickup:
        pickup_name = req.authorized_pickup.full_name
        pickup_relationship = req.authorized_pickup.relationship_type
    if hasattr(req, "student") and req.student:
        student_name = req.student.full_name

    reviewed_at_str = None
    if req.reviewed_at:
        reviewed_at_str = req.reviewed_at.isoformat()

    return WithdrawalRequestResponse(
        id=req.id,
        student_id=req.student_id,
        authorized_pickup_id=req.authorized_pickup_id,
        status=req.status,
        scheduled_date=req.scheduled_date,
        scheduled_time=req.scheduled_time,
        reason=req.reason,
        pickup_name=pickup_name,
        pickup_relationship=pickup_relationship,
        student_name=student_name,
        review_notes=req.review_notes,
        reviewed_at=reviewed_at_str,
        created_at=req.created_at.isoformat(),
    )


# ==================== Parent Endpoints ====================


@parent_router.get("", response_model=list[WithdrawalRequestResponse])
@limiter.limit("30/minute")
async def list_parent_withdrawal_requests(
    request: Request,
    guardian_id: int = Path(..., gt=0),
    student_id: int | None = Query(None, gt=0),
    request_status: str | None = Query(None, alias="status"),
    session: AsyncSession = Depends(deps.get_tenant_db),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> list[WithdrawalRequestResponse]:
    """List withdrawal requests for this guardian."""
    _require_parent_or_admin(user, guardian_id)

    service = WithdrawalRequestService(session)
    requests = await service.request_repo.list_by_guardian(
        guardian_id,
        student_id=student_id,
        status=request_status,
    )
    return [_to_response(r) for r in requests]


@parent_router.post(
    "", response_model=WithdrawalRequestResponse, status_code=status.HTTP_201_CREATED
)
@limiter.limit("20/minute")
async def create_parent_withdrawal_request(
    request: Request,
    payload: WithdrawalRequestCreate,
    guardian_id: int = Path(..., gt=0),
    session: AsyncSession = Depends(deps.get_tenant_db),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> WithdrawalRequestResponse:
    """Create a new withdrawal request."""
    _require_parent_or_admin(user, guardian_id)

    service = WithdrawalRequestService(session)
    wr = await service.create_request(
        guardian_id,
        user.id,
        student_id=payload.student_id,
        authorized_pickup_id=payload.authorized_pickup_id,
        scheduled_date=payload.scheduled_date,
        scheduled_time=payload.scheduled_time,
        reason=payload.reason,
    )
    await session.commit()
    return _to_response(wr)


@parent_router.get("/{request_id}", response_model=WithdrawalRequestResponse)
async def get_parent_withdrawal_request(
    guardian_id: int = Path(..., gt=0),
    request_id: int = Path(..., gt=0),
    session: AsyncSession = Depends(deps.get_tenant_db),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> WithdrawalRequestResponse:
    """Get detail of a specific withdrawal request."""
    _require_parent_or_admin(user, guardian_id)

    service = WithdrawalRequestService(session)
    req = await service.request_repo.get(request_id)
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada"
        )
    if req.requested_by_guardian_id != guardian_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado"
        )
    return _to_response(req)


@parent_router.post("/{request_id}/cancel", response_model=WithdrawalRequestResponse)
@limiter.limit("10/minute")
async def cancel_parent_withdrawal_request(
    request: Request,
    guardian_id: int = Path(..., gt=0),
    request_id: int = Path(..., gt=0),
    session: AsyncSession = Depends(deps.get_tenant_db),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> WithdrawalRequestResponse:
    """Cancel a withdrawal request (parent action)."""
    _require_parent_or_admin(user, guardian_id)

    service = WithdrawalRequestService(session)
    updated = await service.cancel_request(request_id, guardian_id)
    await session.commit()
    return _to_response(updated)


# ==================== Staff Endpoints ====================


@staff_router.get("", response_model=list[WithdrawalRequestResponse])
@limiter.limit("60/minute")
async def list_all_withdrawal_requests(
    request: Request,
    request_status: str | None = Query(None, alias="status"),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    session: AsyncSession = Depends(deps.get_tenant_db),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> list[WithdrawalRequestResponse]:
    """List all withdrawal requests (staff view)."""
    _require_staff(user)

    service = WithdrawalRequestService(session)
    requests = await service.request_repo.list_all(
        status=request_status,
        date_from=date_from,
        date_to=date_to,
    )
    return [_to_response(r) for r in requests]


@staff_router.get("/today", response_model=list[WithdrawalRequestResponse])
async def list_today_approved_requests(
    session: AsyncSession = Depends(deps.get_tenant_db),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> list[WithdrawalRequestResponse]:
    """List APPROVED requests for today (for kiosk/staff dashboard)."""
    _require_staff(user)

    service = WithdrawalRequestService(session)
    requests = await service.request_repo.list_approved_for_today()
    return [_to_response(r) for r in requests]


@staff_router.get("/pending", response_model=list[WithdrawalRequestResponse])
async def list_pending_requests(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    course_id: int | None = Query(None, gt=0),
    session: AsyncSession = Depends(deps.get_tenant_db),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> list[WithdrawalRequestResponse]:
    """List PENDING requests for staff review."""
    _require_staff(user)

    service = WithdrawalRequestService(session)
    requests = await service.request_repo.list_pending(
        date_from=date_from,
        date_to=date_to,
        course_id=course_id,
    )
    return [_to_response(r) for r in requests]


@staff_router.get("/{request_id}", response_model=WithdrawalRequestResponse)
async def get_withdrawal_request(
    request_id: int = Path(..., gt=0),
    session: AsyncSession = Depends(deps.get_tenant_db),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> WithdrawalRequestResponse:
    """Get detail of a specific withdrawal request (staff)."""
    _require_staff(user)

    service = WithdrawalRequestService(session)
    req = await service.request_repo.get(request_id)
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada"
        )
    return _to_response(req)


@staff_router.post("/{request_id}/approve", response_model=WithdrawalRequestResponse)
@limiter.limit("30/minute")
async def approve_withdrawal_request(
    request: Request,
    request_id: int = Path(..., gt=0),
    payload: ReviewRequest | None = None,
    session: AsyncSession = Depends(deps.get_tenant_db),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> WithdrawalRequestResponse:
    """Approve a pending withdrawal request (staff action)."""
    _require_staff(user)

    notes = payload.notes if payload else None
    service = WithdrawalRequestService(session)
    updated = await service.approve_request(request_id, user.id, notes)
    await session.commit()
    return _to_response(updated)


@staff_router.post("/{request_id}/reject", response_model=WithdrawalRequestResponse)
@limiter.limit("30/minute")
async def reject_withdrawal_request(
    request: Request,
    request_id: int = Path(..., gt=0),
    payload: ReviewRequest | None = None,
    session: AsyncSession = Depends(deps.get_tenant_db),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> WithdrawalRequestResponse:
    """Reject a pending withdrawal request (staff action)."""
    _require_staff(user)

    notes = payload.notes if payload else None
    service = WithdrawalRequestService(session)
    updated = await service.reject_request(request_id, user.id, notes)
    await session.commit()
    return _to_response(updated)
