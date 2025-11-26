"""Broadcast endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.core import deps
from app.core.auth import AuthUser
from app.schemas.notifications import BroadcastCreate, BroadcastPreview
from app.services.broadcast_service import BroadcastService


router = APIRouter()


@router.post("/preview", response_model=BroadcastPreview)
async def preview_broadcast(
    payload: BroadcastCreate,
    service: BroadcastService = Depends(deps.get_broadcast_service),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR")),
) -> BroadcastPreview:
    return await service.preview_broadcast(payload)


@router.post("/send", status_code=status.HTTP_202_ACCEPTED)
async def send_broadcast(
    payload: BroadcastCreate,
    service: BroadcastService = Depends(deps.get_broadcast_service),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR")),
) -> dict[str, str]:
    try:
        job_id = await service.enqueue_broadcast(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {"job_id": job_id}
