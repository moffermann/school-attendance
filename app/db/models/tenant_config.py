"""Tenant Config model for per-tenant credentials and settings."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, LargeBinary, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.tenant import Tenant


class TenantConfig(Base):
    """Stores encrypted credentials and configuration for each tenant."""

    __tablename__ = "tenant_configs"
    __table_args__ = {"schema": "public"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("public.tenants.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    # WhatsApp credentials (encrypted with Fernet)
    whatsapp_access_token_encrypted: Mapped[bytes | None] = mapped_column(
        LargeBinary, nullable=True
    )
    whatsapp_phone_number_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Email provider: "ses" or "smtp"
    email_provider: Mapped[str | None] = mapped_column(String(16), nullable=True, default="ses")

    # AWS SES credentials (encrypted with Fernet)
    ses_region: Mapped[str | None] = mapped_column(String(32), nullable=True, default="us-east-1")
    ses_source_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ses_access_key_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    ses_secret_key_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)

    # SMTP credentials (for Gmail, Google Workspace, Outlook, etc.)
    smtp_host: Mapped[str | None] = mapped_column(String(255), nullable=True)
    smtp_port: Mapped[int | None] = mapped_column(Integer, nullable=True, default=587)
    smtp_user: Mapped[str | None] = mapped_column(String(255), nullable=True)
    smtp_password_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    smtp_use_tls: Mapped[bool | None] = mapped_column(Boolean, nullable=True, default=True)
    smtp_from_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # S3 storage config
    s3_bucket: Mapped[str | None] = mapped_column(String(255), nullable=True)
    s3_prefix: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Device API key (encrypted with Fernet)
    device_api_key_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)

    # Timezone for displaying times in notifications and reports (IANA timezone name)
    # Examples: America/Santiago, America/Bogota, America/Mexico_City
    timezone: Mapped[str | None] = mapped_column(
        String(64), nullable=True, default="America/Santiago"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    tenant: Mapped[Tenant] = relationship("Tenant", back_populates="tenant_config")

    def __repr__(self) -> str:
        return f"<TenantConfig(tenant_id={self.tenant_id})>"
