"""Broadcast endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core import deps
from app.core.auth import AuthUser
from app.core.rate_limiter import limiter
from app.schemas.notifications import BroadcastCreate, BroadcastPreview
from app.services.broadcast_service import BroadcastService


router = APIRouter()


# R7-A5 fix: Add rate limiting to prevent broadcast spam
@router.post("/preview", response_model=BroadcastPreview)
@limiter.limit("10/minute")
async def preview_broadcast(
    request: Request,
    payload: BroadcastCreate,
    service: BroadcastService = Depends(deps.get_broadcast_service),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR")),
) -> BroadcastPreview:
    return await service.preview_broadcast(payload)


# R7-A5 fix: Strict rate limiting for actual sends
@router.post("/send", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("5/minute")
async def send_broadcast(
    request: Request,
    payload: BroadcastCreate,
    service: BroadcastService = Depends(deps.get_broadcast_service),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR")),
) -> dict[str, str]:
    try:
        job_id = await service.enqueue_broadcast(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {"job_id": job_id}
