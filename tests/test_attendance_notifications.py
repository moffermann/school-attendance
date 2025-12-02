"""Tests for attendance notification service."""

from __future__ import annotations

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.attendance_event import AttendanceEvent
from app.db.models.guardian import Guardian
from app.db.models.student import Student
from app.db.models.course import Course
from app.db.models.associations import student_guardian_table
from app.services.attendance_notification_service import AttendanceNotificationService


@pytest.fixture
async def student_with_photo_consent(
    db_session: AsyncSession, sample_course: Course, sample_guardian: Guardian
) -> Student:
    """Create a student with photo consent enabled."""
    student = Student(
        full_name="Ana López",
        course_id=sample_course.id,
        photo_pref_opt_in=True,
    )
    db_session.add(student)
    await db_session.flush()

    # Associate guardian
    await db_session.execute(
        student_guardian_table.insert().values(
            student_id=student.id,
            guardian_id=sample_guardian.id,
        )
    )
    await db_session.flush()
    await db_session.refresh(student, attribute_names=["guardians"])

    return student


@pytest.fixture
async def student_without_photo_consent(
    db_session: AsyncSession, sample_course: Course, sample_guardian: Guardian
) -> Student:
    """Create a student with photo consent disabled."""
    student = Student(
        full_name="Carlos Ruiz",
        course_id=sample_course.id,
        photo_pref_opt_in=False,
    )
    db_session.add(student)
    await db_session.flush()

    # Associate guardian
    await db_session.execute(
        student_guardian_table.insert().values(
            student_id=student.id,
            guardian_id=sample_guardian.id,
        )
    )
    await db_session.flush()
    await db_session.refresh(student, attribute_names=["guardians"])

    return student


@pytest.fixture
async def guardian_with_whatsapp_enabled(db_session: AsyncSession) -> Guardian:
    """Create a guardian with WhatsApp notifications enabled."""
    guardian = Guardian(
        full_name="Roberto García",
        contacts={"whatsapp": "+56987654321", "email": "roberto@example.com"},
        notification_prefs={
            "INGRESO_OK": {"whatsapp": True, "email": False},
            "SALIDA_OK": {"whatsapp": True, "email": False},
        },
    )
    db_session.add(guardian)
    await db_session.flush()
    return guardian


@pytest.fixture
async def guardian_with_notifications_disabled(db_session: AsyncSession) -> Guardian:
    """Create a guardian with all notifications disabled."""
    guardian = Guardian(
        full_name="Laura Soto",
        contacts={"whatsapp": "+56911111111"},
        notification_prefs={
            "INGRESO_OK": {"whatsapp": False, "email": False},
            "SALIDA_OK": {"whatsapp": False, "email": False},
        },
    )
    db_session.add(guardian)
    await db_session.flush()
    return guardian


@pytest.fixture
async def attendance_event(db_session: AsyncSession, sample_student: Student) -> AttendanceEvent:
    """Create a sample attendance event."""
    event = AttendanceEvent(
        student_id=sample_student.id,
        type="IN",
        gate_id="GATE-A",
        device_id="DEV-01",
        occurred_at=datetime.utcnow(),
    )
    db_session.add(event)
    await db_session.flush()
    return event


