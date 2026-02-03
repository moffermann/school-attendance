"""Phase 3 API endpoint tests for higher coverage."""

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app import main
from app.core import deps
from app.core.auth import AuthUser
from app.core.deps import TenantAuthUser

# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def app_with_admin_auth():
    """Get app with ADMIN role auth."""
    app = main.app
    app.dependency_overrides[deps.get_current_user] = lambda: AuthUser(
        id=1, role="ADMIN", full_name="Admin User", guardian_id=None, teacher_id=None
    )
    yield app
    app.dependency_overrides.clear()


@pytest.fixture
def app_with_device_auth():
    """Get app with device key auth."""
    app = main.app
    app.dependency_overrides[deps.verify_device_key] = lambda: True
    app.dependency_overrides[deps.get_current_user_optional] = lambda: None
    yield app
    app.dependency_overrides.clear()


@pytest.fixture
def app_no_auth():
    """Get app without auth."""
    app = main.app
    app.dependency_overrides[deps.verify_device_key] = lambda: False
    app.dependency_overrides[deps.get_current_user_optional] = lambda: None
    yield app
    app.dependency_overrides.clear()


# =============================================================================
# Device API Tests
# =============================================================================


class TestDeviceAPI:
    """Tests for device endpoints."""

    def test_list_devices(self, app_with_admin_auth):
        """Should list all devices."""
        app = app_with_admin_auth

        class FakeDeviceService:
            async def list_devices(self):
                return [
                    SimpleNamespace(
                        id=1,
                        device_id="DEV-001",
                        gate_id="GATE-A",
                        firmware_version="1.0.0",
                        battery_pct=85,
                        pending_events=0,
                        online=True,
                        last_sync=datetime.now(UTC),
                    )
                ]

        app.dependency_overrides[deps.get_device_service] = lambda: FakeDeviceService()

        with TestClient(app) as client:
            resp = client.get("/api/v1/devices")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data) == 1
            assert data[0]["device_id"] == "DEV-001"

    def test_heartbeat_with_device_key(self, app_with_device_auth):
        """Should accept heartbeat with device key auth."""
        app = app_with_device_auth

        class FakeDeviceService:
            async def process_heartbeat(self, payload):
                return SimpleNamespace(
                    id=1,
                    device_id=payload.device_id,
                    gate_id=payload.gate_id,
                    firmware_version=payload.firmware_version,
                    battery_pct=payload.battery_pct,
                    pending_events=payload.pending_events,
                    online=True,
                    last_sync=datetime.now(UTC),
                )

        app.dependency_overrides[deps.get_device_service] = lambda: FakeDeviceService()

        with TestClient(app) as client:
            resp = client.post(
                "/api/v1/devices/heartbeat",
                json={
                    "device_id": "DEV-001",
                    "gate_id": "GATE-A",
                    "firmware_version": "1.0.0",
                    "battery_pct": 90,
                    "pending_events": 5,
                },
            )
            assert resp.status_code == 200
            assert resp.json()["battery_pct"] == 90

    def test_heartbeat_no_auth(self, app_no_auth):
        """Should reject heartbeat without auth."""
        with TestClient(app_no_auth) as client:
            resp = client.post(
                "/api/v1/devices/heartbeat",
                json={
                    "device_id": "DEV-001",
                    "gate_id": "GATE-A",
                    "firmware_version": "1.0.0",
                    "battery_pct": 90,
                    "pending_events": 5,
                },
            )
            assert resp.status_code == 403

    def test_ping_device(self, app_with_admin_auth):
        """Should ping a device."""
        app = app_with_admin_auth

        class FakeDeviceService:
            async def ping_device(self, device_id):
                return SimpleNamespace(
                    id=device_id,
                    device_id="DEV-001",
                    gate_id="GATE-A",
                    firmware_version="1.0.0",
                    battery_pct=85,
                    pending_events=0,
                    online=True,
                    last_sync=datetime.now(UTC),
                )

        app.dependency_overrides[deps.get_device_service] = lambda: FakeDeviceService()

        with TestClient(app) as client:
            resp = client.post("/api/v1/devices/1/ping")
            assert resp.status_code == 200

    def test_ping_device_not_found(self, app_with_admin_auth):
        """Should return 404 for non-existent device."""
        app = app_with_admin_auth

        class FakeDeviceService:
            async def ping_device(self, device_id):
                raise ValueError("Dispositivo no encontrado")

        app.dependency_overrides[deps.get_device_service] = lambda: FakeDeviceService()

        with TestClient(app) as client:
            resp = client.post("/api/v1/devices/999/ping")
            assert resp.status_code == 404

    def test_device_logs(self, app_with_admin_auth):
        """Should get device logs."""
        app = app_with_admin_auth

        class FakeDeviceService:
            async def get_logs(self, device_id):
                return ["Log entry 1", "Log entry 2"]

        app.dependency_overrides[deps.get_device_service] = lambda: FakeDeviceService()

        with TestClient(app) as client:
            resp = client.get("/api/v1/devices/1/logs")
            assert resp.status_code == 200
            assert len(resp.json()) == 2

    def test_device_logs_not_found(self, app_with_admin_auth):
        """Should return 404 for logs of non-existent device."""
        app = app_with_admin_auth

        class FakeDeviceService:
            async def get_logs(self, device_id):
                raise ValueError("Dispositivo no encontrado")

        app.dependency_overrides[deps.get_device_service] = lambda: FakeDeviceService()

        with TestClient(app) as client:
            resp = client.get("/api/v1/devices/999/logs")
            assert resp.status_code == 404


