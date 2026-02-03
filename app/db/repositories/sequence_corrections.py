"""Sequence corrections repository."""

from datetime import date, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.sequence_correction import SequenceCorrection


class SequenceCorrectionRepository:
    """Repository for sequence correction audit records."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        *,
        event_id: int,
        student_id: int,
        requested_type: str,
        corrected_type: str,
        device_id: str,
        gate_id: str,
        occurred_at: datetime,
    ) -> SequenceCorrection:
        """Create a sequence correction audit record."""
        correction = SequenceCorrection(
            event_id=event_id,
            student_id=student_id,
            requested_type=requested_type,
            corrected_type=corrected_type,
            device_id=device_id,
            gate_id=gate_id,
            occurred_at=occurred_at,
        )
        self.session.add(correction)
        await self.session.flush()
        return correction

    async def list_by_date(
        self, target_date: date, limit: int = 100
    ) -> list[SequenceCorrection]:
        """List corrections for a specific date (for dashboard)."""
        stmt = (
            select(SequenceCorrection)
            .where(func.date(SequenceCorrection.corrected_at) == target_date)
            .order_by(SequenceCorrection.corrected_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count_by_device(self, device_id: str, since: datetime) -> int:
        """Count corrections for a device (identifies problematic tablets)."""
        stmt = (
            select(func.count())
            .select_from(SequenceCorrection)
            .where(
                SequenceCorrection.device_id == device_id,
                SequenceCorrection.corrected_at >= since,
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar() or 0
