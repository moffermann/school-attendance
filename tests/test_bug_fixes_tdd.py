"""TDD Bug Fix Tests - These tests should FAIL initially, then PASS after fixes."""

import asyncio

import jwt
import pytest

from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token


class TestBug1RefreshTokenIssuer:
    """BUG-1: Refresh tokens should include 'iss' claim to prevent token confusion attacks."""

    def test_refresh_token_has_issuer_claim(self):
        """Verify refresh token includes issuer claim like access token does."""
        refresh_token = create_refresh_token("test_user")
        decoded = jwt.decode(refresh_token, settings.secret_key, algorithms=["HS256"])

        # This should fail initially because refresh token doesn't have 'iss' claim
        assert "iss" in decoded, "Refresh token must include 'iss' claim"
        assert decoded["iss"] == "school-attendance", "Issuer must be 'school-attendance'"

    def test_access_token_has_issuer_claim(self):
        """Verify access token has issuer claim (already implemented, baseline test)."""
        access_token = create_access_token("test_user")
        decoded = jwt.decode(access_token, settings.secret_key, algorithms=["HS256"])

        assert "iss" in decoded
        assert decoded["iss"] == "school-attendance"

    def test_both_tokens_have_consistent_issuer(self):
        """Both token types should have the same issuer for consistency."""
        access_token = create_access_token("test_user")
        refresh_token = create_refresh_token("test_user")

        access_decoded = jwt.decode(access_token, settings.secret_key, algorithms=["HS256"])
        refresh_decoded = jwt.decode(refresh_token, settings.secret_key, algorithms=["HS256"])

        # This should fail initially
        assert access_decoded.get("iss") == refresh_decoded.get("iss"), (
            "Access and refresh tokens must have same issuer"
        )


class TestBug2ErrorMessageLeak:
    """BUG-2: API should not leak internal error details to clients."""

    @pytest.mark.anyio
    async def test_attendance_error_message_is_generic(self):
        """Verify attendance endpoint returns generic error message, not exception details."""
        from fastapi.testclient import TestClient

        from app.main import app

        client = TestClient(app)

        # Send invalid data to trigger ValueError
        response = client.post(
            "/api/v1/attendance/events",
            json={
                "student_id": -999999,  # Invalid student
                "device_id": "TEST",
                "gate_id": "GATE-1",
                "type": "IN",
                "occurred_at": "2024-01-01T08:00:00",
            },
            headers={"X-Device-Key": settings.device_api_key},
        )

        # Should return 400 or 404, but NOT leak internal error details
        if response.status_code in (400, 404):
            detail = response.json().get("detail", "")

            # Error message should NOT contain Python exception details

            # The message should be user-friendly, not a raw exception string
            assert not any(pattern in detail for pattern in ["ValueError", "Traceback"]), (
                f"Error message should not leak exception details: {detail}"
            )


class TestBug3AsyncWorkerEventLoop:
    """BUG-3: Worker should handle existing event loops gracefully."""

    def test_send_whatsapp_handles_existing_event_loop(self):
        """Verify WhatsApp worker handles case when event loop is already running."""
        from unittest.mock import AsyncMock, patch

        from app.workers.jobs.send_whatsapp import send_whatsapp_message

        # Create and set a running event loop (simulating async context)
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        # Mock the async _send function to avoid actual API calls
        with patch("app.workers.jobs.send_whatsapp._send", new_callable=AsyncMock) as mock_send:
            mock_send.return_value = None

            # This should NOT raise RuntimeError even if loop exists
            # The current implementation will fail with:
            # RuntimeError: asyncio.run() cannot be called from a running event loop
            try:
                # Run in a way that simulates being called from async context
                async def test_in_async_context():
                    # Call the sync function from within async context
                    # This simulates RQ worker running in async mode
                    send_whatsapp_message(
                        notification_id=1,
                        to="+56912345678",
                        template="INGRESO_OK",
                        variables={"student_name": "Test", "date": "01/01/2024", "time": "08:00"},
                    )

                # Run the test
                loop.run_until_complete(test_in_async_context())

            except RuntimeError as e:
                if "cannot be called from a running event loop" in str(e):
                    pytest.fail(
                        f"Worker should handle existing event loop gracefully, but raised: {e}"
                    )
                raise
            finally:
                loop.close()
                asyncio.set_event_loop(None)

    def test_send_whatsapp_works_without_event_loop(self):
        """Verify WhatsApp worker works normally when no event loop exists."""
        from unittest.mock import AsyncMock, patch

        from app.workers.jobs.send_whatsapp import send_whatsapp_message

        # Ensure no event loop is running
        try:
            asyncio.get_running_loop()
            pytest.skip("Event loop is running, skip this test")
        except RuntimeError:
            pass  # No running loop, good

        # Mock the async _send function
        with patch("app.workers.jobs.send_whatsapp._send", new_callable=AsyncMock) as mock_send:
            mock_send.return_value = None

            # This should work without issues
            send_whatsapp_message(
                notification_id=1,
                to="+56912345678",
                template="INGRESO_OK",
                variables={"student_name": "Test", "date": "01/01/2024", "time": "08:00"},
            )

            mock_send.assert_called_once()
