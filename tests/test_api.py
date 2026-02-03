from __future__ import annotations

from datetime import date, datetime
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app import main
from app.core import deps
from app.core.auth import AuthUser
from app.schemas.absences import AbsenceStatus
from app.schemas.devices import DeviceRead
from app.schemas.notifications import NotificationSummaryResponse
from app.schemas.webapp import (
    DashboardSnapshot,
    DashboardStats,
    ReportCourseSummary,
    ReportsSnapshot,
    ReportTrendPoint,
)


@pytest.fixture
def client():
    app = main.app
    # Auth overrides
    app.dependency_overrides[deps.get_current_user] = lambda: AuthUser(
        id=1, role="DIRECTOR", full_name="Dir", guardian_id=None
    )
    app.dependency_overrides[deps.get_current_user_optional] = lambda: AuthUser(
        id=1, role="DIRECTOR", full_name="Dir", guardian_id=None
    )
    app.dependency_overrides[deps.verify_device_key] = lambda: True
    # Service overrides (set per-test)
    overrides = []
    yield app, overrides
    for key in overrides:
        app.dependency_overrides.pop(key, None)
    # Clear auth overrides
    app.dependency_overrides.pop(deps.get_current_user, None)
    app.dependency_overrides.pop(deps.get_current_user_optional, None)
    app.dependency_overrides.pop(deps.verify_device_key, None)


def test_dashboard_endpoint(client):
    app, overrides = client

    class FakeDashboardService:
        async def get_snapshot(self, **kwargs):
            return DashboardSnapshot(
                date=date.today(),
                stats=DashboardStats(
                    total_in=1, total_out=2, late_count=0, no_in_count=0, with_photos=0
                ),
                events=[],
            )

    overrides.append(deps.get_dashboard_service)
    app.dependency_overrides[deps.get_dashboard_service] = lambda: FakeDashboardService()

    with TestClient(app) as test_client:
        resp = test_client.get("/api/v1/web-app/dashboard")
        assert resp.status_code == 200
        payload = resp.json()
        assert payload["stats"]["total_in"] == 1


def test_reports_endpoint(client):
    app, overrides = client

    class FakeDashboardService:
        async def get_report(self, **kwargs):
            return ReportsSnapshot(
                start_date=date.today(),
                end_date=date.today(),
                courses=[
                    ReportCourseSummary(
                        course_id=1,
                        course_name="1A",
                        total_students=10,
                        present=9,
                        late=1,
                        absent=1,
                        attendance_pct=90.0,
                    )
                ],
                trend=[ReportTrendPoint(date=date.today(), present=9)],
            )

    overrides.append(deps.get_dashboard_service)
    app.dependency_overrides[deps.get_dashboard_service] = lambda: FakeDashboardService()

    with TestClient(app) as test_client:
        resp = test_client.get("/api/v1/web-app/reports?start=2024-01-01&end=2024-01-02")
        assert resp.status_code == 200
        data = resp.json()
        assert data["courses"][0]["attendance_pct"] == 90.0


def test_devices_endpoint(client):
    app, overrides = client

    class FakeDeviceService:
        async def list_devices(self):
            return [
                DeviceRead(
                    id=1,
                    device_id="DEV-1",
                    gate_id="G1",
                    firmware_version="1.0",
                    battery_pct=80,
                    pending_events=0,
                    online=True,
                    last_sync=datetime.now(),
                )
            ]

    overrides.append(deps.get_device_service)
    app.dependency_overrides[deps.get_device_service] = lambda: FakeDeviceService()

    with TestClient(app) as test_client:
        resp = test_client.get("/api/v1/devices")
        assert resp.status_code == 200
        assert resp.json()[0]["device_id"] == "DEV-1"


def test_alerts_endpoint(client):
    app, overrides = client

    class FakeAlertService:
        async def list_alerts(self, **kwargs):
            return []

    overrides.append(deps.get_alert_service)
    app.dependency_overrides[deps.get_alert_service] = lambda: FakeAlertService()

    with TestClient(app) as test_client:
        resp = test_client.get("/api/v1/alerts/no-entry")
        assert resp.status_code == 200
        assert resp.json() == []


def test_notifications_summary_endpoint(client):
    app, overrides = client

    class FakeNotificationService:
        async def summary(self):
            return NotificationSummaryResponse(
                total=2,
                by_status={"sent": 2},
                by_channel={"WHATSAPP": 1, "EMAIL": 1},
                by_template={"INGRESO_OK": 2},
            )

    overrides.append(deps.get_notification_service)
    app.dependency_overrides[deps.get_notification_service] = lambda: FakeNotificationService()

    with TestClient(app) as test_client:
        resp = test_client.get("/api/v1/notifications/summary")
        assert resp.status_code == 200
        assert resp.json()["total"] == 2


def test_absences_list_endpoint(client):
    app, overrides = client

    class FakeAbsenceService:
        async def list_absences(self, user, start_date=None, end_date=None, status=None):
            return [
                SimpleNamespace(
                    id=1,
                    student_id=1,
                    type="SICK",
                    start_date=date(2024, 1, 1),
                    end_date=date(2024, 1, 2),
                    comment=None,
                    attachment_ref=None,
                    status="PENDING",
                    ts_submitted=datetime.now(),
                )
            ]

    overrides.append(deps.get_absence_service)
    app.dependency_overrides[deps.get_absence_service] = lambda: FakeAbsenceService()

    with TestClient(app) as test_client:
        resp = test_client.get("/api/v1/absences")
        assert resp.status_code == 200
        assert resp.json()[0]["status"] == AbsenceStatus.PENDING.value
