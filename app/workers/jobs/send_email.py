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
from app.db.repositories.tenants import TenantRepository
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

# NEUVOX branding
NEUVOX_LOGO_URL = "https://demoorgventas.s3.us-east-1.amazonaws.com/Dise%C3%B1o/LOGO_NEUVOX.png"


def _get_email_wrapper(
    content: str,
    portal_url: str | None = None,
    show_portal_button: bool = True,
) -> str:
    """Generate the base email wrapper with NEUVOX branding.

    Args:
        content: The main content HTML to insert
        portal_url: URL for the "Ver en el Portal" button
        show_portal_button: Whether to show the portal button

    Returns:
        Complete HTML email with wrapper
    """
    if portal_url is None:
        base_url = str(settings.public_base_url).rstrip("/")
        portal_url = f"{base_url}/app/#/login"

    portal_button = ""
    if show_portal_button:
        portal_button = f'''
            <tr>
                <td style="padding: 30px 40px 20px 40px; text-align: center;">
                    <a href="{portal_url}"
                       style="display: inline-block; background-color: #8b5cf6; color: #ffffff;
                              text-decoration: none; padding: 14px 32px; border-radius: 8px;
                              font-weight: 600; font-size: 14px;">
                        Ver en el Portal
                    </a>
                </td>
            </tr>
        '''

    return f'''<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NEUVOX - Notificación</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
             background-color: #f4f7fa; line-height: 1.6;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
           style="background-color: #f4f7fa;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0"
                       width="600" style="margin: 0 auto; max-width: 600px;">
                    <!-- Header with Logo -->
                    <tr>
                        <td style="background-color: #ffffff; padding: 30px 40px;
                                   text-align: center; border-radius: 12px 12px 0 0;">
                            <img src="{NEUVOX_LOGO_URL}" alt="NEUVOX"
                                 style="height: 120px; width: auto;">
                        </td>
                    </tr>
                    <!-- Main Content -->
                    <tr>
                        <td style="background-color: #ffffff; padding: 0;">
                            {content}
                        </td>
                    </tr>
                    <!-- Portal Button -->
                    {portal_button}
                    <!-- Slogan -->
                    <tr>
                        <td style="background-color: #ffffff; padding: 20px 40px 30px 40px;
                                   text-align: center;">
                            <p style="margin: 0; color: #64748b; font-size: 13px; font-style: italic;">
                                "Garantizando la seguridad y tranquilidad de su familia"
                            </p>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 24px 40px;
                                   border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0 0 8px 0; color: #64748b; font-size: 12px;
                                      text-align: center;">
                                Este es un correo automático, por favor no responda a este mensaje.
                            </p>
                            <p style="margin: 0; color: #94a3b8; font-size: 11px; text-align: center;">
                                &copy; 2026 NEUVOX Intelligence Systems. Todos los derechos reservados.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>'''


def _build_info_table(rows: list[tuple[str, str]]) -> str:
    """Build an info table with label-value pairs.

    Args:
        rows: List of (label, value) tuples

    Returns:
        HTML table string
    """
    table_rows = []
    for i, (label, value) in enumerate(rows):
        bg_color = "#f8fafc" if i % 2 == 0 else "#ffffff"
        table_rows.append(f'''
            <tr style="background-color: {bg_color};">
                <td style="padding: 12px 16px; color: #64748b; font-size: 14px;
                           border-bottom: 1px solid #e2e8f0; width: 140px;">
                    {label}
                </td>
                <td style="padding: 12px 16px; color: #1e293b; font-size: 14px;
                           font-weight: 600; border-bottom: 1px solid #e2e8f0;">
                    {value}
                </td>
            </tr>
        ''')

    return f'''
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
               style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            {"".join(table_rows)}
        </table>
    '''


