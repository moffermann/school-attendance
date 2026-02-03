"""Absence request management endpoints.

Enterprise pattern implementation with:
- Rate limiting: 60/min read, 30/min write, 10/min export/delete
- IP tracking via Request parameter
- Full CRUD operations
- Pagination and filtering
"""

import csv
from datetime import date
from io import StringIO

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Path,
    Query,
    Request,
    Response,
    UploadFile,
    status,
)

from app.core import deps
from app.core.auth import AuthUser
from app.core.deps import TenantAuthUser
from app.core.rate_limiter import limiter
from app.schemas.absences import (
    AbsenceCreate,
    AbsenceDeleteResponse,
    AbsenceFilters,
    AbsenceRead,
    AbsenceRejectRequest,
    AbsenceRequestCreate,
    AbsenceRequestRead,
    AbsenceStatsResponse,
    AbsenceStatus,
    AbsenceStatusUpdate,
    AbsenceType,
    PaginatedAbsences,
)
from app.services.absence_service import AbsenceService

router = APIRouter()


def _sanitize_csv_value(val: str | None) -> str:
    """Sanitize value for CSV to prevent formula injection.

    Excel and other spreadsheets interpret cells starting with =, +, -, @, |
    as formulas, which can be exploited for code execution.
    """
    if not val:
        return ""
    val = str(val)
    stripped = val.lstrip()
    if stripped and stripped[0] in "=+-@|":
        return "'" + val
    return val


# =============================================================================
# STATIC ROUTES FIRST (before path parameter routes)
# =============================================================================


