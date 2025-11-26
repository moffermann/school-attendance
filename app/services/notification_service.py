"""Read-only notification queries for metrics/bitácora."""

from __future__ import annotations

from collections import Counter
from datetime import datetime

from app.db.repositories.guardians import GuardianRepository
from app.db.repositories.notifications import NotificationRepository
from app.schemas.notifications import NotificationLog, NotificationSummaryResponse


class NotificationService:
    def __init__(self, session):
        self.session = session
        self.repository = NotificationRepository(session)
        self.guardian_repo = GuardianRepository(session)

    async def list_notifications(
        self,
        *,
        guardian_id: int | None = None,
        student_id: int | None = None,
        status: str | None = None,
        channel: str | None = None,
        template: str | None = None,
        start: datetime | None = None,
        end: datetime | None = None,
        limit: int = 200,
    ) -> list[NotificationLog]:
        guardian_ids = None
        if student_id is not None:
            guardians = await self.guardian_repo.list_by_student_ids([student_id])
            guardian_ids = [g.id for g in guardians]
        elif guardian_id is not None:
            guardian_ids = [guardian_id]

        records = await self.repository.list_notifications(
            guardian_ids=guardian_ids,
            status=status,
            channel=channel,
            template=template,
            start=start,
            end=end,
            limit=limit,
        )
        return [NotificationLog.model_validate(item, from_attributes=True) for item in records]

    async def summary(self) -> NotificationSummaryResponse:
        records = await self.repository.list_notifications(limit=500)
        by_status = Counter(record.status for record in records)
        by_channel = Counter(record.channel for record in records)
        by_template = Counter(record.template for record in records)
        return NotificationSummaryResponse(
            total=len(records),
            by_status=by_status,
            by_channel=by_channel,
            by_template=by_template,
        )
