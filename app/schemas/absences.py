"""Schemas for absence requests."""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, Field


class AbsenceType(str, Enum):
    SICK = "SICK"
    PERSONAL = "PERSONAL"
    OTHER = "OTHER"


class AbsenceStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class AbsenceRequestCreate(BaseModel):
    student_id: int
    type: AbsenceType
    start: date
    end: date
    comment: str | None = None
    attachment_name: str | None = None


class AbsenceRequestRead(BaseModel):
    id: int
    student_id: int
    type: AbsenceType
    start: date
    end: date
    comment: str | None = None
    attachment_name: str | None = None
    status: AbsenceStatus
    ts_submitted: datetime


class AbsenceRequestList(BaseModel):
    items: list[AbsenceRequestRead] = Field(default_factory=list)


class AbsenceStatusUpdate(BaseModel):
    status: AbsenceStatus
