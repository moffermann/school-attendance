"""Phase 3 service tests for higher coverage."""

from __future__ import annotations

from datetime import date, datetime, time, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.auth import AuthUser
from app.schemas.absences import AbsenceRequestCreate, AbsenceStatus, AbsenceType
from app.schemas.schedules import (
    ScheduleCreate,
    ScheduleExceptionCreate,
    ScheduleExceptionScope,
)
from app.services.absence_service import AbsenceService
from app.services.schedule_service import ScheduleService
from app.services.device_service import DeviceService
from app.schemas.devices import DeviceHeartbeatRequest


# =============================================================================
# Schedule Service Tests
# =============================================================================

class TestScheduleService:
    """Tests for ScheduleService."""

    @pytest.fixture
    def mock_session(self):
        session = MagicMock()
        session.commit = AsyncMock()
        return session

    @pytest.fixture
    def schedule_service(self, mock_session):
        return ScheduleService(mock_session)

    @pytest.mark.asyncio
    async def test_list_course_schedule(self, schedule_service):
        """Should list schedules for a course."""
        fake_schedules = [
            SimpleNamespace(
                id=1,
                course_id=1,
                weekday=0,
                in_time=time(8, 0),
                out_time=time(14, 0),
            )
        ]

        schedule_service.repository.list_by_course = AsyncMock(return_value=fake_schedules)

        result = await schedule_service.list_course_schedule(1)

        assert len(result) == 1
        assert result[0].weekday == 0

    @pytest.mark.asyncio
    async def test_create_schedule(self, schedule_service, mock_session):
        """Should create a schedule."""
        fake_schedule = SimpleNamespace(
            id=1,
            course_id=1,
            weekday=1,
            in_time=time(8, 30),
            out_time=time(14, 30),
        )

        schedule_service.repository.create = AsyncMock(return_value=fake_schedule)

        payload = ScheduleCreate(weekday=1, in_time=time(8, 30), out_time=time(14, 30))
        result = await schedule_service.create_schedule(1, payload)

        assert result.weekday == 1
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_schedule_entry(self, schedule_service, mock_session):
        """Should update a schedule."""
        fake_schedule = SimpleNamespace(
            id=1,
            course_id=1,
            weekday=2,
            in_time=time(9, 0),
            out_time=time(15, 0),
        )

        schedule_service.repository.update = AsyncMock(return_value=fake_schedule)

        payload = ScheduleCreate(weekday=2, in_time=time(9, 0), out_time=time(15, 0))
        result = await schedule_service.update_schedule_entry(1, payload)

        assert result.weekday == 2
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_exception(self, schedule_service, mock_session):
        """Should create a schedule exception."""
        fake_exception = SimpleNamespace(
            id=1,
            scope="GLOBAL",
            date=date(2025, 12, 25),
            course_id=None,
            in_time=None,
            out_time=None,
            reason="Navidad",
            created_by=None,
        )

        schedule_service.repository.create_exception = AsyncMock(return_value=fake_exception)

        payload = ScheduleExceptionCreate(
            scope=ScheduleExceptionScope.GLOBAL,
            date=date(2025, 12, 25),
            course_id=None,
            in_time=None,
            out_time=None,
            reason="Navidad",
        )
        result = await schedule_service.create_exception(payload)

        assert result.scope == "GLOBAL"
        assert result.reason == "Navidad"
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_exception_success(self, schedule_service, mock_session):
        """Should delete a schedule exception."""
        schedule_service.repository.delete_exception = AsyncMock(return_value=True)

        await schedule_service.delete_exception(1)

        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_exception_not_found(self, schedule_service):
        """Should raise error when exception not found."""
        schedule_service.repository.delete_exception = AsyncMock(return_value=False)

        with pytest.raises(ValueError, match="Excepción no encontrada"):
            await schedule_service.delete_exception(999)


# =============================================================================
# Absence Service Tests
# =============================================================================

