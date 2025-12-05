"""Service for no-show alerts."""

from __future__ import annotations

from datetime import date, datetime, timezone

from app.db.repositories.no_show_alerts import NoShowAlertRepository
from app.schemas.alerts import NoShowAlertRead


class AlertService:
    def __init__(self, session):
        self.session = session
        self.repository = NoShowAlertRepository(session)

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
    ) -> list[NoShowAlertRead]:
        # TDD-R3-BUG4 fix: Provide default limit to prevent unbounded queries
        rows = await self.repository.list_alerts(
            start_date=start_date,
            end_date=end_date,
            status=status,
            course_id=course_id,
            guardian_id=guardian_id,
            student_id=student_id,
            limit=limit or 500,  # Default limit if None passed
            offset=offset,
        )
        return [NoShowAlertRead.model_validate(row) for row in rows]

    async def resolve_alert(self, alert_id: int, notes: str | None = None) -> NoShowAlertRead:
        resolved = await self.repository.mark_resolved(alert_id, notes, datetime.now(timezone.utc))
        if resolved is None:
            raise ValueError("Alerta no encontrada")
        await self.session.commit()
        row = {
            "id": resolved.id,
            "student_id": resolved.student_id,
            "guardian_id": resolved.guardian_id,
            "course_id": resolved.course_id,
            "schedule_id": resolved.schedule_id,
            "alert_date": resolved.alert_date,
            "alerted_at": resolved.alerted_at,
            "status": resolved.status,
            "resolved_at": resolved.resolved_at,
            "notes": resolved.notes,
            "notification_attempts": resolved.notification_attempts,
            "last_notification_at": resolved.last_notification_at,
            "student_name": getattr(resolved.student, "full_name", ""),
            "guardian_name": getattr(resolved.guardian, "full_name", ""),
            "course_name": getattr(resolved.course, "name", ""),
        }
        return NoShowAlertRead.model_validate(row)
