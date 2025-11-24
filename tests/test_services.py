from __future__ import annotations

import asyncio
from datetime import datetime, time, timezone, date
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.schemas.attendance import AttendanceEventCreate, AttendanceType
from app.schemas.absences import AbsenceRequestCreate, AbsenceType
from app.schemas.guardians import GuardianPreferencesUpdate
from app.schemas.notifications import BroadcastAudience, BroadcastCreate, NotificationChannel, NotificationDispatchRequest, NotificationType
from app.schemas.schedules import ScheduleCreate
from app.services.attendance_service import AttendanceService
from app.services.consent_service import ConsentService
from app.services.absence_service import AbsenceService
from app.services.notifications.dispatcher import NotificationDispatcher
from app.services.schedule_service import ScheduleService
from app.services.broadcast_service import BroadcastService
from app.services.alert_service import AlertService
from app.services.dashboard_service import DashboardService
from app.services.device_service import DeviceService
from app.services.web_app_service import WebAppDataService
from app.core.auth import AuthUser


@pytest.mark.anyio("asyncio")
async def test_attendance_service_registers_event(monkeypatch) -> None:
    class DummyPhotoService:
        async def store_photo(self, *args, **kwargs):
            return "key"

    monkeypatch.setattr("app.services.attendance_service.PhotoService", lambda: DummyPhotoService())
    session = MagicMock()
    session.commit = AsyncMock()

    service = AttendanceService(session)
    service.student_repo.get = AsyncMock(return_value=SimpleNamespace(id=1))

    fake_event = SimpleNamespace(
        id=42,
        student_id=1,
        type=AttendanceType.IN.value,
        gate_id="GATE-1",
        device_id="DEV-1",
        occurred_at=datetime.utcnow(),
        local_seq=None,
        photo_ref=None,
        synced_at=None,
    )
    service.attendance_repo.create_event = AsyncMock(return_value=fake_event)

    payload = AttendanceEventCreate(
        student_id=1,
        device_id="DEV-1",
        gate_id="GATE-1",
        type=AttendanceType.IN,
    )

    result = await service.register_event(payload)

    assert result.id == 42
    service.attendance_repo.create_event.assert_awaited()
    session.commit.assert_awaited()


@pytest.mark.anyio("asyncio")
async def test_schedule_service_creates_rule(monkeypatch) -> None:
    session = MagicMock()
    session.commit = AsyncMock()

    service = ScheduleService(session)
    fake_schedule = SimpleNamespace(
        id=7,
        course_id=1,
        weekday=0,
        in_time=time(8, 0),
        out_time=time(13, 30),
    )
    service.repository.create = AsyncMock(return_value=fake_schedule)

    payload = ScheduleCreate(weekday=0, in_time=fake_schedule.in_time, out_time=fake_schedule.out_time)
    result = await service.create_schedule(1, payload)

    assert result.id == 7
    service.repository.create.assert_awaited()
    session.commit.assert_awaited()


@pytest.mark.anyio("asyncio")
async def test_consent_service_reads_preferences_and_photo_consents() -> None:
    session = MagicMock()
    service = ConsentService(session)

    guardian = SimpleNamespace(
        id=7,
        notification_prefs={
            "INGRESO_OK": [{"channel": "WHATSAPP", "enabled": True}],
            "SALIDA_OK": [{"channel": "EMAIL", "enabled": True}],
        },
        students=[
            SimpleNamespace(id=101, photo_pref_opt_in=True),
            SimpleNamespace(id=102, photo_pref_opt_in=False),
        ],
    )
    service.guardian_repo.get = AsyncMock(return_value=guardian)

    result = await service.get_guardian_preferences(guardian.id)

    assert result.preferences["INGRESO_OK"][0].model_dump() == guardian.notification_prefs["INGRESO_OK"][0]
    assert result.preferences["SALIDA_OK"][0].model_dump() == guardian.notification_prefs["SALIDA_OK"][0]
    assert result.photo_consents == {101: True, 102: False}
    service.guardian_repo.get.assert_awaited_with(guardian.id)