def _build_photo_section(photo_url: str) -> str:
    """Build the photo evidence section.

    Args:
        photo_url: URL of the photo

    Returns:
        HTML for photo section
    """
    return f'''
        <tr>
            <td style="padding: 20px 40px;">
                <p style="margin: 0 0 12px 0; color: #64748b; font-size: 13px;
                          text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
                    Evidencia Fotográfica
                </p>
                <div style="text-align: center; background-color: #f8fafc; padding: 16px;
                            border-radius: 8px; border: 1px solid #e2e8f0;">
                    <img src="{photo_url}" alt="Foto de registro"
                         style="max-width: 100%; height: auto; border-radius: 8px;
                                max-height: 300px;">
                </div>
            </td>
        </tr>
    '''


# Email templates for attendance notifications
EMAIL_TEMPLATES = {
    "INGRESO_OK": {
        "subject": "Ingreso registrado - {student_name}",
        "title": "Ingreso Registrado",
        "title_color": "#3b82f6",
        "icon": "&#10003;",  # Checkmark
        "icon_color": "#22c55e",
        "subtitle": "Se ha registrado exitosamente el ingreso del alumno al establecimiento.",
        "fields": ["school_name", "student_name", "date", "time"],
        "has_photo": True,
    },
    "SALIDA_OK": {
        "subject": "Salida registrada - {student_name}",
        "title": "Salida Registrada",
        "title_color": "#3b82f6",
        "icon": "&#10003;",  # Checkmark
        "icon_color": "#22c55e",
        "subtitle": "Se ha registrado exitosamente la salida del alumno del establecimiento.",
        "fields": ["school_name", "student_name", "date", "time"],
        "has_photo": True,
    },
    "NO_INGRESO_UMBRAL": {
        "subject": "Alerta: {student_name} no ha ingresado al colegio",
        "title": "Alerta de No Ingreso",
        "title_color": "#dc2626",
        "icon": "&#9888;",  # Warning
        "icon_color": "#dc2626",
        "subtitle": "El alumno no ha registrado ingreso al establecimiento en el horario esperado.",
        "fields": ["school_name", "student_name", "date", "expected_time", "course_name"],
        "has_photo": False,
        "alert_message": "Si su hijo/a no asistirá hoy, por favor comuníquese con el establecimiento para justificar la inasistencia.",
    },
    "BROADCAST": {
        "subject": "{subject}",
        "title": "Comunicado",
        "title_color": "#3b82f6",
        "icon": "&#128227;",  # Megaphone
        "icon_color": "#3b82f6",
        "subtitle": None,
        "fields": ["school_name"],
        "has_photo": False,
        "custom_content": "message",
    },
    "parent_invitation": {
        "subject": "Invitación - Portal de Apoderados",
        "title": "Bienvenido al Portal",
        "title_color": "#8b5cf6",
        "icon": "&#9993;",  # Envelope
        "icon_color": "#8b5cf6",
        "subtitle": "Ha sido registrado/a como apoderado en nuestro sistema de control de asistencia.",
        "fields": ["school_name"],
        "has_photo": False,
        "custom_button": {"text": "Activar mi cuenta", "url_var": "activation_url"},
        "note": "Este enlace expira en {expires_hours} horas.",
        "show_portal_button": False,
    },
    "password_reset": {
        "subject": "Recuperar Contraseña",
        "title": "Recuperación de Contraseña",
        "title_color": "#8b5cf6",
        "icon": "&#128274;",  # Lock
        "icon_color": "#8b5cf6",
        "subtitle": "Recibimos una solicitud para restablecer su contraseña.",
        "fields": ["school_name"],
        "has_photo": False,
        "custom_button": {"text": "Restablecer contraseña", "url_var": "reset_url"},
        "note": "Este enlace expira en 1 hora. Si no solicitó este cambio, puede ignorar este mensaje.",
        "show_portal_button": False,
    },
}

# Field labels for the info table
FIELD_LABELS = {
    "school_name": "Colegio",
    "student_name": "Alumno",
    "date": "Fecha",
    "time": "Hora",
    "expected_time": "Hora esperada",
    "course_name": "Curso",
}


