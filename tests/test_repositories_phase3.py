"""Phase 3 extended repository tests for higher coverage."""

from __future__ import annotations

from datetime import date, datetime, time, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.absence_request import AbsenceRequest
from app.db.models.course import Course
from app.db.models.device import Device
from app.db.models.schedule import Schedule
from app.db.models.schedule_exception import ScheduleException
from app.db.models.student import Student
from app.db.models.user import User
from app.db.repositories.absences import AbsenceRepository
from app.db.repositories.devices import DeviceRepository
from app.db.repositories.schedules import ScheduleRepository
from app.db.repositories.users import UserRepository


# =============================================================================
# Absence Repository Tests
# =============================================================================

class TestAbsenceRepository:
    """Tests for AbsenceRepository."""

    @pytest.fixture
    async def absence_repo(self, db_session: AsyncSession) -> AbsenceRepository:
        return AbsenceRepository(db_session)

    @pytest.fixture
    async def sample_student_for_absence(self, db_session: AsyncSession, sample_course: Course) -> Student:
        student = Student(full_name="Test Student", course_id=sample_course.id)
        db_session.add(student)
        await db_session.flush()
        return student

    @pytest.mark.asyncio
    async def test_create_absence(self, absence_repo, sample_student_for_absence):
        """Should create an absence request."""
        absence = await absence_repo.create(
            student_id=sample_student_for_absence.id,
            type_="SICK",
            start_date=date(2025, 1, 15),
            end_date=date(2025, 1, 16),
            comment="Enfermo con gripe",
            attachment_ref=None,
            submitted_at=datetime.now(timezone.utc),
        )
        assert absence.id is not None
        assert absence.type == "SICK"
        assert absence.student_id == sample_student_for_absence.id

    @pytest.mark.asyncio
    async def test_list_all_absences(self, absence_repo, sample_student_for_absence):
        """Should list all absences."""
        await absence_repo.create(
            student_id=sample_student_for_absence.id,
            type_="SICK",
            start_date=date(2025, 1, 15),
            end_date=date(2025, 1, 16),
            comment=None,
            attachment_ref=None,
            submitted_at=datetime.now(timezone.utc),
        )

        absences = await absence_repo.list_all()
        assert len(absences) >= 1

    @pytest.mark.asyncio
    async def test_list_by_student_ids(self, absence_repo, sample_student_for_absence):
        """Should list absences by student IDs."""
        await absence_repo.create(
            student_id=sample_student_for_absence.id,
            type_="VACATION",
            start_date=date(2025, 2, 1),
            end_date=date(2025, 2, 5),
            comment=None,
            attachment_ref=None,
            submitted_at=datetime.now(timezone.utc),
        )

        absences = await absence_repo.list_by_student_ids([sample_student_for_absence.id])
        assert len(absences) >= 1
        assert all(a.student_id == sample_student_for_absence.id for a in absences)

    @pytest.mark.asyncio
    async def test_list_by_student_ids_empty(self, absence_repo):
        """Should return empty list for empty student IDs."""
        absences = await absence_repo.list_by_student_ids([])
        assert absences == []

    @pytest.mark.asyncio
    async def test_update_status(self, absence_repo, sample_student_for_absence):
        """Should update absence status."""
        absence = await absence_repo.create(
            student_id=sample_student_for_absence.id,
            type_="OTHER",
            start_date=date(2025, 3, 1),
            end_date=date(2025, 3, 1),
            comment="Cita médica",
            attachment_ref=None,
            submitted_at=datetime.now(timezone.utc),
        )

        updated = await absence_repo.update_status(absence.id, "APPROVED")
        assert updated.status == "APPROVED"

    @pytest.mark.asyncio
    async def test_update_status_not_found(self, absence_repo):
        """Should raise error for non-existent absence."""
        with pytest.raises(ValueError, match="Solicitud no encontrada"):
            await absence_repo.update_status(99999, "APPROVED")


# =============================================================================
# Schedule Repository Tests
# =============================================================================

