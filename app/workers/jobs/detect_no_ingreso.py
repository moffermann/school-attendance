"""Job to detect students without check-in.

Multi-tenant aware: iterates over all active tenants and checks each schema.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime

from loguru import logger
from sqlalchemy import select

from app.core.tenant_middleware import sanitize_schema_name
from app.db.models.tenant import Tenant
from app.db.repositories.no_show_alerts import NoShowAlertRepository
from app.db.session import async_session, get_tenant_session
from app.schemas.notifications import (
    NotificationChannel,
    NotificationDispatchRequest,
    NotificationType,
)
from app.services.attendance_service import AttendanceService
from app.services.notifications.dispatcher import NotificationDispatcher


async def _process_tenant(
    tenant_id: int,
    schema_name: str,
    tenant_slug: str,
    current_dt: datetime,
) -> tuple[int, int]:
    """Process no-show alerts for a single tenant.

    Returns:
        Tuple of (success_count, error_count)
    """
    success_count = 0
    error_count = 0

    async with get_tenant_session(schema_name) as session:
        attendance_service = AttendanceService(session)
        dispatcher = NotificationDispatcher(session, tenant_id=tenant_id, tenant_schema=schema_name)
        alert_repo = NoShowAlertRepository(session)

        alerts = await attendance_service.detect_no_show_alerts(current_dt)
        if not alerts:
            logger.debug(
                "[NoIngreso] Tenant '{}': No pending alerts at {}", tenant_slug, current_dt
            )
            return 0, 0

        logger.info("[NoIngreso] Tenant '{}': Found {} potential alerts", tenant_slug, len(alerts))

        for entry in alerts:
            alert_record = entry["alert"]
            guardian = entry["guardian"]
            student = entry["student"]

            # Skip resolved alerts
            if alert_record.status == "RESOLVED":
                continue
            # Only notify ONCE per alert - if already notified, skip
            if alert_record.last_notification_at is not None:
                continue

            student_names = student.full_name

            channels = {NotificationChannel.WHATSAPP, NotificationChannel.EMAIL}
            prefs = guardian.notification_prefs or {}
            template_key = NotificationType.NO_INGRESO_UMBRAL.value
            # TDD-R4-BUG1 fix: Validate prefs[template_key] is a list before iterating
            pref_value = prefs.get(template_key)
            if isinstance(pref_value, list):
                resolved_channels: set[NotificationChannel] = set()
                for item in pref_value:
                    if isinstance(item, dict) and not item.get("enabled", True):
                        continue
                    value = item.get("channel") if isinstance(item, dict) else item
                    try:
                        resolved_channels.add(NotificationChannel(value))
                    except Exception:  # pragma: no cover - ignore invalid prefs
                        continue
                if resolved_channels:
                    channels = resolved_channels

            for channel in channels:
                # B11 fix: handle NULL contacts gracefully
                contacts = guardian.contacts or {}
                if channel == NotificationChannel.WHATSAPP and not contacts.get("whatsapp"):
                    continue
                if channel == NotificationChannel.EMAIL and not contacts.get("email"):
                    continue
                # Build informative variables for email template
                course_name = (
                    entry["course"].name
                    if entry.get("course")
                    else f"Curso ID {alert_record.course_id}"
                )
                schedule = entry.get("schedule")
                expected_time = (
                    schedule.in_time.strftime("%H:%M") if schedule and schedule.in_time else "08:00"
                )

                payload = NotificationDispatchRequest(
                    guardian_id=guardian.id,
                    student_id=None,
                    channel=channel,
                    template=NotificationType.NO_INGRESO_UMBRAL,
                    variables={
                        "student_name": student_names,
                        "date": current_dt.strftime("%d/%m/%Y"),
                        "expected_time": expected_time,
                        "course_name": course_name,
                    },
                )
                try:
                    await dispatcher.enqueue_manual_notification(payload)
                    await alert_repo.mark_notified(alert_record.id, current_dt)
                    # Commit each successful notification individually
                    await session.commit()
                    success_count += 1
                except Exception as exc:  # pragma: no cover - handled downstream
                    # Rollback failed notification, continue with others
                    await session.rollback()
                    error_count += 1
                    logger.error(
                        "[NoIngreso] Tenant '{}': Failed to enqueue notification guardian={} channel={} error={}",
                        tenant_slug,
                        guardian.id,
                        channel,
                        exc,
                    )

    return success_count, error_count


async def _detect_and_notify(target_dt: datetime | None = None) -> None:
    """Detect no-show alerts across all tenants and send notifications."""
    current_dt = target_dt or datetime.now(UTC)
    total_success = 0
    total_errors = 0

    # First, get all active tenants from public schema
    async with async_session() as session:
        result = await session.execute(
            select(Tenant).where(Tenant.is_active == True)  # noqa: E712
        )
        tenants = list(result.scalars().all())

    if not tenants:
        logger.debug("[NoIngreso] No active tenants found")
        return

    # Process each tenant's schema
    for tenant in tenants:
        schema_name = f"tenant_{sanitize_schema_name(tenant.slug)}"

        try:
            success, errors = await _process_tenant(tenant.id, schema_name, tenant.slug, current_dt)
            total_success += success
            total_errors += errors
        except Exception as exc:
            logger.error(
                "[NoIngreso] Error processing tenant '{}': {}",
                tenant.slug,
                exc,
            )
            continue

    logger.info(
        "[NoIngreso] Completed: {} notifications sent, {} errors across {} tenants",
        total_success,
        total_errors,
        len(tenants),
    )


def detect_no_ingreso_job(target_iso: str | None = None) -> None:
    """R2-B8 fix: Wrap asyncio.run with error handling."""
    target_dt = datetime.fromisoformat(target_iso) if target_iso else None
    try:
        asyncio.run(_detect_and_notify(target_dt))
    except Exception as exc:
        logger.error("[NoIngreso] Job failed with error: {}", exc)
        raise  # Re-raise to let RQ handle the failure
