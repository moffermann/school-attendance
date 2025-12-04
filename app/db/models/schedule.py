"""Schedule model."""

from datetime import time

from sqlalchemy import ForeignKey, Integer, SmallInteger, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Schedule(Base):
    __tablename__ = "schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), nullable=False, index=True)
    weekday: Mapped[int] = mapped_column(SmallInteger, nullable=False, index=True)
    # R9-M5 fix: Use proper time type annotation instead of object
    in_time: Mapped[time] = mapped_column(Time, nullable=False)
    out_time: Mapped[time] = mapped_column(Time, nullable=False)

    course = relationship("Course", back_populates="schedules")
