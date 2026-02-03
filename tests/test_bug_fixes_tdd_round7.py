"""TDD Bug Fix Tests Round 7 - Memory Leaks and Backend Structure Validation."""


class TestBugR7_1_BlobURLMemoryLeak:
    """BUG-R7-1: director_notifications.js should revoke blob URL after CSV export."""

    def test_notifications_export_revokes_blob_url(self):
        """Verify director_notifications.js revokes blob URL after download."""
        notifications_path = "src/web-app/js/views/director_notifications.js"

        with open(notifications_path, encoding="utf-8") as f:
            source = f.read()

        # If createObjectURL is used, revokeObjectURL should also be present
        if "createObjectURL" in source:
            assert "revokeObjectURL" in source, (
                "director_notifications.js creates blob URLs but never revokes them - memory leak"
            )


class TestBugR7_2_NullReferenceAbsences:
    """BUG-R7-2: director_absences.js should validate student exists before accessing properties."""

    def test_absences_validates_student_before_access(self):
        """Verify director_absences.js checks student exists before accessing course_id."""
        absences_path = "src/web-app/js/views/director_absences.js"

        with open(absences_path, encoding="utf-8") as f:
            source = f.read()

        # Should use optional chaining or explicit null check
        # Bad: student.course_id without checking student exists
        # Good: student?.course_id or (student && student.course_id) or check before
        has_optional_chaining = "student?.course_id" in source or "student?.full_name" in source
        has_null_check = "if (student)" in source or "if (!student)" in source
        has_ternary_check = "student ? " in source

        assert has_optional_chaining or has_null_check or has_ternary_check, (
            "director_absences.js should validate student exists before accessing student.course_id"
        )


class TestBugR7_3_IntervalMemoryLeak:
    """BUG-R7-3: home.js should clear countdownInterval on cleanup."""

    def test_home_clears_countdown_interval(self):
        """Verify home.js clears countdownInterval in hashchange cleanup."""
        home_path = "src/kiosk-app/js/views/home.js"

        with open(home_path, encoding="utf-8") as f:
            source = f.read()

        # The countdownInterval is created in startAutoResumeCountdown
        # It should be cleared in the hashchange cleanup handler
        # Currently only autoResumeTimeout is cleared, not countdownInterval

        # Check if countdownInterval is stored in a scope where it can be cleared
        has_interval_stored = "countdownInterval = setInterval" in source

        if has_interval_stored:
            # Should have clearInterval(countdownInterval) in cleanup
            has_interval_clear = "clearInterval(countdownInterval)" in source
            assert has_interval_clear, (
                "home.js creates countdownInterval but doesn't clear it in cleanup - memory leak"
            )


class TestBugR7_4_ArrayValidation:
    """BUG-R7-4: teacher-pwa state.js should validate roster.student_ids is array."""

    def test_state_validates_roster_student_ids(self):
        """Verify state.js validates roster.student_ids before using includes()."""
        state_path = "src/teacher-pwa/js/state.js"

        with open(state_path, encoding="utf-8") as f:
            source = f.read()

        # Find the getStudentsByCourse function
        # Should validate roster.student_ids exists and is array before using .includes()
        has_student_ids_check = (
            "roster?.student_ids" in source
            or "roster.student_ids &&" in source
            or "Array.isArray(roster.student_ids)" in source
        )

        assert has_student_ids_check, (
            "state.js should validate roster.student_ids exists before using .includes()"
        )


class TestBugR7_5_EventListenerCleanup:
    """BUG-R7-5: nfc-enrollment.js should remove event listeners after reading."""

    def test_nfc_enrollment_removes_event_listeners(self):
        """Verify nfc-enrollment.js removes event listeners in readTag cleanup."""
        nfc_path = "src/web-app/js/nfc-enrollment.js"

        with open(nfc_path, encoding="utf-8") as f:
            source = f.read()

        # If addEventListener is used, removeEventListener should be in cleanup
        if "addEventListener('reading'" in source:
            assert "removeEventListener" in source, (
                "nfc-enrollment.js adds event listeners but never removes them - memory leak"
            )
