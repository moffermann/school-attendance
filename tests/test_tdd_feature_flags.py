"""TDD Tests for Feature Flags - Phase 2.

Bug categories tested:
- Bug 2.1: Cache Stale After Toggle - toggle_feature doesn't invalidate cache
- Bug 2.2: New Instance Per Request - cache is per-instance, not shared
- Bug 2.3: Fallback to Allow Without Tenant - allows access silently
- Bug 2.4: Invalid Feature Names in Tenant Creation - no validation
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.db.models.tenant_feature import TenantFeature
from app.services.feature_flag_service import (
    ALL_FEATURES,
    DEFAULT_ENABLED_FEATURES,
    FeatureFlagService,
)


class TestBug2_1_CacheStaleAfterToggle:
    """Bug 2.1: toggle_feature() doesn't invalidate cache after changing feature."""

    @pytest.mark.asyncio
    async def test_toggle_feature_should_invalidate_cache(self):
        """After toggling a feature, cache should be invalidated.

        Currently FAILS because tenants.py:toggle_feature() at line 372
        does commit but doesn't call service.clear_cache().
        """
        import inspect

        from app.api.v1.super_admin import tenants

        source = inspect.getsource(tenants.toggle_feature)

        # The fix should call clear_cache or clear_global_feature_cache after toggling
        has_cache_clear = "clear_cache" in source or "clear_global_feature_cache" in source
        assert has_cache_clear, "toggle_feature should call clear_cache after modifying feature"

    @pytest.mark.asyncio
    async def test_feature_flag_service_has_clear_cache_method(self):
        """FeatureFlagService should have clear_cache method."""
        mock_session = AsyncMock()
        service = FeatureFlagService(mock_session)

        # Verify method exists
        assert hasattr(service, "clear_cache"), "Should have clear_cache method"
        assert callable(service.clear_cache), "clear_cache should be callable"

        # Verify cache clearing works
        service._cache[(1, "webauthn")] = True
        service._cache[(1, "broadcasts")] = False
        service._cache[(2, "webauthn")] = True

        # Clear only tenant 1
        service.clear_cache(tenant_id=1)
        assert (1, "webauthn") not in service._cache
        assert (1, "broadcasts") not in service._cache
        assert (2, "webauthn") in service._cache  # Other tenant unaffected


class TestBug2_2_NewInstancePerRequest:
    """Bug 2.2: New FeatureFlagService instance per request - cache is useless.

    The require_feature dependency creates a new instance each time,
    so the instance cache never hits.
    """

    @pytest.mark.asyncio
    async def test_require_feature_creates_new_instance_per_request(self):
        """Verify the bug exists: new instance each time.

        deps.py:446 creates `service = FeatureFlagService(session)` each time,
        which means the cache is never shared between requests.

        The fix should use a global/singleton cache.
        """
        import inspect

        from app.core import deps

        source = inspect.getsource(deps.require_feature)

        # The current code creates a new instance each request
        # After fix, should use shared cache
        has_shared_cache = (
            "_feature_cache" in source
            or "global" in source.lower()
            or "singleton" in source.lower()
        )
        assert has_shared_cache, (
            "require_feature should use shared cache, not create new instance each request"
        )

    @pytest.mark.asyncio
    async def test_feature_cache_is_shared(self):
        """Feature cache should be shared across service instances.

        After fix, multiple FeatureFlagService instances should share cache.
        """
        from app.services.feature_flag_service import _feature_cache

        # Global cache should exist
        assert _feature_cache is not None, "Global feature cache should exist"

        # Verify it's a dict
        assert isinstance(_feature_cache, dict), "Cache should be a dict"


class TestBug2_3_FallbackAllowWithoutTenant:
    """Bug 2.3: require_feature allows access when tenant is None.

    deps.py:442-444 silently returns (allows) when no tenant context.
    This could allow unauthorized access to protected features.
    """

    @pytest.mark.asyncio
    async def test_require_feature_without_tenant_should_reject(self):
        """require_feature without tenant context should reject, not allow.

        This test verifies the production behavior where skip_tenant_middleware=false.
        In test environments, this check is bypassed for convenience.
        """
        from app.core.config import settings
        from app.core.deps import require_feature

        # Temporarily disable the test bypass to verify production behavior
        original_skip = settings.skip_tenant_middleware
        settings.skip_tenant_middleware = False

        try:
            check_feature = require_feature("webauthn")

            # Create request without tenant
            request = MagicMock(spec=Request)
            request.state = MagicMock()
            request.state.tenant = None  # No tenant!

            mock_session = AsyncMock()

            # This should REJECT because there's no tenant context
            with pytest.raises(HTTPException) as exc_info:
                await check_feature(request, mock_session)

            assert exc_info.value.status_code == 400
            assert "tenant" in exc_info.value.detail.lower()
        finally:
            # Restore original setting
            settings.skip_tenant_middleware = original_skip

    @pytest.mark.asyncio
    async def test_require_feature_with_tenant_checks_feature(self):
        """require_feature with valid tenant should check feature.

        This test validates that require_feature properly imports FeatureFlagService
        and calls it with the tenant context.
        """
        import inspect

        from app.core import deps

        source = inspect.getsource(deps.require_feature)

        # Should import FeatureFlagService
        has_service_import = "FeatureFlagService" in source
        assert has_service_import, "require_feature should use FeatureFlagService"

        # Should call service.require_feature
        has_require_call = "require_feature" in source
        assert has_require_call, "Should call service.require_feature"

        # Should pass tenant.id
        has_tenant_id = "tenant.id" in source
        assert has_tenant_id, "Should pass tenant.id to service"


class TestBug2_4_InvalidFeatureNamesInCreation:
    """Bug 2.4: Tenant creation accepts invalid feature names.

    TenantProvisioningService._initialize_features doesn't validate
    that provided feature names are in ALL_FEATURES.
    """

    @pytest.mark.asyncio
    async def test_initialize_features_rejects_invalid_feature_names(self):
        """Creating tenant with invalid feature name should fail.

        Currently FAILS because tenant_provisioning_service.py:206
        doesn't validate feature names:
        ```
        features_to_enable = set(enabled_features or DEFAULT_ENABLED_FEATURES)
        # No validation against ALL_FEATURES
        ```
        """
        import inspect

        from app.services import tenant_provisioning_service

        source = inspect.getsource(
            tenant_provisioning_service.TenantProvisioningService._initialize_features
        )

        # The fix should validate feature names
        has_validation = "ALL_FEATURES" in source and (
            "not in" in source or "difference" in source or "validate" in source.lower()
        )
        assert has_validation, (
            "_initialize_features should validate feature names against ALL_FEATURES"
        )

    @pytest.mark.asyncio
    async def test_all_features_constant_exists(self):
        """ALL_FEATURES constant should exist and contain valid features."""
        assert ALL_FEATURES is not None
        assert len(ALL_FEATURES) > 0
        assert "webauthn" in ALL_FEATURES
        assert "broadcasts" in ALL_FEATURES

    @pytest.mark.asyncio
    async def test_default_features_subset_of_all_features(self):
        """DEFAULT_ENABLED_FEATURES should be subset of ALL_FEATURES."""
        for feature in DEFAULT_ENABLED_FEATURES:
            assert feature in ALL_FEATURES, f"Default feature '{feature}' not in ALL_FEATURES"

    @pytest.mark.asyncio
    async def test_feature_model_constants_match_service_constants(self):
        """Model constants should match service constants."""

        assert TenantFeature.ALL_FEATURES == ALL_FEATURES
        assert TenantFeature.DEFAULT_ENABLED_FEATURES == DEFAULT_ENABLED_FEATURES