# =============================================================================
# Attendance API Tests
# =============================================================================


class TestAttendanceAPI:
    """Tests for attendance endpoints."""

    def test_register_event_forbidden_no_auth(self, app_no_auth):
        """Should reject event without auth."""
        with TestClient(app_no_auth) as client:
            resp = client.post(
                "/api/v1/attendance/events",
                json={
                    "student_id": 1,
                    "type": "IN",
                    "gate_id": "GATE-A",
                    "device_id": "DEV-001",
                },
            )
            assert resp.status_code == 403

    def test_register_event_with_device_key(self, app_with_device_auth):
        """Should accept event with device key."""
        app = app_with_device_auth

        class FakeAttendanceService:
            async def register_event(self, payload):
                return SimpleNamespace(
                    id=1,
                    student_id=payload.student_id,
                    type=payload.type.value,
                    gate_id=payload.gate_id,
                    device_id=payload.device_id,
                    occurred_at=datetime.now(UTC),
                    photo_ref=None,
                    local_seq=None,
                    synced_at=None,
                )

        app.dependency_overrides[deps.get_attendance_service] = lambda: FakeAttendanceService()

        with TestClient(app) as client:
            resp = client.post(
                "/api/v1/attendance/events",
                json={
                    "student_id": 1,
                    "type": "IN",
                    "gate_id": "GATE-A",
                    "device_id": "DEV-001",
                },
            )
            assert resp.status_code == 201

    def test_list_student_events(self, app_with_admin_auth):
        """Should list events for a student."""
        app = app_with_admin_auth

        class FakeAttendanceService:
            async def list_events_by_student(self, student_id):
                return [
                    SimpleNamespace(
                        id=1,
                        student_id=student_id,
                        type="IN",
                        gate_id="GATE-A",
                        device_id="DEV-001",
                        occurred_at=datetime.now(UTC),
                        photo_ref=None,
                        local_seq=None,
                        synced_at=None,
                    )
                ]

        app.dependency_overrides[deps.get_attendance_service] = lambda: FakeAttendanceService()

        with TestClient(app) as client:
            resp = client.get("/api/v1/attendance/students/1")
            assert resp.status_code == 200
            assert len(resp.json()) == 1


# =============================================================================
# Alerts API Tests
# =============================================================================


