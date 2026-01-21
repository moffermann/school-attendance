"""Service for sending attendance notifications to guardians."""

from __future__ import annotations

from typing import TYPE_CHECKING

from loguru import logger
from redis import Redis
from rq import Queue
from sqlalchemy import text

from app.core.config import settings
from app.db.repositories.guardians import GuardianRepository
from app.db.repositories.notifications import NotificationRepository
from app.db.repositories.push_subscriptions import PushSubscriptionRepository
from app.db.repositories.students import StudentRepository
from app.schemas.notifications import NotificationChannel, NotificationType

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.db.models.attendance_event import AttendanceEvent


class AttendanceNotificationService:
    """Handles notification dispatch when attendance events occur."""

    def __init__(
        self,
        session: AsyncSession,
        tenant_id: int | None = None,
        tenant_schema: str | None = None,
    ) -> None:
        self.session = session
        self.notification_repo = NotificationRepository(session)
        self.guardian_repo = GuardianRepository(session)
        self.student_repo = StudentRepository(session)
        self.push_repo = PushSubscriptionRepository(session)
        self._redis: Redis | None = None
        self._queue: Queue | None = None
        # MT-WORKER-FIX: Store tenant context for job enqueueing
        self.tenant_id = tenant_id
        self.tenant_schema = tenant_schema

    def __del__(self):
        """Close Redis connection on cleanup (B8 fix)."""
        if hasattr(self, '_redis') and self._redis:
            try:
                self._redis.close()
            except Exception:
                pass  # Ignore errors during cleanup

    @property
    def queue(self) -> Queue | None:
        """Lazy-load Redis queue with graceful fallback if unavailable."""
        if self._queue is None:
            try:
                self._redis = Redis.from_url(settings.redis_url)
                # Test connection
                self._redis.ping()
                self._queue = Queue("notifications", connection=self._redis)
            except Exception as e:
                logger.error(f"Redis unavailable, notifications disabled: {e}")
                return None
        return self._queue

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
        # MT-POOL-FIX: Re-set search_path in case connection was released and re-acquired after commit
        # This can happen when register_event commits and the connection returns to pool.
        # The next query may get a different connection without search_path set.
        if self.tenant_schema:
            await self.session.execute(text(f"SET search_path TO {self.tenant_schema}, public"))
            logger.debug(f"[DEBUG-NOTIF-SVC] Re-set search_path to {self.tenant_schema}")

        logger.info(f"[DEBUG-NOTIF-SVC] notify_attendance_event called for event {event.id}, student {event.student_id}")

        student = await self.student_repo.get_with_guardians(event.student_id)
        if not student:
            logger.warning(f"Student {event.student_id} not found for notification")
            return []

        guardians = getattr(student, "guardians", [])
        logger.info(f"[DEBUG-NOTIF-SVC] Found {len(guardians)} guardians for student {event.student_id}")
        if not guardians:
            logger.info(f"No guardians found for student {event.student_id}")
            return []

        # Determine notification type based on event
        notification_type = (
            NotificationType.INGRESO_OK
            if event.type == "IN"
            else NotificationType.SALIDA_OK
        )

        # R15-STATE3 fix: Use effective_evidence_preference instead of legacy photo_pref_opt_in
        # This ensures consistency with the new evidence preference system
        evidence_pref = getattr(student, "effective_evidence_preference", "none")
        photo_allowed = evidence_pref == "photo"

        notification_ids = []

        for guardian in guardians:
            # Check guardian notification preferences
            prefs = guardian.notification_prefs or {}
            event_prefs = prefs.get(notification_type.value, {})
            logger.info(f"[DEBUG-NOTIF-SVC] Guardian {guardian.id}: prefs={prefs}, event_prefs={event_prefs}")

            # Build payload with event details
            payload = self._build_payload(
                student=student,
                event=event,
                photo_url=photo_url if photo_allowed else None,
            )

            # Process each enabled channel
            for channel in NotificationChannel:
                is_enabled = self._is_channel_enabled(event_prefs, channel)
                logger.debug(f"[DEBUG-NOTIF-SVC] Channel {channel.value}: enabled={is_enabled}")
                if not is_enabled:
                    continue

                # PUSH channel is handled separately - uses subscriptions, not contacts
                if channel == NotificationChannel.PUSH:
                    push_ids = await self._process_push_notifications(
                        guardian=guardian,
                        notification_type=notification_type,
                        payload=payload,
                        event_id=event.id,
                    )
                    notification_ids.extend(push_ids)
                    continue

                recipient = self._get_recipient(guardian, channel)
                logger.info(f"[DEBUG-NOTIF-SVC] Channel {channel.value}: recipient={recipient}")
                if not recipient:
                    logger.debug(
                        f"Guardian {guardian.id} has no {channel.value} contact"
                    )
                    continue

                logger.info(f"[DEBUG-NOTIF-SVC] Creating notification for guardian {guardian.id}, channel {channel.value}")
                # Create notification record
                notification = await self.notification_repo.create(
                    guardian_id=guardian.id,
                    channel=channel.value,
                    template=notification_type.value,
                    payload=payload,
                    event_id=event.id,
                )
                logger.info(f"[DEBUG-NOTIF-SVC] Created notification {notification.id} for guardian {guardian.id}")
                await self.session.flush()
                logger.info(f"[DEBUG-NOTIF-SVC] Session flushed")

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

        logger.info(f"[DEBUG-NOTIF-SVC] Returning {len(notification_ids)} notification IDs: {notification_ids}")
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
            "type": event.type,
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
        # Default: WhatsApp enabled, Email disabled, Push enabled (if subscribed)
        defaults = {
            NotificationChannel.WHATSAPP: True,
            NotificationChannel.EMAIL: False,
            NotificationChannel.PUSH: True,  # Always try push if subscribed
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
    ) -> bool:
        """Enqueue notification for async processing by worker.

        Returns:
            True if notification was enqueued, False if Redis unavailable.
        """
        queue = self.queue
        if queue is None:
            logger.warning(
                f"Skipping notification {notification_id}: Redis unavailable"
            )
            return False

        job_func_map = {
            NotificationChannel.WHATSAPP: "app.workers.jobs.send_whatsapp.send_whatsapp_message",
            NotificationChannel.EMAIL: "app.workers.jobs.send_email.send_email_message",
        }

        job_func = job_func_map.get(channel)
        if not job_func:
            logger.error(f"Unknown notification channel: {channel}")
            return False

        # MT-WORKER-FIX: Pass tenant context so worker can find notification in correct schema
        queue.enqueue(
            job_func,
            notification_id,
            recipient,
            template,
            payload,
            self.tenant_id,
            self.tenant_schema,
        )
        return True

    async def _process_push_notifications(
        self,
        guardian,
        notification_type: NotificationType,
        payload: dict,
        event_id: int,
    ) -> list[int]:
        """Process push notifications for a guardian's subscriptions.

        Args:
            guardian: The guardian to notify
            notification_type: Type of notification
            payload: Notification payload
            event_id: The attendance event ID

        Returns:
            List of notification IDs created
        """
        # Check if VAPID is configured
        if not settings.vapid_public_key or not settings.vapid_private_key:
            logger.debug("VAPID not configured, skipping push notifications")
            return []

        # Get active push subscriptions for this guardian
        subscriptions = await self.push_repo.list_active_by_guardian(guardian.id)
        if not subscriptions:
            logger.debug(f"Guardian {guardian.id} has no push subscriptions")
            return []

        notification_ids = []

        # Build push-specific payload
        push_payload = self._build_push_payload(notification_type, payload)

        for subscription in subscriptions:
            # Create notification record
            notification = await self.notification_repo.create(
                guardian_id=guardian.id,
                channel=NotificationChannel.PUSH.value,
                template=notification_type.value,
                payload=payload,
                event_id=event_id,
            )
            await self.session.flush()

            # Enqueue push notification
            self._enqueue_push_notification(
                notification_id=notification.id,
                subscription=subscription,
                push_payload=push_payload,
            )

            notification_ids.append(notification.id)
            logger.info(
                f"Queued PUSH notification {notification.id} "
                f"for guardian {guardian.id} (subscription {subscription.id})"
            )

        return notification_ids

    def _build_push_payload(
        self,
        notification_type: NotificationType,
        payload: dict,
    ) -> dict:
        """Build the push notification payload."""
        student_name = payload.get("student_name", "Estudiante")
        time_str = payload.get("time", "")
        event_type = payload.get("type", "")

        # Build title and body based on notification type
        if notification_type == NotificationType.INGRESO_OK:
            title = "Ingreso registrado"
            body = f"{student_name} ingreso al colegio a las {time_str}"
        elif notification_type == NotificationType.SALIDA_OK:
            title = "Salida registrada"
            body = f"{student_name} salio del colegio a las {time_str}"
        elif notification_type == NotificationType.NO_INGRESO_UMBRAL:
            title = "Alerta de inasistencia"
            body = f"{student_name} no ha registrado ingreso hoy"
        else:
            title = "Notificacion de asistencia"
            body = f"Actualizacion para {student_name}"

        return {
            "title": title,
            "body": body,
            "icon": "/app/assets/logo.svg",
            "badge": "/app/assets/badge.svg",
            "tag": f"attendance-{payload.get('event_id', 'unknown')}",
            "url": "/app/#/parent/home",
            "data": payload,
        }

    def _enqueue_push_notification(
        self,
        notification_id: int,
        subscription,
        push_payload: dict,
    ) -> bool:
        """Enqueue a push notification for async processing.

        Args:
            notification_id: ID of the notification record
            subscription: PushSubscription model instance
            push_payload: Push notification payload

        Returns:
            True if enqueued successfully
        """
        queue = self.queue
        if queue is None:
            logger.warning(f"Skipping push notification {notification_id}: Redis unavailable")
            return False

        subscription_info = {
            "endpoint": subscription.endpoint,
            "keys": {
                "p256dh": subscription.p256dh,
                "auth": subscription.auth,
            },
        }

        # MT-WORKER-FIX: Pass tenant context so worker can find notification in correct schema
        queue.enqueue(
            "app.workers.jobs.send_push.send_push_notification",
            notification_id,
            subscription_info,
            push_payload,
            self.tenant_id,
            self.tenant_schema,
        )
        return True