@router.get("/stats", response_model=AbsenceStatsResponse)
@limiter.limit("60/minute")
async def get_absence_stats(
    request: Request,
    service: AbsenceService = Depends(deps.get_absence_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> AbsenceStatsResponse:
    """Get absence statistics (counts by status).

    Returns counts for PENDING, APPROVED, REJECTED, and total.
    """
    return await service.get_stats(user)


@router.get("/export", response_class=Response)
@limiter.limit("10/minute")
async def export_absences(
    request: Request,
    status_filter: str | None = Query(default=None, alias="status"),
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    service: AbsenceService = Depends(deps.get_absence_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> Response:
    """Export absences to CSV.

    Requires ADMIN, DIRECTOR, or INSPECTOR role.
    """
    filters = AbsenceFilters(
        status=status_filter,
        start_date=date.fromisoformat(start_date) if start_date else None,
        end_date=date.fromisoformat(end_date) if end_date else None,
    )
    absences = await service.list_absences_for_export(user, filters, request)

    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "ID",
            "Estudiante",
            "Curso",
            "Tipo",
            "Fecha Inicio",
            "Fecha Fin",
            "Dias",
            "Estado",
            "Razon Rechazo",
            "Comentario",
            "Fecha Solicitud",
        ]
    )

    for a in absences:
        days = (a.end_date - a.start_date).days + 1 if a.end_date and a.start_date else 0
        writer.writerow(
            [
                a.id,
                _sanitize_csv_value(a.student_name),
                _sanitize_csv_value(a.course_name) if a.course_name else "",
                a.type,
                a.start_date.isoformat() if a.start_date else "",
                a.end_date.isoformat() if a.end_date else "",
                days,
                a.status,
                _sanitize_csv_value(a.rejection_reason) if a.rejection_reason else "",
                _sanitize_csv_value(a.comment) if a.comment else "",
                a.ts_submitted.isoformat() if a.ts_submitted else "",
            ]
        )

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=ausencias.csv"},
    )


@router.get("/search", response_model=list[AbsenceRead])
@limiter.limit("60/minute")
async def search_absences(
    request: Request,
    q: str = Query(..., min_length=2, max_length=100),
    limit: int = Query(20, ge=1, le=50),
    service: AbsenceService = Depends(deps.get_absence_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> list[AbsenceRead]:
    """Search absences by student name or comment."""
    return await service.search_absences(user, q, limit=limit)


# =============================================================================
# PAGINATED LIST (new enterprise pattern)
# =============================================================================


@router.get("/paginated", response_model=PaginatedAbsences)
@limiter.limit("60/minute")
async def list_absences_paginated(
    request: Request,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_filter: str | None = Query(default=None, alias="status"),
    type_filter: str | None = Query(default=None, alias="type"),
    course_id: int | None = Query(default=None, ge=1),
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    service: AbsenceService = Depends(deps.get_absence_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> PaginatedAbsences:
    """List absence requests with filters and pagination.

    Returns items, total count, has_more, and counts by status for tabs.
    """
    filters = AbsenceFilters(
        status=status_filter,
        type=type_filter,
        course_id=course_id,
        start_date=date.fromisoformat(start_date) if start_date else None,
        end_date=date.fromisoformat(end_date) if end_date else None,
    )
    return await service.list_absences_paginated(user, filters, limit=limit, offset=offset)


# =============================================================================
# LEGACY LIST (backward compatibility)
# =============================================================================


@router.get("", response_model=list[AbsenceRequestRead])
@limiter.limit("60/minute")
async def list_absences(
    request: Request,
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    service: AbsenceService = Depends(deps.get_absence_service),
    user: AuthUser = Depends(deps.require_roles("PARENT", "ADMIN", "DIRECTOR", "INSPECTOR")),
) -> list[AbsenceRequestRead]:
    """List absences (legacy endpoint for backward compatibility)."""
    records = await service.list_absences(
        user, start_date=start_date, end_date=end_date, status=status_filter
    )
    return [
        AbsenceRequestRead(
            id=record.id,
            student_id=record.student_id,
            type=AbsenceType(record.type),
            start=record.start_date,
            end=record.end_date,
            comment=record.comment,
            attachment_name=record.attachment_ref,
            status=AbsenceStatus(record.status or AbsenceStatus.PENDING.value),
            ts_submitted=record.ts_submitted,
        )
        for record in records
    ]


# =============================================================================
# CREATE
# =============================================================================


@router.post("", response_model=AbsenceRequestRead, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def submit_absence_request(
    request: Request,
    payload: AbsenceRequestCreate,
    service: AbsenceService = Depends(deps.get_absence_service),
    user: AuthUser = Depends(deps.require_roles("PARENT", "ADMIN", "DIRECTOR", "INSPECTOR")),
) -> AbsenceRequestRead:
    """Submit a new absence request (legacy endpoint)."""
    try:
        record = await service.submit_absence(user, payload)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        message = str(exc) or "Solicitud invalida"
        status_code = (
            status.HTTP_404_NOT_FOUND
            if "not found" in message.lower()
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=status_code, detail=message) from exc

    status_value = record.status or AbsenceStatus.PENDING.value
    type_value = record.type or payload.type.value

    return AbsenceRequestRead(
        id=record.id,
        student_id=record.student_id,
        type=AbsenceType(type_value),
        start=record.start_date,
        end=record.end_date,
        comment=record.comment,
        attachment_name=record.attachment_ref,
        status=AbsenceStatus(status_value),
        ts_submitted=record.ts_submitted,
    )


@router.post("/new", response_model=AbsenceRead, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def create_absence(
    request: Request,
    payload: AbsenceCreate,
    service: AbsenceService = Depends(deps.get_absence_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> AbsenceRead:
    """Create a new absence request (new enterprise endpoint)."""
    return await service.create_absence(user, payload, request)


# =============================================================================
# READ SINGLE
# =============================================================================


@router.get("/{absence_id}", response_model=AbsenceRead)
@limiter.limit("60/minute")
async def get_absence(
    request: Request,
    absence_id: int = Path(..., ge=1),
    service: AbsenceService = Depends(deps.get_absence_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> AbsenceRead:
    """Get a single absence request by ID."""
    return await service.get_absence(user, absence_id)


# =============================================================================
# ACTIONS (approve, reject, delete)
# =============================================================================


@router.post("/{absence_id}/status", response_model=AbsenceRequestRead)
@limiter.limit("30/minute")
async def update_absence_status(
    request: Request,
    absence_id: int,
    payload: AbsenceStatusUpdate,
    service: AbsenceService = Depends(deps.get_absence_service),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR", "INSPECTOR")),
) -> AbsenceRequestRead:
    """Update absence status (legacy endpoint)."""
    try:
        record = await service.update_status(absence_id, payload.status)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return AbsenceRequestRead(
        id=record.id,
        student_id=record.student_id,
        type=AbsenceType(record.type),
        start=record.start_date,
        end=record.end_date,
        comment=record.comment,
        attachment_name=record.attachment_ref,
        status=AbsenceStatus(record.status or AbsenceStatus.PENDING.value),
        ts_submitted=record.ts_submitted,
    )


@router.post("/{absence_id}/approve", response_model=AbsenceRead)
@limiter.limit("30/minute")
async def approve_absence(
    request: Request,
    absence_id: int = Path(..., ge=1),
    service: AbsenceService = Depends(deps.get_absence_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> AbsenceRead:
    """Approve an absence request.

    Requires ADMIN, DIRECTOR, or INSPECTOR role.
    Only PENDING requests can be approved.
    """
    return await service.approve_absence(user, absence_id, request)


@router.post("/{absence_id}/reject", response_model=AbsenceRead)
@limiter.limit("30/minute")
async def reject_absence(
    request: Request,
    absence_id: int = Path(..., ge=1),
    payload: AbsenceRejectRequest = AbsenceRejectRequest(),
    service: AbsenceService = Depends(deps.get_absence_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> AbsenceRead:
    """Reject an absence request with optional reason.

    Requires ADMIN, DIRECTOR, or INSPECTOR role.
    Only PENDING requests can be rejected.
    """
    return await service.reject_absence(user, absence_id, payload, request)


@router.delete("/{absence_id}", response_model=AbsenceDeleteResponse)
@limiter.limit("10/minute")
async def delete_absence(
    request: Request,
    absence_id: int = Path(..., ge=1),
    service: AbsenceService = Depends(deps.get_absence_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> AbsenceDeleteResponse:
    """Delete a pending absence request.

    Requires ADMIN or DIRECTOR role.
    Only PENDING requests can be deleted.
    """
    result = await service.delete_absence(user, absence_id, request)
    return AbsenceDeleteResponse(**result)


@router.post("/{absence_id}/attachment", response_model=AbsenceRead)
@limiter.limit("10/minute")
async def upload_absence_attachment(
    request: Request,
    absence_id: int = Path(..., ge=1),
    file: UploadFile = File(...),
    service: AbsenceService = Depends(deps.get_absence_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> AbsenceRead:
    """Upload attachment for an absence request.

    Accepts PDF, JPG, or PNG files up to 5MB.
    Only the absence owner or admin roles can upload.
    Only PENDING requests can have attachments uploaded.
    """
    return await service.upload_attachment(user, absence_id, file, request)
