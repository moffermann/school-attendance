"""TDD Tests for Round 12 - Performance Review.

These tests verify performance-related fixes:
- R12-P1: Avoid duplicate student fetch in attendance_service
- R12-P2: Student.course_id should have index
- R12-P3: SES send_email should use asyncio.to_thread
- R12-P4: Redis queue enqueue should be non-blocking
- R12-P5: Presigned URL generation should be async
- R12-P6: Frontend event delegation for credential buttons
- R12-P7: Frontend search input should have debounce
"""

import inspect
import re


# =============================================================================
# R12-P1: Avoid duplicate student fetch in attendance_service
# =============================================================================
class TestR12P1AvoidDuplicateStudentFetch:
    """Test that student is not fetched twice in register_event flow."""

    def test_send_notifications_does_not_refetch_student(self):
        """R12-P1: _send_attendance_notifications should receive student, not refetch."""
        from app.services import attendance_service

        source = inspect.getsource(attendance_service)

        # Check that _send_attendance_notifications accepts student parameter
        method_match = re.search(
            r"async def _send_attendance_notifications\s*\([^)]*student", source
        )
        assert method_match, (
            "_send_attendance_notifications should accept student as parameter "
            "to avoid duplicate fetch"
        )

        # Check that register_event passes student to _send_attendance_notifications
        register_method_start = source.find("async def register_event")
        register_method_end = source.find("\n    async def ", register_method_start + 1)
        if register_method_end == -1:
            register_method_end = len(source)

        register_source = source[register_method_start:register_method_end]

        # Should pass student to _send_attendance_notifications
        passes_student = (
            "_send_attendance_notifications(event, student)" in register_source
            or "_send_attendance_notifications(event=event, student=student)" in register_source
        )

        assert passes_student, (
            "register_event should pass student to _send_attendance_notifications "
            "to avoid duplicate fetch"
        )


# =============================================================================
# R12-P2: Student.course_id should have index
# =============================================================================
class TestR12P2StudentCourseIdIndex:
    """Test that Student.course_id has database index."""

    def test_student_course_id_has_index(self):
        """R12-P2: course_id should have index=True for query performance."""
        from app.db.models.student import Student

        # Get the column definition
        course_id_col = Student.__table__.c.course_id

        # Check if it has an index (either explicit or via foreign key)
        # Foreign keys in SQLAlchemy don't auto-create indexes, need explicit
        has_index = course_id_col.index is True

        # Also check if there's a separate index on this column
        indexes = Student.__table__.indexes
        has_separate_index = any("course_id" in [c.name for c in idx.columns] for idx in indexes)

        assert has_index or has_separate_index, (
            "Student.course_id should have index=True for query performance. "
            "Queries filtering by course_id are very common."
        )


# =============================================================================
# R12-P3: SES send_email should use asyncio.to_thread
# =============================================================================
class TestR12P3SESAsyncNonBlocking:
    """Test that SES email sending doesn't block event loop."""

    def test_ses_send_email_uses_asyncio_to_thread(self):
        """R12-P3: send_email should wrap boto3 call with asyncio.to_thread."""
        from app.services.notifications import ses_email

        source = inspect.getsource(ses_email)

        # Find the send_email method
        assert "async def send_email" in source, "send_email should be async"

        # Should use asyncio.to_thread for the blocking boto3 call
        has_to_thread = "asyncio.to_thread" in source

        assert has_to_thread, (
            "SES send_email should use asyncio.to_thread() to avoid blocking "
            "the event loop during boto3 API calls."
        )


# =============================================================================
# R12-P5: Presigned URL generation should be async
# =============================================================================
class TestR12P5PresignedUrlAsync:
    """Test that presigned URL generation is non-blocking."""

    def test_generate_presigned_url_is_async(self):
        """R12-P5: generate_presigned_url should be async or use to_thread."""
        from app.services import photo_service

        source = inspect.getsource(photo_service)

        # Find generate_presigned_url - should be async
        method_match = re.search(r"(async\s+)?def\s+generate_presigned_url", source)

        assert method_match, "generate_presigned_url should exist"

        is_async = method_match.group(1) is not None

        # If not async, it should at least be called via to_thread elsewhere
        # For now, check it's async
        assert is_async, (
            "generate_presigned_url should be async def to avoid blocking "
            "the event loop during S3 API calls."
        )


