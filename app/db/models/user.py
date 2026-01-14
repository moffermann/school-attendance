"""User model for authentication."""

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    guardian_id: Mapped[int | None] = mapped_column(ForeignKey("guardians.id"))
    teacher_id: Mapped[int | None] = mapped_column(ForeignKey("teachers.id"))

    guardian = relationship("Guardian", backref="users")
    teacher = relationship("Teacher", backref="users")
    webauthn_credentials = relationship(
        "WebAuthnCredential", back_populates="user", cascade="all, delete-orphan"
    )
    push_subscriptions = relationship(
        "PushSubscription", back_populates="user", cascade="all, delete-orphan"
    )
