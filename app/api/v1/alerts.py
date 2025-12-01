"""No-show alerts API."""

import csv
from datetime import date
from io import StringIO

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.core import deps
from app.core.auth import AuthUser
from app.schemas.alerts import NoShowAlertRead, NoShowAlertResolve
from app.services.alert_service import AlertService


router = APIRouter()


@router.get("/no-entry", response_model=list[NoShowAlertRead])
async def list_no_entry_alerts(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
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
            alert.guardian_name or "",
            alert.student_name or "",
            alert.course_name or "",
            alert.alert_date,
            alert.status,
            alert.notes or "",
        ])

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=no_show_alerts.csv"},
    )

