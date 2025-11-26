"""Absence request model."""

from datetime import datetime, date

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AbsenceRequest(Base):
    __tablename__ = "absence_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    end_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    comment: Mapped[str | None] = mapped_column(Text)
    attachment_ref: Mapped[str | None] = mapped_column(String(512))
    status: Mapped[str] = mapped_column(String(32), default="PENDING", index=True)
    approver_id: Mapped[int | None] = mapped_column(ForeignKey("guardians.id"), index=True)
    ts_submitted: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ts_resolved: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
