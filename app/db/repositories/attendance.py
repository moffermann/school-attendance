"""Attendance repository stub."""

from datetime import datetime, date

from sqlalchemy import and_, select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.attendance_event import AttendanceEvent
from app.db.models.student import Student


class AttendanceRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_event(
        self,
        *,
        student_id: int,
        event_type: str,
        gate_id: str,
        device_id: str,
        occurred_at: datetime,
        photo_ref: str | None = None,
        local_seq: int | None = None,
    ) -> AttendanceEvent:
        event = AttendanceEvent(
            student_id=student_id,
            type=event_type,
            gate_id=gate_id,
            device_id=device_id,
            occurred_at=occurred_at,
            photo_ref=photo_ref,
            local_seq=local_seq,
        )
        self.session.add(event)
        await self.session.flush()
        return event

    async def list_by_student(self, student_id: int, limit: int = 50) -> list[AttendanceEvent]:
        stmt = (
            select(AttendanceEvent)
            .where(AttendanceEvent.student_id == student_id)
            .order_by(AttendanceEvent.occurred_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def has_in_event_on_date(self, student_id: int, target_date: date) -> bool:
        stmt = (
            select(AttendanceEvent)
            .where(
                AttendanceEvent.student_id == student_id,
                AttendanceEvent.type == "IN",
                func.date(AttendanceEvent.occurred_at) == target_date,
            )
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def events_with_photo_before(self, cutoff: datetime) -> list[AttendanceEvent]:
        stmt = select(AttendanceEvent).where(
            AttendanceEvent.photo_ref.is_not(None), AttendanceEvent.occurred_at < cutoff
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def update_photo_ref(self, event_id: int, photo_ref: str | None) -> AttendanceEvent:
        event = await self.session.get(AttendanceEvent, event_id)
        if event is None:
            raise ValueError("Evento no encontrado")
        event.photo_ref = photo_ref
        await self.session.flush()
        return event

    async def update_audio_ref(self, event_id: int, audio_ref: str | None) -> AttendanceEvent:
        """Update the audio reference for an attendance event."""
        event = await self.session.get(AttendanceEvent, event_id)
        if event is None:
            raise ValueError("Evento no encontrado")
        event.audio_ref = audio_ref
        await self.session.flush()
        return event

    async def list_recent_with_photos(self, limit: int = 50) -> list[AttendanceEvent]:
        stmt = (
            select(AttendanceEvent)
            .options(
                selectinload(AttendanceEvent.student).selectinload(Student.course)
            )
            .where(AttendanceEvent.photo_ref.is_not(None))
            .order_by(AttendanceEvent.occurred_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
