"""Schedule exception model."""

from datetime import date, time

from sqlalchemy import Date, ForeignKey, Integer, String, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ScheduleException(Base):
    __tablename__ = "schedule_exceptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    scope: Mapped[str] = mapped_column(String(16), nullable=False)
    course_id: Mapped[int | None] = mapped_column(ForeignKey("courses.id"))
    date: Mapped[date] = mapped_column(Date, nullable=False)
    in_time: Mapped[time | None] = mapped_column(Time)
    out_time: Mapped[time | None] = mapped_column(Time)
    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    created_by: Mapped[int | None] = mapped_column(Integer)
