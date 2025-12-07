"""Parent-facing endpoints.

TDD-BUG1.4 fix: Uses TenantAuthUser for tenant context validation.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core import deps
from app.core.deps import TenantAuthUser, get_current_tenant_user
from app.schemas.guardians import GuardianPreferencesRead, GuardianPreferencesUpdate
from app.services.consent_service import ConsentService


router = APIRouter()


def _require_parent_or_admin_role(user: TenantAuthUser) -> TenantAuthUser:
    """Validate user has PARENT or ADMIN role."""
    if user.role not in ("PARENT", "ADMIN", "DIRECTOR"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permisos insuficientes")
    return user


@router.get("/{guardian_id}/preferences", response_model=GuardianPreferencesRead)
async def get_preferences(
    guardian_id: int,
    request: Request,
    service: ConsentService = Depends(deps.get_consent_service),
    user: TenantAuthUser = Depends(get_current_tenant_user),
) -> GuardianPreferencesRead:
    """
    Get guardian preferences.

    TDD-BUG1.4 fix: Uses TenantAuthUser to ensure tenant context validation.
    """
    _require_parent_or_admin_role(user)

    # Parents can only access their own preferences
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
    request: Request,
    service: ConsentService = Depends(deps.get_consent_service),
    user: TenantAuthUser = Depends(get_current_tenant_user),
) -> GuardianPreferencesRead:
    """
    Update guardian preferences.

    TDD-BUG1.4 fix: Uses TenantAuthUser to ensure tenant context validation.
    """
    _require_parent_or_admin_role(user)

    # Parents can only update their own preferences
    if user.role == "PARENT" and user.guardian_id != guardian_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    try:
        return await service.update_guardian_preferences(guardian_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
