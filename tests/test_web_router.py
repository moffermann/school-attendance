"""Tests for web router endpoints."""

from __future__ import annotations

from datetime import date, datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app import main
from app.core import deps
from app.core.auth import AuthUser
from app.core.security import encode_session


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def client():
    """Create test client."""
    return TestClient(main.app)


@pytest.fixture
def admin_session_token():
    """Create admin session token."""
    return encode_session({"user_id": 1})


@pytest.fixture
def mock_db_session():
    """Create mock DB session."""
    return MagicMock(spec=AsyncSession)


# =============================================================================
# Login Tests
# =============================================================================

class TestLoginPage:
    """Tests for login page."""

    def test_login_page_renders(self, client):
        """Should render login page."""
        resp = client.get("/login")
        assert resp.status_code == 200
        assert "login" in resp.text.lower() or "iniciar" in resp.text.lower()

    def test_login_page_with_next(self, client):
        """Should include next param in form."""
        resp = client.get("/login?next=/dashboard")
        assert resp.status_code == 200


class TestLoginSubmit:
    """Tests for login submission."""

    def test_login_success(self, client):
        """Should login and redirect."""
        app = main.app

        fake_user = SimpleNamespace(
            id=1,
            email="admin@school.com",
            role="ADMIN",
            guardian_id=None,
            is_active=True,
        )

        class FakeAuthService:
            async def authenticate_user(self, email, password):
                return fake_user

        app.dependency_overrides[deps.get_auth_service] = lambda: FakeAuthService()

        try:
            resp = client.post(
                "/login",
                data={"email": "admin@school.com", "password": "secret123", "next": "/"},
                follow_redirects=False,
            )
            assert resp.status_code == 303
            assert "session_token" in resp.cookies
        finally:
            app.dependency_overrides.clear()

    def test_login_failure(self, client):
        """Should show error on invalid credentials."""
        app = main.app

        class FakeAuthService:
            async def authenticate_user(self, email, password):
                raise HTTPException(status_code=401, detail="Credenciales inválidas")

        app.dependency_overrides[deps.get_auth_service] = lambda: FakeAuthService()

        try:
            resp = client.post(
                "/login",
                data={"email": "wrong@school.com", "password": "wrong"},
            )
            assert resp.status_code == 400
            assert "inválidas" in resp.text.lower() or "invalid" in resp.text.lower()
        finally:
            app.dependency_overrides.clear()


class TestLogout:
    """Tests for logout."""

    def test_logout_clears_cookie(self, client):
        """Should clear session cookie and redirect."""
        resp = client.get("/logout", follow_redirects=False)
        assert resp.status_code == 303
        assert resp.headers.get("location") == "/login"


# =============================================================================
# Protected Routes (No Auth)
# =============================================================================

class TestProtectedRoutesNoAuth:
    """Tests for protected routes without authentication."""

    def test_home_redirects_without_auth(self, client):
        """Should redirect to login without auth."""
        resp = client.get("/", follow_redirects=False)
        assert resp.status_code == 303
        assert "/login" in resp.headers.get("location", "")

    def test_spa_serves_static_without_auth(self, client):
        """SPA is served as static files (no auth required at mount level)."""
        # /app is a StaticFiles mount, not a protected route
        # It returns 307 to add trailing slash, then serves static content
        resp = client.get("/app", follow_redirects=False)
        # StaticFiles redirects to add trailing slash
        assert resp.status_code == 307
        assert resp.headers.get("location", "").endswith("/app/")

    def test_schedules_redirects_without_auth(self, client):
        """Should redirect to login without auth."""
        resp = client.get("/schedules", follow_redirects=False)
        assert resp.status_code == 303
        assert "/login" in resp.headers.get("location", "")

    def test_broadcast_redirects_without_auth(self, client):
        """Should redirect to login without auth."""
        resp = client.get("/broadcast", follow_redirects=False)
        assert resp.status_code == 303
        assert "/login" in resp.headers.get("location", "")

    def test_parents_prefs_redirects_without_auth(self, client):
        """Should redirect to login without auth."""
        resp = client.get("/parents/preferences", follow_redirects=False)
        assert resp.status_code == 303
        assert "/login" in resp.headers.get("location", "")

    def test_alerts_redirects_without_auth(self, client):
        """Should redirect to login without auth."""
        resp = client.get("/alerts", follow_redirects=False)
        assert resp.status_code == 303
        assert "/login" in resp.headers.get("location", "")

    def test_photos_redirects_without_auth(self, client):
        """Should redirect to login without auth."""
        resp = client.get("/photos", follow_redirects=False)
        assert resp.status_code == 303
        assert "/login" in resp.headers.get("location", "")