@pytest.mark.anyio("asyncio")
async def test_consent_service_update_preferences_updates_photo_consents() -> None:
    session = MagicMock()
    session.commit = AsyncMock()

    service = ConsentService(session)

    student_a = SimpleNamespace(id=201, photo_pref_opt_in=False)
    student_b = SimpleNamespace(id=202, photo_pref_opt_in=True)
    guardian = SimpleNamespace(
        id=9,
        notification_prefs={},
        students=[student_a, student_b],
    )

    service.guardian_repo.get = AsyncMock(return_value=guardian)
    service.guardian_repo.save = AsyncMock(return_value=guardian)

    payload = GuardianPreferencesUpdate(
        preferences={"NO_INGRESO_UMBRAL": [{"channel": "WHATSAPP", "enabled": True}]},
        photo_consents={201: True, 202: False},
    )

    result = await service.update_guardian_preferences(guardian.id, payload)

    assert guardian.notification_prefs == payload.preferences
    assert student_a.photo_pref_opt_in is True
    assert student_b.photo_pref_opt_in is False
    assert result.photo_consents == {201: True, 202: False}
    service.guardian_repo.save.assert_awaited_with(guardian)
    session.commit.assert_awaited()


@pytest.mark.anyio("asyncio")
async def test_absence_service_submits_request_for_parent() -> None:
    session = MagicMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()

    service = AbsenceService(session)

    submitted_record = SimpleNamespace(
        id=55,
        student_id=1,
        type="SICK",
        start_date=date(2024, 1, 10),
        end_date=date(2024, 1, 11),
        comment="Reposo médico",
        attachment_ref="certificado.pdf",
        status="PENDING",
        ts_submitted=datetime.now(timezone.utc),
    )

    service.student_repo.get = AsyncMock(return_value=SimpleNamespace(id=1))
    service.guardian_repo.get = AsyncMock(
        return_value=SimpleNamespace(students=[SimpleNamespace(id=1)])
    )
    service.absence_repo.create = AsyncMock(return_value=submitted_record)

    user = AuthUser(id=9, role="PARENT", full_name="Test", guardian_id=3)
    payload = AbsenceRequestCreate(
        student_id=1,
        type=AbsenceType.SICK,
        start=date(2024, 1, 10),
        end=date(2024, 1, 11),
        comment="Reposo médico",
        attachment_name="certificado.pdf",
    )

    record = await service.submit_absence(user, payload)

    assert record.student_id == payload.student_id
    service.absence_repo.create.assert_awaited()
    session.commit.assert_awaited()
    session.refresh.assert_awaited_with(record)


@pytest.mark.anyio("asyncio")
async def test_absence_service_rejects_student_not_belonging_to_guardian() -> None:
    session = MagicMock()
    service = AbsenceService(session)

    service.student_repo.get = AsyncMock(return_value=SimpleNamespace(id=2))
    service.guardian_repo.get = AsyncMock(
        return_value=SimpleNamespace(students=[SimpleNamespace(id=5)])
    )

    user = AuthUser(id=8, role="PARENT", full_name="Parent User", guardian_id=2)
    payload = AbsenceRequestCreate(
        student_id=2,
        type=AbsenceType.PERSONAL,
        start=date(2024, 2, 1),
        end=date(2024, 2, 2),
    )

    with pytest.raises(PermissionError):
        await service.submit_absence(user, payload)


