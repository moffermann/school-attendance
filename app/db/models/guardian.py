"""Guardian model."""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.associations import student_guardian_table


class Guardian(Base):
    __tablename__ = "guardians"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    # R15-MDL1 fix: Use lambda factory instead of mutable default dict
    # Mutable defaults are shared across all instances, causing data leaks
    contacts: Mapped[dict[str, Any]] = mapped_column(JSON, default=lambda: {})
    notification_prefs: Mapped[dict[str, Any]] = mapped_column(JSON, default=lambda: {})

    # Status for soft delete
    status: Mapped[str] = mapped_column(String(32), default="ACTIVE", index=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    students = relationship("Student", secondary=student_guardian_table, back_populates="guardians")
    push_subscriptions = relationship(
        "PushSubscription", back_populates="guardian", cascade="all, delete-orphan"
    )
