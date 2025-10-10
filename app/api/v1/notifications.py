"""Notification endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.core import deps
from app.core.auth import AuthUser
from app.schemas.notifications import NotificationDispatchRequest, NotificationRead
from app.services.notifications.dispatcher import NotificationDispatcher


router = APIRouter()


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
