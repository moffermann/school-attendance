"""Dashboard data aggregation for the SPA."""

from __future__ import annotations

import csv
import io
from collections.abc import Iterable
from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models.attendance_event import AttendanceEvent
from app.db.models.course import Course
from app.db.models.schedule import Schedule
from app.db.models.student import Student
from app.db.repositories.schedules import ScheduleRepository
from app.db.repositories.students import StudentRepository
from app.schemas.webapp import (
    DashboardEvent,
    DashboardSnapshot,
    DashboardStats,
    ReportCourseSummary,
    ReportsSnapshot,
    ReportTrendPoint,
)
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
        # R12-P5 fix: Use async map for presigned URLs
        mapped_events = await self._map_events_async(events)

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
            [
                "Fecha",
                "Hora",
                "Alumno",
                "Curso",
                "Tipo",
                "Puerta",
                "Dispositivo",
                "Foto",
                "URL foto",
            ]
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

    async def get_report(
        self,
        *,
        start_date: date,
        end_date: date,
        course_id: int | None = None,
    ) -> ReportsSnapshot:
        if start_date > end_date:
            raise ValueError("Rango de fechas inválido")

        course_stmt = select(Course)
        if course_id is not None:
            course_stmt = course_stmt.where(Course.id == course_id)
        courses: list[Course] = list((await self.session.execute(course_stmt)).scalars().all())
        course_ids = {course.id for course in courses}
        if not course_ids:
            return ReportsSnapshot(start_date=start_date, end_date=end_date, courses=[], trend=[])

        schedules = await self.schedule_repo.list_by_course_ids(course_ids)
        schedules_map = {(schedule.course_id, schedule.weekday): schedule for schedule in schedules}

        students = await self.student_repo.list_by_course_ids(course_ids)
        {student.id: student.course_id for student in students}
        students_by_course: dict[int, list[Student]] = {cid: [] for cid in course_ids}
        for student in students:
            students_by_course.setdefault(student.course_id, []).append(student)

        events_stmt = (
            select(AttendanceEvent, Student, Course)
            .join(Student, Student.id == AttendanceEvent.student_id)
            .join(Course, Course.id == Student.course_id)
            .where(
                func.date(AttendanceEvent.occurred_at) >= start_date,
                func.date(AttendanceEvent.occurred_at) <= end_date,
                Student.course_id.in_(course_ids),
            )
            .order_by(AttendanceEvent.occurred_at)
        )
        result = await self.session.execute(events_stmt)
        events: list[tuple[AttendanceEvent, Student, Course]] = list(result.all())  # type: ignore[arg-type]

        date_range = self._iter_dates(start_date, end_date)
        earliest_in: dict[tuple[int, date], datetime] = {}
        trend_counts: dict[date, set[int]] = {dt: set() for dt in date_range}

        for event, student, course in events:
            event_date = self._normalize_dt(event.occurred_at)
            if not event_date:
                continue
            event_day = event_date.date()
            if event.type == "IN":
                key = (student.id, event_day)
                current = earliest_in.get(key)
                if current is None or event_date < current:
                    earliest_in[key] = event_date
                trend_counts.setdefault(event_day, set()).add(student.id)

        course_summaries: list[ReportCourseSummary] = []
        grace = timedelta(minutes=settings.no_show_grace_minutes)
        for course in courses:
            course_students = students_by_course.get(course.id, [])
            if not course_students:
                course_summaries.append(
                    ReportCourseSummary(
                        course_id=course.id,
                        course_name=course.name,
                        total_students=0,
                        present=0,
                        late=0,
                        absent=0,
                        attendance_pct=0.0,
                    )
                )
                continue

            present_total = 0
            late_total = 0
            absent_total = 0
            expected_sessions = 0

            for current_day in date_range:
                weekday = current_day.weekday()
                schedule = schedules_map.get((course.id, weekday))
                if not schedule:
                    continue
                expected_sessions += len(course_students)
                threshold = datetime.combine(current_day, schedule.in_time) + grace

                for student in course_students:
                    key = (student.id, current_day)
                    first_in = earliest_in.get(key)
                    if not first_in:
                        absent_total += 1
                        continue
                    present_total += 1
                    if first_in > threshold:
                        late_total += 1

            attendance_pct = (present_total / expected_sessions) * 100 if expected_sessions else 0.0

            course_summaries.append(
                ReportCourseSummary(
                    course_id=course.id,
                    course_name=course.name,
                    total_students=len(course_students),
                    present=present_total,
                    late=late_total,
                    absent=absent_total,
                    attendance_pct=round(attendance_pct, 1),
                )
            )

        trend_points: list[ReportTrendPoint] = []
        for day in date_range:
            present_count = len(trend_counts.get(day, set()))
            trend_points.append(ReportTrendPoint(date=day, present=present_count))

        return ReportsSnapshot(
            start_date=start_date,
            end_date=end_date,
            courses=course_summaries,
            trend=trend_points,
        )

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
            # Escape special LIKE characters to prevent SQL injection patterns
            # and limit search query length
            safe_search = self._sanitize_search_query(search)
            if safe_search:
                stmt = stmt.where(func.lower(Student.full_name).like(f"%{safe_search}%"))

        stmt = stmt.order_by(AttendanceEvent.occurred_at.desc()).limit(MAX_EVENTS)

        result = await self.session.execute(stmt)
        return list(result.all())  # type: ignore[arg-type]

    @staticmethod
    def _sanitize_search_query(search: str, max_length: int = 100) -> str | None:
        """Sanitize search query for safe use in LIKE clauses."""
        if not search:
            return None
        # Limit length to prevent DoS
        search = search.strip()[:max_length]
        if not search:
            return None
        # Escape special LIKE characters: % and _ and backslash
        search = search.replace("\\", "\\\\")
        search = search.replace("%", "\\%")
        search = search.replace("_", "\\_")
        return search.lower()

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

        no_in_count = len(
            [student_id for student_id in student_course if student_id not in first_in_by_student]
        )

        return DashboardStats(
            total_in=total_in,
            total_out=total_out,
            late_count=len(late_students),
            no_in_count=no_in_count,
            with_photos=photo_count,
        )

    async def _map_events_async(
        self, events: list[tuple[AttendanceEvent, Student, Course]]
    ) -> list[DashboardEvent]:
        """R12-P5 fix: Map events asynchronously for presigned URL generation."""
        import asyncio

        async def _map_single(event, student, course):
            photo_url = (
                await self.photo_service.generate_presigned_url(event.photo_ref)
                if event.photo_ref
                else None
            )
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
                photo_url=photo_url,
                source=event.source,
            )

        return await asyncio.gather(*[_map_single(e, s, c) for e, s, c in events])

    def _map_event(
        self, event: AttendanceEvent, student: Student, course: Course
    ) -> DashboardEvent:
        """Sync version for backwards compatibility (no photo URL)."""
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
            photo_url=None,
            source=event.source,
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

    @staticmethod
    def _iter_dates(start: date, end: date) -> list[date]:
        days: list[date] = []
        current = start
        while current <= end:
            days.append(current)
            current += timedelta(days=1)
        return days
