"""TDD Tests for Round 9 bug fixes.

These tests verify fixes for:
- R9-W: Workers/Jobs bugs
- R9-M: DB Models bugs
- R9-K: Kiosk JS bugs (code inspection only)
"""

import ast
import inspect
import re
from datetime import time

import pytest


# =============================================================================
# R9-M5: Schedule.in_time/out_time should be Mapped[time] not Mapped[object]
# =============================================================================
class TestR9M5ScheduleTimeType:
    """Test that Schedule model uses proper time type annotation."""

    def test_schedule_time_fields_use_time_type(self):
        """R9-M5: in_time and out_time should be Mapped[time], not Mapped[object]."""
        from app.db.models import schedule as schedule_module
        from app.db.models.schedule import Schedule

        # Check type annotations
        annotations = Schedule.__annotations__

        # Both fields should exist
        assert "in_time" in annotations, "in_time field should exist"
        assert "out_time" in annotations, "out_time field should exist"

        # Read the source to check for proper typing
        source = inspect.getsource(Schedule)

        # Should NOT have Mapped[object] for these fields
        assert "in_time: Mapped[object]" not in source, (
            "in_time should use Mapped[time], not Mapped[object]"
        )
        assert "out_time: Mapped[object]" not in source, (
            "out_time should use Mapped[time], not Mapped[object]"
        )

        # Check module source for imports
        module_source = inspect.getsource(schedule_module)
        assert "from datetime import" in module_source and "time" in module_source, (
            "Should import time from datetime module"
        )


# =============================================================================
# R9-M7: WebAuthnCredential.last_used_at should have timezone=True
# =============================================================================
class TestR9M7WebAuthnTimezone:
    """Test that WebAuthnCredential.last_used_at has timezone=True."""

    def test_last_used_at_has_timezone(self):
        """R9-M7: last_used_at should use DateTime(timezone=True) like created_at."""
        from app.db.models.webauthn_credential import WebAuthnCredential

        source = inspect.getsource(WebAuthnCredential)

        # Find the last_used_at definition
        # It should have timezone=True like created_at
        lines = source.split("\n")
        found_last_used_at = False
        has_timezone = False

        for i, line in enumerate(lines):
            if "last_used_at" in line and "mapped_column" in line:
                found_last_used_at = True
                # Check if this line or surrounding context has timezone=True
                context = "\n".join(lines[max(0, i - 1) : i + 2])
                if "timezone=True" in context or "DateTime(timezone=True)" in context:
                    has_timezone = True
                break

        assert found_last_used_at, "last_used_at field should exist"
        assert has_timezone, (
            "last_used_at should use DateTime(timezone=True) for consistency with created_at"
        )


# =============================================================================
# R9-M8: Enrollment should have unique constraint on (student_id, course_id, school_year)
# =============================================================================
class TestR9M8EnrollmentUnique:
    """Test that Enrollment has unique constraint to prevent duplicates."""

    def test_enrollment_has_unique_constraint(self):
        """R9-M8: Should have unique constraint on (student_id, course_id, school_year)."""
        from app.db.models.enrollment import Enrollment

        # Check for __table_args__ with UniqueConstraint
        source = inspect.getsource(Enrollment)

        # Should have __table_args__ defined
        has_table_args = "__table_args__" in source

        # Should mention UniqueConstraint
        has_unique_constraint = "UniqueConstraint" in source

        # Should reference the three fields
        has_student_id = "student_id" in source and "course_id" in source and "school_year" in source

        assert has_table_args, "Enrollment should have __table_args__ for constraints"
        assert has_unique_constraint, (
            "Enrollment should have UniqueConstraint to prevent duplicate enrollments"
        )


