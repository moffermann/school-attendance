"""Parent-facing endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.core import deps
from app.core.auth import AuthUser
from app.schemas.guardians import GuardianPreferencesRead, GuardianPreferencesUpdate
from app.services.consent_service import ConsentService


router = APIRouter()


@router.get("/{guardian_id}/preferences", response_model=GuardianPreferencesRead)
async def get_preferences(
    guardian_id: int,
    service: ConsentService = Depends(deps.get_consent_service),
    user: AuthUser = Depends(deps.require_roles("PARENT", "ADMIN")),
) -> GuardianPreferencesRead:
    if user.role == "PARENT" and user.guardian_id != guardian_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    try:
        return await service.get_guardian_preferences(guardian_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/{guardian_id}/preferences", response_model=GuardianPreferencesRead)
async def update_preferences(
    guardian_id: int,
    payload: GuardianPreferencesUpdate,
    service: ConsentService = Depends(deps.get_consent_service),
    user: AuthUser = Depends(deps.require_roles("PARENT", "ADMIN")),
) -> GuardianPreferencesRead:
    if user.role == "PARENT" and user.guardian_id != guardian_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    try:
        return await service.update_guardian_preferences(guardian_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
