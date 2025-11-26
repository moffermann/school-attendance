"""Tests for AuthService."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.services.auth_service import AuthService


@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock()


@pytest.fixture
def auth_service(mock_session):
    """Create AuthService with mocked dependencies."""
    return AuthService(mock_session)


class TestAuthService:
    """Tests for AuthService authentication methods."""

    @pytest.mark.asyncio
    async def test_authenticate_success(self, auth_service):
        """Should authenticate user and return tokens."""
        fake_user = SimpleNamespace(
            id=1,
            email="test@example.com",
            hashed_password="hashed",
            role="ADMIN",
            guardian_id=None,
            teacher_id=None,
            is_active=True,
        )

        auth_service.user_repo.get_by_email = AsyncMock(return_value=fake_user)

        with patch("app.services.auth_service.verify_password", return_value=True):
            with patch("app.services.auth_service.create_access_token", return_value="access_token"):
                with patch("app.services.auth_service.create_refresh_token", return_value="refresh_token"):
                    result = await auth_service.authenticate("test@example.com", "password123")

        assert result.access_token == "access_token"
        assert result.refresh_token == "refresh_token"

    @pytest.mark.asyncio
    async def test_authenticate_user_not_found(self, auth_service):
        """Should raise 401 when user not found."""
        auth_service.user_repo.get_by_email = AsyncMock(return_value=None)

        with pytest.raises(HTTPException) as exc_info:
            await auth_service.authenticate("nonexistent@example.com", "password")

        assert exc_info.value.status_code == 401
        assert "Credenciales inválidas" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_authenticate_wrong_password(self, auth_service):
        """Should raise 401 when password is wrong."""
        fake_user = SimpleNamespace(
            id=1,
            email="test@example.com",
            hashed_password="hashed",
            role="ADMIN",
            guardian_id=None,
            is_active=True,
        )

        auth_service.user_repo.get_by_email = AsyncMock(return_value=fake_user)

        with patch("app.services.auth_service.verify_password", return_value=False):
            with pytest.raises(HTTPException) as exc_info:
                await auth_service.authenticate("test@example.com", "wrong_password")

        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_authenticate_inactive_user(self, auth_service):
        """Should raise 401 when user is inactive."""
        fake_user = SimpleNamespace(
            id=1,
            email="test@example.com",
            hashed_password="hashed",
            role="ADMIN",
            guardian_id=None,
            is_active=False,  # Inactive
        )

        auth_service.user_repo.get_by_email = AsyncMock(return_value=fake_user)

        with patch("app.services.auth_service.verify_password", return_value=True):
            with pytest.raises(HTTPException) as exc_info:
                await auth_service.authenticate("test@example.com", "password")

        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_authenticate_user_method(self, auth_service):
        """Should return user object via authenticate_user."""
        fake_user = SimpleNamespace(
            id=1,
            email="test@example.com",
            hashed_password="hashed",
            role="ADMIN",
            guardian_id=None,
            is_active=True,
        )

        auth_service.user_repo.get_by_email = AsyncMock(return_value=fake_user)

        with patch("app.services.auth_service.verify_password", return_value=True):
            result = await auth_service.authenticate_user("test@example.com", "password")

        assert result.id == 1
        assert result.email == "test@example.com"

    @pytest.mark.asyncio
    async def test_refresh_token_success(self, auth_service):
        """Should refresh tokens successfully."""
        fake_user = SimpleNamespace(
            id=1,
            role="ADMIN",
            guardian_id=None,
            is_active=True,
        )

        auth_service.user_repo.get = AsyncMock(return_value=fake_user)

        with patch("app.core.security.decode_token", return_value={"sub": "1"}):
            with patch("app.services.auth_service.create_access_token", return_value="new_access"):
                with patch("app.services.auth_service.create_refresh_token", return_value="new_refresh"):
                    result = await auth_service.refresh("old_refresh_token")

        assert result.access_token == "new_access"
        assert result.refresh_token == "new_refresh"

    @pytest.mark.asyncio
    async def test_refresh_token_invalid(self, auth_service):
        """Should raise 401 when refresh token is invalid."""
        with patch("app.core.security.decode_token", return_value={}):
            with pytest.raises(HTTPException) as exc_info:
                await auth_service.refresh("invalid_token")

        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_token_user_not_found(self, auth_service):
        """Should raise 401 when user from token not found."""
        auth_service.user_repo.get = AsyncMock(return_value=None)

        with patch("app.core.security.decode_token", return_value={"sub": "999"}):
            with pytest.raises(HTTPException) as exc_info:
                await auth_service.refresh("token_for_deleted_user")

        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_token_inactive_user(self, auth_service):
        """Should raise 401 when user is inactive."""
        fake_user = SimpleNamespace(
            id=1,
            role="ADMIN",
            guardian_id=None,
            is_active=False,  # Inactive
        )

        auth_service.user_repo.get = AsyncMock(return_value=fake_user)

        with patch("app.core.security.decode_token", return_value={"sub": "1"}):
            with pytest.raises(HTTPException) as exc_info:
                await auth_service.refresh("token_for_inactive_user")

        assert exc_info.value.status_code == 401
