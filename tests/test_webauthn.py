"""Tests for WebAuthn repository and service."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from app.db.models.webauthn_credential import WebAuthnCredential
from app.db.repositories.webauthn import WebAuthnRepository
from app.services.webauthn_service import WebAuthnService, _challenge_store


# ============================================================================
# WebAuthn Repository Tests
# ============================================================================


@pytest.fixture
async def webauthn_credential(db_session, sample_student):
    """Create a sample WebAuthn credential."""
    credential = WebAuthnCredential(
        credential_id="test_credential_id_base64url",
        student_id=sample_student.id,
        user_id=None,
        user_handle=b"0" * 32,
        public_key=b"fake_public_key_bytes",
        sign_count=0,
        transports="internal",
        device_name="Test Device",
        created_at=datetime.utcnow(),
    )
    db_session.add(credential)
    await db_session.flush()
    return credential


class TestWebAuthnRepository:
    """Tests for WebAuthnRepository CRUD operations."""

    @pytest.mark.asyncio
    async def test_get_by_credential_id(self, db_session, webauthn_credential):
        """Should retrieve credential by ID."""
        repo = WebAuthnRepository(db_session)
        result = await repo.get_by_credential_id(webauthn_credential.credential_id)

        assert result is not None
        assert result.credential_id == webauthn_credential.credential_id
        assert result.student_id == webauthn_credential.student_id

    @pytest.mark.asyncio
    async def test_get_by_credential_id_not_found(self, db_session):
        """Should return None for non-existent credential."""
        repo = WebAuthnRepository(db_session)
        result = await repo.get_by_credential_id("nonexistent_id")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_by_user_handle(self, db_session, webauthn_credential):
        """Should retrieve credential by user handle."""
        repo = WebAuthnRepository(db_session)
        result = await repo.get_by_user_handle(webauthn_credential.user_handle)

        assert result is not None
        assert result.user_handle == webauthn_credential.user_handle

    @pytest.mark.asyncio
    async def test_list_by_student(self, db_session, sample_student, webauthn_credential):
        """Should list all credentials for a student."""
        repo = WebAuthnRepository(db_session)
        results = await repo.list_by_student(sample_student.id)

        assert len(results) == 1
        assert results[0].credential_id == webauthn_credential.credential_id

    @pytest.mark.asyncio
    async def test_list_by_student_empty(self, db_session, sample_student):
        """Should return empty list for student with no credentials."""
        repo = WebAuthnRepository(db_session)
        results = await repo.list_by_student(sample_student.id)

        assert results == []

    @pytest.mark.asyncio
    async def test_get_all_student_credentials(self, db_session, webauthn_credential):
        """Should get all student credentials."""
        repo = WebAuthnRepository(db_session)
        results = await repo.get_all_student_credentials()

        assert len(results) >= 1
        assert any(c.credential_id == webauthn_credential.credential_id for c in results)

    @pytest.mark.asyncio
    async def test_create_credential(self, db_session, sample_student):
        """Should create a new credential."""
        repo = WebAuthnRepository(db_session)

        credential = WebAuthnCredential(
            credential_id="new_credential_id",
            student_id=sample_student.id,
            user_handle=b"1" * 32,
            public_key=b"new_public_key",
            sign_count=0,
        )

        result = await repo.create(credential)

        assert result.credential_id == "new_credential_id"
        assert result.student_id == sample_student.id

    @pytest.mark.asyncio
    async def test_update_sign_count(self, db_session, webauthn_credential):
        """Should update sign count and last_used_at."""
        repo = WebAuthnRepository(db_session)

        await repo.update_sign_count(webauthn_credential.credential_id, 5)
        await db_session.refresh(webauthn_credential)

        assert webauthn_credential.sign_count == 5
        assert webauthn_credential.last_used_at is not None

    @pytest.mark.asyncio
    async def test_delete_credential(self, db_session, webauthn_credential):
        """Should delete a credential."""
        repo = WebAuthnRepository(db_session)
        credential_id = webauthn_credential.credential_id

        result = await repo.delete(credential_id)

        assert result is True
        assert await repo.get_by_credential_id(credential_id) is None

    @pytest.mark.asyncio
    async def test_delete_credential_not_found(self, db_session):
        """Should return False for non-existent credential."""
        repo = WebAuthnRepository(db_session)
        result = await repo.delete("nonexistent_id")

        assert result is False

    @pytest.mark.asyncio
    async def test_exists_for_student(self, db_session, sample_student, webauthn_credential):
        """Should return True if student has credentials."""
        repo = WebAuthnRepository(db_session)
        result = await repo.exists_for_student(sample_student.id)

        assert result is True

    @pytest.mark.asyncio
    async def test_exists_for_student_no_credentials(self, db_session, sample_student):
        """Should return False if student has no credentials."""
        repo = WebAuthnRepository(db_session)
        result = await repo.exists_for_student(sample_student.id)

        assert result is False

    @pytest.mark.asyncio
    async def test_delete_all_for_student(self, db_session, sample_student, webauthn_credential):
        """Should delete all credentials for a student."""
        repo = WebAuthnRepository(db_session)

        count = await repo.delete_all_for_student(sample_student.id)

        assert count == 1
        assert await repo.exists_for_student(sample_student.id) is False


# ============================================================================
# WebAuthn Service Tests
# ============================================================================


class TestWebAuthnService:
    """Tests for WebAuthnService business logic."""

    @pytest.fixture
    def mock_session(self):
        """Create a mock database session."""
        session = MagicMock()
        session.commit = AsyncMock()
        return session

    @pytest.fixture
    def webauthn_service(self, mock_session):
        """Create WebAuthnService with mocked dependencies."""
        service = WebAuthnService(mock_session)
        service.credential_repo = MagicMock()
        service.student_repo = MagicMock()
        service.user_repo = MagicMock()
        return service

    @pytest.mark.asyncio
    async def test_start_student_registration_student_not_found(self, webauthn_service):
        """Should raise 404 if student not found."""
        webauthn_service.student_repo.get = AsyncMock(return_value=None)

        with pytest.raises(HTTPException) as exc_info:
            await webauthn_service.start_student_registration(999)

        assert exc_info.value.status_code == 404
        assert "Estudiante no encontrado" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_start_student_registration_success(self, webauthn_service):
        """Should generate registration options for student."""
        mock_student = MagicMock()
        mock_student.id = 1
        mock_student.full_name = "Test Student"

        webauthn_service.student_repo.get = AsyncMock(return_value=mock_student)
        webauthn_service.credential_repo.list_by_student = AsyncMock(return_value=[])

        with patch("app.services.webauthn_service.settings") as mock_settings:
            mock_settings.webauthn_rp_id = "localhost"
            mock_settings.webauthn_rp_name = "Test App"
            mock_settings.webauthn_timeout_ms = 60000

            result = await webauthn_service.start_student_registration(1, "Test Device")

        assert "challenge_id" in result
        assert "options" in result
        # Verify challenge was stored
        assert result["challenge_id"] in _challenge_store

        # Cleanup
        del _challenge_store[result["challenge_id"]]

    @pytest.mark.asyncio
    async def test_complete_student_registration_invalid_challenge(self, webauthn_service):
        """Should raise 400 for invalid challenge."""
        with pytest.raises(HTTPException) as exc_info:
            await webauthn_service.complete_student_registration(
                "invalid_challenge_id",
                {"id": "test", "response": {}}
            )

        assert exc_info.value.status_code == 400
        assert "Challenge inválido" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_start_student_authentication(self, webauthn_service):
        """Should generate authentication options."""
        webauthn_service.credential_repo.get_all_student_credentials = AsyncMock(return_value=[])

        with patch("app.services.webauthn_service.settings") as mock_settings:
            mock_settings.webauthn_rp_id = "localhost"
            mock_settings.webauthn_timeout_ms = 60000

            result = await webauthn_service.start_student_authentication()

        assert "challenge_id" in result
        assert "options" in result

        # Cleanup
        del _challenge_store[result["challenge_id"]]

    @pytest.mark.asyncio
    async def test_verify_student_authentication_invalid_challenge(self, webauthn_service):
        """Should raise 400 for invalid challenge."""
        with pytest.raises(HTTPException) as exc_info:
            await webauthn_service.verify_student_authentication(
                "invalid_challenge_id",
                {"id": "test", "response": {}}
            )

        assert exc_info.value.status_code == 400
        assert "Challenge inválido" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_verify_student_authentication_credential_not_found(self, webauthn_service):
        """Should raise 401 for unrecognized credential."""
        # Setup valid challenge
        challenge_id = "test_challenge"
        _challenge_store[challenge_id] = {
            "challenge": b"test_challenge_bytes",
            "entity_type": "student_auth",
            "expires": datetime.now(timezone.utc).replace(year=2099),
        }

        webauthn_service.credential_repo.get_by_credential_id = AsyncMock(return_value=None)

        with pytest.raises(HTTPException) as exc_info:
            await webauthn_service.verify_student_authentication(
                challenge_id,
                {"id": "unknown_credential", "response": {}}
            )

        assert exc_info.value.status_code == 401
        assert "Credencial no reconocida" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_list_student_credentials(self, webauthn_service):
        """Should list credentials for student."""
        mock_cred = MagicMock()
        mock_cred.credential_id = "cred123"
        mock_cred.device_name = "Test Device"
        mock_cred.created_at = datetime.utcnow()
        mock_cred.last_used_at = None

        webauthn_service.credential_repo.list_by_student = AsyncMock(return_value=[mock_cred])

        result = await webauthn_service.list_student_credentials(1)

        assert len(result) == 1
        assert result[0]["credential_id"] == "cred123"
        assert result[0]["device_name"] == "Test Device"

    @pytest.mark.asyncio
    async def test_delete_credential_success(self, webauthn_service):
        """Should delete a credential."""
        mock_cred = MagicMock()
        mock_cred.user_id = None

        webauthn_service.credential_repo.get_by_credential_id = AsyncMock(return_value=mock_cred)
        webauthn_service.credential_repo.delete = AsyncMock()

        result = await webauthn_service.delete_credential("cred123")

        assert result is True
        webauthn_service.credential_repo.delete.assert_called_once_with("cred123")

    @pytest.mark.asyncio
    async def test_delete_credential_forbidden(self, webauthn_service):
        """Should raise 403 when deleting another user's credential."""
        mock_cred = MagicMock()
        mock_cred.user_id = 999  # Different user

        webauthn_service.credential_repo.get_by_credential_id = AsyncMock(return_value=mock_cred)

        with pytest.raises(HTTPException) as exc_info:
            await webauthn_service.delete_credential("cred123", user_id=1)

        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_credential_not_found(self, webauthn_service):
        """Should return False for non-existent credential."""
        webauthn_service.credential_repo.get_by_credential_id = AsyncMock(return_value=None)

        result = await webauthn_service.delete_credential("nonexistent")

        assert result is False

    @pytest.mark.asyncio
    async def test_has_biometric(self, webauthn_service):
        """Should check if student has biometric credentials."""
        webauthn_service.credential_repo.exists_for_student = AsyncMock(return_value=True)

        result = await webauthn_service.has_biometric(1)

        assert result is True
        webauthn_service.credential_repo.exists_for_student.assert_called_once_with(1)

    @pytest.mark.asyncio
    async def test_has_passkey(self, webauthn_service):
        """Should check if user has passkey credentials."""
        webauthn_service.credential_repo.exists_for_user = AsyncMock(return_value=False)

        result = await webauthn_service.has_passkey(1)

        assert result is False
        webauthn_service.credential_repo.exists_for_user.assert_called_once_with(1)

    def test_parse_transports(self, webauthn_service):
        """Should parse transport strings correctly."""
        from webauthn.helpers.structs import AuthenticatorTransport

        result = webauthn_service._parse_transports("internal,usb")

        assert AuthenticatorTransport.INTERNAL in result
        assert AuthenticatorTransport.USB in result
        assert len(result) == 2

    def test_parse_transports_empty(self, webauthn_service):
        """Should return empty list for None transports."""
        result = webauthn_service._parse_transports(None)

        assert result == []

    def test_parse_transports_invalid(self, webauthn_service):
        """Should skip invalid transports."""
        result = webauthn_service._parse_transports("internal,invalid,usb")

        assert len(result) == 2


