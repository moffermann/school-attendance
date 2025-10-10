"""Attendance service implementation."""

from typing import List

from datetime import datetime, timedelta, timezone
import uuid

from app.db.repositories.attendance import AttendanceRepository
from app.db.repositories.guardians import GuardianRepository
from app.db.repositories.schedules import ScheduleRepository
from app.db.repositories.students import StudentRepository
from app.db.repositories.no_show_alerts import NoShowAlertRepository
from app.schemas.attendance import AttendanceEventCreate, AttendanceEventRead
from app.core.config import settings
from app.services.photo_service import PhotoService


class AttendanceService:
    def __init__(self, session):
        self.session = session
        self.attendance_repo = AttendanceRepository(session)
        self.student_repo = StudentRepository(session)
        self.schedule_repo = ScheduleRepository(session)
        self.guardian_repo = GuardianRepository(session)
        self.photo_service = PhotoService()
        self.no_show_repo = NoShowAlertRepository(session)

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
        return AttendanceEventRead.model_validate(event, from_attributes=True)

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
            if getattr(schedule, "course", None) is None:
                try:
                    await self.session.refresh(schedule, attribute_names=["course"])
                except Exception:  # pragma: no cover - best effort
                    schedule.course = None
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
                    alert = await self.no_show_repo.get_by_unique(student.id, guardian.id, target_date)
                    if not alert:
                        alert = await self.no_show_repo.create(
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

    async def attach_photo(self, event_id: int, file) -> AttendanceEventRead:
        data = await file.read()
        if not data:
            raise ValueError("Archivo vacío")
        extension = (file.filename or "jpg").split(".")[-1]
        key = f"events/{event_id}/{uuid.uuid4().hex}.{extension}"
        content_type = file.content_type or "image/jpeg"
        await self.photo_service.store_photo(key, data, content_type)
        event = await self.attendance_repo.update_photo_ref(event_id, key)
        await self.session.commit()
        return AttendanceEventRead.model_validate(event, from_attributes=True)

    async def list_recent_photo_events(self, limit: int = 20):
        return await self.attendance_repo.list_recent_with_photos(limit)

    def get_photo_url(self, photo_ref: str, expires: int = 3600) -> str:
        return self.photo_service.generate_presigned_url(photo_ref, expires)
