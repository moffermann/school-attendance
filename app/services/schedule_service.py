"""Schedule service implementation."""

from app.db.repositories.schedules import ScheduleRepository
from app.schemas.schedules import (
    ScheduleCreate,
    ScheduleExceptionCreate,
    ScheduleExceptionRead,
    ScheduleRead,
)


class ScheduleService:
    def __init__(self, session):
        self.session = session
        self.repository = ScheduleRepository(session)

    async def list_course_schedule(self, course_id: int) -> list[ScheduleRead]:
        schedules = await self.repository.list_by_course(course_id)
        return [ScheduleRead.model_validate(s, from_attributes=True) for s in schedules]

    async def create_schedule(self, course_id: int, payload: ScheduleCreate) -> ScheduleRead:
        # Upsert: check if schedule exists for this course_id + weekday
        existing = await self.repository.get_by_course_and_weekday(course_id, payload.weekday)
        if existing:
            # Update existing schedule
            schedule = await self.repository.update(
                existing.id,
                weekday=payload.weekday,
                in_time=payload.in_time,
                out_time=payload.out_time,
            )
        else:
            # Create new schedule
            schedule = await self.repository.create(
                course_id,
                weekday=payload.weekday,
                in_time=payload.in_time,
                out_time=payload.out_time,
            )
        await self.session.commit()
        return ScheduleRead.model_validate(schedule, from_attributes=True)

    async def update_schedule_entry(
        self, schedule_id: int, payload: ScheduleCreate
    ) -> ScheduleRead:
        schedule = await self.repository.update(
            schedule_id,
            weekday=payload.weekday,
            in_time=payload.in_time,
            out_time=payload.out_time,
        )
        await self.session.commit()
        return ScheduleRead.model_validate(schedule, from_attributes=True)

    async def create_exception(self, payload: ScheduleExceptionCreate) -> ScheduleExceptionRead:
        exception = await self.repository.create_exception(
            scope=payload.scope.value,
            date=payload.date,
            course_id=payload.course_id,
            in_time=payload.in_time,
            out_time=payload.out_time,
            reason=payload.reason,
            created_by=None,
        )
        await self.session.commit()
        return ScheduleExceptionRead.model_validate(exception, from_attributes=True)

    async def delete_exception(self, exception_id: int) -> None:
        deleted = await self.repository.delete_exception(exception_id)
        if not deleted:
            raise ValueError("Excepción no encontrada")
        await self.session.commit()
