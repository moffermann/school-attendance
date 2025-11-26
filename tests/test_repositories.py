"""Tests for database repositories."""

from __future__ import annotations

from datetime import datetime, date, time, timezone, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repositories.attendance import AttendanceRepository
from app.db.repositories.tags import TagRepository
from app.db.repositories.devices import DeviceRepository
from app.db.repositories.no_show_alerts import NoShowAlertRepository
from app.db.repositories.students import StudentRepository
from app.db.repositories.schedules import ScheduleRepository
from app.db.models.student import Student
from app.db.models.course import Course
from app.db.models.guardian import Guardian


# ============================================================================
# AttendanceRepository Tests
# ============================================================================

@pytest.mark.asyncio
async def test_attendance_repo_create_event(db_session: AsyncSession, sample_student: Student):
    """Test creating an attendance event."""
    repo = AttendanceRepository(db_session)

    event = await repo.create_event(
        student_id=sample_student.id,
        event_type="IN",
        gate_id="GATE-A",
        device_id="DEV-001",
        occurred_at=datetime.now(timezone.utc),
    )

    assert event.id is not None
    assert event.student_id == sample_student.id
    assert event.type == "IN"
    assert event.gate_id == "GATE-A"


@pytest.mark.asyncio
async def test_attendance_repo_list_by_student(db_session: AsyncSession, sample_student: Student):
    """Test listing events for a student."""
    repo = AttendanceRepository(db_session)

    # Create multiple events
    for i in range(3):
        await repo.create_event(
            student_id=sample_student.id,
            event_type="IN" if i % 2 == 0 else "OUT",
            gate_id="GATE-A",
            device_id="DEV-001",
            occurred_at=datetime.now(timezone.utc) - timedelta(hours=i),
        )

    events = await repo.list_by_student(sample_student.id)

    assert len(events) == 3
    # Should be ordered by occurred_at desc
    assert events[0].occurred_at > events[1].occurred_at


@pytest.mark.asyncio
async def test_attendance_repo_has_in_event_on_date(db_session: AsyncSession, sample_student: Student):
    """Test checking for IN event on a specific date."""
    repo = AttendanceRepository(db_session)

    today = date.today()

    # Initially no event
    has_in = await repo.has_in_event_on_date(sample_student.id, today)
    assert has_in is False

    # Create IN event
    await repo.create_event(
        student_id=sample_student.id,
        event_type="IN",
        gate_id="GATE-A",
        device_id="DEV-001",
        occurred_at=datetime.combine(today, time(8, 30)),
    )

    # Now should have IN event
    has_in = await repo.has_in_event_on_date(sample_student.id, today)
    assert has_in is True


@pytest.mark.asyncio
async def test_attendance_repo_update_photo_ref(db_session: AsyncSession, sample_student: Student):
    """Test updating photo reference on an event."""
    repo = AttendanceRepository(db_session)

    event = await repo.create_event(
        student_id=sample_student.id,
        event_type="IN",
        gate_id="GATE-A",
        device_id="DEV-001",
        occurred_at=datetime.now(timezone.utc),
    )

    assert event.photo_ref is None

    updated = await repo.update_photo_ref(event.id, "photos/test.jpg")

    assert updated.photo_ref == "photos/test.jpg"


# ============================================================================
# TagRepository Tests
# ============================================================================

@pytest.mark.asyncio
async def test_tag_repo_create_pending(db_session: AsyncSession, sample_student: Student):
    """Test creating a pending tag."""
    repo = TagRepository(db_session)

    tag = await repo.create_pending(
        student_id=sample_student.id,
        tag_hash="abc123hash",
        tag_preview="abc1**",
    )

    assert tag.id is not None
    assert tag.student_id == sample_student.id
    assert tag.status == "PENDING"
    assert tag.tag_token_hash == "abc123hash"


@pytest.mark.asyncio
async def test_tag_repo_get_by_preview(db_session: AsyncSession, sample_student: Student):
    """Test finding tag by preview."""
    repo = TagRepository(db_session)

    await repo.create_pending(
        student_id=sample_student.id,
        tag_hash="abc123hash",
        tag_preview="abc1**",
    )

    # Find the tag
    found = await repo.get_by_preview(sample_student.id, "abc1**")
    assert found is not None
    assert found.tag_token_hash == "abc123hash"

    # Non-existent preview returns None
    not_found = await repo.get_by_preview(sample_student.id, "xyz999")
    assert not_found is None


@pytest.mark.asyncio
async def test_tag_repo_confirm_by_preview_atomic(db_session: AsyncSession, sample_student: Student):
    """Test atomic confirmation of a tag."""
    repo = TagRepository(db_session)

    await repo.create_pending(
        student_id=sample_student.id,
        tag_hash="abc123hash",
        tag_preview="abc1**",
    )

    # Atomically confirm
    confirmed = await repo.confirm_by_preview_atomic(
        sample_student.id,
        "abc1**",
        tag_uid="NFC-UID-123",
    )

    assert confirmed is not None
    assert confirmed.status == "ACTIVE"
    assert confirmed.tag_uid == "NFC-UID-123"


@pytest.mark.asyncio
async def test_tag_repo_revoke(db_session: AsyncSession, sample_student: Student):
    """Test revoking a tag."""
    repo = TagRepository(db_session)

    tag = await repo.create_pending(
        student_id=sample_student.id,
        tag_hash="abc123hash",
        tag_preview="abc1**",
    )

    revoked = await repo.revoke(tag.id)

    assert revoked.status == "REVOKED"
    assert revoked.revoked_at is not None


# ============================================================================
# DeviceRepository Tests
# ============================================================================

