"""Service for sending attendance notifications to guardians."""

from __future__ import annotations

from typing import TYPE_CHECKING

from loguru import logger
from redis import Redis
from rq import Queue

from app.core.config import settings
from app.db.repositories.guardians import GuardianRepository
from app.db.repositories.notifications import NotificationRepository
from app.db.repositories.students import StudentRepository
from app.schemas.notifications import NotificationChannel, NotificationType

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.db.models.attendance_event import AttendanceEvent


class AttendanceNotificationService:
    """Handles notification dispatch when attendance events occur."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.notification_repo = NotificationRepository(session)
        self.guardian_repo = GuardianRepository(session)
        self.student_repo = StudentRepository(session)
        self._redis = Redis.from_url(settings.redis_url)
        self._queue = Queue("notifications", connection=self._redis)

    async def notify_attendance_event(
        self,
        event: AttendanceEvent,
        photo_url: str | None = None,
    ) -> list[int]:
        """
        Send notifications to all guardians of a student when an attendance event occurs.

        Args:
            event: The attendance event (IN or OUT)
            photo_url: Optional presigned URL to the photo evidence

        Returns:
            List of notification IDs created
        """
        student = await self.student_repo.get_with_guardians(event.student_id)
        if not student:
            logger.warning(f"Student {event.student_id} not found for notification")
            return []

        guardians = getattr(student, "guardians", [])
        if not guardians:
            logger.info(f"No guardians found for student {event.student_id}")
            return []

        # Determine notification type based on event
        notification_type = (
            NotificationType.INGRESO_OK
            if event.event_type == "IN"
            else NotificationType.SALIDA_OK
        )

        # Check if student allows photo
        photo_allowed = bool(getattr(student, "photo_pref_opt_in", False))

        notification_ids = []

        for guardian in guardians:
            # Check guardian notification preferences
            prefs = guardian.notification_prefs or {}
            event_prefs = prefs.get(notification_type.value, {})

            # Build payload with event details
            payload = self._build_payload(
                student=student,
                event=event,
                photo_url=photo_url if photo_allowed else None,
            )

            # Process each enabled channel
            for channel in NotificationChannel:
                if not self._is_channel_enabled(event_prefs, channel):
                    continue

                recipient = self._get_recipient(guardian, channel)
                if not recipient:
                    logger.debug(
                        f"Guardian {guardian.id} has no {channel.value} contact"
                    )
                    continue

                # Create notification record
                notification = await self.notification_repo.create(
                    guardian_id=guardian.id,
                    channel=channel.value,
                    template=notification_type.value,
                    payload=payload,
                    event_id=event.id,
                )
                await self.session.flush()

                # Enqueue for async delivery
                self._enqueue_notification(
                    notification_id=notification.id,
                    channel=channel,
                    recipient=recipient,
                    template=notification_type.value,
                    payload=payload,
                )

                notification_ids.append(notification.id)
                logger.info(
                    f"Queued {channel.value} notification {notification.id} "
                    f"for guardian {guardian.id} (event {event.id})"
                )

        return notification_ids

    def _build_payload(
        self,
        student,
        event: AttendanceEvent,
        photo_url: str | None,
    ) -> dict:
        """Build the notification payload with event details."""
        occurred_at = event.occurred_at
        return {
            "student_name": student.full_name,
            "student_id": student.id,
            "event_type": event.event_type,
            "event_id": event.id,
            "occurred_at": occurred_at.isoformat() if occurred_at else None,
            "date": occurred_at.strftime("%d/%m/%Y") if occurred_at else None,
            "time": occurred_at.strftime("%H:%M") if occurred_at else None,
            "gate_id": event.gate_id,
            "photo_url": photo_url,
            "has_photo": photo_url is not None,
        }

    def _is_channel_enabled(
        self,
        event_prefs: dict,
        channel: NotificationChannel,
    ) -> bool:
        """Check if a notification channel is enabled for this event type."""
        # Default: WhatsApp enabled, Email disabled
        defaults = {
            NotificationChannel.WHATSAPP: True,
            NotificationChannel.EMAIL: False,
        }
        return event_prefs.get(channel.value.lower(), defaults.get(channel, False))

    def _get_recipient(self, guardian, channel: NotificationChannel) -> str | None:
        """Get the recipient address for a channel from guardian contacts."""
        contacts = guardian.contacts or {}
        channel_key = channel.value.lower()
        return contacts.get(channel_key)

    def _enqueue_notification(
        self,
        notification_id: int,
        channel: NotificationChannel,
        recipient: str,
        template: str,
        payload: dict,
    ) -> None:
        """Enqueue notification for async processing by worker."""
        job_func_map = {
            NotificationChannel.WHATSAPP: "app.workers.jobs.send_whatsapp.send_whatsapp_message",
            NotificationChannel.EMAIL: "app.workers.jobs.send_email.send_email_message",
        }

        job_func = job_func_map.get(channel)
        if not job_func:
            logger.error(f"Unknown notification channel: {channel}")
            return

        # Pass notification_id, recipient, template name, and variables
        self._queue.enqueue(
            job_func,
            notification_id,
            recipient,
            template,
            payload,
        )
