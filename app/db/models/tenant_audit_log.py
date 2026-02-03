"""Tenant Audit Log model for tracking super admin actions."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.types import JSONBCompatible

from app.db.base import Base


class TenantAuditLog(Base):
    """Audit log for super admin actions on tenants."""

    __tablename__ = "tenant_audit_logs"
    __table_args__ = {"schema": "public"}

    # Action types
    ACTION_TENANT_CREATED = "tenant_created"
    ACTION_TENANT_UPDATED = "tenant_updated"
    ACTION_TENANT_DEACTIVATED = "tenant_deactivated"
    ACTION_TENANT_ACTIVATED = "tenant_activated"
    ACTION_TENANT_DELETED = "tenant_deleted"
    ACTION_FEATURE_ENABLED = "feature_enabled"
    ACTION_FEATURE_DISABLED = "feature_disabled"
    ACTION_CONFIG_UPDATED = "config_updated"
    ACTION_ADMIN_INVITED = "admin_invited"
    ACTION_ADMIN_PASSWORD_RESET = "admin_password_reset"
    ACTION_IMPERSONATION_STARTED = "impersonation_started"
    ACTION_IMPERSONATION_ENDED = "impersonation_ended"
    ACTION_LOGIN = "login"
    ACTION_LOGOUT = "logout"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tenant_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("public.tenants.id", ondelete="SET NULL"), nullable=True, index=True
    )
    super_admin_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("public.super_admins.id", ondelete="SET NULL"), nullable=True, index=True
    )
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    entity: Mapped[str | None] = mapped_column(String(64), nullable=True)
    entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    details: Mapped[dict[str, Any]] = mapped_column(JSONBCompatible, nullable=False, default=dict)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )

    # Relationships
    tenant = relationship("Tenant")
    super_admin = relationship("SuperAdmin")

    def __repr__(self) -> str:
        return f"<TenantAuditLog(action={self.action}, tenant_id={self.tenant_id}, admin_id={self.super_admin_id})>"
