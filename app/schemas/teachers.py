"""Teacher schemas."""

from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class TeacherRead(BaseModel):
    """Teacher information."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str | None = None
    status: str = "ACTIVE"


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
