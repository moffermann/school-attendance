"""Guardian schemas."""

from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class GuardianStatus(StrEnum):
    """Status enum for guardians."""

    ACTIVE = "ACTIVE"
    DELETED = "DELETED"


class ChannelPreference(BaseModel):
    """Preference for a notification channel."""

    whatsapp: bool = True
    email: bool = False


class GuardianContacts(BaseModel):
    """Contact information for a guardian."""

    email: str | None = None
    phone: str | None = None
    whatsapp: str | None = None


class GuardianCreateRequest(BaseModel):
    """Request schema for creating a guardian."""

    full_name: str = Field(
        ..., min_length=2, max_length=255, description="Nombre completo del apoderado"
    )
    contacts: GuardianContacts | None = Field(default=None, description="Información de contacto")
    student_ids: list[int] | None = Field(default=None, description="IDs de estudiantes asociados")

    @field_validator("full_name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("El nombre no puede estar vacío")
        return v.strip()


class GuardianUpdateRequest(BaseModel):
    """Request schema for updating a guardian."""

    full_name: str | None = Field(None, min_length=2, max_length=255)
    contacts: GuardianContacts | None = None
    student_ids: list[int] | None = None

    @field_validator("full_name", mode="before")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("El nombre no puede estar vacío")
        return v.strip() if v else v


class GuardianResponse(BaseModel):
    """Response schema for guardian data."""

    id: int
    full_name: str
    contacts: dict[str, Any] = Field(default_factory=dict)
    student_ids: list[int] = Field(default_factory=list)
    status: str = "ACTIVE"
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class GuardianListItem(BaseModel):
    """Minimal guardian info for list views."""

    id: int
    full_name: str
    contacts: dict[str, Any] = Field(default_factory=dict)
    student_ids: list[int] = Field(default_factory=list)
    student_count: int = 0
    status: str = "ACTIVE"

    model_config = ConfigDict(from_attributes=True)


class GuardianFilters(BaseModel):
    """Filters for listing guardians."""

    status: str | None = Field(default=None)
    search: str | None = Field(None, max_length=100)

    model_config = ConfigDict(extra="forbid")


class GuardianWithStats(GuardianResponse):
    """Guardian with statistics."""

    students_count: int = 0


class PaginatedGuardians(BaseModel):
    """Paginated response for guardians."""

    items: list[GuardianListItem]
    total: int
    limit: int
    offset: int
    has_more: bool

    @classmethod
    def create(
        cls, items: list[GuardianListItem], total: int, limit: int, offset: int
    ) -> "PaginatedGuardians":
        """Factory method with correct has_more calculation."""
        return cls(
            items=items,
            total=total,
            limit=limit,
            offset=offset,
            has_more=(offset + len(items)) < total,
        )


class GuardianListResponse(BaseModel):
    """Paginated list of guardians (legacy format)."""

    items: list[GuardianListItem]
    total: int
    skip: int
    limit: int
    has_more: bool


class GuardianStudentsRequest(BaseModel):
    """Request schema for setting guardian's students."""

    student_ids: list[int] = Field(..., description="Lista de IDs de estudiantes")


class GuardianPreferencesRead(BaseModel):
    """Response schema for guardian preferences."""

    guardian_id: int
    preferences: dict[str, ChannelPreference] = Field(default_factory=dict)
    photo_consents: dict[str, bool] = Field(default_factory=dict)

    class Config:
        json_schema_extra = {
            "example": {
                "guardian_id": 1,
                "preferences": {
                    "INGRESO_OK": {"whatsapp": True, "email": False},
                    "SALIDA_OK": {"whatsapp": True, "email": False},
                    "NO_INGRESO_UMBRAL": {"whatsapp": True, "email": True},
                    "CAMBIO_HORARIO": {"whatsapp": True, "email": True},
                },
                "photo_consents": {"1": True, "2": False},
            }
        }


class GuardianPreferencesUpdate(BaseModel):
    """Request schema for updating guardian preferences."""

    # R3-V1 fix: Use proper type for preferences with ChannelPreference
    preferences: dict[str, ChannelPreference] | None = Field(default=None)
    photo_consents: dict[str, bool] | None = Field(default=None)

    class Config:
        json_schema_extra = {
            "example": {
                "preferences": {
                    "INGRESO_OK": {"whatsapp": True, "email": False},
                    "SALIDA_OK": {"whatsapp": True, "email": False},
                },
                "photo_consents": {"1": True, "2": False},
            }
        }