class TestAbsenceService:
    """Tests for AbsenceService."""

    @pytest.fixture
    def mock_session(self):
        session = MagicMock()
        session.commit = AsyncMock()
        session.refresh = AsyncMock()
        return session

    @pytest.fixture
    def absence_service(self, mock_session):
        return AbsenceService(mock_session)

    @pytest.fixture
    def admin_user(self):
        return AuthUser(id=1, role="ADMIN", full_name="Admin", guardian_id=None, teacher_id=None)

    @pytest.fixture
    def parent_user(self):
        return AuthUser(id=2, role="PARENT", full_name="Parent", guardian_id=10, teacher_id=None)

    @pytest.mark.asyncio
    async def test_submit_absence_admin(self, absence_service, admin_user, mock_session):
        """Should submit absence as admin."""
        fake_student = SimpleNamespace(id=1, full_name="Student")
        fake_record = SimpleNamespace(
            id=1,
            student_id=1,
            type="SICK",
            start_date=date(2025, 1, 15),
            end_date=date(2025, 1, 16),
        )

        absence_service.student_repo.get = AsyncMock(return_value=fake_student)
        absence_service.absence_repo.create = AsyncMock(return_value=fake_record)

        payload = AbsenceRequestCreate(
            student_id=1,
            type=AbsenceType.SICK,
            start=date(2025, 1, 15),
            end=date(2025, 1, 16),
            comment="Enfermo",
        )
        result = await absence_service.submit_absence(admin_user, payload)

        assert result.student_id == 1
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_submit_absence_student_not_found(self, absence_service, admin_user):
        """Should raise error when student not found."""
        absence_service.student_repo.get = AsyncMock(return_value=None)

        payload = AbsenceRequestCreate(
            student_id=999,
            type=AbsenceType.SICK,
            start=date(2025, 1, 15),
            end=date(2025, 1, 16),
        )

        with pytest.raises(ValueError, match="Student not found"):
            await absence_service.submit_absence(admin_user, payload)

    @pytest.mark.asyncio
    async def test_submit_absence_invalid_date_range(self, absence_service, admin_user):
        """Should raise error when end date is before start date."""
        fake_student = SimpleNamespace(id=1, full_name="Student")
        absence_service.student_repo.get = AsyncMock(return_value=fake_student)

        payload = AbsenceRequestCreate(
            student_id=1,
            type=AbsenceType.SICK,
            start=date(2025, 1, 20),
            end=date(2025, 1, 15),  # Before start
        )

        with pytest.raises(ValueError, match="fecha de fin"):
            await absence_service.submit_absence(admin_user, payload)

    @pytest.mark.asyncio
    async def test_submit_absence_parent_no_guardian(self, absence_service):
        """Should raise error when parent has no guardian_id."""
        parent_no_guardian = AuthUser(id=2, role="PARENT", full_name="Parent", guardian_id=None, teacher_id=None)
        fake_student = SimpleNamespace(id=1, full_name="Student")
        absence_service.student_repo.get = AsyncMock(return_value=fake_student)

        payload = AbsenceRequestCreate(
            student_id=1,
            type=AbsenceType.SICK,
            start=date(2025, 1, 15),
            end=date(2025, 1, 16),
        )

        with pytest.raises(PermissionError, match="no asociado"):
            await absence_service.submit_absence(parent_no_guardian, payload)

    @pytest.mark.asyncio
    async def test_submit_absence_parent_guardian_not_found(self, absence_service, parent_user):
        """Should raise error when guardian not found."""
        fake_student = SimpleNamespace(id=1, full_name="Student")
        absence_service.student_repo.get = AsyncMock(return_value=fake_student)
        absence_service.guardian_repo.get = AsyncMock(return_value=None)

        payload = AbsenceRequestCreate(
            student_id=1,
            type=AbsenceType.SICK,
            start=date(2025, 1, 15),
            end=date(2025, 1, 16),
        )

        with pytest.raises(ValueError, match="Guardian not found"):
            await absence_service.submit_absence(parent_user, payload)

    @pytest.mark.asyncio
    async def test_submit_absence_parent_not_own_student(self, absence_service, parent_user):
        """Should raise error when parent tries to submit for non-owned student."""
        fake_student = SimpleNamespace(id=1, full_name="Student")
        fake_guardian = SimpleNamespace(
            id=10,
            full_name="Guardian",
            students=[SimpleNamespace(id=99)],  # Different student
        )
        absence_service.student_repo.get = AsyncMock(return_value=fake_student)
        absence_service.guardian_repo.get = AsyncMock(return_value=fake_guardian)

        payload = AbsenceRequestCreate(
            student_id=1,  # Not owned by guardian
            type=AbsenceType.SICK,
            start=date(2025, 1, 15),
            end=date(2025, 1, 16),
        )

        with pytest.raises(PermissionError, match="no pertenece"):
            await absence_service.submit_absence(parent_user, payload)

    @pytest.mark.asyncio
    async def test_submit_absence_parent_success(self, absence_service, parent_user, mock_session):
        """Should submit absence as parent for own child."""
        fake_student = SimpleNamespace(id=1, full_name="Student")
        fake_guardian = SimpleNamespace(
            id=10,
            full_name="Guardian",
            students=[SimpleNamespace(id=1)],  # Same student
        )
        fake_record = SimpleNamespace(
            id=1,
            student_id=1,
            type="SICK",
            start_date=date(2025, 1, 15),
            end_date=date(2025, 1, 16),
        )

        absence_service.student_repo.get = AsyncMock(return_value=fake_student)
        absence_service.guardian_repo.get = AsyncMock(return_value=fake_guardian)
        absence_service.absence_repo.create = AsyncMock(return_value=fake_record)

        payload = AbsenceRequestCreate(
            student_id=1,
            type=AbsenceType.SICK,
            start=date(2025, 1, 15),
            end=date(2025, 1, 16),
        )
        result = await absence_service.submit_absence(parent_user, payload)

        assert result.student_id == 1

    @pytest.mark.asyncio
    async def test_list_absences_admin(self, absence_service, admin_user):
        """Should list all absences for admin."""
        fake_records = [
            SimpleNamespace(id=1, student_id=1, start_date=date(2025, 1, 15), end_date=date(2025, 1, 16), status="PENDING"),
            SimpleNamespace(id=2, student_id=2, start_date=date(2025, 1, 17), end_date=date(2025, 1, 18), status="APPROVED"),
        ]
        absence_service.absence_repo.list_all = AsyncMock(return_value=fake_records)

        result = await absence_service.list_absences(admin_user)

        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_list_absences_filter_by_date(self, absence_service, admin_user):
        """Should filter absences by date."""
        fake_records = [
            SimpleNamespace(id=1, start_date=date(2025, 1, 15), end_date=date(2025, 1, 16), status="PENDING"),
            SimpleNamespace(id=2, start_date=date(2025, 1, 10), end_date=date(2025, 1, 11), status="PENDING"),
        ]
        absence_service.absence_repo.list_all = AsyncMock(return_value=fake_records)

        result = await absence_service.list_absences(
            admin_user,
            start_date=date(2025, 1, 14),
        )

        assert len(result) == 1
        assert result[0].id == 1

    @pytest.mark.asyncio
    async def test_list_absences_filter_by_status(self, absence_service, admin_user):
        """Should filter absences by status."""
        fake_records = [
            SimpleNamespace(id=1, start_date=date(2025, 1, 15), end_date=date(2025, 1, 16), status="PENDING"),
            SimpleNamespace(id=2, start_date=date(2025, 1, 17), end_date=date(2025, 1, 18), status="APPROVED"),
        ]
        absence_service.absence_repo.list_all = AsyncMock(return_value=fake_records)

        result = await absence_service.list_absences(admin_user, status="APPROVED")

        assert len(result) == 1
        assert result[0].status == "APPROVED"

    @pytest.mark.asyncio
    async def test_list_absences_parent_no_guardian(self, absence_service):
        """Should return empty for parent without guardian_id."""
        parent_no_guardian = AuthUser(id=2, role="PARENT", full_name="Parent", guardian_id=None, teacher_id=None)

        result = await absence_service.list_absences(parent_no_guardian)

        assert result == []

    @pytest.mark.asyncio
    async def test_list_absences_parent_guardian_not_found(self, absence_service, parent_user):
        """Should return empty when guardian not found."""
        absence_service.guardian_repo.get = AsyncMock(return_value=None)

        result = await absence_service.list_absences(parent_user)

        assert result == []

    @pytest.mark.asyncio
    async def test_list_absences_parent_success(self, absence_service, parent_user):
        """Should list absences for parent's children."""
        fake_guardian = SimpleNamespace(
            id=10,
            students=[SimpleNamespace(id=1), SimpleNamespace(id=2)],
        )
        fake_records = [
            SimpleNamespace(id=1, student_id=1, start_date=date(2025, 1, 15), end_date=date(2025, 1, 16), status="PENDING"),
        ]
        absence_service.guardian_repo.get = AsyncMock(return_value=fake_guardian)
        absence_service.absence_repo.list_by_student_ids = AsyncMock(return_value=fake_records)

        result = await absence_service.list_absences(parent_user)

        assert len(result) == 1
        absence_service.absence_repo.list_by_student_ids.assert_called_once_with([1, 2])

    @pytest.mark.asyncio
    async def test_update_status(self, absence_service, mock_session):
        """Should update absence status."""
        fake_record = SimpleNamespace(id=1, status="APPROVED")
        absence_service.absence_repo.update_status = AsyncMock(return_value=fake_record)

        result = await absence_service.update_status(1, AbsenceStatus.APPROVED)

        assert result.status == "APPROVED"
        mock_session.commit.assert_called_once()


