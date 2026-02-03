"""Tenant Feature repository for feature flags management."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.tenant_feature import TenantFeature


class TenantFeatureRepository:
    """Repository for TenantFeature CRUD operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, tenant_id: int, feature_name: str) -> TenantFeature | None:
        """Get a specific feature for a tenant."""
        stmt = select(TenantFeature).where(
            TenantFeature.tenant_id == tenant_id,
            TenantFeature.feature_name == feature_name,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_tenant(self, tenant_id: int) -> list[TenantFeature]:
        """List all features for a tenant."""
        stmt = (
            select(TenantFeature)
            .where(TenantFeature.tenant_id == tenant_id)
            .order_by(TenantFeature.feature_name)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_enabled_features(self, tenant_id: int) -> list[str]:
        """Get list of enabled feature names for a tenant."""
        stmt = select(TenantFeature.feature_name).where(
            TenantFeature.tenant_id == tenant_id,
            TenantFeature.is_enabled == True,
        )
        result = await self.session.execute(stmt)
        return [row[0] for row in result.all()]

    async def is_enabled(self, tenant_id: int, feature_name: str) -> bool:
        """Check if a feature is enabled for a tenant."""
        feature = await self.get(tenant_id, feature_name)
        return feature.is_enabled if feature else False

    async def create(
        self,
        *,
        tenant_id: int,
        feature_name: str,
        is_enabled: bool = False,
        config: dict[str, Any] | None = None,
    ) -> TenantFeature:
        """Create a new feature flag for a tenant."""
        feature = TenantFeature(
            tenant_id=tenant_id,
            feature_name=feature_name,
            is_enabled=is_enabled,
            config=config or {},
        )
        self.session.add(feature)
        await self.session.flush()
        return feature

    async def enable(self, tenant_id: int, feature_name: str) -> TenantFeature | None:
        """Enable a feature for a tenant."""
        feature = await self.get(tenant_id, feature_name)
        if feature:
            feature.is_enabled = True
            await self.session.flush()
        return feature

    async def disable(self, tenant_id: int, feature_name: str) -> TenantFeature | None:
        """Disable a feature for a tenant."""
        feature = await self.get(tenant_id, feature_name)
        if feature:
            feature.is_enabled = False
            await self.session.flush()
        return feature

    async def set_enabled(
        self, tenant_id: int, feature_name: str, enabled: bool
    ) -> TenantFeature | None:
        """Set feature enabled status."""
        feature = await self.get(tenant_id, feature_name)
        if feature:
            feature.is_enabled = enabled
            await self.session.flush()
        return feature

    async def update_config(
        self, tenant_id: int, feature_name: str, config: dict[str, Any]
    ) -> TenantFeature | None:
        """Update feature configuration."""
        feature = await self.get(tenant_id, feature_name)
        if feature:
            feature.config = config
            await self.session.flush()
        return feature

    async def initialize_features(self, tenant_id: int) -> list[TenantFeature]:
        """Initialize all features for a new tenant with defaults."""
        features = []
        for feature_name in TenantFeature.ALL_FEATURES:
            is_enabled = feature_name in TenantFeature.DEFAULT_ENABLED_FEATURES
            feature = await self.create(
                tenant_id=tenant_id,
                feature_name=feature_name,
                is_enabled=is_enabled,
            )
            features.append(feature)
        return features

    async def delete_all(self, tenant_id: int) -> int:
        """Delete all features for a tenant (for tenant deletion)."""
        stmt = select(TenantFeature).where(TenantFeature.tenant_id == tenant_id)
        result = await self.session.execute(stmt)
        features = result.scalars().all()
        count = 0
        for feature in features:
            await self.session.delete(feature)
            count += 1
        await self.session.flush()
        return count
