"""Tenant configuration management endpoints for Super Admin."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import deps
from app.db.repositories.tenants import TenantRepository
from app.db.repositories.tenant_configs import TenantConfigRepository

router = APIRouter()


# ==================== Schemas ====================


class WhatsAppConfigUpdate(BaseModel):
    """WhatsApp configuration update."""

    access_token: str | None = None
    phone_number_id: str | None = None


class SESConfigUpdate(BaseModel):
    """SES configuration update."""

    region: str | None = None
    source_email: EmailStr | None = None
    access_key: str | None = None
    secret_key: str | None = None


class S3ConfigUpdate(BaseModel):
    """S3 configuration update."""

    bucket: str | None = None
    prefix: str | None = None


class TenantConfigSummary(BaseModel):
    """Summary of tenant configuration (no secrets)."""

    tenant_id: int
    whatsapp_configured: bool
    whatsapp_phone_number_id: str | None
    ses_configured: bool
    ses_region: str | None
    ses_source_email: str | None
    s3_bucket: str | None
    s3_prefix: str | None
    device_api_key_configured: bool


# ==================== Endpoints ====================


@router.get("/{tenant_id}/config", response_model=TenantConfigSummary)
async def get_tenant_config(
    tenant_id: int,
    admin: deps.SuperAdminUser = Depends(deps.get_current_super_admin),
    session: AsyncSession = Depends(deps.get_public_db),
) -> TenantConfigSummary:
    """Get tenant configuration summary (secrets are masked)."""
    tenant_repo = TenantRepository(session)
    config_repo = TenantConfigRepository(session)

    tenant = await tenant_repo.get(tenant_id)
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant no encontrado")

    config = await config_repo.get(tenant_id)
    if not config:
        # Create default config if missing
        config = await config_repo.create(tenant_id)
        await session.commit()

    return TenantConfigSummary(
        tenant_id=tenant_id,
        whatsapp_configured=config.whatsapp_access_token_encrypted is not None,
        whatsapp_phone_number_id=config.whatsapp_phone_number_id,
        ses_configured=config.ses_access_key_encrypted is not None,
        ses_region=config.ses_region,
        ses_source_email=config.ses_source_email,
        s3_bucket=config.s3_bucket,
        s3_prefix=config.s3_prefix,
        device_api_key_configured=config.device_api_key_encrypted is not None,
    )


@router.put("/{tenant_id}/config/whatsapp")
async def update_whatsapp_config(
    tenant_id: int,
    payload: WhatsAppConfigUpdate,
    admin: deps.SuperAdminUser = Depends(deps.get_current_super_admin),
    session: AsyncSession = Depends(deps.get_public_db),
) -> dict:
    """Update tenant's WhatsApp credentials."""
    tenant_repo = TenantRepository(session)
    config_repo = TenantConfigRepository(session)

    tenant = await tenant_repo.get(tenant_id)
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant no encontrado")

    config = await config_repo.get(tenant_id)
    if not config:
        config = await config_repo.create(tenant_id)

    await config_repo.update_whatsapp_config(
        tenant_id,
        access_token=payload.access_token,
        phone_number_id=payload.phone_number_id,
    )
    await session.commit()

    return {"message": "Configuración de WhatsApp actualizada exitosamente"}


@router.put("/{tenant_id}/config/email")
async def update_ses_config(
    tenant_id: int,
    payload: SESConfigUpdate,
    admin: deps.SuperAdminUser = Depends(deps.get_current_super_admin),
    session: AsyncSession = Depends(deps.get_public_db),
) -> dict:
    """Update tenant's SES email credentials."""
    tenant_repo = TenantRepository(session)
    config_repo = TenantConfigRepository(session)

    tenant = await tenant_repo.get(tenant_id)
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant no encontrado")

    config = await config_repo.get(tenant_id)
    if not config:
        config = await config_repo.create(tenant_id)

    await config_repo.update_ses_config(
        tenant_id,
        region=payload.region,
        source_email=payload.source_email,
        access_key=payload.access_key,
        secret_key=payload.secret_key,
    )
    await session.commit()

    return {"message": "Configuración de email actualizada exitosamente"}


@router.put("/{tenant_id}/config/s3")
async def update_s3_config(
    tenant_id: int,
    payload: S3ConfigUpdate,
    admin: deps.SuperAdminUser = Depends(deps.get_current_super_admin),
    session: AsyncSession = Depends(deps.get_public_db),
) -> dict:
    """Update tenant's S3 storage configuration."""
    tenant_repo = TenantRepository(session)
    config_repo = TenantConfigRepository(session)

    tenant = await tenant_repo.get(tenant_id)
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant no encontrado")

    config = await config_repo.get(tenant_id)
    if not config:
        config = await config_repo.create(tenant_id)

    await config_repo.update_s3_config(
        tenant_id,
        bucket=payload.bucket,
        prefix=payload.prefix,
    )
    await session.commit()

    return {"message": "Configuración de S3 actualizada exitosamente"}


@router.post("/{tenant_id}/config/generate-device-key")
async def generate_device_api_key(
    tenant_id: int,
    admin: deps.SuperAdminUser = Depends(deps.get_current_super_admin),
    session: AsyncSession = Depends(deps.get_public_db),
) -> dict:
    """Generate a new device API key for the tenant."""
    tenant_repo = TenantRepository(session)
    config_repo = TenantConfigRepository(session)

    tenant = await tenant_repo.get(tenant_id)
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant no encontrado")

    config = await config_repo.get(tenant_id)
    if not config:
        config = await config_repo.create(tenant_id)

    new_key = await config_repo.generate_device_api_key(tenant_id)
    await session.commit()

    return {
        "message": "Device API key generada exitosamente",
        "device_api_key": new_key,  # Only shown once!
    }
