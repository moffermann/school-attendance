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

    async def create(
        self, course_id: int, *, weekday: int, in_time: time, out_time: time
    ) -> Schedule:
        schedule = Schedule(course_id=course_id, weekday=weekday, in_time=in_time, out_time=out_time)
        self.session.add(schedule)
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

    async def list_by_weekday(self, weekday: int) -> list[Schedule]:
        stmt = select(Schedule).where(Schedule.weekday == weekday).options(selectinload(Schedule.course))
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
