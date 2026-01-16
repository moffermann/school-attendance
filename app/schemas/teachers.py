"""Teacher schemas."""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class TeacherStatus(str, Enum):
    """Status enum for teachers."""

    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    ON_LEAVE = "ON_LEAVE"
    DELETED = "DELETED"


class TeacherRead(BaseModel):
    """Teacher information."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str | None = None
    status: str = "ACTIVE"
    can_enroll_biometric: bool = False
    created_at: datetime | None = None
    updated_at: datetime | None = None


class TeacherCreate(BaseModel):
    """Schema for creating a new teacher."""

    full_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr | None = None
    status: str = Field(default="ACTIVE", pattern="^(ACTIVE|INACTIVE|ON_LEAVE)$")
    can_enroll_biometric: bool = False

    @field_validator("full_name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("El nombre no puede estar vacío")
        return v.strip()

    @field_validator("email", mode="before")
    @classmethod
    def validate_email(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip().lower()
            if v and "@" not in v:
                raise ValueError("Email inválido")
        return v if v else None


class TeacherUpdate(BaseModel):
    """Schema for updating a teacher."""

    full_name: str | None = Field(default=None, min_length=2, max_length=255)
    email: EmailStr | None = None
    status: str | None = Field(default=None, pattern="^(ACTIVE|INACTIVE|ON_LEAVE)$")
    can_enroll_biometric: bool | None = None

    @field_validator("full_name", mode="before")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("El nombre no puede estar vacío")
        return v.strip() if v else v

    @field_validator("email", mode="before")
    @classmethod
    def validate_email(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip().lower()
            if v and "@" not in v:
                raise ValueError("Email inválido")
        return v if v else None


class TeacherFilters(BaseModel):
    """Filters for listing teachers."""

    status: str | None = Field(default=None)
    search: str | None = Field(None, max_length=100)

    model_config = ConfigDict(extra="forbid")


class TeacherWithStats(TeacherRead):
    """Teacher with statistics."""

    courses_count: int = 0


class PaginatedTeachers(BaseModel):
    """Paginated response for teachers."""

    items: list[TeacherRead]
    total: int
    limit: int
    offset: int
    has_more: bool

    @classmethod
    def create(cls, items: list, total: int, limit: int, offset: int) -> "PaginatedTeachers":
        """Factory method with correct has_more calculation."""
        return cls(
            items=items,
            total=total,
            limit=limit,
            offset=offset,
            has_more=(offset + len(items)) < total,
        )


class TeacherListResponse(BaseModel):
    """Paginated list of teachers (legacy format)."""

    items: list[TeacherRead]
    total: int
    page: int
    page_size: int
    pages: int


class TeacherCourseRead(BaseModel):
    """Course information for teachers."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    grade: str


class TeacherStudentRead(BaseModel):
    """Student information for teacher's roster."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    status: str = "ACTIVE"


class TeacherMeResponse(BaseModel):
    """Response for /teachers/me endpoint."""

    teacher: TeacherRead
    courses: list[TeacherCourseRead]


class AttendanceType(str, Enum):
    """R3-V10 fix: Valid attendance event types."""
    IN = "IN"
    OUT = "OUT"


class BulkAttendanceItem(BaseModel):
    """Single attendance item in bulk submission."""

    student_id: int
    # R3-V10 fix: Use enum for type validation
    type: AttendanceType
    occurred_at: str | None = None  # ISO format, optional


class BulkAttendanceRequest(BaseModel):
    """Request for bulk attendance submission."""

    course_id: int
    gate_id: str
    device_id: str
    # R3-V9 fix: Limit max items in bulk request
    events: list[BulkAttendanceItem] = Field(..., max_length=500)


class BulkAttendanceResponse(BaseModel):
    """Response for bulk attendance submission."""

    processed: int
    errors: list[str]
