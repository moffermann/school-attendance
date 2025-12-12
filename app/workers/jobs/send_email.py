"""RQ job for SES email send."""

from __future__ import annotations

import asyncio
import html
from loguru import logger
from requests.exceptions import ConnectionError, Timeout

from app.db.repositories.notifications import NotificationRepository
from app.db.repositories.tenant_configs import TenantConfigRepository
from app.db.session import async_session
from app.services.notifications.ses_email import SESEmailClient, TenantSESEmailClient, mask_email


# R6-W1 fix: Constants for retry logic (same as send_whatsapp.py)
MAX_RETRIES = 3
TRANSIENT_ERRORS = (ConnectionError, Timeout, TimeoutError, OSError)


# Email templates for attendance notifications
EMAIL_TEMPLATES = {
    "INGRESO_OK": {
        "subject": "Ingreso registrado - {student_name}",
        "body": """
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2e7d32;">✓ Ingreso Registrado</h2>
            <p>Estimado/a apoderado/a,</p>
            <p>Le informamos que <strong>{student_name}</strong> ingresó al establecimiento.</p>
            <table style="margin: 20px 0; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px; color: #666;">Fecha:</td>
                    <td style="padding: 8px;"><strong>{date}</strong></td>
                </tr>
                <tr>
                    <td style="padding: 8px; color: #666;">Hora:</td>
                    <td style="padding: 8px;"><strong>{time}</strong></td>
                </tr>
                {photo_section}
            </table>
            <p style="color: #666; font-size: 12px;">
                Este es un mensaje automático del Sistema de Control de Asistencia.
            </p>
        </div>
        """,
    },
    "SALIDA_OK": {
        "subject": "Salida registrada - {student_name}",
        "body": """
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1565c0;">✓ Salida Registrada</h2>
            <p>Estimado/a apoderado/a,</p>
            <p>Le informamos que <strong>{student_name}</strong> salió del establecimiento.</p>
            <table style="margin: 20px 0; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px; color: #666;">Fecha:</td>
                    <td style="padding: 8px;"><strong>{date}</strong></td>
                </tr>
                <tr>
                    <td style="padding: 8px; color: #666;">Hora:</td>
                    <td style="padding: 8px;"><strong>{time}</strong></td>
                </tr>
                {photo_section}
            </table>
            <p style="color: #666; font-size: 12px;">
                Este es un mensaje automático del Sistema de Control de Asistencia.
            </p>
        </div>
        """,
    },
    "NO_INGRESO_UMBRAL": {
        "subject": "⚠️ Alerta: {student_name} no ha ingresado",
        "body": """
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #d32f2f;">⚠️ Alerta de No Ingreso</h2>
            <p>Estimado/a apoderado/a,</p>
            <p><strong>{student_name}</strong> no ha registrado ingreso al establecimiento el día de hoy.</p>
            <table style="margin: 20px 0; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px; color: #666;">Fecha:</td>
                    <td style="padding: 8px;"><strong>{date}</strong></td>
                </tr>
            </table>
            <p>Si su hijo/a no asistirá hoy, por favor ignore este mensaje o comuníquese con el establecimiento.</p>
            <p style="color: #666; font-size: 12px;">
                Este es un mensaje automático del Sistema de Control de Asistencia.
            </p>
        </div>
        """,
    },
}


def _escape_html_value(value: str) -> str:
    """R6-W2 fix: Escape HTML to prevent XSS in email body."""
    if not isinstance(value, str):
        value = str(value) if value is not None else ""
    return html.escape(value)


def _build_email_content(template: str, variables: dict) -> tuple[str, str]:
    """Build email subject and HTML body from template and variables.

    Returns:
        Tuple of (subject, body_html)
    """
    # Escape all variables for HTML safety
    safe_vars = {k: _escape_html_value(str(v)) if v is not None else "" for k, v in variables.items()}

    # Build photo section if photo is available
    photo_url = variables.get("photo_url")
    has_photo = variables.get("has_photo", False)
    if has_photo and photo_url:
        safe_vars["photo_section"] = f'''
            <tr>
                <td style="padding: 8px; color: #666;">Foto:</td>
                <td style="padding: 8px;">
                    <img src="{_escape_html_value(photo_url)}" alt="Foto de registro"
                         style="max-width: 200px; border-radius: 8px;">
                </td>
            </tr>
        '''
    else:
        safe_vars["photo_section"] = ""

    # Get template or fallback to generic
    email_template = EMAIL_TEMPLATES.get(template)
    if email_template:
        try:
            subject = email_template["subject"].format(**safe_vars)
            body_html = email_template["body"].format(**safe_vars)
            return subject, body_html
        except KeyError as e:
            logger.warning("Template %s missing variable %s, using fallback", template, e)

    # Fallback: generic email
    subject = f"Notificación - {safe_vars.get('student_name', 'Alumno')}"
    body_lines = [
        f"<p><strong>{_escape_html_value(key)}</strong>: {_escape_html_value(str(value))}</p>"
        for key, value in variables.items()
        if key not in ("photo_url", "has_photo", "photo_section")
    ]
    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Notificación del Sistema de Asistencia</h2>
        {"".join(body_lines) or "<p>Se ha generado una notificación.</p>"}
        <p style="color: #666; font-size: 12px;">
            Este es un mensaje automático del Sistema de Control de Asistencia.
        </p>
    </div>
    """
    return subject, body_html


async def _send(
    notification_id: int,
    to: str,
    template: str,
    variables: dict,
    tenant_id: int | None = None,
) -> None:
    async with async_session() as session:
        repo = NotificationRepository(session)
        notification = await repo.get(notification_id)
        if notification is None:
            logger.error("Notification %s not found", notification_id)
            return

        # Use tenant-specific client if tenant_id is provided
        client = None
        if tenant_id:
            try:
                config_repo = TenantConfigRepository(session)
                config = await config_repo.get_decrypted(tenant_id)
                if config and config.ses_source_email:
                    client = TenantSESEmailClient(config)
                    logger.debug("Using tenant SES client for tenant_id=%s", tenant_id)
            except Exception as e:
                logger.warning(
                    "Failed to load tenant SES config for tenant_id=%s, falling back to default: %s",
                    tenant_id, e
                )

        # Fall back to global client if no tenant config
        if client is None:
            client = SESEmailClient()

        # Build email content from template
        subject, body_html = _build_email_content(template, variables)

        try:
            await client.send_email(to=to, subject=subject, body_html=body_html)
            await repo.mark_sent(notification)
            await session.commit()
            logger.info(
                "[Worker] Email sent notification_id=%s to=%s template=%s",
                notification_id, mask_email(to), template
            )
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


def send_email_message(
    notification_id: int,
    to: str,
    template: str,
    variables: dict,
    tenant_id: int | None = None,
) -> None:
    """
    Send an email message.

    Args:
        notification_id: The notification record ID
        to: Recipient email address
        template: Email template name (INGRESO_OK, SALIDA_OK, etc.)
        variables: Template variables
        tenant_id: Optional tenant ID for multi-tenant deployments.
                   If provided, uses tenant-specific SES credentials.
    """
    # TDD-R3-BUG2 fix: Handle case when event loop is already running (same as WhatsApp)
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        # No running loop - use asyncio.run() normally
        asyncio.run(_send(notification_id, to, template, variables, tenant_id))
    else:
        # Loop is already running - run in separate thread with new event loop
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(
                lambda: asyncio.run(_send(notification_id, to, template, variables, tenant_id))
            )
            future.result()  # Wait for completion
