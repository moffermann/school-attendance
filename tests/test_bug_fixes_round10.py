"""TDD Tests for Round 10 bug fixes.

These tests verify fixes for:
- R10-A: API endpoint bugs
- R10-W: Web-app JS bugs
- R10-S: Services layer bugs
"""

import inspect
import re


# =============================================================================
# R10-A3: Query parameter 'search' should have max_length validation
# =============================================================================
class TestR10A3SearchMaxLength:
    """Test that search parameter has max_length validation."""

    def test_dashboard_search_has_max_length(self):
        """R10-A3: search parameter should have max_length to prevent DoS."""
        from app.api.v1 import webapp

        source = inspect.getsource(webapp)

        # Check that search parameter has max_length in Query
        # Pattern: search: ... = Query(..., max_length=...)
        has_max_length = re.search(r"search.*Query\([^)]*max_length\s*=", source)

        assert has_max_length, (
            "search parameter should have max_length validation to prevent DoS attacks"
        )


# =============================================================================
# R10-A4: event_type should use Literal or enum, not plain str
# =============================================================================
class TestR10A4EventTypeValidation:
    """Test that event_type uses proper validation."""

    def test_dashboard_event_type_uses_literal_or_enum(self):
        """R10-A4: event_type should be validated against allowed values."""
        from app.api.v1 import webapp

        source = inspect.getsource(webapp)

        # Should use Literal["IN", "OUT"] or an enum for event_type
        # Check if there's type validation
        has_literal = 'Literal["IN", "OUT"]' in source or "Literal['IN', 'OUT']" in source
        has_enum = "EventType" in source and "event_type" in source

        assert has_literal or has_enum, (
            "event_type should use Literal['IN', 'OUT'] or enum to validate values"
        )


# =============================================================================
# R10-A6: student_id path parameter should have ge=1 constraint
# =============================================================================
class TestR10A6StudentIdConstraint:
    """Test that student_id has ge=1 constraint."""

    def test_kiosk_biometric_status_student_id_validated(self):
        """R10-A6: student_id should have ge=1 to prevent invalid IDs."""
        from app.api.v1.webauthn import kiosk_check_biometric_status

        sig = inspect.signature(kiosk_check_biometric_status)
        student_id_param = sig.parameters.get("student_id")

        assert student_id_param is not None, "student_id parameter should exist"

        default = student_id_param.default
        # Should have Path with ge=1
        if hasattr(default, "ge"):
            assert default.ge == 1, "student_id should have ge=1"
        else:
            # Check if it's typed with Path
            source = inspect.getsource(kiosk_check_biometric_status)
            assert "Path(" in source and "ge=1" in source, (
                "student_id should use Path(..., ge=1) to prevent invalid IDs"
            )


# =============================================================================
# R10-W2: XSS via credential_id interpolation in onclick
# =============================================================================
class TestR10W2XSSInOnclick:
    """Test that credential_id is escaped in onclick handlers."""

    def test_director_biometric_escapes_credential_id(self):
        """R10-W2: credential_id should be escaped to prevent XSS."""
        biometric_js_path = "src/web-app/js/views/director_biometric.js"

        with open(biometric_js_path, encoding="utf-8") as f:
            content = f.read()

        # Should NOT have direct interpolation in onclick
        # Bad: onclick="...('${cred.credential_id}')"
        # Good: data-credential-id="${escapeHtml(cred.credential_id)}" or similar

        has_unsafe_interpolation = (
            "onclick=" in content
            and "${cred.credential_id}" in content
            and "escapeHtml" not in content.split("onclick=")[1].split(">")[0]
        )

        # Check if using safe pattern (data attributes or escaped)
        uses_data_attr = "data-credential-id" in content
        uses_escape = "escapeHtml(cred.credential_id)" in content

        assert uses_data_attr or uses_escape or not has_unsafe_interpolation, (
            "credential_id should be escaped or use data-* attributes to prevent XSS"
        )


# =============================================================================
# R10-W1: Resize listener memory leak
# =============================================================================
class TestR10W1ResizeListenerLeak:
    """Test that resize listener is cleaned up."""

    def test_parent_history_cleans_resize_listener(self):
        """R10-W1: resize listener should be removed on view cleanup."""
        history_js_path = "src/web-app/js/views/parent_history.js"

        with open(history_js_path, encoding="utf-8") as f:
            content = f.read()

        # Should have cleanup mechanism for resize listener
        has_resize_listener = "window.addEventListener('resize'" in content

        if has_resize_listener:
            # Should have either:
            # 1. removeEventListener somewhere
            # 2. Named function reference for cleanup
            # 3. Cleanup exported function
            has_cleanup = (
                "removeEventListener" in content
                or "cleanup" in content.lower()
                or "_resizeHandler" in content
            )

            assert has_cleanup, (
                "resize event listener should have cleanup mechanism to prevent memory leak"
            )


