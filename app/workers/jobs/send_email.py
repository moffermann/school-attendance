"""RQ job for SES email send."""

from __future__ import annotations

import asyncio
import html
from loguru import logger
from requests.exceptions import ConnectionError, Timeout

from app.db.repositories.notifications import NotificationRepository
from app.db.session import async_session
from app.services.notifications.ses_email import SESEmailClient, mask_email


# R6-W1 fix: Constants for retry logic (same as send_whatsapp.py)
MAX_RETRIES = 3
TRANSIENT_ERRORS = (ConnectionError, Timeout, TimeoutError, OSError)


def _escape_html_value(value: str) -> str:
    """R6-W2 fix: Escape HTML to prevent XSS in email body."""
    if not isinstance(value, str):
        value = str(value) if value is not None else ""
    return html.escape(value)


async def _send(notification_id: int, to: str, template: str, variables: dict) -> None:
    async with async_session() as session:
        repo = NotificationRepository(session)
        notification = await repo.get(notification_id)
        if notification is None:
            logger.error("Notification %s not found", notification_id)
            return

        client = SESEmailClient()
        subject = f"Notificación {template.replace('_', ' ').title()}"
        # R6-W2 fix: Escape HTML in variables to prevent XSS
        body_lines = [
            f"<p><strong>{_escape_html_value(key)}</strong>: {_escape_html_value(str(value))}</p>"
            for key, value in variables.items()
        ]
        body_html = "".join(body_lines) or "<p>Se ha generado una notificación.</p>"

        try:
            await client.send_email(to=to, subject=subject, body_html=body_html)
            await repo.mark_sent(notification)
            await session.commit()
            logger.info("[Worker] Email sent notification_id=%s to=%s", notification_id, mask_email(to))
        except TRANSIENT_ERRORS as exc:
            # R6-W1 fix: Transient errors should allow retry
            current_retries = notification.retries or 0
            if current_retries < MAX_RETRIES:
                notification.retries = current_retries + 1
                await session.commit()
                logger.warning(
                    "Email transient error notification_id=%s retry=%d/%d error=%s",
                    notification_id, current_retries + 1, MAX_RETRIES, exc
                )
                raise  # Let RQ retry the job
            else:
                await repo.mark_failed(notification)
                await session.commit()
                logger.error(
                    "Email send failed after %d retries notification_id=%s error=%s",
                    MAX_RETRIES, notification_id, exc
                )
                raise
        except Exception as exc:  # pragma: no cover - permanent failure
            await repo.mark_failed(notification)
            await session.commit()
            logger.error("Email send failed notification_id=%s error=%s", notification_id, exc)
            raise


def send_email_message(notification_id: int, to: str, template: str, variables: dict) -> None:
    asyncio.run(_send(notification_id, to, template, variables))
