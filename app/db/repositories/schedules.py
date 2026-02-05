"""Schedule repository stub."""

from datetime import date, time

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.schedule import Schedule
from app.db.models.schedule_exception import ScheduleException


class ScheduleRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_by_course(self, course_id: int) -> list[Schedule]:
        stmt = (
            select(Schedule)
            .where(Schedule.course_id == course_id)
            .order_by(Schedule.weekday)
            .options(selectinload(Schedule.course))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_course_and_weekday(self, course_id: int, weekday: int) -> Schedule | None:
        """Get schedule by course_id and weekday for upsert operations."""
        stmt = select(Schedule).where(Schedule.course_id == course_id, Schedule.weekday == weekday)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def create(
        self, course_id: int, *, weekday: int, in_time: time, out_time: time
    ) -> Schedule:
        schedule = Schedule(
            course_id=course_id, weekday=weekday, in_time=in_time, out_time=out_time
        )
        self.session.add(schedule)
        await self.session.flush()
        return schedule

    async def update(
        self, schedule_id: int, *, weekday: int | None = None, in_time: time, out_time: time
    ) -> Schedule:
        schedule = await self.session.get(Schedule, schedule_id)
        if schedule is None:
            raise ValueError("Horario no encontrado")
        if weekday is not None:
            schedule.weekday = weekday
        schedule.in_time = in_time
        schedule.out_time = out_time
        await self.session.flush()
        return schedule

    async def create_exception(
        self,
        *,
        scope: str,
        date: date,
        course_id: int | None,
        in_time: time | None,
        out_time: time | None,
        reason: str,
        created_by: int | None,
    ) -> ScheduleException:
        exception = ScheduleException(
            scope=scope,
            date=date,
            course_id=course_id,
            in_time=in_time,
            out_time=out_time,
            reason=reason,
            created_by=created_by,
        )
        self.session.add(exception)
        await self.session.flush()
        return exception

    async def delete_exception(self, exception_id: int) -> bool:
        exception = await self.session.get(ScheduleException, exception_id)
        if exception is None:
            return False
        await self.session.delete(exception)
        await self.session.flush()
        return True

    async def get_exception_for_date(
        self, target_date: date, course_id: int
    ) -> ScheduleException | None:
        """Get the applicable schedule exception for a date and course.

        Checks course-specific exception first, then falls back to global.
        Returns None if no exception applies.
        """
        # 1. Course-specific exception takes priority
        stmt = select(ScheduleException).where(
            ScheduleException.date == target_date,
            ScheduleException.scope == "COURSE",
            ScheduleException.course_id == course_id,
        )
        result = await self.session.execute(stmt)
        exception = result.scalar_one_or_none()
        if exception:
            return exception

        # 2. Fall back to global exception (applies to all courses)
        stmt = select(ScheduleException).where(
            ScheduleException.date == target_date,
            ScheduleException.scope == "GLOBAL",
            ScheduleException.course_id.is_(None),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_weekday(self, weekday: int) -> list[Schedule]:
        stmt = (
            select(Schedule)
            .where(Schedule.weekday == weekday)
            .options(selectinload(Schedule.course))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_by_course_ids(self, course_ids: set[int]) -> list[Schedule]:
        if not course_ids:
            return []
        stmt = (
            select(Schedule)
            .where(Schedule.course_id.in_(course_ids))
            .options(selectinload(Schedule.course))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