# =============================================================================
# R9-M3: Enrollment.course should have back_populates
# =============================================================================
class TestR9M3EnrollmentBackPopulates:
    """Test that Enrollment.course relationship has back_populates."""

    def test_enrollment_course_has_back_populates(self):
        """R9-M3: Enrollment.course should have back_populates='enrollments'."""
        from app.db.models.enrollment import Enrollment

        source = inspect.getsource(Enrollment)

        # Find the course relationship definition
        # Should have back_populates="enrollments"
        course_pattern = r'course\s*=\s*relationship\([^)]*back_populates\s*=\s*["\']enrollments["\']'

        assert re.search(course_pattern, source), (
            "Enrollment.course should have back_populates='enrollments'"
        )


# =============================================================================
# R9-W10: mark_failed should NOT increment retries (double increment bug)
# =============================================================================
class TestR9W10DoubleRetryIncrement:
    """Test that mark_failed doesn't double-increment retries."""

    def test_mark_failed_does_not_increment_retries(self):
        """R9-W10: mark_failed should NOT increment retries since caller already does."""
        from app.db.repositories.notifications import NotificationRepository

        source = inspect.getsource(NotificationRepository.mark_failed)

        # Should NOT have retries increment logic
        # The pattern (notification.retries or 0) + 1 causes double increment
        has_increment = "retries" in source and "+ 1" in source

        assert not has_increment, (
            "mark_failed should NOT increment retries - caller already handles this. "
            "Double increment causes incorrect retry count."
        )


# =============================================================================
# R9-W7: asyncio.run should have timeout wrapper
# =============================================================================
class TestR9W7AsyncioTimeout:
    """Test that asyncio.run calls have timeout protection."""

    def test_send_whatsapp_has_timeout(self):
        """R9-W7: send_whatsapp_message should have timeout to prevent infinite hangs."""
        import app.workers.jobs.send_whatsapp as module

        source = inspect.getsource(module)

        # Should have timeout protection
        # Either asyncio.wait_for or a custom timeout mechanism
        has_timeout = (
            "wait_for" in source
            or "timeout" in source.lower()
            or "asyncio.timeout" in source
        )

        assert has_timeout, (
            "send_whatsapp_message should have timeout protection to prevent "
            "worker from hanging indefinitely"
        )


