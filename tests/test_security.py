"""Tests for security utilities."""

from __future__ import annotations

import pytest

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_session,
    decode_token,
    encode_session,
    hash_password,
    verify_password,
)


class TestJWTTokens:
    """Tests for JWT token functions."""

    def test_create_access_token(self):
        """Should create valid access token."""
        token = create_access_token("123")
        assert token is not None
        assert isinstance(token, str)

    def test_create_access_token_with_custom_expiry(self):
        """Should create access token with custom expiry."""
        token = create_access_token("123", expires_minutes=60)
        assert token is not None

    def test_create_access_token_with_extra_claims(self):
        """Should create access token with extra claims."""
        token = create_access_token("123", role="ADMIN", guardian_id=10)
        decoded = decode_token(token)
        assert decoded["sub"] == "123"
        assert decoded["role"] == "ADMIN"
        assert decoded["guardian_id"] == 10

    def test_create_refresh_token(self):
        """Should create valid refresh token."""
        token = create_refresh_token("123")
        assert token is not None
        assert isinstance(token, str)

    def test_create_refresh_token_with_custom_expiry(self):
        """Should create refresh token with custom expiry."""
        token = create_refresh_token("123", expires_days=30)
        assert token is not None

    def test_decode_token_success(self):
        """Should decode valid token."""
        token = create_access_token("456")
        decoded = decode_token(token)
        assert decoded["sub"] == "456"
        assert "exp" in decoded

    def test_decode_token_expired(self):
        """Should raise error for expired token."""
        from fastapi import HTTPException

        # Create token that expired 1 minute ago
        token = create_access_token("789", expires_minutes=-1)
        with pytest.raises(HTTPException) as exc_info:
            decode_token(token)
        assert exc_info.value.status_code == 401


class TestPasswordHashing:
    """Tests for password hashing functions."""

    def test_hash_password(self):
        """Should hash password."""
        hashed = hash_password("mypassword123")
        assert hashed is not None
        assert hashed != "mypassword123"

    def test_verify_password_correct(self):
        """Should verify correct password."""
        hashed = hash_password("mypassword123")
        assert verify_password("mypassword123", hashed) is True

    def test_verify_password_incorrect(self):
        """Should reject incorrect password."""
        hashed = hash_password("mypassword123")
        assert verify_password("wrongpassword", hashed) is False


class TestSessionTokens:
    """Tests for session token functions."""

    def test_encode_session(self):
        """Should encode session data."""
        token = encode_session({"user_id": 1, "role": "ADMIN"})
        assert token is not None
        assert isinstance(token, str)

    def test_decode_session_success(self):
        """Should decode valid session."""
        data = {"user_id": 1, "role": "ADMIN"}
        token = encode_session(data)
        decoded = decode_session(token)
        assert decoded["user_id"] == 1
        assert decoded["role"] == "ADMIN"

    def test_decode_session_invalid(self):
        """Should raise error for invalid session."""
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            decode_session("invalid_token_12345")
        assert exc_info.value.status_code == 401