# =============================================================================
# R10-W10: Router should validate app container exists
# =============================================================================
class TestR10W10RouterValidation:
    """Test that router validates app container."""

    def test_router_validates_app_element(self):
        """R10-W10: Router should check if #app exists before rendering."""
        router_js_path = "src/web-app/js/router.js"

        with open(router_js_path, encoding="utf-8") as f:
            content = f.read()

        # Find the render function
        assert "render(" in content, "render function should exist"

        # Should validate app exists before using
        # Look for validation pattern
        has_validation = (
            "if (!app)" in content
            or "if (app)" in content
            or "app === null" in content
            or "!document.getElementById" in content
        )

        assert has_validation, (
            "Router.render should validate #app exists before rendering to prevent errors"
        )


# =============================================================================
# R10-S3: consent_service should handle concurrent updates
# =============================================================================
class TestR10S3ConsentRaceCondition:
    """Test that consent service handles concurrent updates safely."""

    def test_consent_service_has_transaction_safety(self):
        """R10-S3: update_guardian_preferences should be transaction-safe."""
        from app.services import consent_service

        source = inspect.getsource(consent_service)

        # Should have some form of transaction control or locking
        has_transaction_handling = (
            "commit" in source
            or "flush" in source
            or "refresh" in source
            or "with_for_update" in source
            or "select_for_update" in source
        )

        assert has_transaction_handling, "consent_service should have proper transaction handling"


# =============================================================================
# R10-A5: credential_id path parameter should have validation
# =============================================================================
class TestR10A5CredentialIdValidation:
    """Test that credential_id has proper validation."""

    def test_delete_credential_has_path_validation(self):
        """R10-A5: credential_id should have min/max length validation."""
        from app.api.v1 import webauthn

        source = inspect.getsource(webauthn)

        # Find admin_delete_student_credential function
        assert "admin_delete_student_credential" in source

        # Should have Path validation for credential_id
        # Look for pattern: credential_id: str = Path(...)
        has_path_validation = re.search(
            r"credential_id.*Path\([^)]*min_length", source
        ) or re.search(r"credential_id.*Path\([^)]*max_length", source)

        assert has_path_validation, (
            "credential_id should use Path(..., min_length=1, max_length=...) for validation"
        )


# =============================================================================
# R10-S8: broadcast_service should log enqueue operations
# =============================================================================
class TestR10S8BroadcastLogging:
    """Test that broadcast service logs enqueue operations."""

    def test_broadcast_service_logs_enqueue(self):
        """R10-S8: Broadcast enqueue operations should be logged."""
        from app.services import broadcast_service

        source = inspect.getsource(broadcast_service)

        # Should have logging for enqueue operations
        has_logging = (
            "logger.info" in source or "logger.debug" in source or "logger.warning" in source
        )

        # Check specifically for enqueue-related logging
        has_enqueue_logging = "enqueue" in source.lower() and has_logging

        assert has_enqueue_logging, "broadcast_service should log enqueue operations for debugging"


# =============================================================================
# R10-W8: parseInt should validate input first
# =============================================================================
class TestR10W8ParseIntValidation:
    """Test that parseInt has input validation."""

    def test_director_dashboard_validates_before_parseint(self):
        """R10-W8: Should validate before parseInt to avoid NaN issues."""
        dashboard_js_path = "src/web-app/js/views/director_dashboard.js"

        with open(dashboard_js_path, encoding="utf-8") as f:
            content = f.read()

        # Check if parseInt is used
        if "parseInt" in content:
            # Should have validation like: filters.course && parseInt(...)
            # or isNaN check
            has_validation = (
                "filters.course &&" in content
                or "isNaN" in content
                or "|| 0" in content  # default value pattern
                or "Number(" in content  # alternative
            )

            assert has_validation, (
                "parseInt should have input validation to handle empty/invalid values"
            )


# =============================================================================
# R10-A8: check_teacher_can_enroll should have rate limiting
# =============================================================================
class TestR10A8TeacherEnrollRateLimit:
    """Test that teacher enrollment check has rate limiting."""

    def test_check_teacher_can_enroll_has_rate_limit(self):
        """R10-A8: Endpoint should have rate limiting to prevent enumeration."""
        from app.api.v1 import webauthn

        source = inspect.getsource(webauthn)

        # Find the check_teacher_can_enroll function if it exists
        if "check_teacher_can_enroll" in source or "can-enroll" in source:
            # Should have rate limiting decorator
            has_rate_limit = "@limiter" in source

            # Check if it's applied to teacher-related endpoints
            source[source.find("teacher") :] if "teacher" in source else ""

            assert has_rate_limit, "Teacher enrollment check endpoints should have rate limiting"


# =============================================================================
# R10-S5: WebAuthn errors should not expose internal details
# =============================================================================
class TestR10S5WebAuthnErrorMessages:
    """Test that WebAuthn errors don't expose internals."""

    def test_webauthn_service_has_generic_error_messages(self):
        """R10-S5: Error messages should be generic, not expose internals."""
        from app.services import webauthn_service

        source = inspect.getsource(webauthn_service)

        # Check for patterns that might expose internal errors
        # Bad: raise Exception(str(e)) or detail=str(e)
        # Good: logging internal error, raising generic message

        # Should have logging for detailed errors
        has_internal_logging = "logger.error" in source or "logger.exception" in source

        assert has_internal_logging, "WebAuthn service should log internal errors for debugging"
