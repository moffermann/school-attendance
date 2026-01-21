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
            source=payload.source.value if payload.source else None,
        )

        await self.session.commit()

        # Trigger notifications to guardians
        # R12-P1 fix: Pass student to avoid duplicate fetch
        await self._send_attendance_notifications(event, student)

        return AttendanceEventRead.model_validate(event, from_attributes=True)

    async def _send_attendance_notifications(self, event, student=None) -> None:
        """Send notifications to guardians after attendance event is registered."""
        # DEBUG: Trace notification flow
        logger.info(f"[DEBUG-NOTIF] Starting notification flow for event {event.id}")
        logger.info(f"[DEBUG-NOTIF] notification_service is: {type(self._notification_service)}")

        if not self._notification_service:
            logger.debug("Notification service not configured, skipping notifications")
            logger.warning(f"[DEBUG-NOTIF] SKIPPED: notification_service is None!")
            return

        try:
            # Generate photo URL if photo exists and student allows photos
            photo_url = None
            if event.photo_ref:
                # R12-P1 fix: Use passed student instead of re-fetching
                if student is None:
                    student = await self.student_repo.get(event.student_id)
                # R4-L1 fix: Use effective_evidence_preference instead of legacy photo_pref_opt_in
                if student:
                    evidence_pref = getattr(student, "effective_evidence_preference", "none")
                    if evidence_pref == "photo":
                        # R2-B10 fix: Reduce presigned URL expiry from 7 days to 24 hours
                        # WhatsApp has 24h to download media, 7 days was excessive security risk
                        # R12-P5 fix: Now async, use await
                        photo_url = await self.photo_service.generate_presigned_url(
                            event.photo_ref,
                            expires=24 * 3600,  # 24 hours
                        )

            logger.info(f"[DEBUG-NOTIF] Calling notify_attendance_event for event {event.id}, photo_url: {bool(photo_url)}")
            notification_ids = await self._notification_service.notify_attendance_event(
                event=event,
                photo_url=photo_url,
            )
            logger.info(f"[DEBUG-NOTIF] notify_attendance_event returned: {notification_ids}")
            await self.session.commit()
            logger.info(f"[DEBUG-NOTIF] Session committed after notifications")

            if notification_ids:
                logger.info(
                    f"Queued {len(notification_ids)} notifications for event {event.id}"
                )
            else:
                logger.warning(f"[DEBUG-NOTIF] NO notifications created for event {event.id}")
        except Exception as e:
            # Don't fail the attendance registration if notifications fail
            logger.error(f"Failed to send notifications for event {event.id}: {e}")
            logger.exception(f"[DEBUG-NOTIF] Full exception trace:")

    async def list_events_by_student(self, student_id: int) -> List[AttendanceEventRead]:
        events = await self.attendance_repo.list_by_student(student_id)
        return [AttendanceEventRead.model_validate(event, from_attributes=True) for event in events]

    async def detect_no_show_alerts(self, current_dt: datetime) -> list[dict]:
        # R15-DT2 fix: Work with timezone-aware datetimes consistently
        # Ensure current_dt is UTC-aware for consistent comparisons
        if current_dt.tzinfo:
            current_dt_utc = current_dt.astimezone(timezone.utc)
        else:
            # Assume naive datetime is UTC
            current_dt_utc = current_dt.replace(tzinfo=timezone.utc)

        weekday = current_dt_utc.weekday()
        schedules = await self.schedule_repo.list_by_weekday(weekday)
        grace = timedelta(minutes=settings.no_show_grace_minutes)
        target_date = current_dt_utc.date()
        alerts: list[dict] = []

        for schedule in schedules:
            # Course is eager-loaded via selectinload in list_by_weekday
            # R15-DT2 fix: datetime.combine with explicit UTC timezone to avoid naive datetime
            threshold = datetime.combine(target_date, schedule.in_time, tzinfo=timezone.utc) + grace
            if current_dt_utc < threshold:
                continue

            students = await self.student_repo.list_by_course(schedule.course_id)
            if not students:
                continue

            # R2-B3 fix: Use batch query instead of N+1 individual queries
            student_ids = [s.id for s in students]
            students_with_in = await self.attendance_repo.get_student_ids_with_in_event_on_date(
                student_ids, target_date
            )
            missing_students = [s for s in students if s.id not in students_with_in]

            if not missing_students:
                continue

            for student in missing_students:
                for guardian in getattr(student, "guardians", []):
                    # Use get_or_create to handle race conditions atomically
                    # R15-DT2 fix: Pass naive datetime to repository (DB stores without TZ)
                    alert, _created = await self.no_show_repo.get_or_create(
                        student_id=student.id,
                        guardian_id=guardian.id,
                        course_id=schedule.course_id,
                        schedule_id=schedule.id,
                        alert_date=target_date,
                        alerted_at=current_dt_utc.replace(tzinfo=None),
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

    # Magic bytes for image validation (first few bytes of file)
    IMAGE_MAGIC_BYTES = {
        b"\xff\xd8\xff": "image/jpeg",  # JPEG
        b"\x89PNG\r\n\x1a\n": "image/png",  # PNG
        b"GIF87a": "image/gif",  # GIF87a
        b"GIF89a": "image/gif",  # GIF89a
        b"RIFF": "image/webp",  # WebP (needs additional check)
    }

    def _validate_magic_bytes(self, data: bytes, claimed_type: str) -> bool:
        """Validate file content matches claimed MIME type using magic bytes."""
        if len(data) < 12:
            return False

        # Check JPEG
        if data[:3] == b"\xff\xd8\xff":
            return claimed_type == "image/jpeg"

        # Check PNG
        if data[:8] == b"\x89PNG\r\n\x1a\n":
            return claimed_type == "image/png"

        # Check GIF
        if data[:6] in (b"GIF87a", b"GIF89a"):
            return claimed_type == "image/gif"

        # Check WebP (RIFF....WEBP)
        if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
            return claimed_type == "image/webp"

        return False

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

        # Validate magic bytes match claimed MIME type
        if not self._validate_magic_bytes(data, content_type):
            raise ValueError(
                "El contenido del archivo no coincide con el tipo declarado. "
                "Por favor suba una imagen válida."
            )

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

    # Audio evidence constants
    ALLOWED_AUDIO_MIME_TYPES = {"audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"}
    ALLOWED_AUDIO_EXTENSIONS = {"webm", "ogg", "mp4", "m4a", "mp3", "wav"}
    MAX_AUDIO_SIZE = 5 * 1024 * 1024  # 5MB
    MAX_AUDIO_DURATION_SECONDS = 30  # Maximum 30 seconds

    # Magic bytes for audio validation
    AUDIO_MAGIC_BYTES = {
        b"RIFF": "audio/wav",  # WAV files start with RIFF
        b"OggS": "audio/ogg",  # OGG files
        b"\x1aE\xdf\xa3": "audio/webm",  # WebM/EBML header
        b"\xff\xfb": "audio/mpeg",  # MP3 with ID3
        b"\xff\xfa": "audio/mpeg",  # MP3 variant
        b"ID3": "audio/mpeg",  # MP3 with ID3v2 header
    }

    def _validate_audio_magic_bytes(self, data: bytes, claimed_type: str) -> bool:
        """Validate audio file content matches claimed MIME type."""
        if len(data) < 12:
            return False

        # Check WAV (RIFF....WAVE)
        if data[:4] == b"RIFF" and data[8:12] == b"WAVE":
            return claimed_type == "audio/wav"

        # Check OGG
        if data[:4] == b"OggS":
            return claimed_type in ("audio/ogg", "audio/webm")

        # Check WebM (EBML header)
        if data[:4] == b"\x1aE\xdf\xa3":
            return claimed_type in ("audio/webm", "audio/ogg")

        # Check MP3
        if data[:3] == b"ID3" or data[:2] in (b"\xff\xfb", b"\xff\xfa"):
            return claimed_type == "audio/mpeg"

        # Check MP4/M4A (ftyp box)
        if data[4:8] == b"ftyp":
            return claimed_type in ("audio/mp4", "audio/mpeg")

        return False

    async def attach_audio(self, event_id: int, file) -> AttendanceEventRead:
        """Attach audio evidence to an attendance event."""
        # Validate MIME type
        content_type = (file.content_type or "").lower()
        if content_type not in self.ALLOWED_AUDIO_MIME_TYPES:
            raise ValueError(
                f"Tipo de audio no permitido: {content_type}. "
                f"Tipos permitidos: {', '.join(self.ALLOWED_AUDIO_MIME_TYPES)}"
            )

        # Read file in chunks
        chunks = []
        total_size = 0
        chunk_size = 64 * 1024

        while True:
            chunk = await file.read(chunk_size)
            if not chunk:
                break
            total_size += len(chunk)
            if total_size > self.MAX_AUDIO_SIZE:
                raise ValueError(
                    f"Archivo de audio muy grande: >{self.MAX_AUDIO_SIZE / 1024 / 1024:.0f}MB. "
                    f"Máximo permitido: {self.MAX_AUDIO_SIZE / 1024 / 1024:.0f}MB"
                )
            chunks.append(chunk)

        if not chunks:
            raise ValueError("Archivo vacío")

        data = b"".join(chunks)

        # Validate magic bytes
        if not self._validate_audio_magic_bytes(data, content_type):
            raise ValueError(
                "El contenido del archivo no coincide con el tipo declarado. "
                "Por favor suba un archivo de audio válido."
            )

        # Validate and sanitize extension
        filename = file.filename or "audio.webm"
        filename = filename.replace("\\", "/").split("/")[-1]
        extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else "webm"
        if extension not in self.ALLOWED_AUDIO_EXTENSIONS:
            raise ValueError(
                f"Extensión de audio no permitida: {extension}. "
                f"Extensiones permitidas: {', '.join(self.ALLOWED_AUDIO_EXTENSIONS)}"
            )

        key = f"events/{event_id}/audio_{uuid.uuid4().hex}.{extension}"
        await self.photo_service.store_photo(key, data, content_type)
        event = await self.attendance_repo.update_audio_ref(event_id, key)
        await self.session.commit()
        return AttendanceEventRead.model_validate(event, from_attributes=True)

    async def list_recent_photo_events(self, limit: int = 20):
        return await self.attendance_repo.list_recent_with_photos(limit)

    async def get_photo_url(self, photo_ref: str, expires: int = 3600) -> str | None:
        # R12-P5 fix: Now async
        return await self.photo_service.generate_presigned_url(photo_ref, expires)
