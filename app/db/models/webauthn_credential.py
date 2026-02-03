"""WebAuthn Credential model for biometric authentication."""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, LargeBinary, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.student import Student
    from app.db.models.user import User


def _utc_now() -> datetime:
    """R6-M3 fix: Return timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)


class WebAuthnCredential(Base):
    """
    Stores WebAuthn/Passkey credentials for biometric authentication.

    A credential can be associated with either:
    - A student (for kiosk attendance via fingerprint/biometric)
    - A user (for web-app/teacher-pwa login via passkey)

    The credential stores the public key and metadata needed to verify
    authentication assertions from the authenticator device.
    """

    __tablename__ = "webauthn_credentials"

    # Credential ID from the authenticator (base64url encoded, used as PK)
    credential_id: Mapped[str] = mapped_column(String(512), primary_key=True)

    # Foreign keys - credential belongs to either a student OR a user
    student_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=True, index=True
    )
    user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )

    # WebAuthn user handle - random 32 bytes, unique per credential
    # This is returned by the authenticator during authentication to identify the user
    user_handle: Mapped[bytes] = mapped_column(LargeBinary(64), nullable=False, unique=True)

    # Public key in COSE format (used to verify signatures)
    public_key: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)

    # Sign counter - increments on each use, helps detect cloned credentials
    sign_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Transports supported by the authenticator (comma-separated: usb,nfc,ble,internal)
    transports: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Human-readable name for the credential (e.g., "Kiosk Entrada Principal", "Mi iPhone")
    device_name: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Timestamps
    # R6-M3 fix: Use timezone-aware datetime
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utc_now
    )
    # R9-M7 fix: Use timezone=True for consistency with created_at
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    student: Mapped["Student"] = relationship(  # noqa: F821
        "Student", back_populates="webauthn_credentials"
    )
    user: Mapped["User"] = relationship(  # noqa: F821
        "User", back_populates="webauthn_credentials"
    )

    def __repr__(self) -> str:
        owner = f"student_id={self.student_id}" if self.student_id else f"user_id={self.user_id}"
        return f"<WebAuthnCredential {self.credential_id[:16]}... {owner}>"