@pytest.mark.anyio("asyncio")
async def test_notification_dispatcher_enqueues_job(monkeypatch) -> None:
    captured_jobs: list[tuple[str, tuple, dict]] = []

    class FakeQueue:
        def __init__(self, name, connection):  # noqa: D401
            self.name = name
            self.connection = connection

        def enqueue(self, func, *args, **kwargs):
            captured_jobs.append((func, args, kwargs))

    class FakeRedis:
        @staticmethod
        def from_url(url):  # noqa: D401
            return object()

    class FakeNotificationRepository:
        def __init__(self, session):
            self.session = session

        async def create(self, **kwargs):
            return SimpleNamespace(
                id=99,
                guardian_id=kwargs["guardian_id"],
                channel=kwargs["channel"],
                template=kwargs["template"],
                payload=kwargs["payload"],
                status="queued",
                ts_created=datetime.now(timezone.utc),
                ts_sent=None,
                retries=0,
            )

    class FakeGuardianRepository:
        def __init__(self, session):
            self.session = session

        async def get(self, guardian_id: int):
            return SimpleNamespace(
                contacts={"whatsapp": "+56912345678", "email": "test@example.com"},
                notification_prefs={},
            )

    monkeypatch.setattr("app.services.notifications.dispatcher.Redis", FakeRedis)
    monkeypatch.setattr("app.services.notifications.dispatcher.Queue", FakeQueue)
    monkeypatch.setattr(
        "app.services.notifications.dispatcher.NotificationRepository",
        FakeNotificationRepository,
    )
    monkeypatch.setattr(
        "app.services.notifications.dispatcher.GuardianRepository",
        FakeGuardianRepository,
    )

    session = MagicMock()
    session.commit = AsyncMock()

    dispatcher = NotificationDispatcher(session)

    payload = NotificationDispatchRequest(
        guardian_id=1,
        channel=NotificationChannel.WHATSAPP,
        template=NotificationType.INGRESO_OK,
        variables={"student": "Sofía"},
    )

    result = await dispatcher.enqueue_manual_notification(payload)

    assert result.id == 99
    session.commit.assert_awaited()
    assert captured_jobs
    func_path, func_args, _ = captured_jobs[0]
    assert func_path.endswith("send_whatsapp_message")
    assert func_args[1] == "+56912345678"


@pytest.mark.anyio("asyncio")
async def test_broadcast_service_preview_and_enqueue(monkeypatch) -> None:
    captured_jobs = []

    class FakeQueue:
        def __init__(self, name, connection):
            self.name = name
            self.connection = connection

        def enqueue(self, func, payload, job_id=None):
            captured_jobs.append((func, payload, job_id))

    class FakeRedis:
        @staticmethod
        def from_url(url):
            return object()

    class FakeGuardianRepo:
        def __init__(self, session):
            self.session = session

        async def list_all(self):
            return [SimpleNamespace(id=1)]

        async def list_by_student_ids(self, ids):
            return [SimpleNamespace(id=2)]

    class FakeStudentRepo:
        def __init__(self, session):
            self.session = session

        async def list_by_course(self, course_id: int):
            return [SimpleNamespace(id=10)]

    monkeypatch.setattr("app.services.broadcast_service.Redis", FakeRedis)
    monkeypatch.setattr("app.services.broadcast_service.Queue", FakeQueue)
    monkeypatch.setattr("app.services.broadcast_service.GuardianRepository", FakeGuardianRepo)
    monkeypatch.setattr("app.services.broadcast_service.StudentRepository", FakeStudentRepo)

    service = BroadcastService(MagicMock())
    payload = BroadcastCreate(
        subject="Cambio",
        message="Salida anticipada",
        template=NotificationType.CAMBIO_HORARIO,
        audience=BroadcastAudience(scope="global", course_ids=None),
    )

    preview = await service.preview_broadcast(payload)
    assert preview.recipients == 1

    job_id = await service.enqueue_broadcast(payload)
    assert job_id
    assert captured_jobs


@pytest.mark.anyio("asyncio")
async def test_detect_no_show_alerts(monkeypatch) -> None:
    class DummyPhotoService:
        async def store_photo(self, *args, **kwargs):
            return "key"

    monkeypatch.setattr("app.services.attendance_service.PhotoService", lambda: DummyPhotoService())

    session = MagicMock()
    service = AttendanceService(session)

    guardian = SimpleNamespace(id=10, full_name="María", students=[])
    student = SimpleNamespace(id=1, full_name="Sofía", guardians=[guardian])
    guardian.students = [student]

    schedule = SimpleNamespace(
        id=3,
        course_id=1,
        in_time=time(8, 0),
        course=SimpleNamespace(name="1° Básico A"),
    )

    service.schedule_repo.list_by_weekday = AsyncMock(return_value=[schedule])
    service.student_repo.list_by_course = AsyncMock(return_value=[student])
    service.attendance_repo.has_in_event_on_date = AsyncMock(return_value=False)
    fake_alert = SimpleNamespace(
        id=5,
        status="PENDING",
        notification_attempts=0,
        last_notification_at=None,
        course_id=schedule.course_id,
    )

    class FakeAlertRepo:
        def __init__(self):
            self.created = []

        async def get_by_unique(self, student_id, guardian_id, alert_date):
            return None

        async def create(self, **kwargs):
            self.created.append(kwargs)
            return fake_alert

    service.no_show_repo = FakeAlertRepo()

    alerts = await service.detect_no_show_alerts(datetime(2024, 1, 10, 9, 0, tzinfo=timezone.utc))
    assert len(alerts) == 1
    assert alerts[0]["alert"] is fake_alert
    assert alerts[0]["guardian"].id == guardian.id