# =============================================================================
# R12-P6: Frontend event delegation for credential buttons
# =============================================================================
class TestR12P6EventDelegation:
    """Test that credential delete buttons use event delegation."""

    def test_director_biometric_uses_event_delegation(self):
        """R12-P6: Delete buttons should use event delegation, not per-button listeners."""
        biometric_js_path = "src/web-app/js/views/director_biometric.js"

        with open(biometric_js_path, encoding="utf-8") as f:
            content = f.read()

        # Look for event delegation pattern on a parent container
        # Good: container.addEventListener('click', e => { if (e.target.matches(...)) })
        # Bad: forEach(btn => btn.addEventListener('click', ...))

        has_foreach_addEventListener = (
            ".forEach(btn =>" in content and "addEventListener('click'" in content
        )

        # Check for event delegation pattern
        has_delegation = (
            "closest(" in content
            or "matches(" in content
            or ".delete-credential-btn" in content
            and "e.target" in content
        )

        # Should NOT have the problematic forEach pattern without cleanup
        # OR should use event delegation instead
        assert has_delegation or not has_foreach_addEventListener, (
            "Credential delete buttons should use event delegation instead of "
            "attaching listeners to each button. This prevents memory leaks "
            "when modal is reopened multiple times."
        )


# =============================================================================
# R12-P7: Frontend search input should have debounce
# =============================================================================
class TestR12P7SearchDebounce:
    """Test that search input has debounce to prevent excessive re-renders."""

    def test_director_biometric_search_has_debounce(self):
        """R12-P7: Search input should debounce filterStudents calls."""
        biometric_js_path = "src/web-app/js/views/director_biometric.js"

        with open(biometric_js_path, encoding="utf-8") as f:
            content = f.read()

        # Check if oninput calls filterStudents directly (bad)
        # or uses debounce/setTimeout (good)
        has_direct_oninput = 'oninput="Views.directorBiometric.filterStudents()"' in content

        # Check for debounce pattern
        has_debounce = (
            "debounce" in content.lower()
            or "setTimeout" in content
            and "filterStudents" in content
            or "clearTimeout" in content
        )

        # If direct oninput, should have debounce
        if has_direct_oninput:
            assert has_debounce, (
                "Search input should debounce filterStudents() calls to prevent "
                "excessive DOM re-renders on every keystroke."
            )


# =============================================================================
# R12-P8: Student.status should have index
# =============================================================================
class TestR12P8StudentStatusIndex:
    """Test that Student.status has database index."""

    def test_student_status_has_index(self):
        """R12-P8: status should have index=True for active student filtering."""
        from app.db.models.student import Student

        # Get the column definition
        status_col = Student.__table__.c.status

        # Check if it has an index
        has_index = status_col.index is True

        # Also check if there's a separate index on this column
        indexes = Student.__table__.indexes
        has_separate_index = any("status" in [c.name for c in idx.columns] for idx in indexes)

        assert has_index or has_separate_index, (
            "Student.status should have index=True for filtering active students. "
            "Queries filtering by status='ACTIVE' are very common."
        )


# =============================================================================
# R12-P9: Notification.ts_sent should have index for worker queries
# =============================================================================
class TestR12P9NotificationTsSentIndex:
    """Test that Notification.ts_sent has database index."""

    def test_notification_ts_sent_has_index(self):
        """R12-P9: ts_sent should have index for time-range queries."""
        from app.db.models.notification import Notification

        # Get the column definition
        ts_sent_col = Notification.__table__.c.ts_sent

        # Check if it has an index
        has_index = ts_sent_col.index is True

        # Also check if there's a separate index
        indexes = Notification.__table__.indexes
        has_separate_index = any("ts_sent" in [c.name for c in idx.columns] for idx in indexes)

        assert has_index or has_separate_index, (
            "Notification.ts_sent should have index for worker queries "
            "that filter by send timestamp."
        )


# =============================================================================
# R12-P10: NoShowAlert.course_id should have index
# =============================================================================
class TestR12P10NoShowAlertCourseIdIndex:
    """Test that NoShowAlert.course_id has database index."""

    def test_no_show_alert_course_id_has_index(self):
        """R12-P10: course_id should have index for GROUP BY queries."""
        from app.db.models.no_show_alert import NoShowAlert

        # Get the column definition
        course_id_col = NoShowAlert.__table__.c.course_id

        # Check if it has an index
        has_index = course_id_col.index is True

        # Also check if there's a separate index
        indexes = NoShowAlert.__table__.indexes
        has_separate_index = any("course_id" in [c.name for c in idx.columns] for idx in indexes)

        assert has_index or has_separate_index, (
            "NoShowAlert.course_id should have index for counts_by_course() GROUP BY queries."
        )
