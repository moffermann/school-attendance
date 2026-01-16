"""Student schemas."""

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StudentStatus(str, Enum):
    """Status enum for students."""

    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    DELETED = "DELETED"


class StudentRead(BaseModel):
    """Student information."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    national_id: str | None = None
    course_id: int
    status: str = "ACTIVE"
    photo_url: str | None = None
    evidence_preference: str = "none"
    created_at: datetime | None = None
    updated_at: datetime | None = None


class StudentCreate(BaseModel):
    """Schema for creating a new student."""

    full_name: str = Field(..., min_length=2, max_length=255)
    course_id: int = Field(..., ge=1)
    national_id: str | None = Field(default=None, max_length=20)
    evidence_preference: Literal["photo", "audio", "none"] = Field(default="none")
    status: str = Field(default="ACTIVE")

    @field_validator("full_name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("El nombre no puede estar vacío")
        return v.strip()


class StudentUpdate(BaseModel):
    """Schema for updating a student."""

    full_name: str | None = Field(default=None, min_length=2, max_length=255)
    course_id: int | None = Field(default=None, ge=1)
    national_id: str | None = None
    evidence_preference: Literal["photo", "audio", "none"] | None = None
    status: str | None = None

    @field_validator("full_name", mode="before")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("El nombre no puede estar vacío")
        return v.strip() if v else v


class StudentFilters(BaseModel):
    """Filters for listing students."""

    status: str | None = Field(default=None)
    course_id: int | None = Field(default=None, ge=1)
    search: str | None = Field(default=None, max_length=100)
    include_deleted: bool = Field(default=False)

    model_config = ConfigDict(extra="forbid")


class StudentWithStats(StudentRead):
    """Student with statistics."""

    course_name: str | None = None
    guardians_count: int = 0
    attendance_events_count: int = 0
    last_attendance_date: datetime | None = None
    has_photo: bool = False
    photo_presigned_url: str | None = None


class StudentPhotoResponse(BaseModel):
    """Response schema for student photo operations."""

    id: int
    full_name: str
    photo_url: str | None
    photo_presigned_url: str | None


class StudentDeleteResponse(BaseModel):
    """Response schema for student delete operation."""

    deleted: bool
    warnings: list[str] = Field(default_factory=list)


class PaginatedStudents(BaseModel):
    """Paginated response for students."""

    items: list[StudentRead]
    total: int
    limit: int
    offset: int
    has_more: bool

    @classmethod
    def create(cls, items: list, total: int, limit: int, offset: int) -> "PaginatedStudents":
        """Factory method with correct has_more calculation."""
        return cls(
            items=items,
            total=total,
            limit=limit,
            offset=offset,
            has_more=(offset + len(items)) < total,
        )


class StudentListResponse(BaseModel):
    """Paginated list response for students (legacy format)."""

    items: list[StudentRead] = Field(default_factory=list)
    total: int = Field(..., ge=0)
    skip: int = Field(..., ge=0)
    limit: int = Field(..., ge=1)
    has_more: bool