@pytest.mark.anyio("asyncio")
async def test_alert_service_resolve(monkeypatch) -> None:
    session = MagicMock()
    session.commit = AsyncMock()

    service = AlertService(session)

    alert_obj = SimpleNamespace(
        id=1,
        student_id=1,
        guardian_id=2,
        course_id=3,
        schedule_id=None,
        alert_date=date.today(),
        alerted_at=datetime.now(timezone.utc),
        status="RESOLVED",
        resolved_at=datetime.now(timezone.utc),
        notes="",
        notification_attempts=1,
        last_notification_at=datetime.now(timezone.utc),
        student=SimpleNamespace(full_name="Sofía"),
        guardian=SimpleNamespace(full_name="María"),
        course=SimpleNamespace(name="1° Básico A"),
    )

    service.repository = MagicMock()
    service.repository.mark_resolved = AsyncMock(return_value=alert_obj)

    result = await service.resolve_alert(1, "ok")
    assert result.status == "RESOLVED"
    session.commit.assert_awaited()


@pytest.mark.anyio("asyncio")
async def test_dashboard_service_computes_stats(monkeypatch) -> None:
    session = MagicMock()
    service = DashboardService(session)

    service.schedule_repo = MagicMock()
    service.student_repo = MagicMock()
    service.photo_service = SimpleNamespace(generate_presigned_url=lambda key, expires=3600: f"https://cdn/{key}")

    target_date = date(2024, 1, 10)
    schedule = SimpleNamespace(course_id=1, in_time=time(8, 0))
    service.schedule_repo.list_by_weekday = AsyncMock(return_value=[schedule])

    students = [
        SimpleNamespace(id=1, course_id=1, full_name="Ana"),
        SimpleNamespace(id=2, course_id=1, full_name="Ben"),
        SimpleNamespace(id=3, course_id=1, full_name="Carla"),
    ]
    service.student_repo.list_by_course_ids = AsyncMock(return_value=students)

    events_raw = [
        (
            SimpleNamespace(
                id=10,
                student_id=1,
                type="IN",
                gate_id="G1",
                device_id="D1",
                occurred_at=datetime(2024, 1, 10, 8, 5),
                photo_ref="photos/p1",
            ),
            students[0],
            SimpleNamespace(id=1, name="1° Básico A"),
        ),
        (
            SimpleNamespace(
                id=11,
                student_id=2,
                type="IN",
                gate_id="G1",
                device_id="D1",
                occurred_at=datetime(2024, 1, 10, 8, 45),
                photo_ref=None,
            ),
            students[1],
            SimpleNamespace(id=1, name="1° Básico A"),
        ),
    ]

    async def fake_fetch_events(*args, **kwargs):
        return events_raw

    service._fetch_events = fake_fetch_events  # type: ignore

    snapshot = await service.get_snapshot(
        target_date=target_date,
        course_id=None,
        event_type=None,
        search=None,
    )

    assert snapshot.stats.total_in == 2
    assert snapshot.stats.total_out == 0
    assert snapshot.stats.late_count == 1
    assert snapshot.stats.no_in_count == 1
    assert snapshot.stats.with_photos == 1
    assert snapshot.events[0].photo_url == "https://cdn/photos/p1"


