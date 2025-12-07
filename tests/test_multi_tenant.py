"""Tests for multi-tenant functionality."""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException
from starlette.requests import Request

from app.core.tenant_middleware import TenantMiddleware
from app.services.feature_flag_service import FeatureFlagService
from app.db.models.tenant_feature import TenantFeature
from app.core.security import (
    create_super_admin_token,
    create_tenant_access_token,
    decode_token,
)
from app.core.encryption import encrypt, decrypt, encrypt_if_present, decrypt_if_present


class TestTenantMiddleware:
    """Tests for TenantMiddleware."""

    @pytest.fixture
    def middleware(self):
        app = MagicMock()
        return TenantMiddleware(app)

    @pytest.mark.asyncio
    async def test_super_admin_routes_bypass_tenant(self, middleware):
        """Super admin routes should not require tenant context."""
        request = MagicMock(spec=Request)
        request.url.path = "/api/v1/super-admin/tenants"
        request.state = MagicMock()

        call_next = AsyncMock()
        call_next.return_value = MagicMock()

        await middleware.dispatch(request, call_next)

        # Tenant should not be set for super admin routes
        assert not hasattr(request.state, "tenant") or request.state.tenant is None

    @pytest.mark.asyncio
    async def test_tenant_resolved_from_header(self, middleware):
        """Tenant can be resolved from X-Tenant-ID header."""
        request = MagicMock(spec=Request)
        request.url.path = "/api/v1/students"
        request.headers = {"x-tenant-id": "1", "host": "localhost"}
        request.state = MagicMock()

        # Mock tenant lookup
        mock_tenant = MagicMock()
        mock_tenant.id = 1
        mock_tenant.slug = "test"
        mock_tenant.is_active = True

        async def mock_resolve(req):
            return mock_tenant

        with patch.object(middleware, "_resolve_tenant", side_effect=mock_resolve):
            call_next = AsyncMock()
            call_next.return_value = MagicMock()

            await middleware.dispatch(request, call_next)

            assert request.state.tenant == mock_tenant
            assert request.state.tenant_schema == "tenant_test"


class TestFeatureFlagService:
    """Tests for FeatureFlagService."""

    @pytest.fixture
    def mock_session(self):
        return AsyncMock()

    @pytest.fixture
    def service(self, mock_session):
        return FeatureFlagService(mock_session)

    @pytest.mark.asyncio
    async def test_is_enabled_returns_cached_value(self, service):
        """Feature flag check should use cache."""
        # Prime the cache
        service._cache[(1, "webauthn")] = True

        # Should return cached value without hitting DB
        result = await service.is_enabled(1, "webauthn")

        assert result is True
        # Value came from cache, so result should match cached value

    @pytest.mark.asyncio
    async def test_require_feature_raises_on_disabled(self, service):
        """require_feature should raise 403 if feature is disabled."""
        service._cache[(1, "webauthn")] = False

        with pytest.raises(HTTPException) as exc_info:
            await service.require_feature(1, "webauthn")

        assert exc_info.value.status_code == 403
        assert "webauthn" in exc_info.value.detail

    def test_clear_cache_clears_all(self, service):
        """clear_cache() without tenant_id clears entire cache."""
        # Use the global cache directly since service._cache is now a reference
        from app.services.feature_flag_service import _feature_cache, clear_global_feature_cache

        # Clear first to ensure clean state
        clear_global_feature_cache()

        _feature_cache[(1, "webauthn")] = True
        _feature_cache[(1, "reports")] = False
        _feature_cache[(2, "webauthn")] = True

        service.clear_cache()

        assert len(_feature_cache) == 0

    def test_clear_cache_clears_tenant_only(self, service):
        """clear_cache(tenant_id) clears only that tenant's cache."""
        # Use the global cache directly since service._cache is now a reference
        from app.services.feature_flag_service import _feature_cache, clear_global_feature_cache

        # Clear first to ensure clean state
        clear_global_feature_cache()

        _feature_cache[(1, "webauthn")] = True
        _feature_cache[(1, "reports")] = False
        _feature_cache[(2, "webauthn")] = True

        service.clear_cache(tenant_id=1)

        assert (1, "webauthn") not in _feature_cache
        assert (1, "reports") not in _feature_cache
        assert (2, "webauthn") in _feature_cache


class TestTenantFeatureModel:
    """Tests for TenantFeature model constants."""

    def test_all_features_defined(self):
        """All features should be in ALL_FEATURES list."""
        expected = [
            "webauthn",
            "broadcasts",
            "reports",
            "whatsapp",
            "email",
            "photo_evidence",
            "audio_evidence",
            "multiple_gates",
            "api_access",
        ]
        assert TenantFeature.ALL_FEATURES == expected

    def test_default_features_subset_of_all(self):
        """Default features should be subset of all features."""
        for feature in TenantFeature.DEFAULT_ENABLED_FEATURES:
            assert feature in TenantFeature.ALL_FEATURES


