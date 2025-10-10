"""Repository for no-show alerts."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.no_show_alert import NoShowAlert
from app.db.models.guardian import Guardian
from app.db.models.student import Student
from app.db.models.course import Course


class NoShowAlertRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_unique(self, student_id: int, guardian_id: int, alert_date: date) -> NoShowAlert | None:
        stmt = (
            select(NoShowAlert)
            .options(selectinload(NoShowAlert.guardian), selectinload(NoShowAlert.student), selectinload(NoShowAlert.course))
            .where(
                NoShowAlert.student_id == student_id,
                NoShowAlert.guardian_id == guardian_id,
                NoShowAlert.alert_date == alert_date,
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def create(
        self,
        *,
        student_id: int,
        guardian_id: int,
        course_id: int,
        schedule_id: int | None,
        alert_date: date,
        alerted_at: datetime,
    ) -> NoShowAlert:
        alert = NoShowAlert(
            student_id=student_id,
            guardian_id=guardian_id,
            course_id=course_id,
            schedule_id=schedule_id,
            alert_date=alert_date,
            alerted_at=alerted_at,
            status="PENDING",
        )
        self.session.add(alert)
        await self.session.flush()
        await self.session.refresh(alert, attribute_names=["student", "guardian", "course"])
        return alert

    async def mark_notified(self, alert_id: int, notified_at: datetime) -> None:
        alert = await self.session.get(NoShowAlert, alert_id)
        if alert is None:
            return
        alert.notification_attempts = (alert.notification_attempts or 0) + 1
        alert.last_notification_at = notified_at
        await self.session.flush()

    async def mark_resolved(self, alert_id: int, notes: str | None, resolved_at: datetime) -> NoShowAlert | None:
        alert = await self.session.get(NoShowAlert, alert_id)
        if alert is None:
            return None
        alert.status = "RESOLVED"
        alert.resolved_at = resolved_at
        if notes:
            alert.notes = notes
        await self.session.flush()
        await self.session.refresh(alert, attribute_names=["student", "guardian", "course"])
        return alert

    async def list_alerts(
        self,
        *,
        start_date: date | None = None,
        end_date: date | None = None,
        status: str | None = None,
        course_id: int | None = None,
        guardian_id: int | None = None,
        student_id: int | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> list[dict]:
        stmt: Select = (
            select(
                NoShowAlert,
                Student.full_name.label("student_name"),
                Guardian.full_name.label("guardian_name"),
                Course.name.label("course_name"),
            )
            .join(Student, Student.id == NoShowAlert.student_id)
            .join(Guardian, Guardian.id == NoShowAlert.guardian_id)
            .join(Course, Course.id == NoShowAlert.course_id)
            .order_by(NoShowAlert.alerted_at.desc())
        )

        if start_date:
            stmt = stmt.where(NoShowAlert.alert_date >= start_date)
        if end_date:
            stmt = stmt.where(NoShowAlert.alert_date <= end_date)
        if status:
            stmt = stmt.where(NoShowAlert.status == status)
        if course_id:
            stmt = stmt.where(NoShowAlert.course_id == course_id)
        if guardian_id:
            stmt = stmt.where(NoShowAlert.guardian_id == guardian_id)
        if student_id:
            stmt = stmt.where(NoShowAlert.student_id == student_id)
        if limit:
            stmt = stmt.limit(limit)
        if offset:
            stmt = stmt.offset(offset)

        result = await self.session.execute(stmt)
        rows = []
        for alert, student_name, guardian_name, course_name in result:
            rows.append(
                {
                    "id": alert.id,
                    "student_id": alert.student_id,
                    "guardian_id": alert.guardian_id,
                    "course_id": alert.course_id,
                    "schedule_id": alert.schedule_id,
                    "alert_date": alert.alert_date,
                    "alerted_at": alert.alerted_at,
                    "status": alert.status,
                    "resolved_at": alert.resolved_at,
                    "notes": alert.notes,
                    "notification_attempts": alert.notification_attempts,
                    "last_notification_at": alert.last_notification_at,
                    "student_name": student_name,
                    "guardian_name": guardian_name,
                    "course_name": course_name,
                }
            )
        return rows

    async def counts_by_course(self, alert_date: date) -> list[dict]:
        stmt = (
            select(NoShowAlert.course_id, func.count().label("total"))
            .where(NoShowAlert.alert_date == alert_date, NoShowAlert.status == "PENDING")
            .group_by(NoShowAlert.course_id)
        )
        result = await self.session.execute(stmt)
        return [dict(course_id=row.course_id, total=row.total) for row in result]
