"""Schemas for course management."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from pydantic import BaseModel, ConfigDict, Field, field_validator

if TYPE_CHECKING:
    from app.db.models.course import Course


class CourseStatus(str, Enum):
    """Status enum for courses."""

    ACTIVE = "ACTIVE"
    DELETED = "DELETED"
    ARCHIVED = "ARCHIVED"


class CourseCreate(BaseModel):
    """Schema for creating a course."""

    name: str = Field(..., min_length=1, max_length=128)
    grade: str = Field(..., min_length=1, max_length=32)
    teacher_ids: list[int] = Field(default_factory=list)

    @field_validator("name", "grade")
    @classmethod
    def validate_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("El campo no puede estar vacio")
        return v.strip()


class CourseUpdate(BaseModel):
    """Schema for updating a course."""

    name: str | None = Field(None, min_length=1, max_length=128)
    grade: str | None = Field(None, min_length=1, max_length=32)
    teacher_ids: list[int] | None = None

    @field_validator("name", "grade", mode="before")
    @classmethod
    def validate_not_empty_if_provided(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("El campo no puede estar vacio")
        return v.strip() if v else v


class CourseRead(BaseModel):
    """Schema for reading a course."""

    id: int
    name: str
    grade: str
    status: str
    teacher_ids: list[int] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_orm_with_teachers(cls, course: "Course") -> "CourseRead":
        """Create CourseRead with teacher_ids populated from relationship."""
        return cls(
            id=course.id,
            name=course.name,
            grade=course.grade,
            status=course.status,
            teacher_ids=[t.id for t in (course.teachers or [])],
            created_at=course.created_at,
            updated_at=course.updated_at,
        )


class CourseWithStats(CourseRead):
    """Schema for course with statistics."""

    active_students_count: int = 0
    schedules_count: int = 0
    enrollments_count: int = 0


class CourseFilters(BaseModel):
    """Filters for listing courses."""

    grade: str | None = None
    status: str | None = Field(default="ACTIVE")
    search: str | None = Field(None, max_length=100)

    model_config = ConfigDict(extra="forbid")


class PaginatedCourses(BaseModel):
    """Paginated response for courses."""

    items: list[CourseRead]
    total: int
    limit: int
    offset: int
    has_more: bool