class TestScheduleRepository:
    """Tests for ScheduleRepository."""

    @pytest.fixture
    async def schedule_repo(self, db_session: AsyncSession) -> ScheduleRepository:
        return ScheduleRepository(db_session)

    @pytest.mark.asyncio
    async def test_create_schedule(self, schedule_repo, sample_course):
        """Should create a schedule."""
        schedule = await schedule_repo.create(
            sample_course.id,
            weekday=1,  # Tuesday
            in_time=time(8, 30),
            out_time=time(14, 0),
        )
        assert schedule.id is not None
        assert schedule.weekday == 1
        assert schedule.in_time == time(8, 30)

    @pytest.mark.asyncio
    async def test_list_by_course(self, schedule_repo, sample_course):
        """Should list schedules by course."""
        await schedule_repo.create(sample_course.id, weekday=0, in_time=time(8, 0), out_time=time(13, 0))
        await schedule_repo.create(sample_course.id, weekday=1, in_time=time(8, 0), out_time=time(13, 0))

        schedules = await schedule_repo.list_by_course(sample_course.id)
        assert len(schedules) >= 2

    @pytest.mark.asyncio
    async def test_update_schedule(self, schedule_repo, sample_course):
        """Should update a schedule."""
        schedule = await schedule_repo.create(
            sample_course.id,
            weekday=2,
            in_time=time(8, 0),
            out_time=time(13, 0),
        )

        updated = await schedule_repo.update(
            schedule.id,
            weekday=3,
            in_time=time(9, 0),
            out_time=time(14, 0),
        )
        assert updated.weekday == 3
        assert updated.in_time == time(9, 0)

    @pytest.mark.asyncio
    async def test_update_schedule_not_found(self, schedule_repo):
        """Should raise error for non-existent schedule."""
        with pytest.raises(ValueError, match="Horario no encontrado"):
            await schedule_repo.update(99999, in_time=time(8, 0), out_time=time(13, 0))

    @pytest.mark.asyncio
    async def test_list_by_weekday(self, schedule_repo, sample_course):
        """Should list schedules by weekday."""
        await schedule_repo.create(sample_course.id, weekday=4, in_time=time(8, 0), out_time=time(13, 0))

        schedules = await schedule_repo.list_by_weekday(4)
        assert len(schedules) >= 1
        assert all(s.weekday == 4 for s in schedules)

    @pytest.mark.asyncio
    async def test_list_by_course_ids(self, schedule_repo, sample_course):
        """Should list schedules by course IDs."""
        await schedule_repo.create(sample_course.id, weekday=3, in_time=time(8, 0), out_time=time(13, 0))

        schedules = await schedule_repo.list_by_course_ids({sample_course.id})
        assert len(schedules) >= 1

    @pytest.mark.asyncio
    async def test_list_by_course_ids_empty(self, schedule_repo):
        """Should return empty list for empty course IDs."""
        schedules = await schedule_repo.list_by_course_ids(set())
        assert schedules == []

    @pytest.mark.asyncio
    async def test_create_exception(self, schedule_repo, sample_course):
        """Should create a schedule exception."""
        exception = await schedule_repo.create_exception(
            scope="COURSE",
            date=date(2025, 12, 25),
            course_id=sample_course.id,
            in_time=None,
            out_time=None,
            reason="Navidad",
            created_by=None,
        )
        assert exception.id is not None
        assert exception.reason == "Navidad"

    @pytest.mark.asyncio
    async def test_delete_exception(self, schedule_repo, sample_course):
        """Should delete a schedule exception."""
        exception = await schedule_repo.create_exception(
            scope="GLOBAL",
            date=date(2025, 9, 18),
            course_id=None,
            in_time=None,
            out_time=None,
            reason="Fiestas Patrias",
            created_by=None,
        )

        result = await schedule_repo.delete_exception(exception.id)
        assert result is True

    @pytest.mark.asyncio
    async def test_delete_exception_not_found(self, schedule_repo):
        """Should return False for non-existent exception."""
        result = await schedule_repo.delete_exception(99999)
        assert result is False


# =============================================================================
# Device Repository Tests
# =============================================================================

class TestDeviceRepository:
    """Tests for DeviceRepository."""

    @pytest.fixture
    async def device_repo(self, db_session: AsyncSession) -> DeviceRepository:
        return DeviceRepository(db_session)

    @pytest.mark.asyncio
    async def test_get_device(self, device_repo, sample_device):
        """Should get device by device_id."""
        result = await device_repo.get_by_device_id(sample_device.device_id)
        assert result is not None
        assert result.device_id == sample_device.device_id

    @pytest.mark.asyncio
    async def test_get_device_not_found(self, device_repo):
        """Should return None for non-existent device."""
        result = await device_repo.get_by_device_id("NON-EXISTENT")
        assert result is None

    @pytest.mark.asyncio
    async def test_list_all_devices(self, device_repo, sample_device):
        """Should list all devices."""
        devices = await device_repo.list_all()
        assert len(devices) >= 1

    @pytest.mark.asyncio
    async def test_upsert_heartbeat(self, device_repo, sample_device):
        """Should upsert device heartbeat."""
        updated = await device_repo.upsert_heartbeat(
            device_id=sample_device.device_id,
            gate_id=sample_device.gate_id,
            battery_pct=75,
            pending_events=5,
            online=True,
            firmware_version="2.0.0",
        )
        assert updated.battery_pct == 75
        assert updated.pending_events == 5
        assert updated.firmware_version == "2.0.0"


# =============================================================================
# User Repository Tests
# =============================================================================

class TestUserRepository:
    """Tests for UserRepository."""

    @pytest.fixture
    async def user_repo(self, db_session: AsyncSession) -> UserRepository:
        return UserRepository(db_session)

    @pytest.fixture
    async def sample_user(self, db_session: AsyncSession) -> User:
        user = User(
            email="testuser@example.com",
            hashed_password="hashed123",
            full_name="Test User",
            role="ADMIN",
            is_active=True,
        )
        db_session.add(user)
        await db_session.flush()
        return user

    @pytest.mark.asyncio
    async def test_get_user(self, user_repo, sample_user):
        """Should get user by ID."""
        result = await user_repo.get(sample_user.id)
        assert result is not None
        assert result.email == "testuser@example.com"

    @pytest.mark.asyncio
    async def test_get_user_not_found(self, user_repo):
        """Should return None for non-existent user."""
        result = await user_repo.get(99999)
        assert result is None

    @pytest.mark.asyncio
    async def test_get_by_email(self, user_repo, sample_user):
        """Should get user by email."""
        result = await user_repo.get_by_email("testuser@example.com")
        assert result is not None
        assert result.id == sample_user.id

    @pytest.mark.asyncio
    async def test_get_by_email_not_found(self, user_repo):
        """Should return None for non-existent email."""
        result = await user_repo.get_by_email("nonexistent@example.com")
        assert result is None

    @pytest.mark.asyncio
    async def test_create_user(self, user_repo):
        """Should create a new user."""
        user = await user_repo.create(
            email="newuser@example.com",
            hashed_password="hashedpwd",
            full_name="New User",
            role="TEACHER",
        )
        assert user.id is not None
        assert user.email == "newuser@example.com"
        assert user.role == "TEACHER"
