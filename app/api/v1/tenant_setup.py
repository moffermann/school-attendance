"""Tenant Admin Setup endpoints for account activation."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import deps
from app.services.tenant_provisioning_service import TenantProvisioningService

router = APIRouter()


class ValidateTokenRequest(BaseModel):
    """Request to validate a setup token."""

    token: str


class ValidateTokenResponse(BaseModel):
    """Response from token validation."""

    valid: bool
    email: str | None = None
    tenant_name: str | None = None
    expires_at: str | None = None


class CompleteSetupRequest(BaseModel):
    """Request to complete admin setup."""

    token: str
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=2, max_length=255)


class CompleteSetupResponse(BaseModel):
    """Response from completing setup."""

    success: bool
    tenant_name: str
    email: str
    message: str


@router.post("/validate-token", response_model=ValidateTokenResponse)
async def validate_setup_token(
    payload: ValidateTokenRequest,
    session: AsyncSession = Depends(deps.get_public_db),
) -> ValidateTokenResponse:
    """
    Validate a tenant admin setup token.

    Returns information about the invitation if valid.
    """
    from app.db.repositories.tenants import TenantRepository

    provisioning_service = TenantProvisioningService(session)
    invitation = await provisioning_service.validate_invitation_token(payload.token)

    if not invitation:
        return ValidateTokenResponse(valid=False)

    # Get tenant name
    tenant_repo = TenantRepository(session)
    tenant = await tenant_repo.get(invitation.tenant_id)

    return ValidateTokenResponse(
        valid=True,
        email=invitation.email,
        tenant_name=tenant.name if tenant else None,
        expires_at=invitation.expires_at.isoformat() if invitation.expires_at else None,
    )


@router.post("/complete", response_model=CompleteSetupResponse)
async def complete_admin_setup(
    payload: CompleteSetupRequest,
    session: AsyncSession = Depends(deps.get_public_db),
) -> CompleteSetupResponse:
    """
    Complete tenant admin account setup.

    Creates the admin user in the tenant schema and marks the invitation as used.
    """
    provisioning_service = TenantProvisioningService(session)

    try:
        result = await provisioning_service.complete_admin_setup(
            token=payload.token,
            password=payload.password,
            full_name=payload.full_name,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e

    return CompleteSetupResponse(
        success=True,
        tenant_name=result["tenant_name"],
        email=result["email"],
        message="Cuenta creada exitosamente. Ya puede iniciar sesión.",
    )
