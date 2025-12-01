"""RQ job for WhatsApp send."""

from __future__ import annotations

import asyncio
from loguru import logger

from app.db.repositories.notifications import NotificationRepository
from app.db.session import async_session
from app.services.notifications.whatsapp import WhatsAppClient


# Message templates for attendance notifications
ATTENDANCE_MESSAGES = {
    "INGRESO_OK": "Ingreso registrado: {student_name} ingresó al colegio el {date} a las {time}.",
    "SALIDA_OK": "Salida registrada: {student_name} salió del colegio el {date} a las {time}.",
}


def _sanitize_format_value(value: str) -> str:
    """Sanitize a value to prevent format string injection.

    Escapes curly braces to prevent {variable} injection attacks.
    """
    if not isinstance(value, str):
        value = str(value) if value is not None else ""
    return value.replace("{", "{{").replace("}", "}}")


def _build_caption(template: str, variables: dict) -> str:
    """Build message caption from template and variables.

    Sanitizes all variable values to prevent format string injection.
    """
    # Sanitize all string variables to prevent injection
    safe_vars = {
        k: _sanitize_format_value(v) if isinstance(v, str) else v
        for k, v in variables.items()
    }

    message_template = ATTENDANCE_MESSAGES.get(template)
    if message_template:
        try:
            return message_template.format(**safe_vars)
        except KeyError:
            pass
    # Fallback to basic message
    student_name = safe_vars.get("student_name", "Alumno")
    event_type = "ingresó" if template == "INGRESO_OK" else "salió"
    time = safe_vars.get("time", "")
    date = safe_vars.get("date", "")
    return f"{student_name} {event_type} del colegio el {date} a las {time}."


async def _send(notification_id: int, to: str, template: str, variables: dict) -> None:
    async with async_session() as session:
        repo = NotificationRepository(session)
        notification = await repo.get(notification_id)
        if notification is None:
            logger.error("Notification %s not found", notification_id)
            return

        client = WhatsAppClient()
        try:
            photo_url = variables.get("photo_url")
            has_photo = variables.get("has_photo", False)

            if has_photo and photo_url:
                # Send image message with caption
                caption = _build_caption(template, variables)
                await client.send_image_message(
                    to=to,
                    image_url=photo_url,
                    caption=caption,
                )
            else:
                # Send template message without image
                # Build components for WhatsApp template
                template_params = [
                    variables.get("student_name", ""),
                    variables.get("date", ""),
                    variables.get("time", ""),
                ]
                components = [
                    {
                        "type": "body",
                        "parameters": [
                            {"type": "text", "text": str(param)}
                            for param in template_params
                            if param
                        ],
                    }
                ]
                await client.send_template(to=to, template=template, components=components)

            await repo.mark_sent(notification)
            await session.commit()
            logger.info(
                "[Worker] WhatsApp sent notification_id=%s to=%s with_photo=%s",
                notification_id,
                to,
                has_photo and photo_url is not None,
            )
        except Exception as exc:  # pragma: no cover - network failure
            await repo.mark_failed(notification)
            await session.commit()
            logger.error("WhatsApp send failed notification_id=%s error=%s", notification_id, exc)
            raise


def send_whatsapp_message(notification_id: int, to: str, template: str, variables: dict) -> None:
    asyncio.run(_send(notification_id, to, template, variables))
