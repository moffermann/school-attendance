from __future__ import annotations

from datetime import datetime, time, timezone, date
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.schemas.attendance import AttendanceEventCreate, AttendanceType
from app.schemas.notifications import BroadcastAudience, BroadcastCreate, NotificationChannel, NotificationDispatchRequest, NotificationType
from app.schemas.schedules import ScheduleCreate
from app.services.attendance_service import AttendanceService
from app.services.notifications.dispatcher import NotificationDispatcher
from app.services.schedule_service import ScheduleService
from app.services.broadcast_service import BroadcastService
from app.services.alert_service import AlertService


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
