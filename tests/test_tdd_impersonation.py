"""TDD Tests for Impersonation Security - Phase 3.

Bug categories tested:
- Bug 3.1: is_impersonation flag is set but never validated
- Bug 3.2: Impersonation token uses default expiration (15 min) instead of short TTL
- Bug 3.3: Impersonation role is hardcoded to DIRECTOR (max privileges)
- Bug 3.4: No token revocation mechanism - token valid until expiration
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.core.security import (
    create_tenant_access_token,
    decode_token,
)


class TestBug3_1_ImpersonationFlagNotValidated:
    """Bug 3.1: is_impersonation flag is passed but never validated anywhere.

    The flag is set in the token but no code checks for it, so it serves no purpose.
    """

    @pytest.mark.asyncio
    async def test_impersonation_token_has_flag(self):
        """Impersonation token should include is_impersonation flag."""
        token = create_tenant_access_token(
            user_id=1,
            tenant_id=1,
            tenant_slug="test-tenant",
            role="DIRECTOR",
            is_impersonation=True,
        )

        payload = decode_token(token)

        # The flag should be in the token
        assert payload.get("is_impersonation") is True

    @pytest.mark.asyncio
    async def test_impersonate_endpoint_sets_flag(self):
        """impersonate_tenant endpoint should set is_impersonation=True in token."""
        import inspect

        from app.api.v1.super_admin import tenants

        source = inspect.getsource(tenants.impersonate_tenant)

        # Should include is_impersonation=True when creating token
        has_flag = "is_impersonation=True" in source or "is_impersonation = True" in source
        assert has_flag, "impersonate_tenant should set is_impersonation=True"

    @pytest.mark.asyncio
    async def test_impersonation_flag_validated_in_deps(self):
        """Impersonation flag should be validated/logged in deps.

        After fix, get_current_tenant_user should recognize impersonation tokens.
        """
        import inspect

        from app.core import deps

        source = inspect.getsource(deps.get_current_tenant_user)

        # The fix should check/use is_impersonation flag
        has_impersonation_check = "is_impersonation" in source
        assert has_impersonation_check, (
            "get_current_tenant_user should validate or record is_impersonation flag"
        )


class TestBug3_2_ImpersonationTokenExpiration:
    """Bug 3.2: Impersonation token uses default 15 min expiration.

    For security, impersonation tokens should expire faster (5 min max).
    """

    @pytest.mark.asyncio
    async def test_impersonate_endpoint_uses_short_expiration(self):
        """impersonate_tenant should pass shorter expires_minutes.

        Currently uses default (15 min), should be 5 min or less.
        """
        import inspect

        from app.api.v1.super_admin import tenants

        source = inspect.getsource(tenants.impersonate_tenant)

        # Should specify expires_minutes for shorter TTL
        has_short_expiry = "expires_minutes" in source
        assert has_short_expiry, "impersonate_tenant should specify expires_minutes for shorter TTL"

    @pytest.mark.asyncio
    async def test_create_tenant_access_token_accepts_expiration(self):
        """create_tenant_access_token should accept expires_minutes parameter."""
        import inspect

        from app.core.security import create_tenant_access_token

        sig = inspect.signature(create_tenant_access_token)
        params = list(sig.parameters.keys())

        assert "expires_minutes" in params, (
            "create_tenant_access_token should accept expires_minutes"
        )


class TestBug3_3_HardcodedDirectorRole:
    """Bug 3.3: Impersonation always grants DIRECTOR role.

    Super admin impersonation uses hardcoded "DIRECTOR" role which has
    maximum privileges. Should be configurable with safer default.
    """

    @pytest.mark.asyncio
    async def test_impersonate_uses_hardcoded_role(self):
        """Check that impersonate_tenant uses configurable role.

        After fix, should allow role parameter or use safer default.
        """
        import inspect

        from app.api.v1.super_admin import tenants

        source = inspect.getsource(tenants.impersonate_tenant)

        # Check for role configuration - either parameter or default constant
        # The fix might make it configurable or use INSPECTOR as default
        has_role_config = (
            "impersonation_role" in source.lower()
            or "INSPECTOR" in source
            or 'role="INSPECTOR"' in source
            or "payload.role" in source
        )
        assert has_role_config, (
            "impersonate_tenant should use configurable or safer role (INSPECTOR)"
        )


class TestBug3_4_NoTokenRevocation:
    """Bug 3.4: No mechanism to revoke tokens immediately.

    If admin is compromised, tokens remain valid until expiration.
    Need a token blacklist mechanism.
    """

    @pytest.mark.asyncio
    async def test_token_blacklist_module_exists(self):
        """Token blacklist module should exist for revocation."""
        try:
            from app.core import token_blacklist

            assert True
        except ImportError:
            pytest.fail("token_blacklist module should exist for token revocation")

    @pytest.mark.asyncio
    async def test_token_blacklist_has_required_functions(self):
        """Token blacklist should have add and check functions."""
        from app.core.token_blacklist import add_to_blacklist, is_blacklisted

        # Functions should exist
        assert callable(add_to_blacklist)
        assert callable(is_blacklisted)

    @pytest.mark.asyncio
    async def test_decode_token_checks_blacklist(self):
        """decode_token should check if token is blacklisted.

        After fix, decode_token should reject blacklisted tokens.
        """
        import inspect

        from app.core import security

        source = inspect.getsource(security.decode_token)

        # Should check blacklist
        has_blacklist_check = "blacklist" in source.lower()
        assert has_blacklist_check, "decode_token should check token blacklist"

    @pytest.mark.asyncio
    async def test_blacklisted_token_rejected(self):
        """Blacklisted token should be rejected."""
        from app.core.token_blacklist import add_to_blacklist, clear_blacklist

        # Clear blacklist first
        clear_blacklist()

        # Create a valid token with unique ID to avoid test interference
        token = create_tenant_access_token(
            user_id=999999,  # Use unique ID
            tenant_id=999,
            tenant_slug="test-blacklist",
            role="DIRECTOR",
        )

        # Token should work initially
        payload = decode_token(token)
        assert payload["sub"] == "999999"

        # Add to blacklist
        add_to_blacklist(token)

        # Token should now be rejected
        with pytest.raises(HTTPException) as exc_info:
            decode_token(token)

        assert exc_info.value.status_code == 401

        # Clean up - clear blacklist at the end
        clear_blacklist()


class TestBug3_5_ImpersonationAuditLogging:
    """Additional: Impersonation should have complete audit trail."""

    @pytest.mark.asyncio
    async def test_impersonate_logs_with_ip_address(self):
        """Impersonation audit log should include IP address.

        Currently logs admin_email but not IP address.
        """
        import inspect

        from app.api.v1.super_admin import tenants

        source = inspect.getsource(tenants.impersonate_tenant)

        # Should extract and log IP address
        has_ip_logging = "ip_address" in source.lower() or "client_host" in source.lower()
        assert has_ip_logging, "impersonate_tenant should log IP address in audit"
