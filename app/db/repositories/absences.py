"""Repository for absence requests."""

from datetime import datetime, date
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.absence_request import AbsenceRequest


class AbsenceRepository:
    """Data access helpers for absence requests."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        *,
        student_id: int,
        type_: str,
        start_date: date,
        end_date: date,
        comment: str | None,
        attachment_ref: str | None,
        submitted_at: datetime,
    ) -> AbsenceRequest:
        record = AbsenceRequest(
            student_id=student_id,
            type=type_,
            start_date=start_date,
            end_date=end_date,
            comment=comment,
            attachment_ref=attachment_ref,
            ts_submitted=submitted_at,
        )
        self.session.add(record)
        await self.session.flush()
        return record

    async def list_by_student_ids(self, student_ids: Iterable[int]) -> list[AbsenceRequest]:
        ids = list(student_ids)
        if not ids:
            return []
        stmt = select(AbsenceRequest).where(AbsenceRequest.student_id.in_(ids)).order_by(AbsenceRequest.ts_submitted.desc())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
