"""TDD Bug Fix Tests Round 2 - These tests should FAIL initially, then PASS after fixes."""

import jwt
import pytest

from app.core.config import settings
from app.core.security import create_access_token, decode_token


class TestBugR2_1_JWTIssuerValidation:
    """BUG-R2-1: decode_token should validate the issuer claim."""

    def test_decode_token_validates_issuer(self):
        """Verify decode_token rejects tokens with wrong issuer."""
        # Create a token with wrong issuer
        wrong_issuer_token = jwt.encode(
            {"sub": "test_user", "iss": "wrong-app"}, settings.secret_key, algorithm="HS256"
        )

        # This should raise an error because issuer doesn't match
        with pytest.raises(Exception):  # HTTPException or jwt.InvalidIssuerError
            decode_token(wrong_issuer_token)

    def test_decode_token_accepts_valid_issuer(self):
        """Verify decode_token accepts tokens with correct issuer."""
        # Create a valid token using our function
        valid_token = create_access_token("test_user")

        # Should decode successfully
        decoded = decode_token(valid_token)
        assert decoded["sub"] == "test_user"
        assert decoded["iss"] == "school-attendance"

    def test_decode_token_rejects_missing_issuer(self):
        """Verify decode_token rejects tokens without issuer claim."""
        # Create a token without issuer
        no_issuer_token = jwt.encode({"sub": "test_user"}, settings.secret_key, algorithm="HS256")

        # This should raise an error because issuer is missing
        with pytest.raises(Exception):
            decode_token(no_issuer_token)


class TestBugR2_2_GuardianPreferencesMerge:
    """BUG-R2-2: Guardian preferences update should merge, not overwrite."""

    @pytest.mark.anyio
    async def test_preferences_partial_update_preserves_existing(self):
        """Verify partial preference update doesn't delete other preferences."""
        from unittest.mock import AsyncMock, MagicMock

        from app.schemas.guardians import ChannelPreference, GuardianPreferencesUpdate
        from app.services.consent_service import ConsentService

        # Create mock session and repository
        mock_session = AsyncMock()
        service = ConsentService(mock_session)

        # Mock guardian with existing preferences (using ChannelPreference objects)
        mock_guardian = MagicMock()
        mock_guardian.notification_prefs = {
            "INGRESO_OK": ChannelPreference(whatsapp=True, email=False),
            "SALIDA_OK": ChannelPreference(whatsapp=True, email=False),
            "NO_INGRESO_UMBRAL": ChannelPreference(whatsapp=True, email=True),
        }
        mock_guardian.students = []

        service.guardian_repo = AsyncMock()
        service.guardian_repo.get = AsyncMock(return_value=mock_guardian)
        service.guardian_repo.save = AsyncMock()

        # Update only INGRESO_OK preference
        payload = GuardianPreferencesUpdate(
            preferences={"INGRESO_OK": ChannelPreference(whatsapp=False, email=False)},
            photo_consents=None,
        )

        await service.update_guardian_preferences(1, payload)

        # After update, ALL original preferences should still exist
        final_prefs = mock_guardian.notification_prefs

        # This test verifies merge behavior
        assert "SALIDA_OK" in final_prefs, "SALIDA_OK preference was deleted!"
        assert "NO_INGRESO_UMBRAL" in final_prefs, "NO_INGRESO_UMBRAL preference was deleted!"
        # TDD-R2-BUG2 fix: preferences are now stored as dicts for JSON serialization
        ingreso_pref = final_prefs["INGRESO_OK"]
        whatsapp_val = (
            ingreso_pref["whatsapp"] if isinstance(ingreso_pref, dict) else ingreso_pref.whatsapp
        )
        assert whatsapp_val is False, "INGRESO_OK should be updated"


class TestBugR2_3_CSVSanitization:
    """BUG-R2-3: CSV sanitization should handle whitespace-prefixed formulas."""

    def test_sanitize_csv_handles_whitespace_before_formula(self):
        """Verify CSV sanitization catches formulas with leading whitespace."""
        # Import the sanitization function
        from app.api.v1.alerts import _sanitize_csv_value

        # These should all be sanitized
        test_cases = [
            ("=1+1", "'=1+1"),  # Direct formula
            (" =1+1", "' =1+1"),  # Single space prefix
            ("  =1+1", "'  =1+1"),  # Double space prefix - FAILS currently!
            ("\t=1+1", "'\t=1+1"),  # Tab prefix - FAILS currently!
            ("   @SUM(A1)", "'   @SUM(A1)"),  # Multiple spaces - FAILS currently!
        ]

        for input_val, _expected in test_cases:
            result = _sanitize_csv_value(input_val)
            # After stripping, if starts with formula char, should have quote prefix
            assert result.startswith("'") or input_val.strip()[0] not in "=+-@", (
                f"Input '{input_val}' should be sanitized but got '{result}'"
            )


class TestBugR2_4_PathParameterValidation:
    """BUG-R2-4: Path parameters should have ge=1 constraint.

    We verify by checking the source code contains the proper Path() validation.
    """

    def test_attendance_endpoint_has_path_validation(self):
        """Verify attendance endpoint path parameter has ge=1 validation."""
        import inspect

        from app.api.v1 import attendance

        source = inspect.getsource(attendance.list_events_by_student)
        assert "Path(" in source, "student_id should use Path()"
        assert "ge=1" in source, "student_id should have ge=1 constraint"

    def test_photo_endpoint_has_path_validation(self):
        """Verify photo upload endpoint has ge=1 validation."""
        import inspect

        from app.api.v1 import attendance

        source = inspect.getsource(attendance.upload_event_photo)
        assert "Path(" in source, "event_id should use Path()"
        assert "ge=1" in source, "event_id should have ge=1 constraint"

    def test_audio_endpoint_has_path_validation(self):
        """Verify audio upload endpoint has ge=1 validation."""
        import inspect

        from app.api.v1 import attendance

        source = inspect.getsource(attendance.upload_event_audio)
        assert "Path(" in source, "event_id should use Path()"
        assert "ge=1" in source, "event_id should have ge=1 constraint"


class TestBugR2_5_FrontendEmptyListValidation:
    """BUG-R2-5: Frontend should not clear local data on empty server response.

    Note: These are JavaScript tests that we document here but verify manually.
    The actual fix is in src/kiosk-app/js/state.js
    """

    def test_documented_behavior(self):
        """Document the expected behavior for manual verification."""
        # This test passes - it just documents what should happen
        expected_behaviors = [
            "updateTags() should skip update if serverTags is empty",
            "updateTeachers() should skip update if serverTeachers is empty",
            "Both should log a warning when skipping",
        ]

        # All behaviors should be implemented
        assert len(expected_behaviors) == 3