class TestAlertsAPI:
    """Tests for alerts endpoints."""

    def test_list_no_entry_alerts(self, app_with_admin_auth):
        """Should list no-entry alerts."""
        app = app_with_admin_auth

        class FakeAlertService:
            async def list_alerts(
                self,
                start_date=None,
                end_date=None,
                status=None,
                course_id=None,
                guardian_id=None,
                student_id=None,
                limit=100,
                offset=0,
            ):
                return []

        app.dependency_overrides[deps.get_alert_service] = lambda: FakeAlertService()

        with TestClient(app) as client:
            resp = client.get("/api/v1/alerts/no-entry")
            assert resp.status_code == 200
            assert resp.json() == []

    def test_resolve_alert(self, app_with_admin_auth):
        """Should resolve an alert."""
        app = app_with_admin_auth

        class FakeAlertService:
            async def resolve_alert(self, alert_id, notes):
                return SimpleNamespace(
                    id=alert_id,
                    student_id=1,
                    guardian_id=1,
                    course_id=1,
                    schedule_id=1,
                    alert_date=datetime.now().date(),
                    alerted_at=datetime.now(UTC),
                    status="RESOLVED",
                    notes=notes,
                    resolved_at=datetime.now(UTC),
                    notification_attempts=1,
                    last_notification_at=None,
                    student_name="Test Student",
                    guardian_name="Test Guardian",
                    course_name="Test Course",
                )

        app.dependency_overrides[deps.get_alert_service] = lambda: FakeAlertService()

        with TestClient(app) as client:
            resp = client.post("/api/v1/alerts/no-entry/1/resolve", json={"notes": "Contactado"})
            assert resp.status_code == 200
            assert resp.json()["status"] == "RESOLVED"


# =============================================================================
# Tags API Tests
# =============================================================================


class TestTagsAPI:
    """Tests for tags endpoints."""

    def test_provision_tag(self, app_with_admin_auth):
        """Should provision a new tag."""
        app = app_with_admin_auth

        class FakeTagProvisionService:
            async def provision(self, payload):
                return SimpleNamespace(
                    ndef_uri="nfc://student/1",
                    tag_token_preview="nfc_xxx",
                    checksum="abc123",
                )

        app.dependency_overrides[deps.get_tag_provision_service] = lambda: FakeTagProvisionService()

        with TestClient(app) as client:
            resp = client.post(
                "/api/v1/tags/provision",
                json={
                    "student_id": 1,
                },
            )
            assert resp.status_code == 200
            assert "tag_token_preview" in resp.json()

    def test_confirm_tag(self, app_with_admin_auth):
        """Should confirm a provisioned tag."""
        app = app_with_admin_auth

        class FakeTagProvisionService:
            async def confirm(self, payload):
                return SimpleNamespace(
                    id=1,
                    student_id=payload.student_id,
                    status="ACTIVE",
                    tag_token_preview=payload.tag_token_preview,
                )

        app.dependency_overrides[deps.get_tag_provision_service] = lambda: FakeTagProvisionService()

        with TestClient(app) as client:
            resp = client.post(
                "/api/v1/tags/confirm",
                json={
                    "student_id": 1,
                    "tag_token_preview": "nfc_xxx",
                },
            )
            assert resp.status_code == 201

    def test_confirm_tag_not_found(self, app_with_admin_auth):
        """Should return 404 for non-existent tag."""
        app = app_with_admin_auth

        class FakeTagProvisionService:
            async def confirm(self, payload):
                raise ValueError("Tag no encontrado")

        app.dependency_overrides[deps.get_tag_provision_service] = lambda: FakeTagProvisionService()

        with TestClient(app) as client:
            resp = client.post(
                "/api/v1/tags/confirm",
                json={
                    "student_id": 1,
                    "tag_token_preview": "nonexistent",
                },
            )
            assert resp.status_code == 404

    def test_revoke_tag(self, app_with_admin_auth):
        """Should revoke a tag."""
        app = app_with_admin_auth

        class FakeTagProvisionService:
            async def revoke(self, tag_id):
                return SimpleNamespace(
                    id=tag_id,
                    student_id=1,
                    status="REVOKED",
                    tag_token_preview="nfc_xxx",
                )

        app.dependency_overrides[deps.get_tag_provision_service] = lambda: FakeTagProvisionService()

        with TestClient(app) as client:
            resp = client.post("/api/v1/tags/1/revoke")
            assert resp.status_code == 200
            assert resp.json()["status"] == "REVOKED"

    def test_revoke_tag_not_found(self, app_with_admin_auth):
        """Should return 404 for non-existent tag."""
        app = app_with_admin_auth

        class FakeTagProvisionService:
            async def revoke(self, tag_id):
                raise ValueError("Tag no encontrado")

        app.dependency_overrides[deps.get_tag_provision_service] = lambda: FakeTagProvisionService()

        with TestClient(app) as client:
            resp = client.post("/api/v1/tags/999/revoke")
            assert resp.status_code == 404


