"""Feature Flag Service for tenant-based feature management."""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import TYPE_CHECKING

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.tenant_feature import TenantFeature
from app.db.repositories.tenant_features import TenantFeatureRepository

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

# TDD-BUG2.2 fix: Global shared cache for feature flags
# This cache is shared across all FeatureFlagService instances
_feature_cache: dict[tuple[int, str], bool] = {}


def clear_global_feature_cache(tenant_id: int | None = None) -> None:
    """
    Clear the global feature flag cache.

    TDD-BUG2.1 fix: Called after toggling features to invalidate cache.

    Args:
        tenant_id: If provided, only clear cache for this tenant.
                  If None, clears entire cache.
    """
    global _feature_cache
    if tenant_id is None:
        _feature_cache.clear()
    else:
        keys_to_remove = [k for k in _feature_cache if k[0] == tenant_id]
        for key in keys_to_remove:
            del _feature_cache[key]


class FeatureFlagService:
    """
    Manages feature flag checks with optional caching.

    Features can be checked at runtime to enable/disable functionality
    per tenant. This allows for:
    - Gradual feature rollouts
    - Plan-based feature restrictions
    - A/B testing capabilities
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = TenantFeatureRepository(session)
        # TDD-BUG2.2 fix: Use global cache instead of instance cache
        # Instance cache is kept for backwards compatibility but uses global
        self._cache = _feature_cache

    async def is_enabled(self, tenant_id: int, feature_name: str) -> bool:
        """
        Check if a feature is enabled for a tenant.

        Args:
            tenant_id: The tenant ID to check
            feature_name: The feature name to check

        Returns:
            True if feature is enabled, False otherwise
        """
        # TDD-BUG2.2 fix: Use global cache
        cache_key = (tenant_id, feature_name)
        if cache_key in _feature_cache:
            return _feature_cache[cache_key]

        # Query database
        is_enabled = await self.repo.is_enabled(tenant_id, feature_name)

        # Cache result in global cache
        _feature_cache[cache_key] = is_enabled

        return is_enabled

    async def get_all_features(self, tenant_id: int) -> dict[str, bool]:
        """
        Get all feature flags for a tenant.

        Args:
            tenant_id: The tenant ID

        Returns:
            Dictionary mapping feature names to enabled status
        """
        features = await self.repo.list_by_tenant(tenant_id)
        return {f.feature_name: f.is_enabled for f in features}

    async def get_enabled_features(self, tenant_id: int) -> list[str]:
        """
        Get list of enabled feature names for a tenant.

        Args:
            tenant_id: The tenant ID

        Returns:
            List of enabled feature names
        """
        return await self.repo.get_enabled_features(tenant_id)

    async def require_feature(self, tenant_id: int, feature_name: str) -> None:
        """
        Raise 403 if feature is not enabled.

        Args:
            tenant_id: The tenant ID to check
            feature_name: The feature name required

        Raises:
            HTTPException: 403 if feature is not enabled
        """
        if not await self.is_enabled(tenant_id, feature_name):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"La funcionalidad '{feature_name}' no está habilitada para su organización",
            )

    def clear_cache(self, tenant_id: int | None = None) -> None:
        """
        Clear the feature cache.

        TDD-BUG2.1 fix: Now calls global cache clear function.

        Args:
            tenant_id: If provided, only clear cache for this tenant.
                      If None, clears entire cache.
        """
        # Use the global function to clear cache
        clear_global_feature_cache(tenant_id)


# ==================== Feature Names Constants ====================
# Re-export from model for convenience

FEATURE_WEBAUTHN = TenantFeature.FEATURE_WEBAUTHN
FEATURE_BROADCASTS = TenantFeature.FEATURE_BROADCASTS
FEATURE_REPORTS = TenantFeature.FEATURE_REPORTS
FEATURE_WHATSAPP = TenantFeature.FEATURE_WHATSAPP
FEATURE_EMAIL = TenantFeature.FEATURE_EMAIL
FEATURE_PHOTO_EVIDENCE = TenantFeature.FEATURE_PHOTO_EVIDENCE
FEATURE_AUDIO_EVIDENCE = TenantFeature.FEATURE_AUDIO_EVIDENCE
FEATURE_MULTIPLE_GATES = TenantFeature.FEATURE_MULTIPLE_GATES
FEATURE_API_ACCESS = TenantFeature.FEATURE_API_ACCESS

ALL_FEATURES = TenantFeature.ALL_FEATURES
DEFAULT_ENABLED_FEATURES = TenantFeature.DEFAULT_ENABLED_FEATURES
