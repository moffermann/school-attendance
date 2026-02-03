"""SMTP email client for Gmail, Google Workspace, Outlook, etc."""

from __future__ import annotations

import asyncio
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import TYPE_CHECKING

from loguru import logger

from app.core.config import settings

if TYPE_CHECKING:
    from app.db.repositories.tenant_configs import DecryptedTenantConfig


def mask_email(email: str) -> str:
    """Mask email for logging, showing only first 2 chars and domain."""
    if "@" not in email:
        return "****"
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        masked_local = "*" * len(local)
    else:
        masked_local = local[:2] + "*" * (len(local) - 2)
    return f"{masked_local}@{domain}"


class SMTPEmailClient:
    """SMTP email client for generic email providers (Gmail, Workspace, Outlook, etc.)."""

    def __init__(self) -> None:
        self._host = settings.smtp_host
        self._port = settings.smtp_port
        self._user = settings.smtp_user
        self._password = settings.smtp_password
        self._use_tls = settings.smtp_use_tls
        self._from_name = settings.smtp_from_name

    def _create_message(self, to: str, subject: str, body_html: str) -> MIMEMultipart:
        """Create MIME message with HTML body."""
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{self._from_name} <{self._user}>"
        msg["To"] = to

        # Add HTML part
        html_part = MIMEText(body_html, "html", "utf-8")
        msg.attach(html_part)

        return msg

    def _send_sync(self, to: str, subject: str, body_html: str) -> None:
        """Synchronous send - called in thread pool."""
        msg = self._create_message(to, subject, body_html)

        if self._use_tls:
            # STARTTLS on port 587
            context = ssl.create_default_context()
            with smtplib.SMTP(self._host, self._port, timeout=30) as server:
                server.starttls(context=context)
                server.login(self._user, self._password)
                server.send_message(msg)
        else:
            # Direct SSL on port 465 or plain on port 25
            if self._port == 465:
                context = ssl.create_default_context()
                with smtplib.SMTP_SSL(self._host, self._port, context=context, timeout=30) as server:
                    server.login(self._user, self._password)
                    server.send_message(msg)
            else:
                with smtplib.SMTP(self._host, self._port, timeout=30) as server:
                    server.login(self._user, self._password)
                    server.send_message(msg)

    async def send_email(self, to: str, subject: str, body_html: str) -> None:
        """Send email asynchronously."""
        if not settings.enable_real_notifications:
            logger.info(
                "[SMTP] Dry-run email to={} subject={} host={}",
                mask_email(to),
                subject,
                self._host,
            )
            return

        try:
            await asyncio.to_thread(self._send_sync, to, subject, body_html)
            logger.info(
                "[SMTP] Email sent to={} subject={}",
                mask_email(to),
                subject,
            )
        except smtplib.SMTPAuthenticationError as exc:
            logger.error("[SMTP] Authentication failed: {}", exc)
            raise
        except smtplib.SMTPException as exc:
            logger.error("[SMTP] Send failed: {}", exc)
            raise


class TenantSMTPEmailClient:
    """SMTP email client using tenant-specific credentials."""

    def __init__(self, config: "DecryptedTenantConfig") -> None:
        """Initialize with decrypted tenant configuration."""
        self._tenant_id = config.tenant_id
        self._host = config.smtp_host or "smtp.gmail.com"
        self._port = config.smtp_port or 587
        self._user = config.smtp_user
        self._password = config.smtp_password
        self._use_tls = config.smtp_use_tls if config.smtp_use_tls is not None else True
        self._from_name = config.smtp_from_name or "Sistema de Asistencia"

        if not self._user or not self._password:
            raise ValueError(f"SMTP not configured for tenant {config.tenant_id}")

    def _create_message(self, to: str, subject: str, body_html: str) -> MIMEMultipart:
        """Create MIME message with HTML body."""
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{self._from_name} <{self._user}>"
        msg["To"] = to

        html_part = MIMEText(body_html, "html", "utf-8")
        msg.attach(html_part)

        return msg

    def _send_sync(self, to: str, subject: str, body_html: str) -> None:
        """Synchronous send - called in thread pool."""
        msg = self._create_message(to, subject, body_html)

        if self._use_tls:
            context = ssl.create_default_context()
            with smtplib.SMTP(self._host, self._port, timeout=30) as server:
                server.starttls(context=context)
                server.login(self._user, self._password)
                server.send_message(msg)
        else:
            if self._port == 465:
                context = ssl.create_default_context()
                with smtplib.SMTP_SSL(self._host, self._port, context=context, timeout=30) as server:
                    server.login(self._user, self._password)
                    server.send_message(msg)
            else:
                with smtplib.SMTP(self._host, self._port, timeout=30) as server:
                    server.login(self._user, self._password)
                    server.send_message(msg)

    async def send_email(self, to: str, subject: str, body_html: str) -> None:
        """Send email asynchronously using tenant's SMTP configuration."""
        if not settings.enable_real_notifications:
            logger.info(
                "[SMTP:tenant={}] Dry-run email to={} subject={}",
                self._tenant_id,
                mask_email(to),
                subject,
            )
            return

        try:
            await asyncio.to_thread(self._send_sync, to, subject, body_html)
            logger.info(
                "[SMTP:tenant={}] Email sent to={}",
                self._tenant_id,
                mask_email(to),
            )
        except smtplib.SMTPAuthenticationError as exc:
            logger.error("[SMTP:tenant={}] Authentication failed: {}", self._tenant_id, exc)
            raise
        except smtplib.SMTPException as exc:
            logger.error("[SMTP:tenant={}] Send failed: {}", self._tenant_id, exc)
            raise
