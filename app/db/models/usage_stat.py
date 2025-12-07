"""Usage Stat model for tracking tenant usage metrics."""

from __future__ import annotations

from datetime import date

from sqlalchemy import BigInteger, Date, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class UsageStat(Base):
    """Tracks usage statistics per tenant per day."""

    __tablename__ = "usage_stats"
    __table_args__ = (
        UniqueConstraint("tenant_id", "stat_date", "metric_name", name="uq_usage_stats_tenant_date_metric"),
        {"schema": "public"},
    )

    # Available metric names
    METRIC_ATTENDANCE_EVENTS = "attendance_events"
    METRIC_NOTIFICATIONS_SENT = "notifications_sent"
    METRIC_ACTIVE_STUDENTS = "active_students"
    METRIC_ACTIVE_USERS = "active_users"
    METRIC_API_CALLS = "api_calls"
    METRIC_PHOTOS_UPLOADED = "photos_uploaded"
    METRIC_WHATSAPP_MESSAGES = "whatsapp_messages"
    METRIC_EMAIL_MESSAGES = "email_messages"

    ALL_METRICS = [
        METRIC_ATTENDANCE_EVENTS,
        METRIC_NOTIFICATIONS_SENT,
        METRIC_ACTIVE_STUDENTS,
        METRIC_ACTIVE_USERS,
        METRIC_API_CALLS,
        METRIC_PHOTOS_UPLOADED,
        METRIC_WHATSAPP_MESSAGES,
        METRIC_EMAIL_MESSAGES,
    ]

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("public.tenants.id", ondelete="CASCADE"), nullable=False
    )
    stat_date: Mapped[date] = mapped_column(Date, nullable=False)
    metric_name: Mapped[str] = mapped_column(String(64), nullable=False)
    value: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)

    # Relationships
    tenant = relationship("Tenant")

    def __repr__(self) -> str:
        return f"<UsageStat(tenant_id={self.tenant_id}, date={self.stat_date}, metric={self.metric_name}, value={self.value})>"
