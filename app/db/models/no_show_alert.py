"""No-show alert model."""

from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class NoShowAlert(Base):
    __tablename__ = "no_show_alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False, index=True)
    guardian_id: Mapped[int] = mapped_column(ForeignKey("guardians.id"), nullable=False, index=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), nullable=False)
    schedule_id: Mapped[int | None] = mapped_column(ForeignKey("schedules.id"))
    alert_date: Mapped[date] = mapped_column(Date, nullable=False)
    alerted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="PENDING")
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(String(512))
    notification_attempts: Mapped[int] = mapped_column(Integer, default=0)
    last_notification_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    student = relationship("Student")
    guardian = relationship("Guardian")
    course = relationship("Course")
    schedule = relationship("Schedule")