# =============================================================================
# Parents API Tests
# =============================================================================


class TestParentsAPI:
    """Tests for parents endpoints."""

    @pytest.fixture
    def app_with_tenant_admin_auth(self):
        """Get app with ADMIN role auth for tenant endpoints."""
        app = main.app
        app.dependency_overrides[deps.get_current_tenant_user] = lambda: TenantAuthUser(
            id=1,
            role="ADMIN",
            full_name="Admin User",
            guardian_id=None,
            teacher_id=None,
            tenant_id=1,
            tenant_slug="test",
        )
        yield app
        app.dependency_overrides.clear()

    @pytest.fixture
    def app_with_parent_auth(self):
        """Get app with PARENT role auth for tenant endpoints."""
        app = main.app
        app.dependency_overrides[deps.get_current_tenant_user] = lambda: TenantAuthUser(
            id=2,
            role="PARENT",
            full_name="Parent User",
            guardian_id=10,
            teacher_id=None,
            tenant_id=1,
            tenant_slug="test",
        )
        yield app
        app.dependency_overrides.clear()

    def test_get_preferences_admin(self, app_with_tenant_admin_auth):
        """Should get preferences as admin."""
        app = app_with_tenant_admin_auth

        class FakeConsentService:
            async def get_guardian_preferences(self, guardian_id):
                return SimpleNamespace(
                    guardian_id=guardian_id,
                    preferences={"INGRESO_OK": {"whatsapp": True, "email": False}},
                    photo_consents={},
                )

        app.dependency_overrides[deps.get_consent_service] = lambda: FakeConsentService()

        with TestClient(app) as client:
            resp = client.get("/api/v1/parents/10/preferences")
            assert resp.status_code == 200
            assert resp.json()["guardian_id"] == 10

    def test_get_preferences_parent_own(self, app_with_parent_auth):
        """Should get own preferences as parent."""
        app = app_with_parent_auth

        class FakeConsentService:
            async def get_guardian_preferences(self, guardian_id):
                return SimpleNamespace(
                    guardian_id=guardian_id,
                    preferences={},
                    photo_consents={},
                )

        app.dependency_overrides[deps.get_consent_service] = lambda: FakeConsentService()

        with TestClient(app) as client:
            resp = client.get("/api/v1/parents/10/preferences")
            assert resp.status_code == 200

    def test_get_preferences_parent_other(self, app_with_parent_auth):
        """Should forbid access to other parent's preferences."""
        app = app_with_parent_auth

        with TestClient(app) as client:
            resp = client.get("/api/v1/parents/99/preferences")  # Different guardian_id
            assert resp.status_code == 403

    def test_get_preferences_not_found(self, app_with_tenant_admin_auth):
        """Should return 404 for non-existent guardian."""
        app = app_with_tenant_admin_auth

        class FakeConsentService:
            async def get_guardian_preferences(self, guardian_id):
                raise ValueError("Apoderado no encontrado")

        app.dependency_overrides[deps.get_consent_service] = lambda: FakeConsentService()

        with TestClient(app) as client:
            resp = client.get("/api/v1/parents/999/preferences")
            assert resp.status_code == 404

    def test_update_preferences_admin(self, app_with_tenant_admin_auth):
        """Should update preferences as admin."""
        app = app_with_tenant_admin_auth

        class FakeConsentService:
            async def update_guardian_preferences(self, guardian_id, payload):
                return SimpleNamespace(
                    guardian_id=guardian_id,
                    preferences=payload.preferences or {},
                    photo_consents=payload.photo_consents or {},
                )

        app.dependency_overrides[deps.get_consent_service] = lambda: FakeConsentService()

        with TestClient(app) as client:
            resp = client.put(
                "/api/v1/parents/10/preferences",
                json={
                    "preferences": {"INGRESO_OK": {"whatsapp": True, "email": False}},
                    "photo_consents": {"1": True},
                },
            )
            assert resp.status_code == 200
            assert resp.json()["guardian_id"] == 10

    def test_update_preferences_parent_other(self, app_with_parent_auth):
        """Should forbid updating other parent's preferences."""
        app = app_with_parent_auth

        with TestClient(app) as client:
            resp = client.put(
                "/api/v1/parents/99/preferences",
                json={
                    "preferences": {},
                },
            )
            assert resp.status_code == 403

    def test_update_preferences_not_found(self, app_with_tenant_admin_auth):
        """Should return 404 for non-existent guardian."""
        app = app_with_tenant_admin_auth

        class FakeConsentService:
            async def update_guardian_preferences(self, guardian_id, payload):
                raise ValueError("Apoderado no encontrado")

        app.dependency_overrides[deps.get_consent_service] = lambda: FakeConsentService()

        with TestClient(app) as client:
            resp = client.put(
                "/api/v1/parents/999/preferences",
                json={
                    "preferences": {},
                },
            )
            assert resp.status_code == 404


