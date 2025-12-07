"""Tenant management endpoints for Super Admin."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Path, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import deps
from app.db.models.tenant_feature import TenantFeature
from app.db.repositories.tenants import TenantRepository
from app.db.repositories.tenant_features import TenantFeatureRepository

router = APIRouter()


# ==================== Schemas ====================


class TenantCreate(BaseModel):
    """Schema for creating a new tenant."""

    name: str = Field(..., min_length=2, max_length=255)
    slug: str = Field(..., min_length=2, max_length=64, pattern=r"^[a-z0-9_-]+$")
    subdomain: str | None = Field(None, min_length=2, max_length=64, pattern=r"^[a-z0-9-]+$")
    domain: str | None = Field(None, max_length=255)
    plan: str = Field("standard", max_length=32)
    max_students: int = Field(500, ge=1)
    admin_email: EmailStr
    enabled_features: list[str] | None = None


class TenantUpdate(BaseModel):
    """Schema for updating a tenant."""

    name: str | None = Field(None, min_length=2, max_length=255)
    subdomain: str | None = Field(None, min_length=2, max_length=64, pattern=r"^[a-z0-9-]+$")
    domain: str | None = Field(None, max_length=255)
    plan: str | None = Field(None, max_length=32)
    max_students: int | None = Field(None, ge=1)
    is_active: bool | None = None


class TenantSummary(BaseModel):
    """Summary view of a tenant."""

    id: int
    slug: str
    name: str
    subdomain: str | None
    domain: str | None
    is_active: bool
    plan: str
    max_students: int
    created_at: datetime

    class Config:
        from_attributes = True


class TenantFeatureResponse(BaseModel):
    """Feature flag response."""

    feature_name: str
    is_enabled: bool
    config: dict

    class Config:
        from_attributes = True


class TenantDetail(TenantSummary):
    """Detailed view of a tenant with features."""

    config: dict
    updated_at: datetime
    features: list[TenantFeatureResponse] = []


class TenantListResponse(BaseModel):
    """Paginated tenant list response."""

    items: list[TenantSummary]
    total: int


class FeatureToggleRequest(BaseModel):
    """Request to toggle a feature."""

    enabled: bool


# ==================== Endpoints ====================


@router.get("/", response_model=TenantListResponse)
async def list_tenants(
    include_inactive: bool = False,
    admin: deps.SuperAdminUser = Depends(deps.get_current_super_admin),
    session: AsyncSession = Depends(deps.get_public_db),
) -> TenantListResponse:
    """List all tenants."""
    repo = TenantRepository(session)
    tenants = await repo.list_all(include_inactive=include_inactive)
    total = await repo.count(include_inactive=include_inactive)

    return TenantListResponse(
        items=[TenantSummary.model_validate(t) for t in tenants],
        total=total,
    )


@router.get("/{tenant_id}", response_model=TenantDetail)
async def get_tenant(
    tenant_id: int = Path(..., ge=1, description="Tenant ID (must be >= 1)"),
    admin: deps.SuperAdminUser = Depends(deps.get_current_super_admin),
    session: AsyncSession = Depends(deps.get_public_db),
) -> TenantDetail:
    """Get detailed tenant information."""
    tenant_repo = TenantRepository(session)
    feature_repo = TenantFeatureRepository(session)

    tenant = await tenant_repo.get(tenant_id)
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant no encontrado")

    features = await feature_repo.list_by_tenant(tenant_id)

    return TenantDetail(
        id=tenant.id,
        slug=tenant.slug,
        name=tenant.name,
        subdomain=tenant.subdomain,
        domain=tenant.domain,
        is_active=tenant.is_active,
        plan=tenant.plan,
        max_students=tenant.max_students,
        config=tenant.config,
        created_at=tenant.created_at,
        updated_at=tenant.updated_at,
        features=[TenantFeatureResponse.model_validate(f) for f in features],
    )


@router.post("/", response_model=TenantDetail, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    payload: TenantCreate,
    admin: deps.SuperAdminUser = Depends(deps.get_current_super_admin),
    session: AsyncSession = Depends(deps.get_public_db),
) -> TenantDetail:
    """
    Create a new tenant.

    This will:
    1. Create the tenant record
    2. Create the PostgreSQL schema
    3. Run migrations on the schema
    4. Initialize feature flags
    5. Send admin invitation email
    """
    from app.services.tenant_provisioning_service import TenantProvisioningService

    tenant_repo = TenantRepository(session)

    # Validate slug uniqueness
    if await tenant_repo.slug_exists(payload.slug):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El slug ya está en uso",
        )

    # Validate subdomain uniqueness
    if payload.subdomain and await tenant_repo.subdomain_exists(payload.subdomain):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El subdominio ya está en uso",
        )

    # Validate domain uniqueness
    if payload.domain and await tenant_repo.domain_exists(payload.domain):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El dominio ya está en uso",
        )

    # Use provisioning service
    provisioning_service = TenantProvisioningService(session)
    tenant = await provisioning_service.create_tenant(
        name=payload.name,
        slug=payload.slug,
        subdomain=payload.subdomain,
        domain=payload.domain,
        plan=payload.plan,
        max_students=payload.max_students,
        admin_email=payload.admin_email,
        enabled_features=payload.enabled_features,
        created_by_admin_id=admin.id,
    )

    await session.commit()

    # Fetch features for response
    feature_repo = TenantFeatureRepository(session)
    features = await feature_repo.list_by_tenant(tenant.id)

    return TenantDetail(
        id=tenant.id,
        slug=tenant.slug,
        name=tenant.name,
        subdomain=tenant.subdomain,
        domain=tenant.domain,
        is_active=tenant.is_active,
        plan=tenant.plan,
        max_students=tenant.max_students,
        config=tenant.config,
        created_at=tenant.created_at,
        updated_at=tenant.updated_at,
        features=[TenantFeatureResponse.model_validate(f) for f in features],
    )


@router.patch("/{tenant_id}", response_model=TenantDetail)
async def update_tenant(
    tenant_id: int,
    payload: TenantUpdate,
    admin: deps.SuperAdminUser = Depends(deps.get_current_super_admin),
    session: AsyncSession = Depends(deps.get_public_db),
) -> TenantDetail:
    """Update tenant settings."""
    tenant_repo = TenantRepository(session)
    feature_repo = TenantFeatureRepository(session)

    tenant = await tenant_repo.get(tenant_id)
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant no encontrado")

    # Validate subdomain uniqueness if changing
    if payload.subdomain and payload.subdomain != tenant.subdomain:
        if await tenant_repo.subdomain_exists(payload.subdomain, exclude_tenant_id=tenant_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El subdominio ya está en uso",
            )

    # Validate domain uniqueness if changing
    if payload.domain and payload.domain != tenant.domain:
        if await tenant_repo.domain_exists(payload.domain, exclude_tenant_id=tenant_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El dominio ya está en uso",
            )

    # Update tenant
    update_data = payload.model_dump(exclude_unset=True)
    tenant = await tenant_repo.update(tenant_id, **update_data)
    await session.commit()

    features = await feature_repo.list_by_tenant(tenant_id)

    return TenantDetail(
        id=tenant.id,
        slug=tenant.slug,
        name=tenant.name,
        subdomain=tenant.subdomain,
        domain=tenant.domain,
        is_active=tenant.is_active,
        plan=tenant.plan,
        max_students=tenant.max_students,
        config=tenant.config,
        created_at=tenant.created_at,
        updated_at=tenant.updated_at,
        features=[TenantFeatureResponse.model_validate(f) for f in features],
    )


@router.post("/{tenant_id}/deactivate")
async def deactivate_tenant(
    tenant_id: int,
    admin: deps.SuperAdminUser = Depends(deps.get_current_super_admin),
    session: AsyncSession = Depends(deps.get_public_db),
) -> dict:
    """Deactivate a tenant (keeps data, blocks access)."""
    tenant_repo = TenantRepository(session)

    tenant = await tenant_repo.get(tenant_id)
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant no encontrado")

    await tenant_repo.deactivate(tenant_id)
    await session.commit()

    return {"message": f"Tenant '{tenant.name}' desactivado exitosamente"}


@router.post("/{tenant_id}/activate")
async def activate_tenant(
    tenant_id: int,
    admin: deps.SuperAdminUser = Depends(deps.get_current_super_admin),
    session: AsyncSession = Depends(deps.get_public_db),
) -> dict:
    """Activate a deactivated tenant."""
    tenant_repo = TenantRepository(session)

    tenant = await tenant_repo.get(tenant_id)
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant no encontrado")

    await tenant_repo.activate(tenant_id)
    await session.commit()

    return {"message": f"Tenant '{tenant.name}' activado exitosamente"}


# ==================== Feature Management ====================


@router.get("/{tenant_id}/features", response_model=list[TenantFeatureResponse])
async def list_tenant_features(
    tenant_id: int,
    admin: deps.SuperAdminUser = Depends(deps.get_current_super_admin),
    session: AsyncSession = Depends(deps.get_public_db),
) -> list[TenantFeatureResponse]:
    """List all features for a tenant."""
    tenant_repo = TenantRepository(session)
    feature_repo = TenantFeatureRepository(session)

    tenant = await tenant_repo.get(tenant_id)
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant no encontrado")

    features = await feature_repo.list_by_tenant(tenant_id)
    return [TenantFeatureResponse.model_validate(f) for f in features]


@router.post("/{tenant_id}/features/{feature_name}")
async def toggle_feature(
    tenant_id: int,
    feature_name: str,
    payload: FeatureToggleRequest,
    admin: deps.SuperAdminUser = Depends(deps.get_current_super_admin),
    session: AsyncSession = Depends(deps.get_public_db),
) -> TenantFeatureResponse:
    """Enable or disable a feature for a tenant."""
    from app.services.feature_flag_service import clear_global_feature_cache

    tenant_repo = TenantRepository(session)
    feature_repo = TenantFeatureRepository(session)

    tenant = await tenant_repo.get(tenant_id)
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant no encontrado")

    # Validate feature name
    if feature_name not in TenantFeature.ALL_FEATURES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Feature '{feature_name}' no válido. Opciones: {TenantFeature.ALL_FEATURES}",
        )

    feature = await feature_repo.get(tenant_id, feature_name)
    if not feature:
        # Create feature if it doesn't exist
        feature = await feature_repo.create(
            tenant_id=tenant_id,
            feature_name=feature_name,
            is_enabled=payload.enabled,
        )
    else:
        feature = await feature_repo.set_enabled(tenant_id, feature_name, payload.enabled)

    await session.commit()

    # TDD-BUG2.1 fix: Invalidate cache after toggling feature
    clear_global_feature_cache(tenant_id)

    return TenantFeatureResponse.model_validate(feature)


# ==================== Admin Management ====================


class ResendInvitationRequest(BaseModel):
    """Request to resend admin invitation."""

    email: EmailStr


@router.post("/{tenant_id}/resend-invitation")
async def resend_admin_invitation(
    tenant_id: int,
    payload: ResendInvitationRequest,
    admin: deps.SuperAdminUser = Depends(deps.get_current_super_admin),
    session: AsyncSession = Depends(deps.get_public_db),
) -> dict:
    """Resend invitation email to tenant admin."""
    from app.services.tenant_provisioning_service import TenantProvisioningService

    tenant_repo = TenantRepository(session)

    tenant = await tenant_repo.get(tenant_id)
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant no encontrado")

    provisioning_service = TenantProvisioningService(session)
    await provisioning_service.send_admin_invitation(
        tenant_id=tenant_id,
        email=payload.email,
        created_by_admin_id=admin.id,
    )
    await session.commit()

    return {"message": f"Invitación enviada a {payload.email}"}


@router.post("/{tenant_id}/reset-admin-password")
async def reset_admin_password(
    tenant_id: int,
    payload: ResendInvitationRequest,
    admin: deps.SuperAdminUser = Depends(deps.get_current_super_admin),
    session: AsyncSession = Depends(deps.get_public_db),
) -> dict:
    """Reset tenant admin password by sending a new invitation."""
    from app.services.tenant_provisioning_service import TenantProvisioningService

    tenant_repo = TenantRepository(session)

    tenant = await tenant_repo.get(tenant_id)
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant no encontrado")

    provisioning_service = TenantProvisioningService(session)
    await provisioning_service.send_password_reset_invitation(
        tenant_id=tenant_id,
        email=payload.email,
        created_by_admin_id=admin.id,
    )
    await session.commit()

    return {"message": f"Link de reset enviado a {payload.email}"}


# ==================== Impersonation ====================


class ImpersonateResponse(BaseModel):
    """Response with impersonation token."""

    access_token: str
    token_type: str = "bearer"
    tenant_id: int
    tenant_slug: str
    tenant_name: str


# TDD-BUG3.2 fix: Short expiration for impersonation tokens (5 minutes)
IMPERSONATION_TOKEN_EXPIRES_MINUTES = 5

# TDD-BUG3.3 fix: Use INSPECTOR role by default (read-only access)
DEFAULT_IMPERSONATION_ROLE = "INSPECTOR"


class ImpersonateRequest(BaseModel):
    """Optional request body for impersonation with role override."""

    role: str | None = None  # If None, uses DEFAULT_IMPERSONATION_ROLE


@router.post("/{tenant_id}/impersonate", response_model=ImpersonateResponse)
async def impersonate_tenant(
    request: Request,
    tenant_id: int = Path(..., ge=1, description="Tenant ID (must be >= 1)"),
    payload: ImpersonateRequest | None = None,
    admin: deps.SuperAdminUser = Depends(deps.get_current_super_admin),
    session: AsyncSession = Depends(deps.get_public_db),
) -> ImpersonateResponse:
    """
    Generate an impersonation token to access a tenant as super admin.

    This allows super admins to support tenants by viewing their data.
    The token includes a special flag to indicate it's an impersonation session.

    TDD-BUG3 fixes:
    - Uses short expiration (5 min) for security
    - Defaults to INSPECTOR role (read-only) instead of DIRECTOR
    - Logs IP address in audit trail
    """
    from app.core.security import create_tenant_access_token
    from app.db.repositories.tenant_audit_logs import TenantAuditLogRepository

    tenant_repo = TenantRepository(session)

    tenant = await tenant_repo.get(tenant_id)
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant no encontrado")

    if not tenant.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede impersonar un tenant inactivo",
        )

    # TDD-BUG3.3 fix: Use configurable role with safer default
    impersonation_role = DEFAULT_IMPERSONATION_ROLE
    if payload and payload.role:
        # Allow role override but validate
        valid_roles = {"DIRECTOR", "INSPECTOR", "ADMIN", "TEACHER"}
        if payload.role not in valid_roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Rol inválido. Opciones: {valid_roles}",
            )
        impersonation_role = payload.role

    # TDD-BUG3.5 fix: Extract client IP for audit logging
    client_ip = request.client.host if request.client else None

    # Log impersonation for audit with IP address
    audit_repo = TenantAuditLogRepository(session)
    await audit_repo.log(
        tenant_id=tenant_id,
        action="IMPERSONATE",
        admin_id=admin.id,
        details={"admin_email": admin.email, "role": impersonation_role},
        ip_address=client_ip,
    )
    await session.commit()

    # TDD-BUG3.1 & 3.2 fix: Create token with impersonation flag and short expiration
    access_token = create_tenant_access_token(
        user_id=admin.id,
        tenant_id=tenant.id,
        tenant_slug=tenant.slug,
        role=impersonation_role,
        is_impersonation=True,
        expires_minutes=IMPERSONATION_TOKEN_EXPIRES_MINUTES,
    )

    return ImpersonateResponse(
        access_token=access_token,
        tenant_id=tenant.id,
        tenant_slug=tenant.slug,
        tenant_name=tenant.name,
    )
