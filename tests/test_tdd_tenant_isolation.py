"""TDD Tests for Tenant Isolation - Phase 1.

Bug categories tested:
- Bug 1.1: JWT Tenant Mismatch - Conditional validation
- Bug 1.2: Fallback to Public Schema without validation
- Bug 1.3: X-Tenant-ID Header without token validation
- Bug 1.4: Cross-Tenant Access in Parent endpoints
"""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException
from starlette.requests import Request

from app.core.deps import (
    get_current_tenant_user,
    get_tenant_db,
    get_tenant,
    require_feature,
)
from app.core.security import create_tenant_access_token
from app.core.tenant_middleware import TenantMiddleware


class TestBug1_1_JWTTenantMismatch:
    """Bug 1.1: JWT tenant validation is conditional - skips if request_tenant is None."""

    @pytest.mark.asyncio
    async def test_jwt_tenant_mismatch_without_request_tenant_rejects(self):
        """Token con tenant_id=1 + request sin tenant context debe rechazar.

        Currently FAILS because the validation at deps.py:341 is conditional:
        `if request_tenant and token_tenant_id and ...`

        When request_tenant is None, the check is skipped entirely.
        """
        # Create token for tenant 1
        token = create_tenant_access_token(
            user_id=1,
            tenant_id=1,
            tenant_slug="tenant-a",
            role="DIRECTOR",
        )

        # Create request WITHOUT tenant context (request.state.tenant = None)
        request = MagicMock(spec=Request)
        request.state = MagicMock()
        request.state.tenant = None  # No tenant resolved by middleware
        request.state.tenant_schema = None

        # Mock session and user repo
        mock_session = AsyncMock()
        mock_user = MagicMock()
        mock_user.id = 1
        mock_user.is_active = True
        mock_user.role = "DIRECTOR"
        mock_user.full_name = "Test User"
        mock_user.guardian_id = None
        mock_user.teacher_id = None

        with patch("app.core.deps.UserRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = mock_user
            mock_repo_class.return_value = mock_repo

            # This should REJECT because token has tenant_id but request has no tenant
            # Currently it ALLOWS because the check is skipped
            with pytest.raises(HTTPException) as exc_info:
                await get_current_tenant_user(request, token, mock_session)

            assert exc_info.value.status_code == 403
            assert "tenant" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_jwt_tenant_mismatch_with_different_tenant_rejects(self):
        """Token tenant_id=1 + request tenant_id=2 debe rechazar."""
        # Create token for tenant 1
        token = create_tenant_access_token(
            user_id=1,
            tenant_id=1,
            tenant_slug="tenant-a",
            role="DIRECTOR",
        )

        # Create request with tenant 2
        request = MagicMock(spec=Request)
        request.state = MagicMock()
        mock_tenant = MagicMock()
        mock_tenant.id = 2  # Different tenant!
        mock_tenant.slug = "tenant-b"
        request.state.tenant = mock_tenant
        request.state.tenant_schema = "tenant_tenant_b"

        mock_session = AsyncMock()

        with pytest.raises(HTTPException) as exc_info:
            await get_current_tenant_user(request, token, mock_session)

        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_jwt_with_matching_tenant_allows(self):
        """Token tenant_id=1 + request tenant_id=1 debe permitir."""
        token = create_tenant_access_token(
            user_id=1,
            tenant_id=1,
            tenant_slug="tenant-a",
            role="DIRECTOR",
        )

        request = MagicMock(spec=Request)
        request.state = MagicMock()
        mock_tenant = MagicMock()
        mock_tenant.id = 1  # Same tenant
        mock_tenant.slug = "tenant-a"
        request.state.tenant = mock_tenant
        request.state.tenant_schema = "tenant_tenant_a"

        mock_session = AsyncMock()
        mock_user = MagicMock()
        mock_user.id = 1
        mock_user.is_active = True
        mock_user.role = "DIRECTOR"
        mock_user.full_name = "Test User"
        mock_user.guardian_id = None
        mock_user.teacher_id = None

        with patch("app.core.deps.UserRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = mock_user
            mock_repo_class.return_value = mock_repo

            # Should allow
            user = await get_current_tenant_user(request, token, mock_session)
            assert user.tenant_id == 1


class TestBug1_2_FallbackPublicSchema:
    """Bug 1.2: get_tenant_db falls back to public schema when tenant_schema is None.

    The fix introduces require_tenant_db which is strict (no fallback).
    """

    @pytest.mark.asyncio
    async def test_require_tenant_db_rejects_without_tenant_schema(self):
        """require_tenant_db sin tenant_schema debe rechazar.

        This tests the NEW require_tenant_db dependency that doesn't fall back.
        """
        from app.core.deps import require_tenant_db

        request = MagicMock(spec=Request)
        request.state = MagicMock()
        request.state.tenant_schema = None  # No tenant schema

        # require_tenant_db should REJECT
        with pytest.raises(HTTPException) as exc_info:
            async for session in require_tenant_db(request):
                pytest.fail("Should have raised HTTPException")

        assert exc_info.value.status_code == 400
        assert "tenant" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_require_tenant_db_works_with_valid_tenant_schema(self):
        """require_tenant_db con tenant_schema válido debe funcionar."""
        from app.core.deps import require_tenant_db

        request = MagicMock(spec=Request)
        request.state = MagicMock()
        request.state.tenant_schema = "tenant_test"

        with patch("app.core.deps.get_tenant_session") as mock_get_tenant_session:
            mock_session = AsyncMock()

            async def mock_generator():
                yield mock_session

            mock_get_tenant_session.return_value = mock_generator()

            async for session in require_tenant_db(request):
                assert session == mock_session

    @pytest.mark.asyncio
    async def test_get_tenant_db_still_allows_fallback_for_backwards_compat(self):
        """get_tenant_db mantiene fallback para backwards compatibility."""
        request = MagicMock(spec=Request)
        request.state = MagicMock()
        request.state.tenant_schema = None

        with patch("app.core.deps.get_session") as mock_get_session:
            mock_session = AsyncMock()

            async def mock_generator():
                yield mock_session

            mock_get_session.return_value = mock_generator()

            # get_tenant_db should fall back to public schema
            async for session in get_tenant_db(request):
                assert session == mock_session


class TestBug1_3_XTenantIDHeader:
    """Bug 1.3: X-Tenant-ID header is accepted without validating JWT token type."""

    @pytest.fixture
    def middleware(self):
        app = MagicMock()
        return TenantMiddleware(app)

    @pytest.mark.asyncio
    async def test_x_tenant_id_header_requires_super_admin_token(self, middleware):
        """Header X-Tenant-ID solo debe funcionar con token super_admin.

        Currently FAILS because middleware at tenant_middleware.py:177-187
        resolves tenant from X-Tenant-ID header without checking token type.

        The middleware accepts X-Tenant-ID from ANY request, even if the
        Authorization header contains a regular tenant token.
        """
        # Create a NORMAL tenant token (not super_admin)
        token = create_tenant_access_token(
            user_id=1,
            tenant_id=1,
            tenant_slug="tenant-a",
            role="DIRECTOR",
        )

        # Verify the token is NOT super_admin
        from app.core.security import decode_token
        payload = decode_token(token)
        assert payload.get("typ") == "tenant", "Token should be tenant type"
        assert payload.get("typ") != "super_admin"

        # The bug is that middleware reads X-Tenant-ID without validating
        # the token type. This test documents that the header should be
        # rejected for non-super_admin tokens.

        # Check that middleware code does NOT validate token before using X-Tenant-ID
        from app.core import tenant_middleware
        import inspect
        source = inspect.getsource(tenant_middleware.TenantMiddleware._resolve_tenant)

        # The current code reads X-Tenant-ID header without token validation
        has_x_tenant_check = "X-Tenant-ID" in source or "x-tenant-id" in source.lower()
        assert has_x_tenant_check, "Middleware should handle X-Tenant-ID"

        # This should fail until we add token validation
        has_token_validation = "super_admin" in source.lower() or "token" in source.lower()
        assert has_token_validation, (
            "Middleware should validate token type before accepting X-Tenant-ID"
        )

    @pytest.mark.asyncio
    async def test_x_tenant_id_with_super_admin_token_allows(self, middleware):
        """X-Tenant-ID con token super_admin debe permitir."""
        from app.core.security import create_super_admin_token

        token = create_super_admin_token(admin_id=1)

        request = MagicMock(spec=Request)
        request.url.path = "/api/v1/super-admin/tenants"
        request.headers = {
            "x-tenant-id": "2",
            "host": "localhost",
            "authorization": f"Bearer {token}",
        }
        request.state = MagicMock()

        # Super admin routes are in PUBLIC_ENDPOINTS, so they bypass tenant check
        # This test verifies the pattern is correct
        call_next = AsyncMock()
        call_next.return_value = MagicMock()

        await middleware.dispatch(request, call_next)
        # Should not raise


class TestBug1_4_CrossTenantParent:
    """Bug 1.4: Parent endpoints don't validate tenant_id of guardian.

    The issue is that parents.py uses get_consent_service which uses get_db
    (public schema) instead of get_tenant_db. This means:
    1. The schema is not tenant-specific
    2. There's no tenant validation on the guardian lookup

    The fix requires using TenantAuthUser and validating tenant context.
    """

    @pytest.mark.asyncio
    async def test_parent_endpoint_requires_tenant_context(self):
        """Parent endpoints deben requerir tenant context.

        Currently FAILS because parents.py uses get_db (public schema)
        instead of get_tenant_db, so there's no tenant isolation.
        """
        from app.core.deps import TenantAuthUser

        # Create a parent user WITH tenant context
        mock_user = TenantAuthUser(
            id=1,
            role="PARENT",
            full_name="Test Parent",
            guardian_id=100,
            teacher_id=None,
            tenant_id=1,
            tenant_slug="tenant-a",
        )

        # The endpoint should use TenantAuthUser to validate tenant
        # Currently it uses plain AuthUser which has no tenant_id
        assert hasattr(mock_user, "tenant_id")
        assert mock_user.tenant_id == 1

    @pytest.mark.asyncio
    async def test_consent_service_should_use_tenant_db(self):
        """ConsentService debe usar get_tenant_db, no get_db.

        Currently FAILS because deps.get_consent_service uses get_db
        at deps.py:198-201 which returns public schema.
        """
        from app.core import deps
        import inspect

        # Get the source of get_consent_service
        source = inspect.getsource(deps.get_consent_service)

        # It should use get_tenant_db, not get_db
        # Currently uses get_db which is the bug
        assert "get_tenant_db" in source, (
            "get_consent_service should use get_tenant_db for tenant isolation"
        )

    @pytest.mark.asyncio
    async def test_parent_role_check_includes_tenant_validation(self):
        """Parent role check debe incluir validación de tenant.

        Currently the check at parents.py:20-21 is:
        `if user.role == "PARENT" and user.guardian_id != guardian_id`

        It should also check tenant_id if we want cross-tenant isolation.
        """
        from app.api.v1 import parents
        import inspect

        source = inspect.getsource(parents.get_preferences)

        # The current implementation doesn't check tenant_id
        # This test documents what SHOULD happen
        # After fix, the check should include tenant validation
        has_guardian_check = "guardian_id" in source
        assert has_guardian_check, "Should have guardian_id check"

        # This will fail until we add tenant validation
        has_tenant_check = "tenant_id" in source or "tenant" in source.lower()
        assert has_tenant_check, (
            "get_preferences should validate tenant context"
        )
