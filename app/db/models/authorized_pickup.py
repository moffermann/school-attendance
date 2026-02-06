"""Authorized pickup (adult authorized to pick up students) model."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.student import Student
    from app.db.models.student_withdrawal import StudentWithdrawal


# Association table for many-to-many relationship between students and authorized pickups
student_authorized_pickup_table = Table(
    "student_authorized_pickup",
    Base.metadata,
    Column("student_id", Integer, ForeignKey("students.id", ondelete="CASCADE"), primary_key=True),
    Column(
        "authorized_pickup_id",
        Integer,
        ForeignKey("authorized_pickups.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column("priority", Integer, default=0),  # Order of preference (0 = primary)
    Column("notes", String(500), nullable=True),  # Special notes for this relationship
    Column("valid_from", DateTime(timezone=True), nullable=True),  # Start date (null = immediate)
    Column("valid_until", DateTime(timezone=True), nullable=True),  # End date (null = permanent)
)


class AuthorizedPickup(Base):
    """Adult authorized to pick up students from school.

    This model supports the "Retiros Autorizados" feature where schools maintain
    a whitelist of adults who can withdraw students during school hours.
    Identity verification can be done via QR code scan, photo match, or admin override.
    """

    __tablename__ = "authorized_pickups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Personal information
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    national_id: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)  # RUT/DNI
    relationship_type: Mapped[str] = mapped_column(String(100), nullable=False)  # Padre, Madre, Abuelo...
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Verification credentials
    qr_code_hash: Mapped[str | None] = mapped_column(String(64), unique=True, index=True, nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    # Audit fields
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
    # Note: No FK constraint - in multi-tenant setup, FKs to users don't work
    # because the FK would point to public.users but users are in tenant schemas.
    # Validated at application level instead.
    created_by_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Relationships
    students: Mapped[list["Student"]] = relationship(
        "Student",
        secondary=student_authorized_pickup_table,
        back_populates="authorized_pickups",
    )
    withdrawals: Mapped[list["StudentWithdrawal"]] = relationship(
        "StudentWithdrawal", back_populates="authorized_pickup"
    )

    def __repr__(self) -> str:
        return f"<AuthorizedPickup(id={self.id}, name='{self.full_name}', relationship='{self.relationship_type}')>"