def _escape_html_value(value: str) -> str:
    """R6-W2 fix: Escape HTML to prevent XSS in email body."""
    if not isinstance(value, str):
        value = str(value) if value is not None else ""
    return html.escape(value)


def _build_email_content(
    template: str,
    variables: dict[str, Any],
    school_name: str | None = None,
) -> tuple[str, str]:
    """Build email subject and HTML body from template and variables.

    Args:
        template: Template name (INGRESO_OK, SALIDA_OK, etc.)
        variables: Template variables
        school_name: School display name from TenantConfig

    Returns:
        Tuple of (subject, body_html)
    """
    # Escape all variables for HTML safety
    safe_vars = {
        k: _escape_html_value(str(v)) if v is not None else "" for k, v in variables.items()
    }

    # Add school_name to variables
    if school_name:
        safe_vars["school_name"] = _escape_html_value(school_name)
    elif "school_name" not in safe_vars or not safe_vars["school_name"]:
        safe_vars["school_name"] = "Sistema de Asistencia"

    # Get template config
    email_template = EMAIL_TEMPLATES.get(template)
    if not email_template:
        # Fallback to generic template
        return _build_fallback_email(template, variables, school_name)

    try:
        # Build subject
        subject = email_template["subject"].format(**safe_vars)

        # Build content sections
        content_parts = []

        # Title section with icon
        title = email_template.get("title", "Notificación")
        title_color = email_template.get("title_color", "#3b82f6")
        icon = email_template.get("icon", "")
        icon_color = email_template.get("icon_color", "#22c55e")

        content_parts.append(f'''
            <tr>
                <td style="padding: 30px 40px 10px 40px; text-align: center;">
                    <span style="display: inline-block; width: 48px; height: 48px;
                                 background-color: {icon_color}15; border-radius: 50%;
                                 line-height: 48px; font-size: 24px; color: {icon_color};">
                        {icon}
                    </span>
                    <h1 style="margin: 16px 0 0 0; font-size: 24px; font-weight: 700;
                               color: {title_color};">
                        {title}
                    </h1>
                </td>
            </tr>
        ''')

        # Subtitle
        subtitle = email_template.get("subtitle")
        if subtitle:
            content_parts.append(f'''
                <tr>
                    <td style="padding: 8px 40px 20px 40px; text-align: center;">
                        <p style="margin: 0; color: #64748b; font-size: 15px;">
                            {subtitle}
                        </p>
                    </td>
                </tr>
            ''')

        # Info table with fields
        fields = email_template.get("fields", [])
        if fields:
            table_rows = []
            for field in fields:
                if field in safe_vars and safe_vars[field]:
                    label = FIELD_LABELS.get(field, field.replace("_", " ").title())
                    table_rows.append((label, safe_vars[field]))

            if table_rows:
                content_parts.append(f'''
                    <tr>
                        <td style="padding: 10px 40px 20px 40px;">
                            {_build_info_table(table_rows)}
                        </td>
                    </tr>
                ''')

        # Custom content (for BROADCAST)
        custom_content_key = email_template.get("custom_content")
        if custom_content_key and custom_content_key in safe_vars:
            content_parts.append(f'''
                <tr>
                    <td style="padding: 10px 40px 20px 40px;">
                        <div style="color: #1e293b; font-size: 15px; line-height: 1.7;
                                    white-space: pre-wrap;">
                            {safe_vars[custom_content_key]}
                        </div>
                    </td>
                </tr>
            ''')

        # Photo section
        photo_url = variables.get("photo_url")
        has_photo_config = email_template.get("has_photo", False)
        has_photo_var = variables.get("has_photo", False)
        if has_photo_config and has_photo_var and photo_url:
            content_parts.append(_build_photo_section(_escape_html_value(photo_url)))

        # Alert message (for NO_INGRESO_UMBRAL)
        alert_msg = email_template.get("alert_message")
        if alert_msg:
            content_parts.append(f'''
                <tr>
                    <td style="padding: 10px 40px 20px 40px;">
                        <div style="background-color: #fef3c7; padding: 16px; border-radius: 8px;
                                    border-left: 4px solid #f59e0b;">
                            <p style="margin: 0; color: #92400e; font-size: 14px;">
                                {alert_msg}
                            </p>
                        </div>
                    </td>
                </tr>
            ''')

        # Custom button (for invitation/reset)
        custom_button = email_template.get("custom_button")
        if custom_button:
            button_text = custom_button.get("text", "Continuar")
            url_var = custom_button.get("url_var", "url")
            button_url = safe_vars.get(url_var, "#")
            content_parts.append(f'''
                <tr>
                    <td style="padding: 20px 40px; text-align: center;">
                        <a href="{button_url}"
                           style="display: inline-block; background-color: #8b5cf6; color: #ffffff;
                                  text-decoration: none; padding: 14px 32px; border-radius: 8px;
                                  font-weight: 600; font-size: 14px;">
                            {button_text}
                        </a>
                    </td>
                </tr>
            ''')

        # Note (for invitation/reset)
        note = email_template.get("note")
        if note:
            formatted_note = note.format(**safe_vars)
            content_parts.append(f'''
                <tr>
                    <td style="padding: 0 40px 20px 40px; text-align: center;">
                        <p style="margin: 0; color: #64748b; font-size: 13px;">
                            {formatted_note}
                        </p>
                    </td>
                </tr>
            ''')

        # Build final content
        content_html = "".join(content_parts)

        # Determine if we should show portal button
        show_portal = email_template.get("show_portal_button", True)

        # Wrap in email template
        body_html = _get_email_wrapper(
            f"<table role='presentation' cellspacing='0' cellpadding='0' border='0' width='100%'>{content_html}</table>",
            show_portal_button=show_portal,
        )

        return subject, body_html

    except KeyError as e:
        logger.warning("Template {} missing variable {}, using fallback", template, e)
        return _build_fallback_email(template, variables, school_name)


