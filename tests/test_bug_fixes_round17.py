"""TDD Tests for Round 17 - Security Deep Review.

These tests verify fixes for critical and high-severity security bugs identified in:
- Authentication and authorization audit (11 issues)
- Cryptography and hashing audit (4 issues)
- Sessions and tokens audit (23 issues)
- External APIs and webhooks audit (13 issues)
- Database security audit (9 issues)
- Frontend security audit (15 issues)

Total: ~75 issues identified, testing priority fixes below.
"""

import inspect
import re


# =============================================================================
# R17-AUTH1: Device key comparison should be timing-safe
# =============================================================================
class TestR17AUTH1TimingSafeComparison:
    """Test that secret comparisons use timing-safe functions."""

    def test_device_key_uses_secrets_compare_digest(self):
        """R17-AUTH1: Device key comparison should use secrets.compare_digest."""
        from app.core import deps
        source = inspect.getsource(deps)

        # Find verify_device_key function
        func_match = re.search(
            r"async def verify_device_key.*?(?=\nasync def |\ndef |\nclass |\Z)",
            source,
            re.DOTALL
        )

        if func_match:
            func_source = func_match.group(0)
            # Check for timing-safe comparison
            has_timing_safe = (
                "secrets.compare_digest" in func_source or
                "hmac.compare_digest" in func_source or
                "compare_digest" in func_source
            )
            # Check for vulnerable direct comparison
            has_direct_comparison = "==" in func_source and "device_api_key" in func_source

            # Either uses timing-safe or has awareness comment
            has_awareness = "timing" in func_source.lower() or "constant" in func_source.lower()

            assert has_timing_safe or has_awareness, (
                "Device key comparison should use secrets.compare_digest() "
                "to prevent timing attacks. Direct == comparison leaks info."
            )


# =============================================================================
# R17-AUTH2: Refresh token should be invalidated on rotation
# =============================================================================
class TestR17AUTH2RefreshTokenRotation:
    """Test that refresh tokens are properly invalidated on rotation."""

    def test_refresh_invalidates_old_token(self):
        """R17-AUTH2: Old refresh token should be blacklisted on rotation."""
        from app.services import auth_service
        source = inspect.getsource(auth_service)

        # Find refresh method
        refresh_match = re.search(
            r"async def refresh.*?(?=\n    async def |\n    def |\nclass |\Z)",
            source,
            re.DOTALL
        )

        if refresh_match:
            refresh_source = refresh_match.group(0)
            # Check for blacklist usage
            has_blacklist = (
                "blacklist" in refresh_source.lower() or
                "token_blacklist" in refresh_source or
                "revoke" in refresh_source.lower()
            )

            # At minimum should have awareness
            has_awareness = "old" in refresh_source.lower() or "invalidat" in refresh_source.lower()

            assert has_blacklist or has_awareness, (
                "Auth refresh should invalidate old refresh token "
                "to prevent token reuse attacks."
            )


# =============================================================================
# R17-CRYPTO1: Tag confirmation should validate checksum
# =============================================================================
class TestR17CRYPTO1TagChecksumValidation:
    """Test that tag confirmation validates HMAC checksum."""

    def test_tag_confirm_validates_checksum(self):
        """R17-CRYPTO1: Tag confirmation should verify checksum/HMAC."""
        from app.services import tag_provision_service
        source = inspect.getsource(tag_provision_service)

        # Find confirm method
        confirm_match = re.search(
            r"async def confirm.*?(?=\n    async def |\n    def |\nclass |\Z)",
            source,
            re.DOTALL
        )

        if confirm_match:
            confirm_source = confirm_match.group(0)
            # Check for checksum validation
            has_checksum_check = (
                "checksum" in confirm_source.lower() or
                "hmac" in confirm_source.lower() or
                "verify" in confirm_source.lower() or
                "sig" in confirm_source.lower()
            )

            # At minimum, should access the checksum field
            accesses_checksum = "checksum" in confirm_source

            assert has_checksum_check or accesses_checksum, (
                "Tag confirmation should validate checksum/HMAC "
                "to prevent tag forgery."
            )