# ============================================================================
# WebAuthn User Registration Tests
# ============================================================================


class TestWebAuthnUserService:
    """Tests for WebAuthnService user passkey operations."""

    @pytest.fixture
    def mock_session(self):
        """Create a mock database session."""
        session = MagicMock()
        session.commit = AsyncMock()
        return session

    @pytest.fixture
    def webauthn_service(self, mock_session):
        """Create WebAuthnService with mocked dependencies."""
        service = WebAuthnService(mock_session)
        service.credential_repo = MagicMock()
        service.student_repo = MagicMock()
        service.user_repo = MagicMock()
        return service

    @pytest.mark.asyncio
    async def test_start_user_registration_user_not_found(self, webauthn_service):
        """Should raise 404 if user not found."""
        webauthn_service.user_repo.get = AsyncMock(return_value=None)

        with pytest.raises(HTTPException) as exc_info:
            await webauthn_service.start_user_registration(999)

        assert exc_info.value.status_code == 404
        assert "Usuario no encontrado" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_start_user_registration_success(self, webauthn_service):
        """Should generate registration options for user."""
        mock_user = MagicMock()
        mock_user.id = 1
        mock_user.email = "test@example.com"
        mock_user.full_name = "Test User"

        webauthn_service.user_repo.get = AsyncMock(return_value=mock_user)
        webauthn_service.credential_repo.list_by_user = AsyncMock(return_value=[])

        with patch("app.services.webauthn_service.settings") as mock_settings:
            mock_settings.webauthn_rp_id = "localhost"
            mock_settings.webauthn_rp_name = "Test App"
            mock_settings.webauthn_timeout_ms = 60000

            result = await webauthn_service.start_user_registration(1, "My Phone")

        assert "challenge_id" in result
        assert "options" in result

        # Cleanup
        del _challenge_store[result["challenge_id"]]

    @pytest.mark.asyncio
    async def test_complete_user_registration_invalid_challenge(self, webauthn_service):
        """Should raise 400 for invalid challenge."""
        with pytest.raises(HTTPException) as exc_info:
            await webauthn_service.complete_user_registration(
                "invalid_challenge_id",
                {"id": "test", "response": {}}
            )

        assert exc_info.value.status_code == 400
        assert "Challenge inválido" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_list_user_credentials(self, webauthn_service):
        """Should list credentials for user."""
        mock_cred = MagicMock()
        mock_cred.credential_id = "user_cred123"
        mock_cred.device_name = "iPhone"
        mock_cred.created_at = datetime.utcnow()
        mock_cred.last_used_at = datetime.utcnow()

        webauthn_service.credential_repo.list_by_user = AsyncMock(return_value=[mock_cred])

        result = await webauthn_service.list_user_credentials(1)

        assert len(result) == 1
        assert result[0]["credential_id"] == "user_cred123"
        assert result[0]["device_name"] == "iPhone"
        assert result[0]["last_used_at"] is not None
