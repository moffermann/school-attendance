"""Attendance service implementation."""

from __future__ import annotations

from typing import List, TYPE_CHECKING

from datetime import datetime, timedelta, timezone
import uuid

from loguru import logger

from app.db.repositories.attendance import AttendanceRepository
from app.db.repositories.guardians import GuardianRepository
from app.db.repositories.schedules import ScheduleRepository
from app.db.repositories.students import StudentRepository
from app.db.repositories.no_show_alerts import NoShowAlertRepository
from app.schemas.attendance import AttendanceEventCreate, AttendanceEventRead
from app.core.config import settings
from app.services.photo_service import PhotoService

if TYPE_CHECKING:
    from app.services.attendance_notification_service import AttendanceNotificationService


class AttendanceService:
    def __init__(self, session, notification_service: AttendanceNotificationService | None = None):
        self.session = session
        self.attendance_repo = AttendanceRepository(session)
        self.student_repo = StudentRepository(session)
        self.schedule_repo = ScheduleRepository(session)
        self.guardian_repo = GuardianRepository(session)
        self.photo_service = PhotoService()
        self.no_show_repo = NoShowAlertRepository(session)
        self._notification_service = notification_service

    async def register_event(self, payload: AttendanceEventCreate) -> AttendanceEventRead:
        student = await self.student_repo.get(payload.student_id)
        if not student:
            raise ValueError("Student not found")

        event = await self.attendance_repo.create_event(
            student_id=payload.student_id,
            event_type=payload.type.value,
            gate_id=payload.gate_id,
            device_id=payload.device_id,
            occurred_at=payload.occurred_at,
            photo_ref=payload.photo_ref,
            local_seq=payload.local_seq,
        )

        await self.session.commit()

        # Trigger notifications to guardians
        await self._send_attendance_notifications(event)

        return AttendanceEventRead.model_validate(event, from_attributes=True)

    async def _send_attendance_notifications(self, event) -> None:
        """Send notifications to guardians after attendance event is registered."""
        if not self._notification_service:
            logger.debug("Notification service not configured, skipping notifications")
            return

        try:
            # Generate photo URL if photo exists and student allows photos
            photo_url = None
            if event.photo_ref:
                student = await self.student_repo.get(event.student_id)
                if student and getattr(student, "photo_pref_opt_in", False):
                    # Generate presigned URL valid for 7 days (for WhatsApp delivery)
                    photo_url = self.photo_service.generate_presigned_url(
                        event.photo_ref,
                        expires=7 * 24 * 3600,
                    )

            notification_ids = await self._notification_service.notify_attendance_event(
                event=event,
                photo_url=photo_url,
            )
            await self.session.commit()

            if notification_ids:
                logger.info(
                    f"Queued {len(notification_ids)} notifications for event {event.id}"
                )
        except Exception as e:
            # Don't fail the attendance registration if notifications fail
            logger.error(f"Failed to send notifications for event {event.id}: {e}")

    async def list_events_by_student(self, student_id: int) -> List[AttendanceEventRead]:
        events = await self.attendance_repo.list_by_student(student_id)
        return [AttendanceEventRead.model_validate(event, from_attributes=True) for event in events]

    async def detect_no_show_alerts(self, current_dt: datetime) -> list[dict]:
        if current_dt.tzinfo:
            current_dt_naive = current_dt.astimezone(timezone.utc).replace(tzinfo=None)
        else:
            current_dt_naive = current_dt

        weekday = current_dt_naive.weekday()
        schedules = await self.schedule_repo.list_by_weekday(weekday)
        grace = timedelta(minutes=settings.no_show_grace_minutes)
        target_date = current_dt_naive.date()
        alerts: list[dict] = []

        for schedule in schedules:
            # Course is eager-loaded via selectinload in list_by_weekday
            threshold = datetime.combine(target_date, schedule.in_time) + grace
            if current_dt_naive < threshold:
                continue

            students = await self.student_repo.list_by_course(schedule.course_id)
            if not students:
                continue

            missing_students = []
            for student in students:
                has_in = await self.attendance_repo.has_in_event_on_date(student.id, target_date)
                if not has_in:
                    missing_students.append(student)

            if not missing_students:
                continue

            for student in missing_students:
                for guardian in getattr(student, "guardians", []):
                    # Use get_or_create to handle race conditions atomically
                    alert, _created = await self.no_show_repo.get_or_create(
                        student_id=student.id,
                        guardian_id=guardian.id,
                        course_id=schedule.course_id,
                        schedule_id=schedule.id,
                        alert_date=target_date,
                        alerted_at=current_dt_naive,
                    )
                    alerts.append(
                        {
                            "alert": alert,
                            "guardian": guardian,
                            "student": student,
                            "course": schedule.course,
                        }
                    )

        return alerts

    # Security constants for file uploads
    ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
    ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp"}
    MAX_PHOTO_SIZE = 10 * 1024 * 1024  # 10MB

    async def attach_photo(self, event_id: int, file) -> AttendanceEventRead:
        # Validate MIME type
        content_type = (file.content_type or "").lower()
        if content_type not in self.ALLOWED_MIME_TYPES:
            raise ValueError(
                f"Tipo de archivo no permitido: {content_type}. "
                f"Tipos permitidos: {', '.join(self.ALLOWED_MIME_TYPES)}"
            )

        # Read file in chunks to avoid loading large files before validation
        chunks = []
        total_size = 0
        chunk_size = 64 * 1024  # 64KB chunks

        while True:
            chunk = await file.read(chunk_size)
            if not chunk:
                break
            total_size += len(chunk)
            if total_size > self.MAX_PHOTO_SIZE:
                raise ValueError(
                    f"Archivo muy grande: >{self.MAX_PHOTO_SIZE / 1024 / 1024:.0f}MB. "
                    f"Máximo permitido: {self.MAX_PHOTO_SIZE / 1024 / 1024:.0f}MB"
                )
            chunks.append(chunk)

        if not chunks:
            raise ValueError("Archivo vacío")

        data = b"".join(chunks)

        # Validate and sanitize extension
        filename = file.filename or "photo.jpg"
        # Prevent path traversal - only use the last part after any slashes
        filename = filename.replace("\\", "/").split("/")[-1]
        extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
        if extension not in self.ALLOWED_EXTENSIONS:
            raise ValueError(
                f"Extensión no permitida: {extension}. "
                f"Extensiones permitidas: {', '.join(self.ALLOWED_EXTENSIONS)}"
            )

        key = f"events/{event_id}/{uuid.uuid4().hex}.{extension}"
        await self.photo_service.store_photo(key, data, content_type)
        event = await self.attendance_repo.update_photo_ref(event_id, key)
        await self.session.commit()
        return AttendanceEventRead.model_validate(event, from_attributes=True)

    async def list_recent_photo_events(self, limit: int = 20):
        return await self.attendance_repo.list_recent_with_photos(limit)

    def get_photo_url(self, photo_ref: str, expires: int = 3600) -> str:
        return self.photo_service.generate_presigned_url(photo_ref, expires)