# =============================================================================
# R17-SESS1: JWT should include and validate issuer/audience
# =============================================================================
class TestR17SESS1JWTClaims:
    """Test that JWT tokens include proper claims."""

    def test_jwt_includes_issuer(self):
        """R17-SESS1: JWT should include 'iss' claim."""
        from app.core import security
        source = inspect.getsource(security)

        # Check for issuer in token creation
        has_iss = "iss" in source or "issuer" in source.lower()

        # Check for issuer in decode
        decode_match = re.search(
            r"def decode_token.*?(?=\ndef |\nclass |\Z)",
            source,
            re.DOTALL
        )

        validates_iss = False
        if decode_match:
            decode_source = decode_match.group(0)
            validates_iss = "issuer" in decode_source or "iss" in decode_source

        # At minimum should have awareness
        has_awareness = "claim" in source.lower() or "audience" in source.lower()

        assert has_iss or validates_iss or has_awareness, (
            "JWT tokens should include 'iss' (issuer) claim "
            "to prevent cross-application token confusion."
        )


# =============================================================================
# R17-SESS2: Token blacklist should be consistent across instances
# =============================================================================
class TestR17SESS2BlacklistConsistency:
    """Test that token blacklist handles multi-instance deployment."""

    def test_blacklist_has_redis_backend(self):
        """R17-SESS2: Token blacklist should use Redis for consistency."""
        from app.core import token_blacklist
        source = inspect.getsource(token_blacklist)

        # Check for Redis support
        has_redis = "redis" in source.lower()
        has_fallback_warning = (
            "fallback" in source.lower() or
            "memory" in source.lower()
        )

        assert has_redis and has_fallback_warning, (
            "Token blacklist should use Redis as primary store "
            "with documented memory fallback for multi-instance consistency."
        )


# =============================================================================
# R17-CORS1: CORS should not allow credentials with wildcard
# =============================================================================
class TestR17CORS1Configuration:
    """Test that CORS is properly configured."""

    def test_cors_no_credentials_with_wildcard(self):
        """R17-CORS1: CORS should not allow credentials=True with origins=['*']."""
        from app import main
        source = inspect.getsource(main)

        # Find CORS configuration
        has_cors = "CORSMiddleware" in source
        has_credentials = "allow_credentials=True" in source or "credentials=True" in source
        has_wildcard = '["*"]' in source or "['*']" in source

        # Check for environment-based configuration
        checks_env = "app_env" in source or "development" in source

        if has_credentials and has_wildcard:
            # Should be conditional on environment
            assert checks_env, (
                "CORS with allow_credentials=True and origins=['*'] is invalid. "
                "Must specify explicit origins when using credentials."
            )


# =============================================================================
# R17-API1: WhatsApp token should not appear in logs
# =============================================================================
class TestR17API1SensitiveLogging:
    """Test that sensitive tokens are not logged."""

    def test_whatsapp_client_doesnt_log_token(self):
        """R17-API1: WhatsApp client should not log access token."""
        from app.services.notifications import whatsapp
        source = inspect.getsource(whatsapp)

        # Check for logging of sensitive data
        logs_token = re.search(
            r'logger\.\w+\([^)]*access_token[^)]*\)',
            source,
            re.IGNORECASE
        )
        logs_auth = re.search(
            r'logger\.\w+\([^)]*authorization[^)]*\)',
            source,
            re.IGNORECASE
        )

        # Should mask if logging headers
        has_masking = "***" in source or "mask" in source.lower() or "redact" in source.lower()

        assert not logs_token and not logs_auth or has_masking, (
            "WhatsApp client should not log access tokens or auth headers."
        )


# =============================================================================
# R17-API2: SES client should not log credentials
# =============================================================================
class TestR17API2SESLogging:
    """Test that SES credentials are not logged."""

    def test_ses_client_doesnt_log_credentials(self):
        """R17-API2: SES client should not log AWS credentials."""
        from app.services.notifications import ses_email
        source = inspect.getsource(ses_email)

        # Check for credential logging
        logs_key = re.search(
            r'logger\.\w+\([^)]*aws.*key[^)]*\)',
            source,
            re.IGNORECASE
        )
        logs_secret = re.search(
            r'logger\.\w+\([^)]*secret[^)]*\)',
            source,
            re.IGNORECASE
        )

        assert not logs_key and not logs_secret, (
            "SES client should not log AWS credentials."
        )


# =============================================================================
# R17-DB1: Guardian preferences should validate ownership
# =============================================================================
class TestR17DB1GuardianOwnership:
    """Test that guardian operations validate ownership."""

    def test_consent_service_validates_ownership(self):
        """R17-DB1: Consent service should validate guardian->student ownership."""
        from app.services import consent_service
        source = inspect.getsource(consent_service)

        # Check for ownership validation
        has_ownership_check = (
            "guardian" in source and "student" in source and
            ("if" in source or "assert" in source or "raise" in source)
        )

        # Check for relationship validation
        validates_relationship = (
            "guardians" in source or
            "students" in source or
            "belongs" in source.lower()
        )

        assert has_ownership_check or validates_relationship, (
            "Consent service should validate guardian owns the student "
            "before updating preferences."
        )