@pytest.mark.asyncio
async def test_device_repo_upsert_creates_new(db_session: AsyncSession):
    """Test upsert creates a new device when it doesn't exist."""
    repo = DeviceRepository(db_session)

    device = await repo.upsert_heartbeat(
        device_id="NEW-DEV-001",
        gate_id="GATE-B",
        firmware_version="2.0.0",
        battery_pct=95,
        pending_events=5,
        online=True,
    )

    assert device.id is not None
    assert device.device_id == "NEW-DEV-001"
    assert device.gate_id == "GATE-B"


@pytest.mark.asyncio
async def test_device_repo_upsert_updates_existing(db_session: AsyncSession, sample_device):
    """Test upsert updates an existing device."""
    repo = DeviceRepository(db_session)

    # Update the existing device
    device = await repo.upsert_heartbeat(
        device_id=sample_device.device_id,
        gate_id="GATE-C",  # Changed
        firmware_version="2.0.0",  # Changed
        battery_pct=50,  # Changed
        pending_events=10,
        online=False,
    )

    assert device.id == sample_device.id  # Same device
    assert device.gate_id == "GATE-C"
    assert device.firmware_version == "2.0.0"
    assert device.battery_pct == 50


@pytest.mark.asyncio
async def test_device_repo_list_all(db_session: AsyncSession, sample_device):
    """Test listing all devices."""
    repo = DeviceRepository(db_session)

    devices = await repo.list_all()

    assert len(devices) >= 1
    assert any(d.device_id == sample_device.device_id for d in devices)


# ============================================================================
# NoShowAlertRepository Tests
# ============================================================================

@pytest.mark.asyncio
async def test_no_show_alert_repo_get_or_create_creates(
    db_session: AsyncSession, sample_student: Student, sample_guardian: Guardian, sample_course: Course
):
    """Test get_or_create creates new alert when it doesn't exist."""
    repo = NoShowAlertRepository(db_session)

    alert, created = await repo.get_or_create(
        student_id=sample_student.id,
        guardian_id=sample_guardian.id,
        course_id=sample_course.id,
        schedule_id=None,
        alert_date=date.today(),
        alerted_at=datetime.now(timezone.utc),
    )

    assert created is True
    assert alert.id is not None
    assert alert.status == "PENDING"


@pytest.mark.asyncio
async def test_no_show_alert_repo_get_or_create_gets_existing(
    db_session: AsyncSession, sample_student: Student, sample_guardian: Guardian, sample_course: Course
):
    """Test get_or_create returns existing alert when it exists."""
    repo = NoShowAlertRepository(db_session)
    today = date.today()

    # Create first
    alert1, created1 = await repo.get_or_create(
        student_id=sample_student.id,
        guardian_id=sample_guardian.id,
        course_id=sample_course.id,
        schedule_id=None,
        alert_date=today,
        alerted_at=datetime.now(timezone.utc),
    )

    # Try to create again - should return existing
    alert2, created2 = await repo.get_or_create(
        student_id=sample_student.id,
        guardian_id=sample_guardian.id,
        course_id=sample_course.id,
        schedule_id=None,
        alert_date=today,
        alerted_at=datetime.now(timezone.utc),
    )

    assert created1 is True
    assert created2 is False
    assert alert1.id == alert2.id


@pytest.mark.asyncio
async def test_no_show_alert_repo_mark_resolved(
    db_session: AsyncSession, sample_student: Student, sample_guardian: Guardian, sample_course: Course
):
    """Test marking an alert as resolved."""
    repo = NoShowAlertRepository(db_session)

    alert, _ = await repo.get_or_create(
        student_id=sample_student.id,
        guardian_id=sample_guardian.id,
        course_id=sample_course.id,
        schedule_id=None,
        alert_date=date.today(),
        alerted_at=datetime.now(timezone.utc),
    )

    resolved = await repo.mark_resolved(
        alert.id,
        notes="Student arrived late",
        resolved_at=datetime.now(timezone.utc),
    )

    assert resolved.status == "RESOLVED"
    assert resolved.notes == "Student arrived late"
    assert resolved.resolved_at is not None


# ============================================================================
# StudentRepository Tests
# ============================================================================

@pytest.mark.asyncio
async def test_student_repo_get(db_session: AsyncSession, sample_student: Student):
    """Test getting a student by ID."""
    repo = StudentRepository(db_session)

    student = await repo.get(sample_student.id)

    assert student is not None
    assert student.full_name == sample_student.full_name


@pytest.mark.asyncio
async def test_student_repo_list_by_course(db_session: AsyncSession, sample_student: Student, sample_course: Course):
    """Test listing students by course with guardians eager loaded."""
    repo = StudentRepository(db_session)

    students = await repo.list_by_course(sample_course.id)

    assert len(students) >= 1
    assert any(s.id == sample_student.id for s in students)
    # Guardians should be loaded
    for student in students:
        assert hasattr(student, "guardians")


# ============================================================================
# ScheduleRepository Tests
# ============================================================================

@pytest.mark.asyncio
async def test_schedule_repo_list_by_weekday(db_session: AsyncSession, sample_schedule):
    """Test listing schedules by weekday with course eager loaded."""
    repo = ScheduleRepository(db_session)

    schedules = await repo.list_by_weekday(0)  # Monday

    assert len(schedules) >= 1
    # Course should be loaded
    for schedule in schedules:
        assert schedule.course is not None


@pytest.mark.asyncio
async def test_schedule_repo_create(db_session: AsyncSession, sample_course: Course):
    """Test creating a schedule."""
    repo = ScheduleRepository(db_session)

    schedule = await repo.create(
        sample_course.id,
        weekday=2,  # Wednesday
        in_time=time(9, 0),
        out_time=time(14, 0),
    )

    assert schedule.id is not None
    assert schedule.weekday == 2
    assert schedule.in_time == time(9, 0)
