"""Job to detect students without check-in."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone, timedelta

from loguru import logger

from app.core.config import settings
from app.db.session import async_session
from app.schemas.notifications import NotificationChannel, NotificationDispatchRequest, NotificationType
from app.services.attendance_service import AttendanceService
from app.services.notifications.dispatcher import NotificationDispatcher
from app.db.repositories.no_show_alerts import NoShowAlertRepository


async def _detect_and_notify(target_dt: datetime | None = None) -> None:
    current_dt = target_dt or datetime.now(timezone.utc)
    async with async_session() as session:
        attendance_service = AttendanceService(session)
        dispatcher = NotificationDispatcher(session)
        alert_repo = NoShowAlertRepository(session)

        alerts = await attendance_service.detect_no_show_alerts(current_dt)
        if not alerts:
            logger.info("[NoIngreso] No pending alerts at %s", current_dt)
            return

        reminder_delta = timedelta(minutes=settings.no_show_grace_minutes)

        success_count = 0
        error_count = 0

        for entry in alerts:
            alert_record = entry["alert"]
            guardian = entry["guardian"]
            student = entry["student"]

            if alert_record.status == "RESOLVED":
                continue
            if (
                alert_record.last_notification_at
                and current_dt - alert_record.last_notification_at < reminder_delta
            ):
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
                payload = NotificationDispatchRequest(
                    guardian_id=guardian.id,
                    student_id=None,
                    channel=channel,
                    template=NotificationType.NO_INGRESO_UMBRAL,
                    variables={
                        "students": student_names,
                        "course_id": str(entry["course"].name if entry.get("course") else alert_record.course_id),
                        "timestamp": current_dt.strftime("%H:%M"),
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
                        "[NoIngreso] Failed to enqueue notification guardian=%s channel=%s error=%s",
                        guardian.id,
                        channel,
                        exc,
                    )

        logger.info(
            "[NoIngreso] Completed: %d notifications sent, %d errors",
            success_count,
            error_count,
        )


def detect_no_ingreso_job(target_iso: str | None = None) -> None:
    """R2-B8 fix: Wrap asyncio.run with error handling."""
    target_dt = datetime.fromisoformat(target_iso) if target_iso else None
    try:
        asyncio.run(_detect_and_notify(target_dt))
    except Exception as exc:
        logger.error("[NoIngreso] Job failed with error: %s", exc)
        raise  # Re-raise to let RQ handle the failure
