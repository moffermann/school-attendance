"""NFC/QR tag provisioning endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.core import deps
from app.core.auth import AuthUser
from app.schemas.tags import TagConfirmRequest, TagProvisionRequest, TagProvisionResponse, TagRead
from app.services.tag_provision_service import TagProvisionService


router = APIRouter()


@router.post("/provision", response_model=TagProvisionResponse)
async def provision_tag(
    payload: TagProvisionRequest,
    service: TagProvisionService = Depends(deps.get_tag_provision_service),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR", "INSPECTOR")),
) -> TagProvisionResponse:
    return await service.provision(payload)


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
