"""Tenant Feature model for feature flags per tenant."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.types import JSONBCompatible

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.tenant import Tenant


class TenantFeature(Base):
    """Represents a feature flag for a specific tenant."""

    __tablename__ = "tenant_features"
    __table_args__ = (
        UniqueConstraint("tenant_id", "feature_name", name="uq_tenant_feature"),
        {"schema": "public"},
    )

    # Available feature names
    FEATURE_WEBAUTHN = "webauthn"
    FEATURE_BROADCASTS = "broadcasts"
    FEATURE_REPORTS = "reports"
    FEATURE_WHATSAPP = "whatsapp"
    FEATURE_EMAIL = "email"
    FEATURE_PHOTO_EVIDENCE = "photo_evidence"
    FEATURE_AUDIO_EVIDENCE = "audio_evidence"
    FEATURE_MULTIPLE_GATES = "multiple_gates"
    FEATURE_API_ACCESS = "api_access"

    ALL_FEATURES = [
        FEATURE_WEBAUTHN,
        FEATURE_BROADCASTS,
        FEATURE_REPORTS,
        FEATURE_WHATSAPP,
        FEATURE_EMAIL,
        FEATURE_PHOTO_EVIDENCE,
        FEATURE_AUDIO_EVIDENCE,
        FEATURE_MULTIPLE_GATES,
        FEATURE_API_ACCESS,
    ]

    # Default features enabled for new tenants
    DEFAULT_ENABLED_FEATURES = [
        FEATURE_WHATSAPP,
        FEATURE_EMAIL,
        FEATURE_PHOTO_EVIDENCE,
        FEATURE_REPORTS,
    ]

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("public.tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    feature_name: Mapped[str] = mapped_column(String(64), nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    config: Mapped[dict[str, Any]] = mapped_column(JSONBCompatible, nullable=False, default=dict)

    # Relationships
    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="features")

    def __repr__(self) -> str:
        return f"<TenantFeature(tenant_id={self.tenant_id}, feature={self.feature_name}, enabled={self.is_enabled})>"