# =============================================================================
# Broadcast API Tests
# =============================================================================


class TestBroadcastAPI:
    """Tests for broadcast endpoints."""

    @pytest.fixture
    def app_with_broadcast_auth(self):
        """Get app with admin auth for broadcast endpoints.

        Note: Feature flag check is bypassed via SKIP_TENANT_MIDDLEWARE=true in conftest.py
        """
        app = main.app
        # Override require_roles dependency (uses get_current_user internally)
        app.dependency_overrides[deps.get_current_user] = lambda: AuthUser(
            id=1, role="ADMIN", full_name="Admin User", guardian_id=None, teacher_id=None
        )
        yield app
        app.dependency_overrides.clear()

    def test_broadcast_preview(self, app_with_broadcast_auth):
        """Should preview broadcast."""
        app = app_with_broadcast_auth

        class FakeBroadcastService:
            async def preview_broadcast(self, payload):
                return SimpleNamespace(
                    subject=payload.subject,
                    message=payload.message,
                    recipients=5,
                    dry_run=True,
                )

        app.dependency_overrides[deps.get_broadcast_service] = lambda: FakeBroadcastService()

        with TestClient(app) as client:
            resp = client.post(
                "/api/v1/broadcasts/preview",
                json={
                    "subject": "Test Subject",
                    "message": "Test Message",
                    "template": "INGRESO_OK",
                    "audience": {"scope": "global"},
                },
            )
            assert resp.status_code == 200
            assert resp.json()["recipients"] == 5

    def test_broadcast_send(self, app_with_broadcast_auth):
        """Should send broadcast."""
        app = app_with_broadcast_auth

        class FakeBroadcastService:
            async def enqueue_broadcast(self, payload):
                return "job-123"

        app.dependency_overrides[deps.get_broadcast_service] = lambda: FakeBroadcastService()

        with TestClient(app) as client:
            resp = client.post(
                "/api/v1/broadcasts/send",
                json={
                    "subject": "Test Subject",
                    "message": "Test Message",
                    "template": "INGRESO_OK",
                    "audience": {"scope": "global"},
                },
            )
            assert resp.status_code == 202
            assert resp.json()["job_id"] == "job-123"