# =============================================================================
# Protected Routes (Invalid Session)
# =============================================================================

class TestProtectedRoutesInvalidSession:
    """Tests for protected routes with invalid session."""

    def test_home_redirects_with_invalid_session(self, client):
        """Should redirect with invalid session token."""
        resp = client.get(
            "/",
            cookies={"session_token": "invalid_token"},
            follow_redirects=False,
        )
        assert resp.status_code == 303
        assert "/login" in resp.headers.get("location", "")

    def test_spa_serves_static_with_invalid_session(self, client):
        """SPA is served as static files (session not checked at mount level)."""
        # /app is a StaticFiles mount, auth is handled client-side
        resp = client.get(
            "/app",
            cookies={"session_token": "invalid_token"},
            follow_redirects=False,
        )
        # StaticFiles redirects to add trailing slash
        assert resp.status_code == 307
        assert resp.headers.get("location", "").endswith("/app/")


# =============================================================================
# Helper Function Tests
# =============================================================================

class TestRequireStaffUser:
    """Tests for _require_staff_user helper."""

    @pytest.mark.asyncio
    async def test_require_staff_no_token(self):
        """Should return redirect when no session token."""
        from app.web.router import _require_staff_user

        request = MagicMock()
        request.url.path = "/test"
        request.cookies.get.return_value = None

        session = MagicMock(spec=AsyncSession)

        result = await _require_staff_user(request, session)

        assert hasattr(result, "status_code")
        assert result.status_code == 303

    @pytest.mark.asyncio
    async def test_require_staff_invalid_token(self):
        """Should return redirect when invalid token."""
        from app.web.router import _require_staff_user

        request = MagicMock()
        request.url.path = "/test"
        request.cookies.get.return_value = "invalid_token"

        session = MagicMock(spec=AsyncSession)

        result = await _require_staff_user(request, session)

        assert hasattr(result, "status_code")
        assert result.status_code == 303

    @pytest.mark.asyncio
    async def test_require_staff_user_not_found(self):
        """Should return redirect when user not found."""
        from app.web.router import _require_staff_user

        valid_token = encode_session({"user_id": 999})

        request = MagicMock()
        request.url.path = "/test"
        request.cookies.get.return_value = valid_token

        # Create mock session that returns None for user
        session = MagicMock(spec=AsyncSession)

        with patch("app.web.router.UserRepository") as MockRepo:
            mock_repo = MagicMock()
            mock_repo.get = AsyncMock(return_value=None)
            MockRepo.return_value = mock_repo

            result = await _require_staff_user(request, session)

        assert hasattr(result, "status_code")
        assert result.status_code == 303

    @pytest.mark.asyncio
    async def test_require_staff_wrong_role(self):
        """Should return redirect when user has wrong role."""
        from app.web.router import _require_staff_user

        valid_token = encode_session({"user_id": 1})

        request = MagicMock()
        request.url.path = "/test"
        request.cookies.get.return_value = valid_token

        fake_user = SimpleNamespace(
            id=1,
            role="TEACHER",  # Not in allowed roles
            full_name="Test User",
            guardian_id=None,
        )

        session = MagicMock(spec=AsyncSession)

        with patch("app.web.router.UserRepository") as MockRepo:
            mock_repo = MagicMock()
            mock_repo.get = AsyncMock(return_value=fake_user)
            MockRepo.return_value = mock_repo

            result = await _require_staff_user(request, session)

        assert hasattr(result, "status_code")
        assert result.status_code == 303

    @pytest.mark.asyncio
    async def test_require_staff_success(self):
        """Should return user and token when valid staff user."""
        from app.web.router import _require_staff_user

        valid_token = encode_session({"user_id": 1})

        request = MagicMock()
        request.url.path = "/test"
        request.cookies.get.return_value = valid_token

        fake_user = SimpleNamespace(
            id=1,
            role="ADMIN",
            full_name="Admin User",
            guardian_id=None,
        )

        session = MagicMock(spec=AsyncSession)

        with patch("app.web.router.UserRepository") as MockRepo:
            mock_repo = MagicMock()
            mock_repo.get = AsyncMock(return_value=fake_user)
            MockRepo.return_value = mock_repo

            result = await _require_staff_user(request, session)

        assert isinstance(result, tuple)
        auth_user, api_token = result
        assert auth_user.id == 1
        assert auth_user.role == "ADMIN"
        assert api_token is not None
