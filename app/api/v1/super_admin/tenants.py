"""Tenant management endpoints for Super Admin."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Path, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import deps
from app.db.models.tenant_audit_log import TenantAuditLog
from app.db.models.tenant_feature import TenantFeature
from app.db.repositories.tenant_features import TenantFeatureRepository
from app.db.repositories.tenants import TenantRepository

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
    student_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class TenantFeatureResponse(BaseModel):
    """Feature flag response."""

    feature_name: str
    is_enabled: bool
    config: dict[str, Any]

    class Config:
        from_attributes = True


class TenantDetail(TenantSummary):
    """Detailed view of a tenant with features."""

    config: dict[str, Any]
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
    """List all tenants with student counts."""
    repo = TenantRepository(session)
    tenants = await repo.list_all(include_inactive=include_inactive)
    total = await repo.count(include_inactive=include_inactive)

    # Get student counts for each tenant
    tenant_summaries = []
    for tenant in tenants:
        student_count = 0
        try:
            schema_name = f"tenant_{tenant.slug}"
            result = await session.execute(text(f"SELECT COUNT(*) FROM {schema_name}.students"))
            student_count = result.scalar() or 0
        except Exception:
            pass  # Schema may not exist yet

        summary = TenantSummary(
            id=tenant.id,
            slug=tenant.slug,
            name=tenant.name,
            subdomain=tenant.subdomain,
            domain=tenant.domain,
            is_active=tenant.is_active,
            plan=tenant.plan,
            max_students=tenant.max_students,
            student_count=student_count,
            created_at=tenant.created_at,
        )
        tenant_summaries.append(summary)

    return TenantListResponse(
        items=tenant_summaries,
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
    updated_tenant = await tenant_repo.update(tenant_id, **update_data)
    assert updated_tenant is not None, "Tenant should exist after update"
    await session.commit()

    features = await feature_repo.list_by_tenant(tenant_id)

    return TenantDetail(
        id=updated_tenant.id,
        slug=updated_tenant.slug,
        name=updated_tenant.name,
        subdomain=updated_tenant.subdomain,
        domain=updated_tenant.domain,
        is_active=updated_tenant.is_active,
        plan=updated_tenant.plan,
        max_students=updated_tenant.max_students,
        config=updated_tenant.config,
        created_at=updated_tenant.created_at,
        updated_at=updated_tenant.updated_at,
        features=[TenantFeatureResponse.model_validate(f) for f in features],
    )


@router.post("/{tenant_id}/deactivate")
async def deactivate_tenant(
    tenant_id: int,
    admin: deps.SuperAdminUser = Depends(deps.get_current_super_admin),
    session: AsyncSession = Depends(deps.get_public_db),
) -> dict[str, str]:
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
) -> dict[str, str]:
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
) -> dict[str, str]:
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
) -> dict[str, str]:
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

    # TDD-BUG5.3 fix: Use constant instead of string literal
    # Log impersonation for audit with IP address
    audit_repo = TenantAuditLogRepository(session)
    await audit_repo.log(
        tenant_id=tenant_id,
        action=TenantAuditLog.ACTION_IMPERSONATION_STARTED,
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


class EndImpersonationRequest(BaseModel):
    """Request schema for ending impersonation."""

    token: str = Field(..., description="The impersonation token to invalidate")


class EndImpersonationResponse(BaseModel):
    """Response schema for ending impersonation."""

    message: str
    duration_seconds: int | None = None


# ==================== Tenant Config Schemas ====================


class TenantConfigUpdate(BaseModel):
    """Schema for updating tenant configuration (timezone, SMTP, etc.)."""

    # Timezone (IANA format: America/Santiago, America/Bogota, etc.)
    timezone: str | None = Field(None, max_length=64, examples=["America/Santiago"])

    # Email provider selection
    email_provider: str | None = Field(None, pattern=r"^(ses|smtp)$")

    # SMTP Configuration
    smtp_host: str | None = Field(None, max_length=255)
    smtp_port: int | None = Field(None, ge=1, le=65535)
    smtp_user: str | None = Field(None, max_length=255)
    smtp_password: str | None = Field(None, max_length=255)
    smtp_use_tls: bool | None = None
    smtp_from_name: str | None = Field(None, max_length=255)

    # SES Configuration (optional, for AWS SES users)
    ses_region: str | None = Field(None, max_length=32)
    ses_source_email: str | None = Field(None, max_length=255)
    ses_access_key: str | None = Field(None, max_length=128)
    ses_secret_key: str | None = Field(None, max_length=128)

    # WhatsApp Configuration
    whatsapp_phone_number_id: str | None = Field(None, max_length=64)
    whatsapp_access_token: str | None = Field(None, max_length=512)


class TenantConfigResponse(BaseModel):
    """Response schema for tenant configuration (without sensitive data)."""

    tenant_id: int
    timezone: str | None
    email_provider: str | None

    # SMTP (without password)
    smtp_host: str | None
    smtp_port: int | None
    smtp_user: str | None
    smtp_use_tls: bool | None
    smtp_from_name: str | None
    smtp_configured: bool  # True if password is set

    # SES (without secrets)
    ses_region: str | None
    ses_source_email: str | None
    ses_configured: bool  # True if credentials are set

    # WhatsApp (without token)
    whatsapp_phone_number_id: str | None
    whatsapp_configured: bool  # True if token is set

    # S3
    s3_bucket: str | None
    s3_prefix: str | None

    # Device
    device_api_key_configured: bool

    updated_at: datetime | None


@router.post("/{tenant_id}/end-impersonation", response_model=EndImpersonationResponse)
async def end_impersonation(
    request: Request,
    payload: EndImpersonationRequest,
    tenant_id: int = Path(..., ge=1, description="Tenant ID (must be >= 1)"),
    admin: deps.SuperAdminUser = Depends(deps.get_current_super_admin),
    session: AsyncSession = Depends(deps.get_public_db),
) -> EndImpersonationResponse:
    """
    End an impersonation session and log the action.

    TDD-BUG5.2 fix: Log the end of impersonation session with duration.
    Also invalidates the impersonation token.
    """
    from app.core.security import decode_token
    from app.core.token_blacklist import add_to_blacklist
    from app.db.repositories.tenant_audit_logs import TenantAuditLogRepository

    tenant_repo = TenantRepository(session)

    tenant = await tenant_repo.get(tenant_id)
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant no encontrado")

    # Decode token to get expiration and validate it's an impersonation token
    try:
        token_payload = decode_token(payload.token)
    except HTTPException:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token inválido o ya expirado",
        ) from None

    # Verify it's an impersonation token
    if not token_payload.get("is_impersonation"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El token no es de impersonation",
        )

    # Verify token is for this tenant
    if token_payload.get("tenant_id") != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El token no corresponde a este tenant",
        )

    # Calculate session duration
    import time

    iat = token_payload.get("iat")
    duration_seconds = int(time.time() - iat) if iat else None

    # Invalidate the token
    exp = token_payload.get("exp")
    add_to_blacklist(payload.token, exp)

    # Extract client IP for audit logging
    client_ip = request.client.host if request.client else None

    # Log end of impersonation
    audit_repo = TenantAuditLogRepository(session)
    await audit_repo.log(
        tenant_id=tenant_id,
        action=TenantAuditLog.ACTION_IMPERSONATION_ENDED,
        admin_id=admin.id,
        details={
            "admin_email": admin.email,
            "duration_seconds": duration_seconds,
        },
        ip_address=client_ip,
    )
    await session.commit()

    return EndImpersonationResponse(
        message="Sesión de impersonation finalizada",
        duration_seconds=duration_seconds,
    )


# ==================== Tenant Configuration ====================


@router.get("/{tenant_id}/config", response_model=TenantConfigResponse)
async def get_tenant_config(
    tenant_id: int = Path(..., ge=1, description="Tenant ID"),
    admin: deps.SuperAdminUser = Depends(deps.get_current_super_admin),
    session: AsyncSession = Depends(deps.get_public_db),
) -> TenantConfigResponse:
    """
    Get tenant configuration (timezone, email settings, etc.).

    Sensitive credentials are masked - only shows if they are configured.
    """
    from app.db.repositories.tenant_configs import TenantConfigRepository

    tenant_repo = TenantRepository(session)
    config_repo = TenantConfigRepository(session)

    tenant = await tenant_repo.get(tenant_id)
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant no encontrado")

    config = await config_repo.get(tenant_id)
    if not config:
        # Create default config if it doesn't exist
        config = await config_repo.create(tenant_id)
        await session.commit()

    return TenantConfigResponse(
        tenant_id=config.tenant_id,
        timezone=config.timezone,
        email_provider=config.email_provider,
        smtp_host=config.smtp_host,
        smtp_port=config.smtp_port,
        smtp_user=config.smtp_user,
        smtp_use_tls=config.smtp_use_tls,
        smtp_from_name=config.smtp_from_name,
        smtp_configured=config.smtp_password_encrypted is not None,
        ses_region=config.ses_region,
        ses_source_email=config.ses_source_email,
        ses_configured=(
            config.ses_access_key_encrypted is not None
            and config.ses_secret_key_encrypted is not None
        ),
        whatsapp_phone_number_id=config.whatsapp_phone_number_id,
        whatsapp_configured=config.whatsapp_access_token_encrypted is not None,
        s3_bucket=config.s3_bucket,
        s3_prefix=config.s3_prefix,
        device_api_key_configured=config.device_api_key_encrypted is not None,
        updated_at=config.updated_at,
    )


@router.patch("/{tenant_id}/config", response_model=TenantConfigResponse)
async def update_tenant_config(
    tenant_id: int,
    payload: TenantConfigUpdate,
    admin: deps.SuperAdminUser = Depends(deps.get_current_super_admin),
    session: AsyncSession = Depends(deps.get_public_db),
) -> TenantConfigResponse:
    """
    Update tenant configuration (timezone, SMTP, SES, WhatsApp settings).

    Only fields provided in the request body will be updated.
    Credentials (passwords, tokens, keys) are encrypted before storage.
    """
    from zoneinfo import ZoneInfo

    from app.db.repositories.tenant_configs import TenantConfigRepository

    tenant_repo = TenantRepository(session)
    config_repo = TenantConfigRepository(session)

    tenant = await tenant_repo.get(tenant_id)
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant no encontrado")

    config = await config_repo.get(tenant_id)
    if not config:
        config = await config_repo.create(tenant_id)

    # Validate timezone if provided
    if payload.timezone is not None:
        try:
            ZoneInfo(payload.timezone)
        except Exception:
            msg = (
                f"Zona horaria inválida: {payload.timezone}. "
                "Use formato IANA (ej: America/Santiago)"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=msg,
            ) from None
        await config_repo.update_timezone(tenant_id, payload.timezone)

    # Update email provider
    if payload.email_provider is not None:
        await config_repo.update_email_provider(tenant_id, payload.email_provider)

    # Update SMTP config if any field provided
    if any(
        v is not None
        for v in [
            payload.smtp_host,
            payload.smtp_port,
            payload.smtp_user,
            payload.smtp_password,
            payload.smtp_use_tls,
            payload.smtp_from_name,
        ]
    ):
        await config_repo.update_smtp_config(
            tenant_id,
            host=payload.smtp_host,
            port=payload.smtp_port,
            user=payload.smtp_user,
            password=payload.smtp_password,
            use_tls=payload.smtp_use_tls,
            from_name=payload.smtp_from_name,
        )

    # Update SES config if any field provided
    if any(
        v is not None
        for v in [
            payload.ses_region,
            payload.ses_source_email,
            payload.ses_access_key,
            payload.ses_secret_key,
        ]
    ):
        await config_repo.update_ses_config(
            tenant_id,
            region=payload.ses_region,
            source_email=payload.ses_source_email,
            access_key=payload.ses_access_key,
            secret_key=payload.ses_secret_key,
        )

    # Update WhatsApp config if any field provided
    if payload.whatsapp_phone_number_id is not None or payload.whatsapp_access_token is not None:
        await config_repo.update_whatsapp_config(
            tenant_id,
            phone_number_id=payload.whatsapp_phone_number_id,
            access_token=payload.whatsapp_access_token,
        )

    await session.commit()

    # Fetch updated config for response
    config = await config_repo.get(tenant_id)
    assert config is not None, "Config should exist after update"

    return TenantConfigResponse(
        tenant_id=config.tenant_id,
        timezone=config.timezone,
        email_provider=config.email_provider,
        smtp_host=config.smtp_host,
        smtp_port=config.smtp_port,
        smtp_user=config.smtp_user,
        smtp_use_tls=config.smtp_use_tls,
        smtp_from_name=config.smtp_from_name,
        smtp_configured=config.smtp_password_encrypted is not None,
        ses_region=config.ses_region,
        ses_source_email=config.ses_source_email,
        ses_configured=(
            config.ses_access_key_encrypted is not None
            and config.ses_secret_key_encrypted is not None
        ),
        whatsapp_phone_number_id=config.whatsapp_phone_number_id,
        whatsapp_configured=config.whatsapp_access_token_encrypted is not None,
        s3_bucket=config.s3_bucket,
        s3_prefix=config.s3_prefix,
        device_api_key_configured=config.device_api_key_encrypted is not None,
        updated_at=config.updated_at,
    )
