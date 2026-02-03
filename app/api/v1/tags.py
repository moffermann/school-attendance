"""NFC/QR tag provisioning endpoints."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.core import deps
from app.core.auth import AuthUser
from app.schemas.tags import TagConfirmRequest, TagProvisionRequest, TagProvisionResponse, TagRead
from app.services.tag_provision_service import ConcurrentEnrollmentError, TagProvisionService


router = APIRouter()


@router.post("/provision", response_model=TagProvisionResponse)
async def provision_tag(
    payload: TagProvisionRequest,
    service: TagProvisionService = Depends(deps.get_tag_provision_service),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR", "INSPECTOR")),
) -> TagProvisionResponse:
    try:
        return await service.provision(payload)
    except ConcurrentEnrollmentError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post("/confirm", response_model=TagRead, status_code=status.HTTP_201_CREATED)
async def confirm_tag(
    payload: TagConfirmRequest,
    service: TagProvisionService = Depends(deps.get_tag_provision_service),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR", "INSPECTOR")),
) -> TagRead:
    try:
        return await service.confirm(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/{tag_id}/revoke", response_model=TagRead)
async def revoke_tag(
    tag_id: int,
    service: TagProvisionService = Depends(deps.get_tag_provision_service),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR", "INSPECTOR")),
) -> TagRead:
    try:
        return await service.revoke(tag_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/cleanup", status_code=status.HTTP_200_OK)
async def cleanup_expired_tags(
    service: TagProvisionService = Depends(deps.get_tag_provision_service),
    _: AuthUser = Depends(deps.require_roles("ADMIN")),
) -> dict[str, Any]:
    """Clean up PENDING tags that have been waiting more than 1 hour.

    Changes their status to EXPIRED. Only ADMIN can run this.
    """
    count = await service.cleanup_expired_pending_tags()
    return {"expired_tags_cleaned": count}
