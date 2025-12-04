"""Tag model."""

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _utc_now() -> datetime:
    """R6-M2 fix: Return timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False, index=True)
    tag_token_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    tag_token_preview: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    tag_uid: Mapped[str | None] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32), default="PENDING", index=True)
    # R6-M2 fix: Use timezone-aware datetime
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utc_now
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
