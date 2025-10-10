"""Attendance schemas."""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class AttendanceType(str, Enum):
    IN = "IN"
    OUT = "OUT"


class AttendanceEventCreate(BaseModel):
    student_id: int
    device_id: str
    gate_id: str
    type: AttendanceType
    occurred_at: datetime = Field(default_factory=datetime.utcnow)
    photo_ref: str | None = None
    local_seq: int | None = None


class AttendanceEventRead(AttendanceEventCreate):
    id: int
    synced_at: datetime | None = None