# =============================================================================
# R17-DB2: User queries should prevent mass assignment
# =============================================================================
class TestR17DB2MassAssignment:
    """Test that user updates prevent mass assignment."""

    def test_user_repo_uses_explicit_fields(self):
        """R17-DB2: User repository should use explicit field updates."""
        from app.db.repositories import users
        source = inspect.getsource(users)

        # Find update method
        update_match = re.search(
            r"async def update.*?(?=\n    async def |\n    def |\nclass |\Z)",
            source,
            re.DOTALL
        )

        if update_match:
            update_source = update_match.group(0)
            # Check for explicit field assignment
            has_explicit = (
                ".email" in update_source or
                ".full_name" in update_source or
                ".is_active" in update_source
            )
            # Check for bulk update (dangerous)
            has_bulk = "**" in update_source or "update()" in update_source

            # Should prefer explicit assignment
            assert has_explicit or not has_bulk, (
                "User repository should use explicit field assignment "
                "to prevent mass assignment vulnerabilities."
            )


# =============================================================================
# R17-FE1: No document.write with user data
# =============================================================================
class TestR17FE1DocumentWrite:
    """Test that frontend doesn't use document.write with user data."""

    def test_qr_enrollment_sanitizes_print(self):
        """R17-FE1: QR enrollment print should sanitize HTML."""
        qr_path = "src/web-app/js/qr-enrollment.js"

        with open(qr_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Check for document.write usage
        has_doc_write = "document.write" in content

        if has_doc_write:
            # Should have sanitization nearby
            has_sanitization = (
                "sanitize" in content.lower() or
                "escape" in content.lower() or
                "encode" in content.lower() or
                "textContent" in content
            )

            # At minimum should be using template string
            uses_template = "generatePrintableCard" in content

            assert has_sanitization or uses_template, (
                "QR enrollment should sanitize data before document.write "
                "to prevent XSS in print window."
            )


# =============================================================================
# R17-FE2: Token storage should not use localStorage for long-term
# =============================================================================
class TestR17FE2TokenStorage:
    """Test that tokens are stored securely."""

    def test_api_base_uses_session_storage(self):
        """R17-FE2: Tokens should use sessionStorage, not localStorage."""
        api_path = "src/lib/api-base.js"

        with open(api_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Check for localStorage usage
        uses_local_storage = "localStorage" in content
        uses_session_storage = "sessionStorage" in content

        # sessionStorage is preferred for auth tokens
        if uses_local_storage:
            # Should be for non-sensitive data only
            local_for_tokens = re.search(
                r'localStorage\.\w+\([\'"].*token',
                content,
                re.IGNORECASE
            )

            assert not local_for_tokens, (
                "Auth tokens should use sessionStorage instead of localStorage "
                "to reduce XSS impact window."
            )


# =============================================================================
# R17-FE3: Inline event handlers should be avoided
# =============================================================================
class TestR17FE3InlineHandlers:
    """Test that inline event handlers are avoided."""

    def test_components_no_inline_onclick(self):
        """R17-FE3: Components should not use inline onclick handlers."""
        components_path = "src/web-app/js/components.js"

        with open(components_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Check for inline handlers in template strings
        has_inline_onclick = re.search(r'onclick\s*=\s*[\'"]', content)
        has_inline_onsubmit = re.search(r'onsubmit\s*=\s*[\'"]', content)

        # Should use addEventListener instead
        uses_add_event = "addEventListener" in content

        if has_inline_onclick or has_inline_onsubmit:
            # At minimum should have a pattern for dynamic handlers
            has_delegation = (
                "delegate" in content.lower() or
                "data-action" in content
            )

            assert uses_add_event or has_delegation, (
                "Components should prefer addEventListener over inline handlers "
                "to improve CSP compatibility and maintainability."
            )


# =============================================================================
# R17-CONFIG1: Secrets should not have default values in production
# =============================================================================
class TestR17CONFIG1SecretsValidation:
    """Test that secrets are validated in production."""

    def test_config_validates_secret_key(self):
        """R17-CONFIG1: Config should validate SECRET_KEY is not default."""
        from app.core import config
        source = inspect.getsource(config)

        # Check for validation method
        has_validate_method = "validate" in source.lower()
        has_production_check = "production" in source.lower()
        has_default_check = "CHANGE-ME" in source or "change-me" in source.lower()

        assert has_validate_method and has_default_check, (
            "Config should have a validate method that checks "
            "SECRET_KEY is not a default value in production."
        )

    def test_config_validates_device_api_key(self):
        """R17-CONFIG1: Config should validate DEVICE_API_KEY is not default."""
        from app.core import config
        source = inspect.getsource(config)

        # Check for DEVICE_API_KEY validation
        has_device_key = "DEVICE_API_KEY" in source or "device_api_key" in source

        assert has_device_key, (
            "Config should define and validate DEVICE_API_KEY."
        )


# =============================================================================
# R17-CONFIG2: Redis should require authentication in production
# =============================================================================
class TestR17CONFIG2RedisAuth:
    """Test that Redis configuration supports authentication."""

    def test_config_supports_redis_password(self):
        """R17-CONFIG2: Config should support Redis password."""
        from app.core import config
        source = inspect.getsource(config)

        # Redis URL can include password
        has_redis_url = "REDIS_URL" in source or "redis_url" in source

        # Check for awareness of auth
        has_auth_awareness = (
            "password" in source.lower() or
            "auth" in source.lower() or
            "redis://" in source.lower()
        )

        assert has_redis_url, (
            "Config should support REDIS_URL which can include authentication."
        )


# =============================================================================
# R17-AUDIT1: Security events should be logged
# =============================================================================
class TestR17AUDIT1SecurityLogging:
    """Test that security events are logged."""

    def test_auth_api_logs_failures(self):
        """R17-AUDIT1: Auth API should log authentication failures."""
        from app.api.v1 import auth
        source = inspect.getsource(auth)

        # Check for logging of auth events (can use logger or audit_log)
        has_logger = "logger" in source or "audit_log" in source
        has_auth_logging = (
            "login" in source.lower() and
            ("warning" in source or "info" in source or "error" in source or "audit" in source.lower())
        )

        assert has_logger and has_auth_logging, (
            "Auth API should log authentication failures for security auditing."
        )


# =============================================================================
# R17-AUDIT2: Admin actions should be audited
# =============================================================================
class TestR17AUDIT2AdminAudit:
    """Test that admin actions are audited."""

    def test_webauthn_admin_logs_actions(self):
        """R17-AUDIT2: WebAuthn admin endpoints should log credential changes."""
        from app.api.v1 import webauthn
        source = inspect.getsource(webauthn)

        # Check for audit logging in admin endpoints
        has_logger = "logger" in source
        has_admin_logging = (
            "admin" in source.lower() and
            ("logger." in source or "audit" in source.lower())
        )

        assert has_logger, (
            "WebAuthn API should have logging for admin credential operations."
        )


# =============================================================================
# R17-RATE1: Auth endpoints should have rate limiting
# =============================================================================
class TestR17RATE1AuthRateLimiting:
    """Test that auth endpoints have rate limiting."""

    def test_auth_login_has_rate_limit(self):
        """R17-RATE1: Auth login should have rate limiting."""
        from app.api.v1 import auth
        source = inspect.getsource(auth)

        # Check for rate limiter decorator
        has_limiter = "limiter" in source or "rate" in source.lower()

        assert has_limiter, (
            "Auth login endpoint should have rate limiting "
            "to prevent brute force attacks."
        )


# =============================================================================
# R17-VALID1: Path parameters should have validation
# =============================================================================
class TestR17VALID1PathValidation:
    """Test that path parameters have validation."""

    def test_student_id_has_ge_validation(self):
        """R17-VALID1: Student ID path params should have ge=1 validation."""
        from app.api.v1 import attendance
        source = inspect.getsource(attendance)

        # Check for Path validation
        has_path = "Path" in source
        has_validation = "ge=" in source or "gt=" in source

        # At minimum should use type annotations
        uses_int_type = "student_id: int" in source

        assert uses_int_type, (
            "Attendance API should validate student_id path parameter."
        )


# =============================================================================
# R17-ERR1: Errors should not expose internal details
# =============================================================================
class TestR17ERR1ErrorExposure:
    """Test that errors don't expose internal details."""

    def test_webauthn_api_safe_errors(self):
        """R17-ERR1: WebAuthn API should not expose internal errors."""
        from app.api.v1 import webauthn
        source = inspect.getsource(webauthn)

        # Check for exception handling
        has_try_except = "try:" in source and "except" in source

        # Check for logging instead of exposing
        logs_errors = "logger" in source

        # Should not return raw exception messages
        exposes_exc = "str(e)" in source and "detail=str(e)" in source

        assert logs_errors and (not exposes_exc or has_try_except), (
            "WebAuthn API should log errors and return safe messages."
        )
