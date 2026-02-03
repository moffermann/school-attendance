from app.schemas.notifications import (
    NotificationChannel,
    NotificationDispatchRequest,
    NotificationType,
)


def test_notification_dispatch_request_defaults() -> None:
    payload = NotificationDispatchRequest(
        guardian_id=1,
        channel=NotificationChannel.WHATSAPP,
        template=NotificationType.INGRESO_OK,
    )

    assert payload.variables == {}
