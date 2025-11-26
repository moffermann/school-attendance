"""Tests for API security and authentication."""

from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app import main
from app.core import deps
from app.core.auth import AuthUser
from app.schemas.attendance import AttendanceType


@pytest.fixture
def app_no_auth():
    """Get app without any auth overrides."""
    app = main.app
    # Clear any existing overrides
    app.dependency_overrides.clear()
    yield app
    app.dependency_overrides.clear()


@pytest.fixture
def app_with_parent_auth():
    """Get app with PARENT role auth."""
    app = main.app
    app.dependency_overrides[deps.get_current_user] = lambda: AuthUser(
        id=10, role="PARENT", full_name="Parent User", guardian_id=5
    )
    app.dependency_overrides[deps.get_current_user_optional] = lambda: AuthUser(
        id=10, role="PARENT", full_name="Parent User", guardian_id=5
    )
    yield app
    app.dependency_overrides.clear()


@pytest.fixture
def app_with_director_auth():
    """Get app with DIRECTOR role auth."""
    app = main.app
    app.dependency_overrides[deps.get_current_user] = lambda: AuthUser(
        id=1, role="DIRECTOR", full_name="Director User", guardian_id=None
    )
    app.dependency_overrides[deps.get_current_user_optional] = lambda: AuthUser(
        id=1, role="DIRECTOR", full_name="Director User", guardian_id=None
    )
    app.dependency_overrides[deps.verify_device_key] = lambda: False
    yield app
    app.dependency_overrides.clear()


# ============================================================================
# Tests for unauthenticated access (should be denied)
# ============================================================================

def test_dashboard_requires_auth(app_no_auth):
    """Dashboard endpoint should require authentication."""
    with TestClient(app_no_auth) as client:
        resp = client.get("/api/v1/web-app/dashboard")
        assert resp.status_code == 401


def test_devices_requires_auth(app_no_auth):
    """Devices endpoint should require authentication."""
    with TestClient(app_no_auth) as client:
        resp = client.get("/api/v1/devices")
        assert resp.status_code == 401


def test_alerts_requires_auth(app_no_auth):
    """Alerts endpoint should require authentication."""
    with TestClient(app_no_auth) as client:
        resp = client.get("/api/v1/alerts/no-entry")
        assert resp.status_code == 401


def test_absences_requires_auth(app_no_auth):
    """Absences endpoint should require authentication."""
    with TestClient(app_no_auth) as client:
        resp = client.get("/api/v1/absences")
        assert resp.status_code == 401


# ============================================================================
# Tests for role-based access control
# ============================================================================

def test_parent_cannot_access_devices(app_with_parent_auth):
    """Parent role should not access devices endpoint."""
    with TestClient(app_with_parent_auth) as client:
        resp = client.get("/api/v1/devices")
        # Parent doesn't have required role
        assert resp.status_code == 403


def test_parent_cannot_register_attendance_without_device_key(app_with_parent_auth):
    """Parent cannot register attendance without device key."""
    with TestClient(app_with_parent_auth) as client:
        # Disable device key verification for this test
        app_with_parent_auth.dependency_overrides[deps.verify_device_key] = lambda: False

        resp = client.post("/api/v1/attendance/events", json={
            "student_id": 1,
            "device_id": "DEV-TEST",
            "gate_id": "GATE-A",
            "type": "IN",
        })
        assert resp.status_code == 403


def test_director_can_register_attendance(app_with_director_auth):
    """Director should be able to register attendance."""
    app = app_with_director_auth

    class FakeAttendanceService:
        async def register_event(self, payload):
            return SimpleNamespace(
                id=1,
                student_id=payload.student_id,
                type=payload.type.value,
                gate_id=payload.gate_id,
                device_id=payload.device_id,
                occurred_at=datetime.utcnow(),
                local_seq=None,
                photo_ref=None,
                synced_at=None,
            )

    app.dependency_overrides[deps.get_attendance_service] = lambda: FakeAttendanceService()

    with TestClient(app) as client:
        resp = client.post("/api/v1/attendance/events", json={
            "student_id": 1,
            "device_id": "DEV-TEST",
            "gate_id": "GATE-A",
            "type": "IN",
        })
        assert resp.status_code == 201
        assert resp.json()["student_id"] == 1


# ============================================================================
# Tests for device key authentication
# ============================================================================

def test_attendance_with_valid_device_key(app_no_auth):
    """Attendance endpoint should work with valid device key."""
    app = app_no_auth
    # Simulate valid device key
    app.dependency_overrides[deps.verify_device_key] = lambda: True

    class FakeAttendanceService:
        async def register_event(self, payload):
            return SimpleNamespace(
                id=1,
                student_id=payload.student_id,
                type=payload.type.value,
                gate_id=payload.gate_id,
                device_id=payload.device_id,
                occurred_at=datetime.utcnow(),
                local_seq=None,
                photo_ref=None,
                synced_at=None,
            )

    app.dependency_overrides[deps.get_attendance_service] = lambda: FakeAttendanceService()

    with TestClient(app) as client:
        resp = client.post("/api/v1/attendance/events", json={
            "student_id": 1,
            "device_id": "DEV-TEST",
            "gate_id": "GATE-A",
            "type": "IN",
        })
        assert resp.status_code == 201


# ============================================================================
# Tests for input validation
# ============================================================================

def test_attendance_event_validates_type(app_with_director_auth):
    """Attendance event type should be validated."""
    with TestClient(app_with_director_auth) as client:
        resp = client.post("/api/v1/attendance/events", json={
            "student_id": 1,
            "device_id": "DEV-TEST",
            "gate_id": "GATE-A",
            "type": "INVALID",  # Invalid type
        })
        assert resp.status_code == 422


def test_attendance_event_validates_student_id(app_with_director_auth):
    """Attendance event should require valid student_id."""
    with TestClient(app_with_director_auth) as client:
        resp = client.post("/api/v1/attendance/events", json={
            "student_id": "not-a-number",  # Invalid
            "device_id": "DEV-TEST",
            "gate_id": "GATE-A",
            "type": "IN",
        })
        assert resp.status_code == 422


# ============================================================================
# Tests for health endpoint (public)
# ============================================================================

def test_health_ping_is_public(app_no_auth):
    """Health ping endpoint should be accessible without auth."""
    with TestClient(app_no_auth) as client:
        resp = client.get("/api/v1/health/ping")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"


def test_healthz_alias_is_public(app_no_auth):
    """Healthz alias should be accessible without auth."""
    with TestClient(app_no_auth) as client:
        resp = client.get("/healthz")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
