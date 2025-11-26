"""Teacher schemas."""

from pydantic import BaseModel, ConfigDict


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


class BulkAttendanceItem(BaseModel):
    """Single attendance item in bulk submission."""

    student_id: int
    type: str  # "IN" or "OUT"
    occurred_at: str | None = None  # ISO format, optional


class BulkAttendanceRequest(BaseModel):
    """Request for bulk attendance submission."""

    course_id: int
    gate_id: str
    device_id: str
    events: list[BulkAttendanceItem]


class BulkAttendanceResponse(BaseModel):
    """Response for bulk attendance submission."""

    processed: int
    errors: list[str]
