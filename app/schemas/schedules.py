"""Schedule schemas."""

from datetime import date, time
from enum import Enum

from pydantic import BaseModel


class ScheduleCreate(BaseModel):
    weekday: int
    in_time: time
    out_time: time


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


class ScheduleExceptionRead(ScheduleExceptionCreate):
    id: int
    created_by: int | None = None