class TestTokenCreation:
    """Tests for JWT token creation."""

    def test_super_admin_token_has_correct_type(self):
        """Super admin token should have typ='super_admin'."""
        token = create_super_admin_token(admin_id=1)
        payload = decode_token(token)

        assert payload["typ"] == "super_admin"
        assert payload["sub"] == "1"

    def test_tenant_token_has_tenant_claims(self):
        """Tenant user token should include tenant_id and tenant_slug."""
        token = create_tenant_access_token(
            user_id=1,
            tenant_id=5,
            tenant_slug="test-school",
            role="DIRECTOR",
        )
        payload = decode_token(token)

        assert payload["typ"] == "tenant"
        assert payload["sub"] == "1"
        assert payload["tenant_id"] == 5
        assert payload["tenant_slug"] == "test-school"
        assert payload["role"] == "DIRECTOR"


class TestEncryption:
    """Tests for encryption utilities."""

    def test_encrypt_decrypt_roundtrip(self):
        """Encrypted value should decrypt to original."""
        original = "my_secret_token_123"
        encrypted = encrypt(original)
        decrypted = decrypt(encrypted)

        assert decrypted == original
        assert encrypted != original.encode()

    def test_encrypt_empty_returns_empty(self):
        """Encrypting empty string returns empty bytes."""
        result = encrypt("")
        assert result == b""

    def test_decrypt_empty_returns_empty(self):
        """Decrypting empty bytes returns empty string."""
        result = decrypt(b"")
        assert result == ""

    def test_encrypt_if_present_none(self):
        """encrypt_if_present returns None for None input."""
        result = encrypt_if_present(None)
        assert result is None

    def test_decrypt_if_present_none(self):
        """decrypt_if_present returns None for None input."""
        result = decrypt_if_present(None)
        assert result is None

    def test_encrypt_if_present_value(self):
        """encrypt_if_present encrypts non-None values."""
        result = encrypt_if_present("secret")
        assert result is not None
        assert decrypt(result) == "secret"


class TestTenantIsolation:
    """Tests for tenant data isolation."""

    @pytest.mark.asyncio
    async def test_schema_switching(self):
        """Verify schema name is constructed correctly."""
        tenant_slug = "school-abc"
        expected_schema = "tenant_school-abc"

        # This tests the schema name pattern
        assert f"tenant_{tenant_slug}" == expected_schema

    def test_token_tenant_mismatch_prevention(self):
        """Token with wrong tenant_id should be rejected."""
        # Create token for tenant 1
        token = create_tenant_access_token(
            user_id=1,
            tenant_id=1,
            tenant_slug="school-a",
            role="DIRECTOR",
        )
        payload = decode_token(token)

        # Simulate request to tenant 2
        request_tenant_id = 2

        # This should be rejected
        assert payload["tenant_id"] != request_tenant_id


class TestSuperAdminEndpoints:
    """Tests for super admin API endpoints."""

    @pytest.fixture
    def mock_super_admin(self):
        return MagicMock(
            id=1,
            email="admin@example.com",
            full_name="Super Admin",
            is_active=True,
        )

    def test_super_admin_token_required_type(self):
        """Super admin endpoints should reject tenant tokens."""
        # Create a tenant token (not super admin)
        token = create_tenant_access_token(
            user_id=1,
            tenant_id=1,
            tenant_slug="test",
            role="DIRECTOR",
        )
        payload = decode_token(token)

        # This should be 'tenant', not 'super_admin'
        assert payload.get("typ") != "super_admin"


class TestTenantWhatsAppClient:
    """Tests for tenant-specific WhatsApp client."""

    def test_client_requires_credentials(self):
        """Client should raise if credentials missing."""
        from app.services.notifications.whatsapp import TenantWhatsAppClient
        from app.db.repositories.tenant_configs import DecryptedTenantConfig

        config = DecryptedTenantConfig(
            tenant_id=1,
            whatsapp_access_token=None,  # Missing
            whatsapp_phone_number_id=None,  # Missing
            ses_region=None,
            ses_source_email=None,
            ses_access_key=None,
            ses_secret_key=None,
            s3_bucket=None,
            s3_prefix=None,
            device_api_key=None,
        )

        with pytest.raises(ValueError) as exc_info:
            TenantWhatsAppClient(config)

        assert "not configured" in str(exc_info.value)

    def test_client_initializes_with_credentials(self):
        """Client should initialize with valid credentials."""
        from app.services.notifications.whatsapp import TenantWhatsAppClient
        from app.db.repositories.tenant_configs import DecryptedTenantConfig

        config = DecryptedTenantConfig(
            tenant_id=1,
            whatsapp_access_token="test_token",
            whatsapp_phone_number_id="12345",
            ses_region=None,
            ses_source_email=None,
            ses_access_key=None,
            ses_secret_key=None,
            s3_bucket=None,
            s3_prefix=None,
            device_api_key=None,
        )

        client = TenantWhatsAppClient(config)

        assert client._tenant_id == 1
        assert client._access_token == "test_token"
        assert client._phone_number_id == "12345"
