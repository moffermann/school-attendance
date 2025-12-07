"""Tenant model for multi-tenancy."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.types import JSONBCompatible

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.tenant_config import TenantConfig
    from app.db.models.tenant_feature import TenantFeature


class Tenant(Base):
    """Represents a tenant (school/organization) in the multi-tenant system."""

    __tablename__ = "tenants"
    __table_args__ = {"schema": "public"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    domain: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    subdomain: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    plan: Mapped[str] = mapped_column(String(32), nullable=False, default="standard")
    max_students: Mapped[int] = mapped_column(Integer, nullable=False, default=500)
    config: Mapped[dict] = mapped_column(JSONBCompatible, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    features: Mapped[list["TenantFeature"]] = relationship(
        "TenantFeature", back_populates="tenant", cascade="all, delete-orphan"
    )
    tenant_config: Mapped["TenantConfig"] = relationship(
        "TenantConfig", back_populates="tenant", uselist=False, cascade="all, delete-orphan"
    )

    @property
    def schema_name(self) -> str:
        """Return the PostgreSQL schema name for this tenant."""
        return f"tenant_{self.slug}"

    def __repr__(self) -> str:
        return f"<Tenant(id={self.id}, slug={self.slug}, name={self.name})>"
