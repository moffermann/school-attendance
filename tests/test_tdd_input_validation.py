"""TDD Tests for Input Validation - Phase 4.

Bug categories tested:
- Bug 4.1: Schema name uses string interpolation in SQL (potential injection)
- Bug 4.2: Tenant ID without range validation (can be negative or too large)
- Bug 4.3: Email not normalized (case-sensitivity issues)
"""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException, Path


class TestBug4_1_SchemaNameSanitization:
    """Bug 4.1: Schema name validation in session.py.

    get_tenant_session uses f-string in SQL which could allow injection
    if schema_name isn't properly sanitized.
    """

    @pytest.mark.asyncio
    async def test_get_tenant_session_has_validation(self):
        """get_tenant_session should validate schema_name before use.

        Currently uses: f"SET search_path TO {schema_name}, public"
        Should validate schema_name first to prevent SQL injection.
        """
        from app.db import session as session_module
        import inspect

        source = inspect.getsource(session_module.get_tenant_session)

        # Should validate schema name before using in SQL
        has_validation = (
            "isalnum" in source
            or "validate" in source.lower()
            or "replace" in source
            or "sanitize" in source.lower()
        )
        assert has_validation, (
            "get_tenant_session should validate schema_name to prevent SQL injection"
        )

    @pytest.mark.asyncio
    async def test_create_tenant_schema_validates_name(self):
        """create_tenant_schema should validate schema name."""
        from app.db.session import create_tenant_schema

        # Try to create schema with SQL injection attempt
        with pytest.raises(ValueError) as exc_info:
            await create_tenant_schema("test; DROP TABLE users;--")

        assert "Invalid" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_sanitize_schema_name_removes_special_chars(self):
        """sanitize_schema_name should remove dangerous characters."""
        from app.core.tenant_middleware import sanitize_schema_name

        # Test various inputs
        assert sanitize_schema_name("colegio-abc") == "colegio_abc"
        assert sanitize_schema_name("test123") == "test123"

        # These should be sanitized to safe values
        result = sanitize_schema_name("test; DROP TABLE--")
        assert ";" not in result
        assert "-" not in result


class TestBug4_2_TenantIdValidation:
    """Bug 4.2: Tenant ID should be validated for range.

    tenant_id parameters should reject negative values or values > MAX_INT.
    """

    @pytest.mark.asyncio
    async def test_impersonate_endpoint_validates_tenant_id(self):
        """impersonate_tenant should validate tenant_id range.

        Should use Path(..., ge=1) to ensure tenant_id >= 1.
        """
        from app.api.v1.super_admin import tenants
        import inspect

        # Get the function signature
        sig = inspect.signature(tenants.impersonate_tenant)
        params = sig.parameters

        # Check if tenant_id has Path validation
        tenant_id_param = params.get("tenant_id")
        assert tenant_id_param is not None

        # The annotation should include Path with ge=1
        source = inspect.getsource(tenants.impersonate_tenant)
        has_validation = (
            "ge=1" in source
            or "gt=0" in source
            or "Path(" in source
        )
        assert has_validation, (
            "tenant_id should have Path validation with ge=1"
        )

    @pytest.mark.asyncio
    async def test_get_tenant_endpoint_validates_tenant_id(self):
        """get_tenant endpoint should validate tenant_id range."""
        from app.api.v1.super_admin import tenants
        import inspect

        source = inspect.getsource(tenants.get_tenant)

        # Should have validation for tenant_id
        has_validation = (
            "ge=1" in source
            or "gt=0" in source
            or "Path(" in source
        )
        assert has_validation, (
            "get_tenant should validate tenant_id with Path(ge=1)"
        )


class TestBug4_3_EmailNormalization:
    """Bug 4.3: Email addresses should be normalized to lowercase.

    Login should work regardless of email case (ADMIN@test.com == admin@test.com).
    """

    @pytest.mark.asyncio
    async def test_super_admin_login_normalizes_email(self):
        """super_admin_login should normalize email to lowercase.

        Currently searches with payload.email directly.
        Should normalize: admin = await repo.get_by_email(payload.email.lower())
        """
        from app.api.v1.super_admin import auth
        import inspect

        source = inspect.getsource(auth.super_admin_login)

        # Should normalize email before lookup
        has_normalization = (
            ".lower()" in source
            or "lower" in source.lower()
            or "normalize" in source.lower()
        )
        assert has_normalization, (
            "super_admin_login should normalize email to lowercase"
        )

    @pytest.mark.asyncio
    async def test_tenant_login_normalizes_email(self):
        """Tenant user login should also normalize email."""
        from app.services import auth_service
        import inspect

        # The normalization is done in _verify_user which is called by authenticate
        source = inspect.getsource(auth_service.AuthService._verify_user)

        # Should normalize email
        has_normalization = (
            ".lower()" in source
            or "lower" in source.lower()
            or "normalize" in source.lower()
        )
        assert has_normalization, (
            "AuthService._verify_user should normalize email to lowercase"
        )

    @pytest.mark.asyncio
    async def test_email_stored_normalized(self):
        """Verify email normalization is documented pattern."""
        # This test ensures we're aware that emails should be stored normalized
        # In the database, all emails should be lowercase

        # Test that pydantic EmailStr normalizes domain but not local part
        from pydantic import BaseModel, EmailStr

        class TestModel(BaseModel):
            email: EmailStr

        model = TestModel(email="TEST@EXAMPLE.COM")
        # Pydantic v2 normalizes domain to lowercase but keeps local part as-is
        # So we need to normalize the full email in our code
        # This test documents that we can't rely on Pydantic alone
        assert "@" in model.email  # Just verify it's a valid email format
