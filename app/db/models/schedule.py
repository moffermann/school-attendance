"""Schedule model."""

from sqlalchemy import ForeignKey, Integer, SmallInteger, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Schedule(Base):
    __tablename__ = "schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), nullable=False, index=True)
    weekday: Mapped[int] = mapped_column(SmallInteger, nullable=False, index=True)
    in_time: Mapped[object] = mapped_column(Time, nullable=False)
    out_time: Mapped[object] = mapped_column(Time, nullable=False)

    course = relationship("Course", back_populates="schedules")
