"""Dashboard data aggregation for the SPA."""

from __future__ import annotations

import csv
import io
from datetime import date, datetime, timedelta
from typing import Iterable

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models.attendance_event import AttendanceEvent
from app.db.models.course import Course
from app.db.models.schedule import Schedule
from app.db.models.student import Student
from app.db.repositories.schedules import ScheduleRepository
from app.db.repositories.students import StudentRepository
from app.schemas.webapp import DashboardEvent, DashboardSnapshot, DashboardStats
from app.services.photo_service import PhotoService

MAX_EVENTS = 500


class DashboardService:
    """Generates dashboard snapshots and exports for staff roles."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.schedule_repo = ScheduleRepository(session)
        self.student_repo = StudentRepository(session)
        self.photo_service = PhotoService()

    async def get_snapshot(
        self,
        *,
        target_date: date,
        course_id: int | None = None,
        event_type: str | None = None,
        search: str | None = None,
    ) -> DashboardSnapshot:
        normalized_type = self._normalize_type(event_type)
        search_query = search.strip().lower() if search else None

        events = await self._fetch_events(target_date, course_id, normalized_type, search_query)
        schedules = await self.schedule_repo.list_by_weekday(target_date.weekday())
        if course_id is not None:
            schedules = [schedule for schedule in schedules if schedule.course_id == course_id]

        course_ids = {schedule.course_id for schedule in schedules}
        students = await self.student_repo.list_by_course_ids(course_ids) if course_ids else []

        stats = self._compute_stats(target_date, events, schedules, students)
        mapped_events = [self._map_event(event, student, course) for event, student, course in events]

        return DashboardSnapshot(date=target_date, stats=stats, events=mapped_events)

    async def export_snapshot_csv(
        self,
        *,
        target_date: date,
        course_id: int | None = None,
        event_type: str | None = None,
        search: str | None = None,
    ) -> str:
        snapshot = await self.get_snapshot(
            target_date=target_date, course_id=course_id, event_type=event_type, search=search
        )

        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(
            ["Fecha", "Hora", "Alumno", "Curso", "Tipo", "Puerta", "Dispositivo", "Foto", "URL foto"]
        )

        for event in snapshot.events:
            ts = event.ts or ""
            date_part, time_part = (ts.split("T") + [""])[:2]
            writer.writerow(
                [
                    date_part,
                    time_part,
                    event.student_name,
                    event.course_name,
                    event.type,
                    event.gate_id,
                    event.device_id,
                    "si" if event.photo_ref else "no",
                    event.photo_url or "",
                ]
            )

        return buffer.getvalue()

    async def _fetch_events(
        self,
        target_date: date,
        course_id: int | None,
        event_type: str | None,
        search: str | None,
    ) -> list[tuple[AttendanceEvent, Student, Course]]:
        stmt = (
            select(AttendanceEvent, Student, Course)
            .join(Student, Student.id == AttendanceEvent.student_id)
            .join(Course, Course.id == Student.course_id)
            .where(func.date(AttendanceEvent.occurred_at) == target_date)
        )

        if course_id is not None:
            stmt = stmt.where(Student.course_id == course_id)
        if event_type:
            stmt = stmt.where(AttendanceEvent.type == event_type)
        if search:
            stmt = stmt.where(func.lower(Student.full_name).like(f"%{search}%"))

        stmt = stmt.order_by(AttendanceEvent.occurred_at.desc()).limit(MAX_EVENTS)

        result = await self.session.execute(stmt)
        return list(result.all())

    def _compute_stats(
        self,
        target_date: date,
        events: Iterable[tuple[AttendanceEvent, Student, Course]],
        schedules: Iterable[Schedule],
        students: Iterable[Student],
    ) -> DashboardStats:
        total_in = 0
        total_out = 0
        photo_count = 0
        first_in_by_student: dict[int, datetime] = {}

        for event, _, _ in events:
            if event.type == "IN":
                total_in += 1
                normalized_ts = self._normalize_dt(event.occurred_at)
                existing = first_in_by_student.get(event.student_id)
                if normalized_ts and (existing is None or normalized_ts < existing):
                    first_in_by_student[event.student_id] = normalized_ts
            elif event.type == "OUT":
                total_out += 1
            if event.photo_ref:
                photo_count += 1

        thresholds: dict[int, datetime] = {}
        for schedule in schedules:
            thresholds[schedule.course_id] = datetime.combine(
                target_date, schedule.in_time
            ) + timedelta(minutes=settings.no_show_grace_minutes)

        student_course = {student.id: student.course_id for student in students}
        late_students: set[int] = set()
        for student_id, first_in_at in first_in_by_student.items():
            course = student_course.get(student_id)
            threshold = thresholds.get(course) if course is not None else None
            if threshold and first_in_at > threshold:
                late_students.add(student_id)

        no_in_count = len([student_id for student_id in student_course if student_id not in first_in_by_student])

        return DashboardStats(
            total_in=total_in,
            total_out=total_out,
            late_count=len(late_students),
            no_in_count=no_in_count,
            with_photos=photo_count,
        )

    def _map_event(self, event: AttendanceEvent, student: Student, course: Course) -> DashboardEvent:
        photo_url = self.photo_service.generate_presigned_url(event.photo_ref) if event.photo_ref else None
        return DashboardEvent(
            id=event.id,
            student_id=student.id,
            student_name=student.full_name,
            course_id=course.id,
            course_name=course.name,
            type=event.type,
            gate_id=event.gate_id,
            ts=self._format_ts(event.occurred_at),
            device_id=event.device_id,
            photo_ref=event.photo_ref,
            photo_url=photo_url or None,
        )

    @staticmethod
    def _format_ts(value: datetime | None) -> str | None:
        if not value:
            return None
        return value.replace(microsecond=0).isoformat()

    @staticmethod
    def _normalize_dt(value: datetime | None) -> datetime | None:
        if not value:
            return None
        return value.replace(tzinfo=None) if value.tzinfo else value

    @staticmethod
    def _normalize_type(value: str | None) -> str | None:
        if not value:
            return None
        upper = value.upper()
        return upper if upper in {"IN", "OUT"} else None
