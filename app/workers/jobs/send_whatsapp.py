"""RQ job for WhatsApp send."""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from typing import Any

from loguru import logger
from requests.exceptions import ConnectionError, Timeout  # type: ignore[import-untyped]

from app.db.repositories.notifications import NotificationRepository
from app.db.repositories.tenant_configs import TenantConfigRepository
from app.db.session import get_worker_session
from app.services.notifications.whatsapp import TenantWhatsAppClient, WhatsAppClient, mask_phone

# R2-B4 fix: Constants for retry logic
MAX_RETRIES = 3
TRANSIENT_ERRORS = (ConnectionError, Timeout, TimeoutError, OSError)


@asynccontextmanager
async def _get_session(tenant_schema: str | None):
    """MT-WORKER-FIX: Get session with proper tenant context for worker jobs.

    Uses get_worker_session which creates a fresh engine for each invocation,
    avoiding connection pool issues in RQ worker processes.
    """
    async with get_worker_session(tenant_schema) as session:
        yield session


# Message templates for attendance notifications
ATTENDANCE_MESSAGES = {
    "INGRESO_OK": "Ingreso registrado: {student_name} ingresó al colegio el {date} a las {time}.",
    "SALIDA_OK": "Salida registrada: {student_name} salió del colegio el {date} a las {time}.",
    "BROADCAST": "📢 *{subject}*\n\n{message}",
    # Withdrawal templates
    "RETIRO_COMPLETADO": "✅ *Retiro Confirmado*\n\nEstudiante: {student_name}\nHora: {time}\n\n_Gracias por usar el sistema de retiro autorizado._",
    "RETIRO_POR_TERCERO": "⚠️ *ALERTA: Retiro por Tercero*\n\nEstudiante: {student_name}\nRetirado por: {pickup_name} ({pickup_relationship})\nHora: {time}\n\n_Si NO autorizó este retiro, contacte al colegio INMEDIATAMENTE._",
}


def _sanitize_format_value(value: str) -> str:
    """Sanitize a value to prevent format string injection.

    Escapes curly braces to prevent {variable} injection attacks.
    """
    if not isinstance(value, str):
        value = str(value) if value is not None else ""
    return value.replace("{", "{{").replace("}", "}}")


def _escape_whatsapp_formatting(value: str) -> str:
    """R2-B11 fix: Escape WhatsApp formatting characters.

    WhatsApp interprets these as formatting:
    - *text* = bold
    - _text_ = italic
    - ~text~ = strikethrough
    - ```text``` = monospace

    We escape them with backslash to prevent unintended formatting.
    """
    if not isinstance(value, str):
        value = str(value) if value is not None else ""
    # Escape formatting characters
    for char in ["*", "_", "~", "`"]:
        value = value.replace(char, "\\" + char)
    return value


def _build_caption(template: str, variables: dict[str, Any]) -> str:
    """Build message caption from template and variables.

    Sanitizes all variable values to prevent format string injection.
    R2-B11 fix: Also escapes WhatsApp formatting characters.
    """
    # Sanitize and escape all string variables
    safe_vars = {}
    for k, v in variables.items():
        if isinstance(v, str):
            # First escape WhatsApp formatting, then sanitize for format string
            v = _escape_whatsapp_formatting(v)
            v = _sanitize_format_value(v)
        safe_vars[k] = v

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


async def _send(
    notification_id: int,
    to: str,
    template: str,
    variables: dict[str, Any],
    tenant_id: int | None = None,
    tenant_schema: str | None = None,
) -> None:
    # MT-WORKER-FIX: Use tenant session to find notification in correct schema
    async with _get_session(tenant_schema) as session:
        repo = NotificationRepository(session)
        notification = await repo.get(notification_id)
        if notification is None:
            logger.error("Notification {} not found", notification_id)
            return

        # Use tenant-specific client if tenant_id is provided
        client: WhatsAppClient | TenantWhatsAppClient | None = None
        if tenant_id:
            try:
                config_repo = TenantConfigRepository(session)
                config = await config_repo.get_decrypted(tenant_id)
                if config and config.whatsapp_access_token:
                    client = TenantWhatsAppClient(config)
                    logger.debug("Using tenant WhatsApp client for tenant_id={}", tenant_id)
            except Exception as e:
                logger.warning(
                    "Failed to load tenant WhatsApp config for tenant_id={}, falling back to default: {}",
                    tenant_id,
                    e,
                )

        # Fall back to global client if no tenant config
        if client is None:
            client = WhatsAppClient()
        try:
            photo_url = variables.get("photo_url")
            has_photo = variables.get("has_photo", False)

            # BROADCAST and withdrawal templates use plain text messages (not WhatsApp templates)
            # Withdrawal templates are not registered as official WhatsApp Business templates
            if template in ("BROADCAST", "RETIRO_COMPLETADO", "RETIRO_POR_TERCERO"):
                text = _build_caption(template, variables)
                await client.send_text_message(to=to, text=text)
            elif has_photo and photo_url:
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
                "[Worker] WhatsApp sent notification_id={} to={} with_photo={}",
                notification_id,
                mask_phone(to),
                has_photo and photo_url is not None,
            )
        except TRANSIENT_ERRORS as exc:
            # R2-B4 fix: Transient errors should allow retry
            current_retries = notification.retries or 0
            if current_retries < MAX_RETRIES:
                # Don't mark as failed, just increment retry count for next attempt
                notification.retries = current_retries + 1
                await session.commit()
                logger.warning(
                    "WhatsApp transient error notification_id={} retry={}/{} error={}",
                    notification_id,
                    current_retries + 1,
                    MAX_RETRIES,
                    exc,
                )
                raise  # Let RQ retry the job
            else:
                await repo.mark_failed(notification)
                await session.commit()
                logger.error(
                    "WhatsApp send failed after {} retries notification_id={} error={}",
                    MAX_RETRIES,
                    notification_id,
                    exc,
                )
                raise
        except Exception as exc:  # pragma: no cover - permanent failure
            # Non-transient errors (e.g., 400 Bad Request) - mark as failed immediately
            await repo.mark_failed(notification)
            await session.commit()
            logger.error("WhatsApp send failed notification_id={} error={}", notification_id, exc)
            raise


def send_whatsapp_message(
    notification_id: int,
    to: str,
    template: str,
    variables: dict[str, Any],
    tenant_id: int | None = None,
    tenant_schema: str | None = None,
) -> None:
    """
    Send a WhatsApp message.

    Args:
        notification_id: The notification record ID
        to: Recipient phone number
        template: WhatsApp template name
        variables: Template variables
        tenant_id: Optional tenant ID for multi-tenant deployments.
                   If provided, uses tenant-specific WhatsApp credentials.
        tenant_schema: Optional tenant schema name for multi-tenant deployments.
                      If provided, queries notification from tenant's schema.
    """
    # TDD-BUG3 fix: Handle case when event loop is already running (e.g., async RQ workers)
    # TDD-R3-BUG1 fix: Use lambda to avoid coroutine evaluation before executor.submit
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        # No running loop - use asyncio.run() normally
        asyncio.run(_send(notification_id, to, template, variables, tenant_id, tenant_schema))
    else:
        # Loop is already running - run in separate thread with new event loop
        import concurrent.futures

        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(
                lambda: asyncio.run(
                    _send(notification_id, to, template, variables, tenant_id, tenant_schema)
                )
            )
            future.result()  # Wait for completion