class TestAttendanceNotificationService:
    """Tests for AttendanceNotificationService."""

    @pytest.mark.asyncio
    async def test_notify_sends_whatsapp_for_entry_event(
        self,
        db_session: AsyncSession,
        sample_student: Student,
        sample_guardian: Guardian,
    ):
        """Test that entry events trigger WhatsApp notifications."""
        # Update guardian with WhatsApp prefs
        sample_guardian.notification_prefs = {
            "INGRESO_OK": {"whatsapp": True},
        }
        await db_session.flush()

        event = AttendanceEvent(
            student_id=sample_student.id,
            type="IN",
            gate_id="GATE-A",
            device_id="DEV-01",
            occurred_at=datetime.utcnow(),
        )
        db_session.add(event)
        await db_session.flush()

        with patch.object(
            AttendanceNotificationService, "_enqueue_notification"
        ) as mock_enqueue:
            service = AttendanceNotificationService(db_session)
            notification_ids = await service.notify_attendance_event(event)
            await db_session.commit()

            # Should have created at least one notification
            assert len(notification_ids) >= 1
            mock_enqueue.assert_called()

    @pytest.mark.asyncio
    async def test_notify_sends_whatsapp_for_exit_event(
        self,
        db_session: AsyncSession,
        sample_student: Student,
        sample_guardian: Guardian,
    ):
        """Test that exit events trigger WhatsApp notifications."""
        sample_guardian.notification_prefs = {
            "SALIDA_OK": {"whatsapp": True},
        }
        await db_session.flush()

        event = AttendanceEvent(
            student_id=sample_student.id,
            type="OUT",
            gate_id="GATE-A",
            device_id="DEV-01",
            occurred_at=datetime.utcnow(),
        )
        db_session.add(event)
        await db_session.flush()

        with patch.object(
            AttendanceNotificationService, "_enqueue_notification"
        ) as mock_enqueue:
            service = AttendanceNotificationService(db_session)
            notification_ids = await service.notify_attendance_event(event)
            await db_session.commit()

            assert len(notification_ids) >= 1
            mock_enqueue.assert_called()

    @pytest.mark.asyncio
    async def test_no_notification_when_disabled(
        self,
        db_session: AsyncSession,
        sample_course: Course,
        guardian_with_notifications_disabled: Guardian,
    ):
        """Test that no notifications are sent when disabled."""
        student = Student(
            full_name="Test Student",
            course_id=sample_course.id,
        )
        db_session.add(student)
        await db_session.flush()

        await db_session.execute(
            student_guardian_table.insert().values(
                student_id=student.id,
                guardian_id=guardian_with_notifications_disabled.id,
            )
        )
        await db_session.flush()

        event = AttendanceEvent(
            student_id=student.id,
            type="IN",
            gate_id="GATE-A",
            device_id="DEV-01",
            occurred_at=datetime.utcnow(),
        )
        db_session.add(event)
        await db_session.flush()

        with patch.object(
            AttendanceNotificationService, "_enqueue_notification"
        ) as mock_enqueue:
            service = AttendanceNotificationService(db_session)
            notification_ids = await service.notify_attendance_event(event)
            await db_session.commit()

            # No notifications should be created
            assert len(notification_ids) == 0
            mock_enqueue.assert_not_called()

    @pytest.mark.asyncio
    async def test_photo_url_included_when_student_consents(
        self,
        db_session: AsyncSession,
        sample_course: Course,
        guardian_with_whatsapp_enabled: Guardian,
    ):
        """Test that photo URL is included when student has photo consent."""
        student = Student(
            full_name="Photo Consent Student",
            course_id=sample_course.id,
            photo_pref_opt_in=True,
        )
        db_session.add(student)
        await db_session.flush()

        await db_session.execute(
            student_guardian_table.insert().values(
                student_id=student.id,
                guardian_id=guardian_with_whatsapp_enabled.id,
            )
        )
        await db_session.flush()

        event = AttendanceEvent(
            student_id=student.id,
            type="IN",
            gate_id="GATE-A",
            device_id="DEV-01",
            occurred_at=datetime.utcnow(),
            photo_ref="events/123/photo.jpg",
        )
        db_session.add(event)
        await db_session.flush()

        captured_payloads = []

        def capture_enqueue(*args, **kwargs):
            captured_payloads.append(kwargs.get("payload", args[-1] if args else {}))

        with patch.object(
            AttendanceNotificationService,
            "_enqueue_notification",
            side_effect=capture_enqueue,
        ):
            service = AttendanceNotificationService(db_session)
            photo_url = "https://example.com/signed-photo-url"
            await service.notify_attendance_event(event, photo_url=photo_url)
            await db_session.commit()

            # Check that payload includes photo
            assert len(captured_payloads) > 0
            payload = captured_payloads[0]
            assert payload.get("photo_url") == photo_url
            assert payload.get("has_photo") is True

    @pytest.mark.asyncio
    async def test_photo_url_excluded_when_student_no_consent(
        self,
        db_session: AsyncSession,
        sample_course: Course,
        guardian_with_whatsapp_enabled: Guardian,
    ):
        """Test that photo URL is excluded when student has no photo consent."""
        student = Student(
            full_name="No Photo Consent Student",
            course_id=sample_course.id,
            photo_pref_opt_in=False,
        )
        db_session.add(student)
        await db_session.flush()

        await db_session.execute(
            student_guardian_table.insert().values(
                student_id=student.id,
                guardian_id=guardian_with_whatsapp_enabled.id,
            )
        )
        await db_session.flush()

        event = AttendanceEvent(
            student_id=student.id,
            type="IN",
            gate_id="GATE-A",
            device_id="DEV-01",
            occurred_at=datetime.utcnow(),
        )
        db_session.add(event)
        await db_session.flush()

        captured_payloads = []

        def capture_enqueue(*args, **kwargs):
            captured_payloads.append(kwargs.get("payload", args[-1] if args else {}))

        with patch.object(
            AttendanceNotificationService,
            "_enqueue_notification",
            side_effect=capture_enqueue,
        ):
            service = AttendanceNotificationService(db_session)
            # Try to send with photo URL - should be excluded
            await service.notify_attendance_event(
                event, photo_url="https://example.com/photo.jpg"
            )
            await db_session.commit()

            # Photo should not be included due to no consent
            assert len(captured_payloads) > 0
            payload = captured_payloads[0]
            assert payload.get("photo_url") is None
            assert payload.get("has_photo") is False

    @pytest.mark.asyncio
    async def test_no_guardians_returns_empty(
        self,
        db_session: AsyncSession,
        sample_course: Course,
    ):
        """Test that students without guardians return empty list."""
        student = Student(
            full_name="Orphan Student",
            course_id=sample_course.id,
        )
        db_session.add(student)
        await db_session.flush()

        event = AttendanceEvent(
            student_id=student.id,
            type="IN",
            gate_id="GATE-A",
            device_id="DEV-01",
            occurred_at=datetime.utcnow(),
        )
        db_session.add(event)
        await db_session.flush()

        service = AttendanceNotificationService(db_session)
        notification_ids = await service.notify_attendance_event(event)

        assert notification_ids == []

    @pytest.mark.asyncio
    async def test_payload_contains_required_fields(
        self,
        db_session: AsyncSession,
        sample_student: Student,
        sample_guardian: Guardian,
    ):
        """Test that notification payload contains all required fields."""
        sample_guardian.notification_prefs = {"INGRESO_OK": {"whatsapp": True}}
        await db_session.flush()

        occurred_at = datetime(2024, 3, 15, 8, 30, 0)
        event = AttendanceEvent(
            student_id=sample_student.id,
            type="IN",
            gate_id="GATE-A",
            device_id="DEV-01",
            occurred_at=occurred_at,
        )
        db_session.add(event)
        await db_session.flush()

        captured_payloads = []

        def capture_enqueue(*args, **kwargs):
            captured_payloads.append(kwargs.get("payload", args[-1] if args else {}))

        with patch.object(
            AttendanceNotificationService,
            "_enqueue_notification",
            side_effect=capture_enqueue,
        ):
            service = AttendanceNotificationService(db_session)
            await service.notify_attendance_event(event)
            await db_session.commit()

            assert len(captured_payloads) > 0
            payload = captured_payloads[0]

            # Verify required fields
            assert "student_name" in payload
            assert "student_id" in payload
            assert "type" in payload
            assert "event_id" in payload
            assert "occurred_at" in payload
            assert "date" in payload
            assert "time" in payload
            assert payload["student_name"] == sample_student.full_name
            assert payload["type"] == "IN"
            assert payload["date"] == "15/03/2024"
            assert payload["time"] == "08:30"
