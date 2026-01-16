"""Guardian model."""

from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.associations import student_guardian_table


class Guardian(Base):
    __tablename__ = "guardians"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    # R15-MDL1 fix: Use lambda factory instead of mutable default dict
    # Mutable defaults are shared across all instances, causing data leaks
    contacts: Mapped[dict] = mapped_column(JSON, default=lambda: {})
    notification_prefs: Mapped[dict] = mapped_column(JSON, default=lambda: {})

    # Status for soft delete
    status: Mapped[str] = mapped_column(String(32), default="ACTIVE", index=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    students = relationship("Student", secondary=student_guardian_table, back_populates="guardians")
