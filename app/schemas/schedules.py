"""Schedule schemas."""

from datetime import date, time
from enum import Enum

from pydantic import BaseModel, field_validator, model_validator


class ScheduleCreate(BaseModel):
    weekday: int
    in_time: time
    out_time: time

    @field_validator("weekday")
    @classmethod
    def validate_weekday(cls, v: int) -> int:
        if not 0 <= v <= 6:
            raise ValueError("El día de la semana debe estar entre 0 (lunes) y 6 (domingo)")
        return v

    @model_validator(mode="after")
    def validate_times(self) -> "ScheduleCreate":
        if self.out_time <= self.in_time:
            raise ValueError("La hora de salida debe ser posterior a la hora de entrada")
        return self


class ScheduleRead(ScheduleCreate):
    id: int
    course_id: int


class ScheduleExceptionScope(str, Enum):
    GLOBAL = "GLOBAL"
    COURSE = "COURSE"


class ScheduleExceptionCreate(BaseModel):
    scope: ScheduleExceptionScope
    date: date
    course_id: int | None = None
    in_time: time | None = None
    out_time: time | None = None
    reason: str

    @model_validator(mode="after")
    def validate_scope_course_id(self) -> "ScheduleExceptionCreate":
        """R4-L2 fix: Validate scope and course_id consistency."""
        if self.scope == ScheduleExceptionScope.COURSE and self.course_id is None:
            raise ValueError("course_id es requerido cuando scope es COURSE")
        if self.scope == ScheduleExceptionScope.GLOBAL and self.course_id is not None:
            raise ValueError("course_id debe ser null cuando scope es GLOBAL")
        return self


class ScheduleExceptionRead(ScheduleExceptionCreate):
    id: int
    created_by: int | None = None