def _build_fallback_email(
    template: str,
    variables: dict[str, Any],
    school_name: str | None = None,
) -> tuple[str, str]:
    """Build a fallback email when template fails.

    Args:
        template: Template name
        variables: Template variables
        school_name: School display name

    Returns:
        Tuple of (subject, body_html)
    """
    safe_vars = {
        k: _escape_html_value(str(v)) if v is not None else "" for k, v in variables.items()
    }

    subject = f"Notificación - {safe_vars.get('student_name', 'Sistema de Asistencia')}"

    rows = []
    if school_name:
        rows.append(("Colegio", _escape_html_value(school_name)))
    for key, value in variables.items():
        if key not in ("photo_url", "has_photo", "photo_section") and value:
            label = FIELD_LABELS.get(key, key.replace("_", " ").title())
            rows.append((label, _escape_html_value(str(value))))

    content = f'''
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
                <td style="padding: 30px 40px 10px 40px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #3b82f6;">
                        Notificación
                    </h1>
                </td>
            </tr>
            <tr>
                <td style="padding: 20px 40px;">
                    {_build_info_table(rows) if rows else "<p>Se ha generado una notificación.</p>"}
                </td>
            </tr>
        </table>
    '''

    body_html = _get_email_wrapper(content)
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

        # Get school_display_name from tenant config
        school_name: str | None = None

        # Use tenant-specific client if tenant_id is provided
        client: (
            SESEmailClient | TenantSESEmailClient | SMTPEmailClient | TenantSMTPEmailClient | None
        ) = None
        config = None
        if tenant_id:
            try:
                config_repo = TenantConfigRepository(session)
                config = await config_repo.get_decrypted(tenant_id)
                if config:
                    # Get school display name for email branding
                    # Fallback to tenant.name if school_display_name is not configured
                    school_name = config.school_display_name
                    if not school_name:
                        tenant_repo = TenantRepository(session)
                        tenant = await tenant_repo.get(tenant_id)
                        if tenant:
                            school_name = tenant.name

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

        # Build email content from template with school name
        subject, body_html = _build_email_content(template, variables, school_name)

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