@pytest.mark.anyio("asyncio")
async def test_dashboard_service_report(monkeypatch) -> None:
    session = MagicMock()
    service = DashboardService(session)

    course = SimpleNamespace(id=1, name="1° Básico A")
    schedule = SimpleNamespace(course_id=1, in_time=time(8, 0), weekday=2)
    schedule_next = SimpleNamespace(course_id=1, in_time=time(8, 0), weekday=3)
    students = [
        SimpleNamespace(id=1, course_id=1, full_name="Ana"),
        SimpleNamespace(id=2, course_id=1, full_name="Ben"),
    ]

    service.schedule_repo.list_by_course_ids = AsyncMock(return_value=[schedule, schedule_next])
    service.student_repo.list_by_course_ids = AsyncMock(return_value=students)

    events_raw = [
        (
            SimpleNamespace(
                student_id=1,
                type="IN",
                gate_id="G1",
                device_id="D1",
                occurred_at=datetime(2024, 1, 10, 8, 5),
                photo_ref=None,
            ),
            students[0],
            course,
        ),
        (
            SimpleNamespace(
                student_id=2,
                type="IN",
                gate_id="G1",
                device_id="D1",
                occurred_at=datetime(2024, 1, 10, 8, 45),
                photo_ref=None,
            ),
            students[1],
            course,
        ),
        (
            SimpleNamespace(
                student_id=1,
                type="IN",
                gate_id="G1",
                device_id="D1",
                occurred_at=datetime(2024, 1, 11, 8, 0),
                photo_ref=None,
            ),
            students[0],
            course,
        ),
    ]

    course_result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [course]))
    events_result = SimpleNamespace(all=lambda: events_raw)
    session.execute = AsyncMock(side_effect=[course_result, events_result])

    snapshot = await service.get_report(
        start_date=date(2024, 1, 10),
        end_date=date(2024, 1, 11),
        course_id=None,
    )

    summary = snapshot.courses[0]
    assert summary.present == 3
    assert summary.absent == 1
    assert summary.late == 1
    assert summary.attendance_pct == 75.0
    assert [point.present for point in snapshot.trend] == [2, 1]


@pytest.mark.anyio("asyncio")
async def test_web_app_data_service_bootstrap(monkeypatch) -> None:
    session = MagicMock()
    service = WebAppDataService(session)

    service._resolve_student_ids = AsyncMock(return_value=[1, 2])
    service._load_students = AsyncMock(return_value=[
        SimpleNamespace(id=1, full_name="Ana", course_id=10, photo_pref_opt_in=True, guardians=[]),
        SimpleNamespace(id=2, full_name="Ben", course_id=11, photo_pref_opt_in=False, guardians=[]),
    ])
    service._load_courses = AsyncMock(return_value=[SimpleNamespace(id=10, name="1A", grade="1")])
    service._load_schedules = AsyncMock(return_value=[])
    service._load_schedule_exceptions = AsyncMock(return_value=[])
    service._load_guardians = AsyncMock(return_value=[])
    service._load_attendance_events = AsyncMock(return_value=[])
    service._load_devices = AsyncMock(return_value=[])
    service._load_absences = AsyncMock(return_value=[])
    service._load_notifications = AsyncMock(return_value=[])

    user = AuthUser(id=1, role="DIRECTOR", full_name="Dir", guardian_id=None)
    payload = await service.build_bootstrap_payload(user)

    assert payload.current_user.role == "DIRECTOR"
    assert len(payload.students) == 2
    assert payload.courses[0].name == "1A"


@pytest.mark.anyio("asyncio")
async def test_device_service_ping_and_logs(monkeypatch) -> None:
    session = MagicMock()
    repo = MagicMock()
    device = SimpleNamespace(
        id=1,
        device_id="DEV-1",
        gate_id="G1",
        firmware_version="1.0.0",
        battery_pct=90,
        pending_events=2,
        online=False,
        last_sync=datetime(2024, 1, 10, 8, 0),
    )
    repo.get_by_id = AsyncMock(return_value=device)
    repo.touch_ping = AsyncMock(return_value=device)
    repo.list_all = AsyncMock(return_value=[device])
    session.commit = AsyncMock()

    service = DeviceService(session)
    service.repository = repo  # type: ignore

    devices = await service.list_devices()
    assert devices[0].device_id == "DEV-1"

    result = await service.ping_device(1)
    assert result.id == 1
    repo.touch_ping.assert_awaited_with(device)
    session.commit.assert_awaited()

    logs = await service.get_logs(1)
    assert any("Dispositivo DEV-1" in line for line in logs)
