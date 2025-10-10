"""Attendance event model."""

from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AttendanceTypeEnum(str, Enum):
    IN = "IN"
    OUT = "OUT"


class AttendanceEvent(Base):
    __tablename__ = "attendance_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(SAEnum(AttendanceTypeEnum, name="attendance_type"), nullable=False)
    gate_id: Mapped[str] = mapped_column(String(64), nullable=False)
    device_id: Mapped[str] = mapped_column(String(64), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    local_seq: Mapped[int | None] = mapped_column(Integer)
    photo_ref: Mapped[str | None] = mapped_column(String(512))
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    student = relationship("Student")