# =============================================================================
# Device Service Tests
# =============================================================================

class TestDeviceService:
    """Tests for DeviceService."""

    @pytest.fixture
    def mock_session(self):
        session = MagicMock()
        session.commit = AsyncMock()
        return session

    @pytest.fixture
    def device_service(self, mock_session):
        return DeviceService(mock_session)

    @pytest.mark.asyncio
    async def test_list_devices(self, device_service):
        """Should list all devices."""
        fake_devices = [
            SimpleNamespace(
                id=1,
                device_id="DEV-001",
                gate_id="GATE-A",
                firmware_version="1.0.0",
                battery_pct=85,
                pending_events=0,
                online=True,
                last_sync=datetime.now(timezone.utc),
            )
        ]
        device_service.repository.list_all = AsyncMock(return_value=fake_devices)

        result = await device_service.list_devices()

        assert len(result) == 1
        assert result[0].device_id == "DEV-001"

    @pytest.mark.asyncio
    async def test_process_heartbeat(self, device_service, mock_session):
        """Should process device heartbeat."""
        from app.schemas.devices import DeviceRead

        fake_device = DeviceRead(
            id=1,
            device_id="DEV-001",
            gate_id="GATE-A",
            firmware_version="2.0.0",
            battery_pct=90,
            pending_events=5,
            online=True,
            last_sync=datetime.now(timezone.utc),
        )
        device_service.repository.upsert_heartbeat = AsyncMock(return_value=fake_device)

        payload = DeviceHeartbeatRequest(
            device_id="DEV-001",
            gate_id="GATE-A",
            firmware_version="2.0.0",
            battery_pct=90,
            pending_events=5,
            online=True,
        )
        result = await device_service.process_heartbeat(payload)

        assert result.battery_pct == 90
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_ping_device_success(self, device_service, mock_session):
        """Should ping device successfully."""
        fake_device = SimpleNamespace(
            id=1,
            device_id="DEV-001",
            gate_id="GATE-A",
            firmware_version="1.0.0",
            battery_pct=85,
            pending_events=0,
            online=True,
            last_sync=datetime.now(timezone.utc),
        )
        device_service.repository.get_by_id = AsyncMock(return_value=fake_device)
        device_service.repository.touch_ping = AsyncMock()

        result = await device_service.ping_device(1)

        assert result.device_id == "DEV-001"
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_ping_device_not_found(self, device_service):
        """Should raise error when device not found."""
        device_service.repository.get_by_id = AsyncMock(return_value=None)

        with pytest.raises(ValueError, match="no encontrado"):
            await device_service.ping_device(999)

    @pytest.mark.asyncio
    async def test_get_logs_success(self, device_service):
        """Should get device logs."""
        fake_device = SimpleNamespace(
            id=1,
            device_id="DEV-001",
            pending_events=3,
            battery_pct=85,
            last_sync=datetime.now(timezone.utc),
        )
        device_service.repository.get_by_id = AsyncMock(return_value=fake_device)

        result = await device_service.get_logs(1)

        assert len(result) == 3
        assert "DEV-001" in result[0]

    @pytest.mark.asyncio
    async def test_get_logs_device_not_found(self, device_service):
        """Should raise error when device not found."""
        device_service.repository.get_by_id = AsyncMock(return_value=None)

        with pytest.raises(ValueError, match="no encontrado"):
            await device_service.get_logs(999)

    @pytest.mark.asyncio
    async def test_get_logs_no_last_sync(self, device_service):
        """Should handle device with no last_sync."""
        fake_device = SimpleNamespace(
            id=1,
            device_id="DEV-001",
            pending_events=0,
            battery_pct=100,
            last_sync=None,  # No sync yet
        )
        device_service.repository.get_by_id = AsyncMock(return_value=fake_device)

        result = await device_service.get_logs(1)

        assert len(result) == 3
        assert "N/A" in result[0]
