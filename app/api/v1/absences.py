"""Absence request endpoints."""

import csv
from datetime import date
from io import StringIO

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response

from app.core import deps
from app.core.auth import AuthUser
from app.schemas.absences import AbsenceRequestCreate, AbsenceRequestRead, AbsenceStatus, AbsenceStatusUpdate, AbsenceType
from app.services.absence_service import AbsenceService


router = APIRouter()


def _sanitize_csv_value(val: str | None) -> str:
    """R5-A7 fix: Sanitize value for CSV to prevent formula injection.

    Excel and other spreadsheets interpret cells starting with =, +, -, @
    as formulas, which can be exploited for code execution.

    TDD-R2-BUG3 fix: Also handle whitespace-prefixed formulas.
    """
    if not val:
        return ""
    val = str(val)
    stripped = val.lstrip()
    if stripped and stripped[0] in '=+-@':
        return "'" + val  # Prefix with quote to prevent formula interpretation
    return val


@router.get("", response_model=list[AbsenceRequestRead])
async def list_absences(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    service: AbsenceService = Depends(deps.get_absence_service),
    user: AuthUser = Depends(deps.require_roles("PARENT", "ADMIN", "DIRECTOR", "INSPECTOR")),
) -> list[AbsenceRequestRead]:
    records = await service.list_absences(user, start_date=start_date, end_date=end_date, status=status_filter)
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


@router.get("/export", response_class=Response)
async def export_absences(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    service: AbsenceService = Depends(deps.get_absence_service),
    user: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR", "INSPECTOR")),
) -> Response:
    # Use the actual authenticated user instead of a fake admin user
    # Staff roles (ADMIN, DIRECTOR, INSPECTOR) are already verified by require_roles
    records = await service.list_absences(user, start_date=start_date, end_date=end_date, status=status_filter)

    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["student_id", "type", "start", "end", "status", "comment", "attachment"])
    for record in records:
        writer.writerow([
            record.student_id,
            record.type,
            record.start_date,
            record.end_date,
            record.status,
            _sanitize_csv_value(record.comment),
            _sanitize_csv_value(record.attachment_ref),
        ])

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=absences.csv"},
    )


@router.post("", response_model=AbsenceRequestRead, status_code=201)
async def submit_absence_request(
    payload: AbsenceRequestCreate,
    service: AbsenceService = Depends(deps.get_absence_service),
    user: AuthUser = Depends(deps.require_roles("PARENT", "ADMIN", "DIRECTOR", "INSPECTOR")),
) -> AbsenceRequestRead:
    try:
        record = await service.submit_absence(user, payload)
    except PermissionError as exc:  # pragma: no cover - guard rails
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        message = str(exc) or "Solicitud inválida"
        status_code = status.HTTP_404_NOT_FOUND if "not found" in message.lower() else status.HTTP_400_BAD_REQUEST
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


@router.post("/{absence_id}/status", response_model=AbsenceRequestRead)
async def update_absence_status(
    absence_id: int,
    payload: AbsenceStatusUpdate,
    service: AbsenceService = Depends(deps.get_absence_service),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR", "INSPECTOR")),
) -> AbsenceRequestRead:
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
