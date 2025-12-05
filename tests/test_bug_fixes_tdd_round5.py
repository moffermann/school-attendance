"""TDD Bug Fix Tests Round 5 - Validation consistency and type safety."""

import pytest
import inspect


class TestBugR5_1_ParseIntRadixMetrics:
    """BUG-R5-1: director_metrics.js should use parseInt with radix 10."""

    def test_director_metrics_uses_parseint_with_radix(self):
        """Verify director_metrics.js uses parseInt with explicit radix."""
        metrics_path = "src/web-app/js/views/director_metrics.js"

        with open(metrics_path, "r", encoding="utf-8") as f:
            source = f.read()

        # Find all parseInt calls
        import re
        parseint_calls = re.findall(r'parseInt\([^)]+\)', source)

        for call in parseint_calls:
            # Each parseInt should have a second argument (radix)
            assert call.count(',') >= 1, \
                f"parseInt without radix found in director_metrics.js: {call}. Should use parseInt(value, 10)"


class TestBugR5_2_AlertExportStatusValidation:
    """BUG-R5-2: Alert export endpoint should validate status like list endpoint."""

    def test_alert_export_uses_enum_for_status(self):
        """Verify alert export uses AlertStatusFilter enum for status validation."""
        from app.api.v1 import alerts

        source = inspect.getsource(alerts.export_no_entry_alerts)

        # Should use AlertStatusFilter like the list endpoint does
        # Current bug: uses "str | None" instead of "AlertStatusFilter | None"
        has_enum = "AlertStatusFilter" in source

        assert has_enum, \
            "Alert export endpoint should use AlertStatusFilter enum for status_filter parameter"


class TestBugR5_3_MemoryLeakObjectURLExport:
    """BUG-R5-3: CSV export creates blob URLs that should be revoked."""

    def test_director_metrics_revokes_blob_url(self):
        """Verify director_metrics.js revokes blob URL after download."""
        metrics_path = "src/web-app/js/views/director_metrics.js"

        with open(metrics_path, "r", encoding="utf-8") as f:
            source = f.read()

        # If createObjectURL is used, revokeObjectURL should also be present
        if "createObjectURL" in source:
            assert "revokeObjectURL" in source, \
                "director_metrics.js creates blob URLs but never revokes them - memory leak"


class TestBugR5_4_MissingRadixInTeacherPWA:
    """BUG-R5-4: Check for parseInt without radix in teacher PWA."""

    def test_teacher_pwa_uses_parseint_with_radix(self):
        """Verify teacher PWA JS files use parseInt with radix."""
        import os
        import re

        pwa_dir = "src/teacher-pwa"
        if not os.path.exists(pwa_dir):
            pytest.skip("teacher-pwa directory not found")

        issues = []
        for root, dirs, files in os.walk(pwa_dir):
            for file in files:
                if file.endswith('.js'):
                    filepath = os.path.join(root, file)
                    with open(filepath, "r", encoding="utf-8") as f:
                        source = f.read()

                    parseint_calls = re.findall(r'parseInt\([^)]+\)', source)
                    for call in parseint_calls:
                        if call.count(',') == 0:
                            issues.append(f"{filepath}: {call}")

        assert len(issues) == 0, \
            f"parseInt without radix found in teacher-pwa: {issues}"


class TestBugR5_5_NotificationPayloadTypeCheck:
    """BUG-R5-5: Notification export should handle non-dict payloads gracefully."""

    def test_notification_export_handles_payload_types(self):
        """Verify notification export has defensive payload type checking."""
        from app.api.v1 import notifications

        source = inspect.getsource(notifications.export_notifications)

        # Should have isinstance check for dict
        has_isinstance = "isinstance(item.payload, dict)" in source

        # Current code has this check, verify it's there
        assert has_isinstance, \
            "Notification export should check isinstance(item.payload, dict)"
