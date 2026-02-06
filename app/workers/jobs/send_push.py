"""Web Push notification worker job."""

import asyncio
import json
import logging
from typing import Any

from pywebpush import WebPushException, webpush

from app.core.config import settings

logger = logging.getLogger(__name__)


async def _send_push_async(
    subscription_info: dict[str, Any],
    payload: dict[str, Any],
    notification_id: int | None = None,
) -> bool:
    """Send a single push notification asynchronously.

    Args:
        subscription_info: Push subscription data (endpoint, keys)
        payload: Notification payload (title, body, url, etc.)
        notification_id: Optional notification ID for logging

    Returns:
        True if sent successfully, False otherwise
    """
    if not settings.vapid_private_key or not settings.vapid_public_key:
        logger.warning("[Push] VAPID keys not configured, skipping push notification")
        return False

    try:
        # Convert payload to JSON string
        data = json.dumps(payload)

        # Send push notification
        webpush(
            subscription_info=subscription_info,
            data=data,
            vapid_private_key=settings.vapid_private_key,
            vapid_claims={"sub": settings.vapid_subject},
        )

        log_id = notification_id or "unknown"
        logger.info(
            f"[Push] Sent notification {log_id} to {subscription_info.get('endpoint', '')[:50]}..."
        )
        return True

    except WebPushException as e:
        logger.error(f"[Push] WebPush error: {e}")

        # Check for subscription expired/invalid
        if e.response and e.response.status_code in (404, 410):
            logger.warning(
                f"[Push] Subscription expired or invalid for {subscription_info.get('endpoint', '')[:50]}..., "
                "should be removed"
            )
        return False

    except Exception as e:
        logger.error(f"[Push] Unexpected error sending push: {e}")
        return False


def send_push_notification(
    notification_id: int,
    subscription_info: dict[str, Any],
    payload: dict[str, Any],
    tenant_id: int | None = None,
    tenant_schema: str | None = None,
) -> bool:
    """Worker job to send a push notification.

    Args:
        notification_id: ID of the notification record
        subscription_info: Push subscription (endpoint, keys.p256dh, keys.auth)
        payload: Notification content (title, body, icon, url, tag, etc.)
        tenant_id: Optional tenant ID for multi-tenant support
        tenant_schema: Optional tenant schema for multi-tenant support (not used yet)

    Returns:
        True if successful, False otherwise
    """
    log_prefix = f"[Push][Tenant:{tenant_id or 'default'}]"

    if not settings.enable_real_notifications:
        logger.info(
            f"{log_prefix} SIMULATED push to {subscription_info.get('endpoint', '')[:50]}..."
        )
        logger.debug(f"{log_prefix} Payload: {payload}")
        return True

    try:
        # Run async function in event loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                _send_push_async(subscription_info, payload, notification_id)
            )
            return result
        finally:
            loop.close()

    except Exception as e:
        logger.error(f"{log_prefix} Error in send_push_notification: {e}")
        return False


def send_push_batch(
    notifications: list[dict[str, Any]],
    tenant_id: int | None = None,
) -> dict[str, int]:
    """Send multiple push notifications in batch.

    Args:
        notifications: List of dicts with notification_id, subscription_info, payload
        tenant_id: Optional tenant ID

    Returns:
        Dict with success/failure counts
    """
    success = 0
    failed = 0

    for notif in notifications:
        result = send_push_notification(
            notification_id=notif.get("notification_id", 0),
            subscription_info=notif.get("subscription_info", {}),
            payload=notif.get("payload", {}),
            tenant_id=tenant_id,
        )
        if result:
            success += 1
        else:
            failed += 1

    return {"success": success, "failed": failed}
