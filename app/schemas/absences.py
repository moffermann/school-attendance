"""Schemas for absence requests."""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AbsenceType(str, Enum):
    MEDICAL = "MEDICAL"
    FAMILY = "FAMILY"
    VACATION = "VACATION"
    OTHER = "OTHER"


class AbsenceStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


# =============================================================================
# Request schemas
# =============================================================================


class AbsenceRequestCreate(BaseModel):
    """Schema para crear una nueva solicitud de ausencia."""

    student_id: int = Field(..., ge=1)
    type: AbsenceType
    start: date
    end: date
    comment: str | None = Field(default=None, max_length=1000)
    attachment_name: str | None = None

    @model_validator(mode="after")
    def validate_dates(self) -> "AbsenceRequestCreate":
        if self.end < self.start:
            raise ValueError("La fecha de fin no puede ser anterior a la fecha de inicio")
        # Validacion de rango maximo de 30 dias
        if (self.end - self.start).days > 30:
            raise ValueError("El rango maximo es 30 dias")
        return self


class AbsenceCreate(BaseModel):
    """Schema alternativo con nombres de campo estandarizados."""

    student_id: int = Field(..., ge=1)
    type: str = Field(..., max_length=32)
    start_date: date
    end_date: date
    comment: str | None = Field(default=None, max_length=1000)
    attachment_ref: str | None = None

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def validate_date_range(self) -> "AbsenceCreate":
        if self.end_date < self.start_date:
            raise ValueError("Fecha de termino debe ser mayor o igual a fecha de inicio")
        if (self.end_date - self.start_date).days > 30:
            raise ValueError("El rango maximo es 30 dias")
        return self


class AbsenceFilters(BaseModel):
    """Filtros para listar ausencias."""

    status: str | None = Field(default=None)
    type: str | None = Field(default=None)
    student_id: int | None = Field(default=None, ge=1)
    course_id: int | None = Field(default=None, ge=1)
    start_date: date | None = Field(default=None)
    end_date: date | None = Field(default=None)
    search: str | None = Field(default=None, max_length=100)

    model_config = ConfigDict(extra="forbid")


class AbsenceRejectRequest(BaseModel):
    """Payload para rechazar una solicitud."""

    rejection_reason: str | None = Field(default=None, max_length=500)


class AbsenceStatusUpdate(BaseModel):
    """Update de estado legacy."""

    status: AbsenceStatus


# =============================================================================
# Response schemas
# =============================================================================


class AbsenceRequestRead(BaseModel):
    """Schema legacy de lectura."""

    id: int
    student_id: int
    type: AbsenceType
    start: date
    end: date
    comment: str | None = None
    attachment_name: str | None = None
    status: AbsenceStatus
    ts_submitted: datetime


class AbsenceRead(BaseModel):
    """Schema completo de lectura con campos adicionales."""

    id: int
    student_id: int
    student_name: str | None = None
    course_name: str | None = None
    type: str
    start_date: date
    end_date: date
    comment: str | None = None
    attachment_ref: str | None = None
    attachment_url: str | None = None
    status: str
    rejection_reason: str | None = None
    ts_submitted: datetime
    ts_resolved: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class AbsenceWithStats(AbsenceRead):
    """Ausencia con estadisticas adicionales."""

    days_count: int = 0  # end_date - start_date + 1


class AbsenceRequestList(BaseModel):
    """Lista legacy de ausencias."""

    items: list[AbsenceRequestRead] = Field(default_factory=list)


class PaginatedAbsences(BaseModel):
    """Respuesta paginada de ausencias."""

    items: list[AbsenceRead]
    total: int
    limit: int
    offset: int
    has_more: bool
    counts: dict[str, int] = Field(default_factory=dict)

    @classmethod
    def create(
        cls,
        items: list[AbsenceRead],
        total: int,
        limit: int,
        offset: int,
        counts: dict[str, int] | None = None,
    ) -> "PaginatedAbsences":
        return cls(
            items=items,
            total=total,
            limit=limit,
            offset=offset,
            has_more=(offset + len(items)) < total,
            counts=counts or {},
        )


class AbsenceStatsResponse(BaseModel):
    """Estadisticas de ausencias por estado."""

    pending: int = 0
    approved: int = 0
    rejected: int = 0
    total: int = 0


class AbsenceDeleteResponse(BaseModel):
    """Respuesta de eliminacion."""

    deleted: bool
    id: int
