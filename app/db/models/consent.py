"""Consent model."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Consent(Base):
    __tablename__ = "consents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False)
    guardian_id: Mapped[int] = mapped_column(ForeignKey("guardians.id"), nullable=False)
    scopes: Mapped[dict] = mapped_column(JSON, default=dict)
    ts_signed: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ts_expires: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
