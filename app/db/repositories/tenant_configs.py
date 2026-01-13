"""Tenant Config repository for encrypted credentials management."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.encryption import decrypt_if_present, encrypt_if_present
from app.db.models.tenant_config import TenantConfig


@dataclass
class DecryptedTenantConfig:
    """Decrypted tenant configuration."""

    tenant_id: int
    # WhatsApp
    whatsapp_access_token: str | None
    whatsapp_phone_number_id: str | None
    # Email provider
    email_provider: str | None
    # SES
    ses_region: str | None
    ses_source_email: str | None
    ses_access_key: str | None
    ses_secret_key: str | None
    # SMTP (Gmail, Google Workspace, Outlook, etc.)
    smtp_host: str | None
    smtp_port: int | None
    smtp_user: str | None
    smtp_password: str | None
    smtp_use_tls: bool | None
    smtp_from_name: str | None
    # S3
    s3_bucket: str | None
    s3_prefix: str | None
    # Device
    device_api_key: str | None


class TenantConfigRepository:
    """Repository for TenantConfig CRUD operations with encryption handling."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, tenant_id: int) -> TenantConfig | None:
        """Get tenant config by tenant ID (encrypted)."""
        stmt = select(TenantConfig).where(TenantConfig.tenant_id == tenant_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_decrypted(self, tenant_id: int) -> DecryptedTenantConfig | None:
        """Get tenant config with decrypted credentials."""
        config = await self.get(tenant_id)
        if not config:
            return None

        return DecryptedTenantConfig(
            tenant_id=config.tenant_id,
            whatsapp_access_token=decrypt_if_present(config.whatsapp_access_token_encrypted),
            whatsapp_phone_number_id=config.whatsapp_phone_number_id,
            email_provider=config.email_provider,
            ses_region=config.ses_region,
            ses_source_email=config.ses_source_email,
            ses_access_key=decrypt_if_present(config.ses_access_key_encrypted),
            ses_secret_key=decrypt_if_present(config.ses_secret_key_encrypted),
            smtp_host=config.smtp_host,
            smtp_port=config.smtp_port,
            smtp_user=config.smtp_user,
            smtp_password=decrypt_if_present(config.smtp_password_encrypted),
            smtp_use_tls=config.smtp_use_tls,
            smtp_from_name=config.smtp_from_name,
            s3_bucket=config.s3_bucket,
            s3_prefix=config.s3_prefix,
            device_api_key=decrypt_if_present(config.device_api_key_encrypted),
        )

    async def create(self, tenant_id: int) -> TenantConfig:
        """Create a new tenant config with defaults."""
        config = TenantConfig(
            tenant_id=tenant_id,
            ses_region="us-east-1",
        )
        self.session.add(config)
        await self.session.flush()
        return config

    async def update_whatsapp_config(
        self,
        tenant_id: int,
        *,
        access_token: str | None = None,
        phone_number_id: str | None = None,
    ) -> TenantConfig | None:
        """Update WhatsApp credentials (will be encrypted)."""
        config = await self.get(tenant_id)
        if not config:
            return None

        if access_token is not None:
            config.whatsapp_access_token_encrypted = encrypt_if_present(access_token)
        if phone_number_id is not None:
            config.whatsapp_phone_number_id = phone_number_id

        config.updated_at = datetime.now(timezone.utc)
        await self.session.flush()
        return config

    async def update_ses_config(
        self,
        tenant_id: int,
        *,
        region: str | None = None,
        source_email: str | None = None,
        access_key: str | None = None,
        secret_key: str | None = None,
    ) -> TenantConfig | None:
        """Update SES credentials (will be encrypted)."""
        config = await self.get(tenant_id)
        if not config:
            return None

        if region is not None:
            config.ses_region = region
        if source_email is not None:
            config.ses_source_email = source_email
        if access_key is not None:
            config.ses_access_key_encrypted = encrypt_if_present(access_key)
        if secret_key is not None:
            config.ses_secret_key_encrypted = encrypt_if_present(secret_key)

        config.updated_at = datetime.now(timezone.utc)
        await self.session.flush()
        return config

    async def update_smtp_config(
        self,
        tenant_id: int,
        *,
        host: str | None = None,
        port: int | None = None,
        user: str | None = None,
        password: str | None = None,
        use_tls: bool | None = None,
        from_name: str | None = None,
    ) -> TenantConfig | None:
        """Update SMTP credentials (password will be encrypted)."""
        config = await self.get(tenant_id)
        if not config:
            return None

        if host is not None:
            config.smtp_host = host
        if port is not None:
            config.smtp_port = port
        if user is not None:
            config.smtp_user = user
        if password is not None:
            config.smtp_password_encrypted = encrypt_if_present(password)
        if use_tls is not None:
            config.smtp_use_tls = use_tls
        if from_name is not None:
            config.smtp_from_name = from_name

        config.updated_at = datetime.now(timezone.utc)
        await self.session.flush()
        return config

    async def update_email_provider(
        self,
        tenant_id: int,
        provider: str,
    ) -> TenantConfig | None:
        """Update email provider (ses or smtp)."""
        if provider not in ("ses", "smtp"):
            raise ValueError("provider must be 'ses' or 'smtp'")

        config = await self.get(tenant_id)
        if not config:
            return None

        config.email_provider = provider
        config.updated_at = datetime.now(timezone.utc)
        await self.session.flush()
        return config

    async def update_s3_config(
        self,
        tenant_id: int,
        *,
        bucket: str | None = None,
        prefix: str | None = None,
    ) -> TenantConfig | None:
        """Update S3 configuration."""
        config = await self.get(tenant_id)
        if not config:
            return None

        if bucket is not None:
            config.s3_bucket = bucket
        if prefix is not None:
            config.s3_prefix = prefix

        config.updated_at = datetime.now(timezone.utc)
        await self.session.flush()
        return config

    async def update_device_api_key(
        self,
        tenant_id: int,
        device_api_key: str,
    ) -> TenantConfig | None:
        """Update device API key (will be encrypted)."""
        config = await self.get(tenant_id)
        if not config:
            return None

        config.device_api_key_encrypted = encrypt_if_present(device_api_key)
        config.updated_at = datetime.now(timezone.utc)
        await self.session.flush()
        return config

    async def generate_device_api_key(self, tenant_id: int) -> str:
        """Generate and store a new device API key."""
        import secrets

        new_key = secrets.token_urlsafe(32)
        await self.update_device_api_key(tenant_id, new_key)
        return new_key
