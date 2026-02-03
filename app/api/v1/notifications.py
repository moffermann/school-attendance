"""Notification endpoints."""

import csv
from datetime import datetime
from io import StringIO

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response

from app.core import deps
from app.core.auth import AuthUser
from app.schemas.notifications import (
    NotificationDispatchRequest,
    NotificationLog,
    NotificationRead,
    NotificationSummaryResponse,
)
from app.services.notification_service import NotificationService
from app.services.notifications.dispatcher import NotificationDispatcher

router = APIRouter()


def _sanitize_csv_value(val: str | None) -> str:
    """R5-A9 fix: Sanitize value for CSV to prevent formula injection.

    Excel and other spreadsheets interpret cells starting with =, +, -, @
    as formulas, which can be exploited for code execution.

    TDD-R2-BUG3 fix: Also handle whitespace-prefixed formulas.
    """
    if not val:
        return ""
    val = str(val)
    stripped = val.lstrip()
    if stripped and stripped[0] in "=+-@":
        return "'" + val  # Prefix with quote to prevent formula interpretation
    return val


@router.get("", response_model=list[NotificationLog])
async def list_notifications(
    status_filter: str | None = Query(default=None, alias="status"),
    channel: str | None = Query(default=None),
    template: str | None = Query(default=None),
    guardian_id: int | None = Query(default=None),
    student_id: int | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    service: NotificationService = Depends(deps.get_notification_service),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR", "INSPECTOR")),
) -> list[NotificationLog]:
    return await service.list_notifications(
        guardian_id=guardian_id,
        student_id=student_id,
        status=status_filter,
        channel=channel,
        template=template,
        limit=limit,
    )


@router.get("/summary", response_model=NotificationSummaryResponse)
async def notifications_summary(
    service: NotificationService = Depends(deps.get_notification_service),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR", "INSPECTOR")),
) -> NotificationSummaryResponse:
    return await service.summary()


@router.get("/export", response_class=Response)
async def export_notifications(
    status_filter: str | None = Query(default=None, alias="status"),
    channel: str | None = Query(default=None),
    template: str | None = Query(default=None),
    guardian_id: int | None = Query(default=None),
    student_id: int | None = Query(default=None),
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    limit: int = Query(default=500, ge=1, le=2000),
    service: NotificationService = Depends(deps.get_notification_service),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR", "INSPECTOR")),
) -> Response:
    logs = await service.list_notifications(
        guardian_id=guardian_id,
        student_id=student_id,
        status=status_filter,
        channel=channel,
        template=template,
        start=start,
        end=end,
        limit=limit,
    )

    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "ts_created",
            "ts_sent",
            "channel",
            "template",
            "status",
            "retries",
            "guardian_id",
            "student_id",
            "recipient",
        ]
    )
    for item in logs:
        recipient = ""
        if isinstance(item.payload, dict):
            recipient = item.payload.get("recipient") or item.payload.get("email") or ""
        writer.writerow(
            [
                item.ts_created,
                item.ts_sent or "",
                item.channel,
                item.template,
                item.status,
                item.retries or 0,
                item.guardian_id,
                item.student_id or "",
                _sanitize_csv_value(recipient),
            ]
        )

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=notifications.csv"},
    )


@router.post("/dispatch", response_model=NotificationRead, status_code=status.HTTP_202_ACCEPTED)
async def dispatch_notification(
    payload: NotificationDispatchRequest,
    dispatcher: NotificationDispatcher = Depends(deps.get_notification_dispatcher),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR", "INSPECTOR")),
) -> NotificationRead:
    """Encolar el envío de una notificación manual."""

    try:
        return await dispatcher.enqueue_manual_notification(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
