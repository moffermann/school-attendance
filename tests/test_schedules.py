from datetime import date, time

from app.schemas.schedules import ScheduleExceptionCreate, ScheduleExceptionScope


def test_schedule_exception_requires_reason() -> None:
    payload = ScheduleExceptionCreate(
        scope=ScheduleExceptionScope.COURSE,
        date=date.today(),
        course_id=1,
        in_time=time(hour=8, minute=0),
        out_time=time(hour=13, minute=30),
        reason="Simulacro",
    )

    assert payload.scope == ScheduleExceptionScope.COURSE
    assert payload.reason == "Simulacro"
