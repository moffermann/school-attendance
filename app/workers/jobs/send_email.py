"""RQ job for email send (SES or SMTP)."""

from __future__ import annotations

import asyncio
import html
import smtplib
from contextlib import asynccontextmanager
from typing import Any

from loguru import logger
from requests.exceptions import ConnectionError, Timeout  # type: ignore[import-untyped]

from app.core.config import settings
from app.db.repositories.notifications import NotificationRepository
from app.db.repositories.tenant_configs import TenantConfigRepository
from app.db.session import get_worker_session
from app.services.notifications.ses_email import SESEmailClient, TenantSESEmailClient, mask_email
from app.services.notifications.smtp_email import SMTPEmailClient, TenantSMTPEmailClient


@asynccontextmanager
async def _get_session(tenant_schema: str | None):
    """MT-WORKER-FIX: Get session with proper tenant context for worker jobs.

    Uses get_worker_session which creates a fresh engine for each invocation,
    avoiding connection pool issues in RQ worker processes.
    """
    async with get_worker_session(tenant_schema) as session:
        yield session


# R6-W1 fix: Constants for retry logic (same as send_whatsapp.py)
MAX_RETRIES = 3
TRANSIENT_ERRORS = (ConnectionError, Timeout, TimeoutError, OSError, smtplib.SMTPServerDisconnected)


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
        "subject": "⚠️ Alerta: {student_name} no ha ingresado al colegio",
        "body": """
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #d32f2f;">⚠️ Alerta de No Ingreso</h2>
            <p>Estimado/a apoderado/a,</p>
            <p><strong>{student_name}</strong> no ha registrado ingreso al establecimiento.</p>
            <table style="margin: 20px 0; border-collapse: collapse; width: 100%;">
                <tr>
                    <td style="padding: 8px; color: #666; width: 120px;">Fecha:</td>
                    <td style="padding: 8px;"><strong>{date}</strong></td>
                </tr>
                <tr>
                    <td style="padding: 8px; color: #666;">Hora esperada:</td>
                    <td style="padding: 8px;"><strong>{expected_time}</strong></td>
                </tr>
                <tr>
                    <td style="padding: 8px; color: #666;">Curso:</td>
                    <td style="padding: 8px;"><strong>{course_name}</strong></td>
                </tr>
            </table>
            <p style="background: #fff3e0; padding: 12px; border-radius: 4px; border-left: 4px solid #ff9800;">
                Si su hijo/a no asistirá hoy, por favor comuníquese con el establecimiento para justificar la inasistencia.
            </p>
            <p style="color: #666; font-size: 12px; margin-top: 20px;">
                Este es un mensaje automático del Sistema de Control de Asistencia.
            </p>
        </div>
        """,
    },
    "BROADCAST": {
        "subject": "{subject}",
        "body": """
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1976d2;">📢 Comunicado</h2>
            <div style="white-space: pre-wrap; line-height: 1.6;">{message}</div>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #e0e0e0;">
            <p style="color: #666; font-size: 12px;">
                Este es un mensaje del Sistema de Control de Asistencia.
            </p>
        </div>
        """,
    },
    "parent_invitation": {
        "subject": "Invitación - Portal de Apoderados",
        "body": """
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #4f46e5;">Bienvenido al Portal de Apoderados</h2>
            <p>Estimado/a apoderado/a,</p>
            <p>Ha sido registrado/a como apoderado en nuestro sistema de control de asistencia.</p>
            <p>Para activar su cuenta y establecer su contraseña, haga clic en el siguiente enlace:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{activation_url}"
                   style="background-color: #4f46e5; color: white; padding: 12px 24px;
                          text-decoration: none; border-radius: 6px; font-weight: bold;">
                    Activar mi cuenta
                </a>
            </div>
            <p style="color: #666; font-size: 14px;">
                Este enlace expira en {expires_hours} horas.
            </p>
            <p style="color: #666; font-size: 14px;">
                Si no reconoce esta invitación, puede ignorar este mensaje.
            </p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #e0e0e0;">
            <p style="color: #999; font-size: 12px;">
                Este es un mensaje automático del Sistema de Control de Asistencia.
            </p>
        </div>
        """,
    },
    "password_reset": {
        "subject": "Recuperar Contraseña",
        "body": """
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #4f46e5;">Recuperación de Contraseña</h2>
            <p>Estimado/a usuario/a,</p>
            <p>Recibimos una solicitud para restablecer su contraseña.</p>
            <p>Para crear una nueva contraseña, haga clic en el siguiente enlace:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{reset_url}"
                   style="background-color: #4f46e5; color: white; padding: 12px 24px;
                          text-decoration: none; border-radius: 6px; font-weight: bold;">
                    Restablecer contraseña
                </a>
            </div>
            <p style="color: #666; font-size: 14px;">
                Este enlace expira en 1 hora.
            </p>
            <p style="color: #666; font-size: 14px;">
                Si no solicitó este cambio, puede ignorar este mensaje de forma segura.
                Su contraseña no se modificará.
            </p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #e0e0e0;">
            <p style="color: #999; font-size: 12px;">
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


def _build_email_content(template: str, variables: dict[str, Any]) -> tuple[str, str]:
    """Build email subject and HTML body from template and variables.

    Returns:
        Tuple of (subject, body_html)
    """
    # Escape all variables for HTML safety
    safe_vars = {
        k: _escape_html_value(str(v)) if v is not None else "" for k, v in variables.items()
    }

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
            logger.warning("Template {} missing variable {}, using fallback", template, e)

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
    notification_id: int | None,
    to: str,
    template: str,
    variables: dict[str, Any],
    tenant_id: int | None = None,
    tenant_schema: str | None = None,
) -> None:
    # MT-WORKER-FIX: Use tenant session to find notification in correct schema
    async with _get_session(tenant_schema) as session:
        repo = NotificationRepository(session)
        notification = None
        if notification_id is not None:
            notification = await repo.get(notification_id)
            if notification is None:
                logger.error("Notification {} not found", notification_id)
                return

        # Use tenant-specific client if tenant_id is provided
        client: (
            SESEmailClient | TenantSESEmailClient | SMTPEmailClient | TenantSMTPEmailClient | None
        ) = None
        if tenant_id:
            try:
                config_repo = TenantConfigRepository(session)
                config = await config_repo.get_decrypted(tenant_id)
                if config:
                    # Check tenant's email provider preference
                    provider = config.email_provider or settings.email_provider
                    if provider == "smtp" and config.smtp_user:
                        client = TenantSMTPEmailClient(config)
                        logger.debug("Using tenant SMTP client for tenant_id={}", tenant_id)
                    elif config.ses_source_email:
                        client = TenantSESEmailClient(config)
                        logger.debug("Using tenant SES client for tenant_id={}", tenant_id)
            except Exception as e:
                logger.warning(
                    "Failed to load tenant email config for tenant_id={}, falling back to default: {}",
                    tenant_id,
                    e,
                )

        # Fall back to global client if no tenant config
        if client is None:
            if settings.email_provider == "smtp":
                client = SMTPEmailClient()
                logger.debug("Using global SMTP client")
            else:
                client = SESEmailClient()
                logger.debug("Using global SES client")

        # Build email content from template
        subject, body_html = _build_email_content(template, variables)

        assert client is not None, "Email client must be initialized"
        try:
            await client.send_email(to=to, subject=subject, body_html=body_html)
            if notification:
                await repo.mark_sent(notification)
                await session.commit()
            logger.info(
                "[Worker] Email sent notification_id={} to={} template={}",
                notification_id,
                mask_email(to),
                template,
            )
        except TRANSIENT_ERRORS as exc:
            if notification:
                # R6-W1 fix: Transient errors should allow retry
                current_retries = notification.retries or 0
                if current_retries < MAX_RETRIES:
                    notification.retries = current_retries + 1
                    await session.commit()
                    logger.warning(
                        "Email transient error notification_id={} retry={}/{} error={}",
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
                        "Email send failed after {} retries notification_id={} error={}",
                        MAX_RETRIES,
                        notification_id,
                        exc,
                    )
                    raise
            else:
                logger.warning(
                    "Email transient error to={} template={} error={}",
                    mask_email(to),
                    template,
                    exc,
                )
                raise
        except Exception as exc:  # pragma: no cover - permanent failure
            if notification:
                await repo.mark_failed(notification)
                await session.commit()
            logger.error("Email send failed notification_id={} error={}", notification_id, exc)
            raise


def send_email_message(
    notification_id: int | None,
    to: str,
    template: str,
    variables: dict[str, Any],
    tenant_id: int | None = None,
    tenant_schema: str | None = None,
) -> None:
    """
    Send an email message via SES or SMTP.

    The email provider is selected based on:
    1. Tenant's email_provider setting (if tenant_id provided)
    2. Global EMAIL_PROVIDER setting (ses or smtp)

    Args:
        notification_id: The notification record ID
        to: Recipient email address
        template: Email template name (INGRESO_OK, SALIDA_OK, etc.)
        variables: Template variables
        tenant_id: Optional tenant ID for multi-tenant deployments.
                   If provided, uses tenant-specific email credentials.
        tenant_schema: Optional tenant schema name for multi-tenant deployments.
                      If provided, queries notification from tenant's schema.
    """
    # TDD-R3-BUG2 fix: Handle case when event loop is already running (same as WhatsApp)
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
