"""Tenant Admin Invitation model for admin activation via email."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TenantAdminInvitation(Base):
    """Represents an invitation for a tenant administrator to set up their account."""

    __tablename__ = "tenant_admin_invitations"
    __table_args__ = {"schema": "public"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("public.tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("public.super_admins.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    tenant = relationship("Tenant")
    creator = relationship("SuperAdmin")

    @property
    def is_expired(self) -> bool:
        """Check if the invitation has expired."""
        return datetime.now(self.expires_at.tzinfo) > self.expires_at

    @property
    def is_used(self) -> bool:
        """Check if the invitation has been used."""
        return self.used_at is not None

    @property
    def is_valid(self) -> bool:
        """Check if the invitation is still valid (not expired and not used)."""
        return not self.is_expired and not self.is_used

    def __repr__(self) -> str:
        return f"<TenantAdminInvitation(tenant_id={self.tenant_id}, email={self.email})>"
