"""No-show alerts API."""

import csv
from datetime import date
from enum import Enum
from io import StringIO

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.core import deps
from app.core.auth import AuthUser
from app.schemas.alerts import NoShowAlertRead, NoShowAlertResolve
from app.services.alert_service import AlertService


router = APIRouter()


# R5-A1 fix: Enum for valid alert statuses
class AlertStatusFilter(str, Enum):
    """Valid status values for filtering alerts."""
    PENDING = "PENDING"
    RESOLVED = "RESOLVED"


@router.get("/no-entry", response_model=list[NoShowAlertRead])
async def list_no_entry_alerts(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    # R5-A1 fix: Use enum for validated status filter
    status_filter: AlertStatusFilter | None = Query(default=None, alias="status"),
    course_id: int | None = Query(default=None),
    guardian_id: int | None = Query(default=None),
    student_id: int | None = Query(default=None),
    limit: int | None = Query(default=100, ge=1, le=500),
    offset: int | None = Query(default=0, ge=0),
    service: AlertService = Depends(deps.get_alert_service),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR", "INSPECTOR")),
) -> list[NoShowAlertRead]:
    alerts = await service.list_alerts(
        start_date=start_date,
        end_date=end_date,
        status=status_filter,
        course_id=course_id,
        guardian_id=guardian_id,
        student_id=student_id,
        limit=limit,
        offset=offset,
    )
    return alerts


@router.post("/no-entry/{alert_id}/resolve", response_model=NoShowAlertRead)
async def resolve_alert(
    alert_id: int,
    payload: NoShowAlertResolve,
    service: AlertService = Depends(deps.get_alert_service),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR", "INSPECTOR")),
) -> NoShowAlertRead:
    try:
        return await service.resolve_alert(alert_id, payload.notes)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


def _sanitize_csv_value(val: str | None) -> str:
    """Sanitize value for CSV to prevent formula injection (B18 fix).

    Excel and other spreadsheets interpret cells starting with =, +, -, @
    as formulas, which can be exploited for code execution.
    """
    if not val:
        return ""
    val = str(val)
    if val and val[0] in '=+-@':
        return "'" + val  # Prefix with quote to prevent formula interpretation
    return val


@router.get("/no-entry/export")
async def export_no_entry_alerts(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    course_id: int | None = Query(default=None),
    guardian_id: int | None = Query(default=None),
    student_id: int | None = Query(default=None),
    service: AlertService = Depends(deps.get_alert_service),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR", "INSPECTOR")),
) -> Response:
    alerts = await service.list_alerts(
        start_date=start_date,
        end_date=end_date,
        status=status_filter,
        course_id=course_id,
        guardian_id=guardian_id,
        student_id=student_id,
        limit=None,
        offset=None,
    )

    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["guardian", "student", "course", "date", "status", "notes"])
    for alert in alerts:
        writer.writerow([
            _sanitize_csv_value(alert.guardian_name),
            _sanitize_csv_value(alert.student_name),
            _sanitize_csv_value(alert.course_name),
            alert.alert_date,
            _sanitize_csv_value(alert.status),
            _sanitize_csv_value(alert.notes),
        ])

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=no_show_alerts.csv"},
    )

