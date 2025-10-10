"""Device model."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    device_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    gate_id: Mapped[str] = mapped_column(String(64), nullable=False)
    firmware_version: Mapped[str] = mapped_column(String(32), nullable=False)
    battery_pct: Mapped[int] = mapped_column(Integer, default=100)
    pending_events: Mapped[int] = mapped_column(Integer, default=0)
    online: Mapped[bool] = mapped_column(Boolean, default=True)
    last_sync: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
