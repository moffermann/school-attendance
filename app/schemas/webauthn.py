"""WebAuthn/Passkey authentication schemas."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

# =============================================================================
# Registration Schemas
# =============================================================================


class StartRegistrationRequest(BaseModel):
    """Request to start WebAuthn credential registration."""

    device_name: str | None = Field(
        None,
        max_length=100,
        description="Human-readable name for this credential (e.g., 'Kiosk Entrada')",
    )


class StartRegistrationResponse(BaseModel):
    """Response containing WebAuthn registration options."""

    challenge_id: str = Field(..., description="ID to reference this challenge during completion")
    options: dict[str, Any] = Field(
        ...,
        description="PublicKeyCredentialCreationOptions to pass to navigator.credentials.create()",
    )


class CompleteRegistrationRequest(BaseModel):
    """Request to complete WebAuthn credential registration."""

    challenge_id: str = Field(..., description="Challenge ID from start registration")
    credential: dict[str, Any] = Field(
        ..., description="Credential response from navigator.credentials.create()"
    )


class CredentialResponse(BaseModel):
    """Response after successful credential registration."""

    credential_id: str
    device_name: str | None
    created_at: datetime

    class Config:
        from_attributes = True


# =============================================================================
# Authentication Schemas
# =============================================================================


class StartAuthenticationResponse(BaseModel):
    """Response containing WebAuthn authentication options."""

    challenge_id: str = Field(..., description="ID to reference this challenge during verification")
    options: dict[str, Any] = Field(
        ..., description="PublicKeyCredentialRequestOptions to pass to navigator.credentials.get()"
    )


class VerifyAuthenticationRequest(BaseModel):
    """Request to verify WebAuthn authentication."""

    challenge_id: str = Field(..., description="Challenge ID from start authentication")
    credential: dict[str, Any] = Field(
        ..., description="Credential response from navigator.credentials.get()"
    )


class StudentAuthenticationResponse(BaseModel):
    """Response after successful student biometric authentication."""

    student_id: int
    full_name: str
    national_id: str | None
    course_id: int | None
    photo_url: str | None

    class Config:
        from_attributes = True


# =============================================================================
# Credential Management Schemas
# =============================================================================


class CredentialListItem(BaseModel):
    """Credential info for listing."""

    credential_id: str
    device_name: str | None
    created_at: datetime
    last_used_at: datetime | None

    class Config:
        from_attributes = True


class CredentialListResponse(BaseModel):
    """Response containing list of credentials."""

    credentials: list[CredentialListItem]
    count: int


class DeleteCredentialResponse(BaseModel):
    """Response after deleting a credential."""

    deleted: bool
    message: str


# =============================================================================
# Biometric Status Schemas
# =============================================================================


class BiometricStatusResponse(BaseModel):
    """Response indicating biometric enrollment status."""

    has_biometric: bool
    credential_count: int


# =============================================================================
# Kiosk-specific Schemas
# =============================================================================


class KioskStudentRegistrationRequest(BaseModel):
    """Request from kiosk to start student biometric registration."""

    student_id: int = Field(..., description="ID of the student to enroll")
    device_name: str | None = Field(
        None, max_length=100, description="Name for this credential (defaults to kiosk device name)"
    )


class KioskAuthenticationResult(BaseModel):
    """Result of kiosk biometric authentication including attendance data."""

    student_id: int
    full_name: str
    national_id: str | None
    course_name: str | None
    photo_url: str | None
    # For attendance flow integration
    has_photo_consent: bool = False