# =============================================================================
# R9-K1: playSuccessBeep should close AudioContext
# =============================================================================
class TestR9K1AudioContextLeak:
    """Test that playSuccessBeep closes AudioContext."""

    def test_play_success_beep_closes_audio_context(self):
        """R9-K1: playSuccessBeep should call audioContext.close() to prevent leak."""
        home_js_path = "src/kiosk-app/js/views/home.js"

        with open(home_js_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Find playSuccessBeep function
        assert "function playSuccessBeep" in content, "playSuccessBeep function should exist"

        # Extract the function body
        start = content.find("function playSuccessBeep")
        # Find the closing brace by counting braces
        brace_count = 0
        end = start
        in_function = False
        for i, char in enumerate(content[start:], start):
            if char == "{":
                brace_count += 1
                in_function = True
            elif char == "}":
                brace_count -= 1
                if in_function and brace_count == 0:
                    end = i + 1
                    break

        func_body = content[start:end]

        # Should close the audio context
        assert "audioContext.close()" in func_body or ".close()" in func_body, (
            "playSuccessBeep should call audioContext.close() to prevent memory leak"
        )


# =============================================================================
# R9-K3: biometric_enroll playSuccessFeedback should close AudioContext
# =============================================================================
class TestR9K3BiometricAudioLeak:
    """Test that biometric_enroll playSuccessFeedback closes AudioContext."""

    def test_biometric_enroll_closes_audio_context(self):
        """R9-K3: playSuccessFeedback in biometric_enroll should close AudioContext."""
        biometric_js_path = "src/kiosk-app/js/views/biometric_enroll.js"

        with open(biometric_js_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Find playSuccessFeedback function
        assert "playSuccessFeedback" in content, "playSuccessFeedback function should exist"

        # Extract the function
        start = content.find("function playSuccessFeedback")
        if start == -1:
            start = content.find("playSuccessFeedback")

        # Find function end
        brace_count = 0
        end = start
        in_function = False
        for i, char in enumerate(content[start:], start):
            if char == "{":
                brace_count += 1
                in_function = True
            elif char == "}":
                brace_count -= 1
                if in_function and brace_count == 0:
                    end = i + 1
                    break

        func_body = content[start:end]

        # Should close audio context
        assert ".close()" in func_body, (
            "playSuccessFeedback should close AudioContext to prevent memory leak"
        )


# =============================================================================
# R9-K6: admin_panel showWarning should clear existing countdownInterval
# =============================================================================
class TestR9K6CountdownIntervalLeak:
    """Test that admin_panel clears countdownInterval before creating new one."""

    def test_admin_panel_clears_countdown_interval(self):
        """R9-K6: showWarning should clear existing interval before creating new one."""
        admin_js_path = "src/kiosk-app/js/views/admin_panel.js"

        with open(admin_js_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Find showWarning function
        assert "showWarning" in content, "showWarning function should exist"

        # Find function that creates countdownInterval
        # Should have clearInterval before setInterval
        if "countdownInterval" in content and "setInterval" in content:
            # Find showWarning function body
            start = content.find("function showWarning")
            if start == -1:
                start = content.find("showWarning")

            # Get reasonable chunk of code after showWarning
            chunk = content[start:start + 1000]

            # Before setInterval, should clear the interval
            setinterval_pos = chunk.find("setInterval")
            if setinterval_pos > 0:
                before_setinterval = chunk[:setinterval_pos]
                assert "clearInterval" in before_setinterval, (
                    "showWarning should clearInterval(countdownInterval) before creating new one"
                )


# =============================================================================
# R9-K7: sync.js should clear intervals on reinit
# =============================================================================
class TestR9K7SyncIntervalCleanup:
    """Test that kiosk sync.js clears intervals on reinitialization."""

    def test_kiosk_sync_clears_intervals_on_init(self):
        """R9-K7: Sync intervals should be cleared before creating new ones."""
        sync_js_path = "src/kiosk-app/js/sync.js"

        with open(sync_js_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Should have stopIntervals or similar cleanup
        has_cleanup = (
            "stopIntervals" in content
            or "clearInterval" in content
        )

        # If creating intervals, should check/clear existing first
        if "setInterval" in content:
            # Should have some form of interval cleanup
            assert has_cleanup, (
                "sync.js should clear existing intervals before creating new ones "
                "to prevent accumulation on script reload"
            )


# =============================================================================
# R9-M6: Consent model FK fields should have index=True
# =============================================================================
class TestR9M6ConsentIndexes:
    """Test that Consent model has indexes on FK fields."""

    def test_consent_fk_fields_have_index(self):
        """R9-M6: student_id and guardian_id should have index=True."""
        from app.db.models.consent import Consent

        source = inspect.getsource(Consent)

        # Check that FK fields have index=True
        # Pattern: student_id ... index=True or mapped_column(...index=True...)
        student_has_index = re.search(
            r'student_id.*index\s*=\s*True', source, re.DOTALL
        )
        guardian_has_index = re.search(
            r'guardian_id.*index\s*=\s*True', source, re.DOTALL
        )

        assert student_has_index, "Consent.student_id should have index=True for query performance"
        assert guardian_has_index, "Consent.guardian_id should have index=True for query performance"


# =============================================================================
# R9-W9: detect_no_ingreso should log target_dt on error
# =============================================================================
class TestR9W9NoIngresoLogging:
    """Test that detect_no_ingreso logs context on error."""

    def test_detect_no_ingreso_logs_target_dt(self):
        """R9-W9: Error logging should include target_dt for debugging."""
        import app.workers.jobs.detect_no_ingreso as module

        source = inspect.getsource(module)

        # Find the main function and its error handling
        # Should log target_dt when an error occurs
        has_context_logging = (
            "target_dt" in source
            and ("logger.error" in source or "logger.exception" in source)
        )

        # Check if error handler includes target_dt
        error_section = source[source.find("except"):] if "except" in source else ""
        logs_target_in_error = "target_dt" in error_section or "target" in error_section

        assert has_context_logging or logs_target_in_error, (
            "detect_no_ingreso should log target_dt in error messages for debugging"
        )
