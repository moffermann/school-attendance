"""Service layer for authorized student withdrawals."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, time
from hashlib import sha256
from typing import TYPE_CHECKING, Any
from zoneinfo import ZoneInfo

from fastapi import HTTPException, Request, status
from loguru import logger as loguru_logger
from redis import Redis
from rq import Queue
from sqlalchemy.exc import IntegrityError

from app.core.audit import AuditEvent, audit_log
from app.core.config import settings
from app.db.models.student_withdrawal import (
    StudentWithdrawal,
    WithdrawalStatus,
    WithdrawalVerificationMethod,
)
from app.db.repositories.authorized_pickups import AuthorizedPickupRepository
from app.db.repositories.guardians import GuardianRepository
from app.db.repositories.notifications import NotificationRepository
from app.db.repositories.schedules import ScheduleRepository
from app.db.repositories.students import StudentRepository
from app.db.repositories.tenant_configs import TenantConfigRepository
from app.db.repositories.withdrawals import WithdrawalRepository
from app.schemas.notifications import NotificationChannel

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.core.deps import TenantAuthUser

logger = logging.getLogger(__name__)


class WithdrawalError(Exception):
    """Base exception for withdrawal errors."""

    pass


class WithdrawalService:
    """Business logic for authorized student withdrawals."""

    # Roles that can initiate withdrawals (kiosk/admin)
    INITIATE_ROLES = {"ADMIN", "DIRECTOR", "INSPECTOR", "DEVICE"}
    # Roles that can verify/override withdrawals
    VERIFY_ROLES = {"ADMIN", "DIRECTOR", "INSPECTOR"}
    # Roles that can cancel withdrawals
    CANCEL_ROLES = {"ADMIN", "DIRECTOR"}
    # Roles that can view withdrawal history
    READ_ROLES = {"ADMIN", "DIRECTOR", "INSPECTOR", "TEACHER"}

    def __init__(
        self,
        session: AsyncSession,
        *,
        tenant_id: int | None = None,
        tenant_schema: str | None = None,
        tenant_timezone: str | None = None,
    ):
        self.session = session
        self.withdrawal_repo = WithdrawalRepository(session)
        self.pickup_repo = AuthorizedPickupRepository(session)
        self.student_repo = StudentRepository(session)
        self.guardian_repo = GuardianRepository(session)
        self.notification_repo = NotificationRepository(session)
        self.tenant_config_repo = TenantConfigRepository(session)
        self.schedule_repo = ScheduleRepository(session)
        self.tenant_id = tenant_id
        self.tenant_schema = tenant_schema
        self.tenant_timezone = tenant_timezone
        self._redis: Redis | None = None
        self._queue: Queue | None = None

    def __del__(self):
        """Close Redis connection on cleanup."""
        if hasattr(self, "_redis") and self._redis:
            try:
                self._redis.close()
            except Exception:
                pass  # Ignore errors during cleanup

    @property
    def queue(self) -> Queue | None:
        """Lazy-load Redis queue with graceful fallback if unavailable."""
        if self._queue is None:
            try:
                redis_conn: Redis = Redis.from_url(settings.redis_url)  # type: ignore[assignment]
                redis_conn.ping()
                self._redis = redis_conn
                self._queue = Queue("notifications", connection=redis_conn)
            except Exception as e:
                loguru_logger.error(f"Redis unavailable, notifications disabled: {e}")
                return None
        return self._queue

    # -------------------------------------------------------------------------
    # Timezone helpers
    # -------------------------------------------------------------------------

    def _get_local_now(self, device_timezone: str | None = None) -> datetime:
        """Get current datetime in the local timezone (tenant or device).

        Priority: device_timezone > tenant_timezone > America/Santiago.
        This is critical for correct "today" determination: events at 9:50 PM
        Chile (UTC-3) = 00:50 AM UTC next day. Without local timezone awareness,
        they would be incorrectly classified as the next day.
        """
        tz_name = device_timezone or self.tenant_timezone or "America/Santiago"
        try:
            tz = ZoneInfo(tz_name)
        except Exception:
            tz = ZoneInfo("America/Santiago")
        return datetime.now(tz)

    # -------------------------------------------------------------------------
    # Validation helpers
    # -------------------------------------------------------------------------

    async def validate_withdrawal_eligibility(
        self,
        student_id: int,
        date: datetime | None = None,
        device_timezone: str | None = None,
    ) -> None:
        """Validate that a student can be withdrawn.

        Args:
            student_id: ID of the student to withdraw
            date: Date to check (default: now in local timezone)
            device_timezone: Timezone from the device (e.g. "America/Santiago")

        Raises:
            HTTPException: If the student cannot be withdrawn.
        """
        if date is None:
            # CRITICAL: Use local timezone, not UTC, for "today" calculations.
            # A withdrawal at 9:50 PM Chile = 00:50 AM UTC next day.
            # Using UTC would incorrectly count it as the next day's withdrawal.
            date = self._get_local_now(device_timezone)

        # 1. Verify student exists and is active
        student = await self.student_repo.get_active(student_id)
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Estudiante no encontrado o inactivo",
            )

        # 2. Verify student entered today (CRITICAL)
        entered_today = await self.withdrawal_repo.student_entered_today(student_id, date)
        if not entered_today:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede retirar: estudiante no ingresó hoy",
            )

        # 3. Verify no completed withdrawal today
        already_withdrawn = await self.withdrawal_repo.has_completed_withdrawal_today(
            student_id, date
        )
        if already_withdrawn:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Estudiante ya fue retirado hoy",
            )

        # 4. Verify student hasn't exited normally (OUT event)
        exited_today = await self.withdrawal_repo.student_exited_today(student_id, date)
        if exited_today:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Estudiante ya registró salida normal",
            )

        # 5. Verify within allowed time window (dynamic, based on course schedule)
        now = self._get_local_now(device_timezone)
        current_time = now.time()
        today_date = now.date()
        weekday = now.weekday()  # Monday=0, Sunday=6

        course_id = student.course_id
        if not course_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Estudiante no tiene curso asignado",
            )

        # Check for schedule exception first (modified hours or no-class day)
        exception = await self.schedule_repo.get_exception_for_date(today_date, course_id)

        if exception:
            if exception.in_time is None or exception.out_time is None:
                # Exception without times = no class this day
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Sin clases hoy ({exception.reason}). No se permiten retiros.",
                )
            schedule_in = exception.in_time
            schedule_out = exception.out_time
        else:
            # Get regular schedule for today's weekday
            schedule = await self.schedule_repo.get_by_course_and_weekday(course_id, weekday)
            if not schedule:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Sin horario de clases para hoy. No se permiten retiros.",
                )
            schedule_in = schedule.in_time
            schedule_out = schedule.out_time

        # Validate current time is within class hours
        if current_time < schedule_in or current_time > schedule_out:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Retiros solo permitidos en horario de clases "
                    f"({schedule_in.strftime('%H:%M')} - {schedule_out.strftime('%H:%M')})"
                ),
            )

    async def validate_pickup_authorization(
        self,
        pickup_id: int,
        student_id: int,
    ) -> None:
        """Validate that an authorized pickup can withdraw a student.

        Raises:
            HTTPException: If not authorized.
        """
        # 1. Verify pickup exists and is active
        pickup = await self.pickup_repo.get_active(pickup_id)
        if not pickup:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Persona no autorizada o inactiva",
            )

        # 2. Verify authorization for this student
        is_authorized = await self.pickup_repo.is_authorized_for_student(pickup_id, student_id)
        if not is_authorized:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Persona no autorizada para este estudiante",
            )

        # TODO: Add valid_from/valid_until checking from association table

    # -------------------------------------------------------------------------
    # Withdrawal flow operations
    # -------------------------------------------------------------------------

    async def initiate_withdrawal(
        self,
        student_ids: list[int],
        *,
        authorized_pickup_id: int | None = None,
        device_id: str | None = None,
        device_timezone: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        request: Request | None = None,
    ) -> list[StudentWithdrawal]:
        """Initiate withdrawal for one or more students.

        This is the first step: validates eligibility and creates INITIATED records.

        Args:
            student_ids: List of student IDs to withdraw
            authorized_pickup_id: ID of the authorized adult (if identified by QR)
            device_id: Kiosk device ID
            device_timezone: Device timezone (e.g. "America/Santiago")
            ip_address: Client IP address
            user_agent: Client user agent

        Returns:
            List of created StudentWithdrawal records in INITIATED status.
        """
        # DEBUG: Log tenant context
        loguru_logger.info(
            f"[Withdrawal:initiate] tenant_id={self.tenant_id}, "
            f"tenant_schema={self.tenant_schema}, student_ids={student_ids}"
        )

        if not student_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debe seleccionar al menos un estudiante",
            )

        withdrawals = []
        errors = []

        for student_id in student_ids:
            try:
                # Check for existing active withdrawal (idempotent initiation)
                # This prevents duplicate records when the kiosk retries after a failure
                existing = await self.withdrawal_repo.get_pending_withdrawal(student_id)
                if existing:
                    loguru_logger.info(
                        f"[Withdrawal:initiate] Reusing existing withdrawal "
                        f"id={existing.id} status={existing.status} for student {student_id}"
                    )
                    withdrawals.append(existing)
                    continue

                # Validate eligibility
                await self.validate_withdrawal_eligibility(student_id, device_timezone=device_timezone)

                # Validate pickup authorization if provided
                if authorized_pickup_id:
                    await self.validate_pickup_authorization(authorized_pickup_id, student_id)

                # Create withdrawal record
                withdrawal = await self.withdrawal_repo.create(
                    student_id=student_id,
                    authorized_pickup_id=authorized_pickup_id,
                    device_id=device_id,
                    ip_address=ip_address,
                    user_agent=user_agent,
                )
                withdrawals.append(withdrawal)

            except HTTPException as e:
                student = await self.student_repo.get(student_id)
                student_name = student.full_name if student else f"ID {student_id}"
                errors.append(f"{student_name}: {e.detail}")

        if errors and not withdrawals:
            # All failed
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="; ".join(errors),
            )

        await self.session.flush()

        # Audit log
        client_ip = request.client.host if request and request.client else ip_address
        audit_log(
            AuditEvent.WITHDRAWAL_INITIATED,
            ip_address=client_ip,
            resource_type="withdrawal",
            details={
                "student_ids": [w.student_id for w in withdrawals],
                "authorized_pickup_id": authorized_pickup_id,
                "errors": errors if errors else None,
            },
        )

        return withdrawals

    async def verify_withdrawal(
        self,
        withdrawal_id: int,
        *,
        verification_method: WithdrawalVerificationMethod,
        verified_by_user_id: int | None = None,
        pickup_photo_ref: str | None = None,
        request: Request | None = None,
    ) -> StudentWithdrawal:
        """Verify identity and move to VERIFIED status.

        This is the second step: identity confirmation via QR, photo match, or admin override.
        """
        # DEBUG: Log tenant context
        loguru_logger.info(
            f"[Withdrawal:verify] tenant_id={self.tenant_id}, "
            f"tenant_schema={self.tenant_schema}, withdrawal_id={withdrawal_id}"
        )

        withdrawal = await self.withdrawal_repo.get(withdrawal_id)
        loguru_logger.info(f"[Withdrawal:verify] lookup result: {withdrawal}")
        if not withdrawal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Retiro no encontrado",
            )

        # Idempotent: if already VERIFIED, return as-is (safe for kiosk retries)
        if withdrawal.status == WithdrawalStatus.VERIFIED.value:
            loguru_logger.info(
                f"[Withdrawal:verify] Already VERIFIED, returning as-is "
                f"(idempotent retry) withdrawal_id={withdrawal_id}"
            )
            return withdrawal

        if withdrawal.status != WithdrawalStatus.INITIATED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No se puede verificar: estado actual es {withdrawal.status}",
            )

        updated = await self.withdrawal_repo.update_to_verified(
            withdrawal_id,
            verification_method=verification_method,
            verified_by_user_id=verified_by_user_id,
            pickup_photo_ref=pickup_photo_ref,
        )

        if not updated:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al actualizar estado",
            )

        await self.session.flush()

        # Audit log
        client_ip = request.client.host if request and request.client else withdrawal.ip_address
        audit_log(
            AuditEvent.WITHDRAWAL_VERIFIED,
            user_id=verified_by_user_id,
            ip_address=client_ip,
            resource_type="withdrawal",
            resource_id=withdrawal_id,
            details={
                "verification_method": verification_method.value,
                "student_id": withdrawal.student_id,
            },
        )

        return updated

    async def complete_withdrawal(
        self,
        withdrawal_id: int,
        *,
        signature_data: str | None = None,
        reason: str | None = None,
        request: Request | None = None,
    ) -> StudentWithdrawal:
        """Complete withdrawal with signature.

        This is the final step: digital signature and completion.
        After this, the student is considered withdrawn.
        """
        withdrawal = await self.withdrawal_repo.get(withdrawal_id)
        if not withdrawal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Retiro no encontrado",
            )

        if withdrawal.status != WithdrawalStatus.VERIFIED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No se puede completar: estado actual es {withdrawal.status}",
            )

        try:
            updated = await self.withdrawal_repo.update_to_completed(
                withdrawal_id,
                signature_data=signature_data,
                reason=reason,
            )

            if not updated:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Error al completar retiro",
                )

            await self.session.flush()

            # Cross-reference: link to pre-approved withdrawal request if exists
            try:
                from app.services.withdrawal_request_service import (
                    WithdrawalRequestService,
                )

                req_service = WithdrawalRequestService(self.session)
                await req_service.complete_from_withdrawal(
                    student_withdrawal_id=updated.id,
                    student_id=updated.student_id,
                    pickup_id=updated.authorized_pickup_id,
                )
            except Exception:
                loguru_logger.warning(
                    "Failed to link withdrawal to request", exc_info=True
                )

        except IntegrityError as e:
            await self.session.rollback()
            loguru_logger.warning(
                f"IntegrityError completing withdrawal {withdrawal_id}: {e}"
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Estudiante ya tiene un retiro completado hoy. No se puede registrar otro.",
            ) from e

        # Audit log
        client_ip = request.client.host if request and request.client else withdrawal.ip_address
        audit_log(
            AuditEvent.WITHDRAWAL_COMPLETED,
            ip_address=client_ip,
            resource_type="withdrawal",
            resource_id=withdrawal_id,
            details={
                "student_id": withdrawal.student_id,
                "has_signature": signature_data is not None,
            },
        )

        # Send notifications to guardians
        try:
            notification_ids = await self.notify_withdrawal_completed(updated)
            loguru_logger.info(
                f"Withdrawal {withdrawal_id} completed, sent {len(notification_ids)} notifications"
            )
        except Exception as e:
            # Don't fail the withdrawal if notifications fail
            loguru_logger.error(f"Failed to send withdrawal notifications: {e}")

        return updated

    async def cancel_withdrawal(
        self,
        withdrawal_id: int,
        *,
        cancelled_by_user_id: int,
        cancellation_reason: str,
        request: Request | None = None,
    ) -> StudentWithdrawal:
        """Cancel a withdrawal (requires reason).

        Can cancel from INITIATED or VERIFIED status.
        """
        if not cancellation_reason or len(cancellation_reason) < 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Razón de cancelación obligatoria (mínimo 10 caracteres)",
            )

        withdrawal = await self.withdrawal_repo.get(withdrawal_id)
        if not withdrawal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Retiro no encontrado",
            )

        if not withdrawal.can_be_cancelled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No se puede cancelar: estado actual es {withdrawal.status}",
            )

        updated = await self.withdrawal_repo.cancel(
            withdrawal_id,
            cancelled_by_user_id=cancelled_by_user_id,
            cancellation_reason=cancellation_reason,
        )

        if not updated:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al cancelar retiro",
            )

        await self.session.flush()

        # Audit log
        client_ip = request.client.host if request and request.client else None
        audit_log(
            AuditEvent.WITHDRAWAL_CANCELLED,
            user_id=cancelled_by_user_id,
            ip_address=client_ip,
            resource_type="withdrawal",
            resource_id=withdrawal_id,
            details={
                "student_id": withdrawal.student_id,
                "reason": cancellation_reason,
            },
        )

        return updated

    # -------------------------------------------------------------------------
    # Admin override flow
    # -------------------------------------------------------------------------

    async def admin_override_withdrawal(
        self,
        user: TenantAuthUser,
        student_id: int,
        *,
        reason: str,
        signature_data: str | None = None,
        device_id: str | None = None,
        request: Request | None = None,
    ) -> StudentWithdrawal:
        """Admin manually approves a withdrawal without QR/photo verification.

        This combines initiate + verify + complete in one step for admin use cases.
        """
        if user.role not in self.VERIFY_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para autorizar retiros",
            )

        if not reason or len(reason) < 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Razón obligatoria para override manual (mínimo 10 caracteres)",
            )

        # Validate eligibility
        await self.validate_withdrawal_eligibility(student_id)

        ip_address = request.client.host if request and request.client else None

        # Create directly in INITIATED
        withdrawal = await self.withdrawal_repo.create(
            student_id=student_id,
            authorized_pickup_id=None,  # Admin override has no associated pickup
            device_id=device_id,
            ip_address=ip_address,
        )

        # Immediately verify with ADMIN_OVERRIDE
        await self.withdrawal_repo.update_to_verified(
            withdrawal.id,
            verification_method=WithdrawalVerificationMethod.ADMIN_OVERRIDE,
            verified_by_user_id=user.id,
        )

        # Immediately complete
        try:
            completed = await self.withdrawal_repo.update_to_completed(
                withdrawal.id,
                signature_data=signature_data,
                reason=reason,
            )

            await self.session.flush()
        except IntegrityError as e:
            await self.session.rollback()
            loguru_logger.warning(
                f"IntegrityError in admin override for student {student_id}: {e}"
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Estudiante ya tiene un retiro completado hoy.",
            ) from e

        # Audit log
        audit_log(
            AuditEvent.WITHDRAWAL_ADMIN_OVERRIDE,
            user_id=user.id,
            ip_address=ip_address,
            resource_type="withdrawal",
            resource_id=completed.id if completed else withdrawal.id,
            details={
                "student_id": student_id,
                "reason": reason,
            },
        )

        # Send notifications to guardians
        final_withdrawal = completed if completed else withdrawal
        try:
            notification_ids = await self.notify_withdrawal_completed(final_withdrawal)
            loguru_logger.info(
                f"Admin override withdrawal {final_withdrawal.id} completed, "
                f"sent {len(notification_ids)} notifications"
            )
        except Exception as e:
            # Don't fail the withdrawal if notifications fail
            loguru_logger.error(f"Failed to send admin override withdrawal notifications: {e}")

        return final_withdrawal

    # -------------------------------------------------------------------------
    # Query operations
    # -------------------------------------------------------------------------

    async def get_withdrawal(
        self,
        user: TenantAuthUser,
        withdrawal_id: int,
    ) -> StudentWithdrawal:
        """Get a withdrawal by ID."""
        if user.role not in self.READ_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para ver retiros",
            )

        withdrawal = await self.withdrawal_repo.get(withdrawal_id)
        if not withdrawal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Retiro no encontrado",
            )

        return withdrawal

    async def list_withdrawals(
        self,
        user: TenantAuthUser,
        *,
        skip: int = 0,
        limit: int = 50,
        student_id: int | None = None,
        pickup_id: int | None = None,
        status: WithdrawalStatus | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> tuple[list[StudentWithdrawal], int]:
        """List withdrawals with filters and pagination."""
        if user.role not in self.READ_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para ver retiros",
            )

        return await self.withdrawal_repo.list_paginated(
            skip=skip,
            limit=limit,
            student_id=student_id,
            pickup_id=pickup_id,
            status=status,
            date_from=date_from,
            date_to=date_to,
        )

    async def list_today_withdrawals(
        self,
        user: TenantAuthUser,
    ) -> list[StudentWithdrawal]:
        """List all withdrawals for today (using tenant timezone)."""
        if user.role not in self.READ_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para ver retiros",
            )

        # Use tenant timezone for correct "today" determination
        now_local = self._get_local_now()
        return await self.withdrawal_repo.list_today(now_local)

    async def get_withdrawal_stats(
        self,
        user: TenantAuthUser,
        date: datetime | None = None,
    ) -> dict[str, int]:
        """Get withdrawal statistics for a day."""
        if user.role not in self.READ_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para ver estadísticas",
            )

        return await self.withdrawal_repo.count_by_status(date)

    # -------------------------------------------------------------------------
    # Kiosk sync operations
    # -------------------------------------------------------------------------

    async def get_kiosk_sync_data(self) -> dict:
        """Get data for kiosk bootstrap sync.

        Returns authorized pickups and today's completed withdrawals.
        """
        pickups = await self.pickup_repo.list_for_kiosk_sync()
        withdrawals = await self.withdrawal_repo.list_for_kiosk_sync()

        return {
            "authorized_pickups": pickups,
            "today_withdrawals": withdrawals,
        }

    async def lookup_by_qr_hash(self, qr_token: str) -> dict | None:
        """Lookup authorized pickup by QR code token.

        The QR code contains a token, not the hash. We hash it here
        before looking up in the database where hashes are stored.

        Returns pickup info with authorized student IDs.
        Used by kiosk for QR scan verification.
        """
        # Hash the token to match stored qr_code_hash
        qr_hash = sha256(qr_token.encode()).hexdigest()[:64]
        pickup = await self.pickup_repo.get_by_qr_hash(qr_hash)
        if not pickup:
            return None

        return {
            "id": pickup.id,
            "full_name": pickup.full_name,
            "relationship_type": pickup.relationship_type,
            "photo_url": pickup.photo_url,
            "student_ids": [s.id for s in pickup.students],
        }

    # -------------------------------------------------------------------------
    # Notification operations
    # -------------------------------------------------------------------------

    async def notify_withdrawal_completed(
        self,
        withdrawal: StudentWithdrawal,
    ) -> list[int]:
        """Send notifications to guardians when a withdrawal is completed.

        Sends both email and WhatsApp notifications based on guardian preferences.

        Args:
            withdrawal: The completed withdrawal record

        Returns:
            List of notification IDs created
        """
        # Get student with guardians
        student = await self.student_repo.get_with_guardians(withdrawal.student_id)
        if not student:
            loguru_logger.warning(f"Student {withdrawal.student_id} not found for withdrawal notification")
            return []

        guardians = getattr(student, "guardians", [])
        if not guardians:
            loguru_logger.info(f"No guardians found for student {withdrawal.student_id}")
            return []

        # Get pickup person info
        pickup = None
        if withdrawal.authorized_pickup_id:
            pickup = await self.pickup_repo.get(withdrawal.authorized_pickup_id)

        # Get school name from tenant config
        school_name = "Colegio"
        try:
            if self.tenant_id:
                tenant_config = await self.tenant_config_repo.get(self.tenant_id)
                if tenant_config and tenant_config.school_name:
                    school_name = tenant_config.school_name
        except Exception as e:
            loguru_logger.warning(f"Could not get school name: {e}")

        notification_ids = []

        for guardian in guardians:
            # Check guardian notification preferences
            prefs = guardian.notification_prefs or {}
            # Use RETIRO_OK as the preference key for withdrawal notifications
            # Default: email=True, whatsapp=True for withdrawals (important alerts)
            withdrawal_prefs = prefs.get("RETIRO_OK", {"email": True, "whatsapp": True})

            # Determine if self-pickup (pickup person is this guardian)
            is_self = self._is_self_pickup(guardian, pickup)

            # Select template based on pickup type
            template = "RETIRO_COMPLETADO" if is_self else "RETIRO_POR_TERCERO"

            # Build payload
            payload = self._build_withdrawal_payload(
                student=student,
                pickup=pickup,
                withdrawal=withdrawal,
                school_name=school_name,
            )

            # Get guardian contacts
            contacts = guardian.contacts or {}

            # Process EMAIL channel
            email_enabled = withdrawal_prefs.get("email", True)
            email = contacts.get("email")
            if email_enabled and email:
                email_notif_ids = await self._send_channel_notification(
                    guardian_id=guardian.id,
                    channel=NotificationChannel.EMAIL,
                    recipient=email,
                    template=template,
                    payload=payload,
                    withdrawal_id=withdrawal.id,
                )
                notification_ids.extend(email_notif_ids)

            # Process WHATSAPP channel
            whatsapp_enabled = withdrawal_prefs.get("whatsapp", True)
            whatsapp = contacts.get("whatsapp")
            if whatsapp_enabled and whatsapp:
                whatsapp_notif_ids = await self._send_channel_notification(
                    guardian_id=guardian.id,
                    channel=NotificationChannel.WHATSAPP,
                    recipient=whatsapp,
                    template=template,
                    payload=payload,
                    withdrawal_id=withdrawal.id,
                )
                notification_ids.extend(whatsapp_notif_ids)

        return notification_ids

    async def _send_channel_notification(
        self,
        guardian_id: int,
        channel: NotificationChannel,
        recipient: str,
        template: str,
        payload: dict[str, Any],
        withdrawal_id: int,
    ) -> list[int]:
        """Send notification through a specific channel.

        Args:
            guardian_id: The guardian's ID
            channel: The notification channel (EMAIL or WHATSAPP)
            recipient: The recipient address (email or phone)
            template: Template name
            payload: Template variables
            withdrawal_id: The withdrawal ID for context

        Returns:
            List of notification IDs created (0 or 1)
        """
        # Create notification record (with deduplication)
        notification, created = await self.notification_repo.get_or_create(
            guardian_id=guardian_id,
            channel=channel.value,
            template=template,
            payload=payload,
            event_id=None,  # No attendance event for withdrawals
            context_id=withdrawal_id,
        )

        if not created:
            loguru_logger.info(
                f"Skipped duplicate withdrawal {channel.value} for guardian {guardian_id}"
            )
            return []

        await self.session.flush()

        # Enqueue for async delivery
        enqueued = self._enqueue_withdrawal_notification(
            notification_id=notification.id,
            recipient=recipient,
            template=template,
            payload=payload,
            channel=channel,
        )

        if enqueued:
            loguru_logger.info(
                f"Queued {template} {channel.value} notification {notification.id} "
                f"for guardian {guardian_id} (withdrawal {withdrawal_id})"
            )
            return [notification.id]

        return []

    def _build_withdrawal_payload(
        self,
        student,
        pickup,
        withdrawal: StudentWithdrawal,
        school_name: str,
    ) -> dict[str, Any]:
        """Build the notification payload for withdrawal emails.

        Args:
            student: The student being withdrawn
            pickup: The authorized pickup person (may be None for admin override)
            withdrawal: The withdrawal record
            school_name: Name of the school

        Returns:
            Dictionary with template variables
        """
        # Use completed_at as the "withdrawn at" timestamp (when the withdrawal was finalized)
        withdrawn_at = withdrawal.completed_at or withdrawal.initiated_at

        # Convert to tenant's local timezone for display
        timezone_name = self.tenant_timezone or settings.school_timezone
        local_time = None
        if withdrawn_at:
            try:
                school_tz = ZoneInfo(timezone_name)
                if withdrawn_at.tzinfo is None:
                    withdrawn_at = withdrawn_at.replace(tzinfo=ZoneInfo("UTC"))
                local_time = withdrawn_at.astimezone(school_tz)
            except Exception as e:
                loguru_logger.warning(f"Failed to convert timezone '{timezone_name}': {e}")
                local_time = withdrawn_at

        pickup_name = "Administrador" if not pickup else pickup.full_name
        pickup_relationship = "Override Manual" if not pickup else pickup.relationship_type

        return {
            "school_name": school_name,
            "student_name": student.full_name,
            "student_id": student.id,
            "pickup_name": pickup_name,
            "pickup_relationship": pickup_relationship,
            "date": local_time.strftime("%d/%m/%Y") if local_time else None,
            "time": local_time.strftime("%H:%M") if local_time else None,
            "withdrawn_at": withdrawn_at.isoformat() if withdrawn_at else None,
            "signature_data": withdrawal.signature_data,
            "withdrawal_id": withdrawal.id,
            "reason": withdrawal.reason,
        }

    def _is_self_pickup(self, guardian, pickup) -> bool:
        """Determine if the pickup person is the same as the guardian.

        Compares by RUT if available, otherwise by name.

        Args:
            guardian: The guardian to compare
            pickup: The authorized pickup person

        Returns:
            True if the pickup is the guardian themselves
        """
        if not pickup:
            return False

        # Compare by RUT if both have it
        guardian_rut = getattr(guardian, "rut", None)
        pickup_rut = getattr(pickup, "rut", None)

        if guardian_rut and pickup_rut:
            # Normalize RUTs for comparison (remove dots and dashes)
            guardian_rut_clean = guardian_rut.replace(".", "").replace("-", "").upper()
            pickup_rut_clean = pickup_rut.replace(".", "").replace("-", "").upper()
            return guardian_rut_clean == pickup_rut_clean

        # Fallback: compare by name (less reliable)
        guardian_name = getattr(guardian, "full_name", "")
        pickup_name = getattr(pickup, "full_name", "")

        if guardian_name and pickup_name:
            return guardian_name.lower().strip() == pickup_name.lower().strip()

        return False

    def _enqueue_withdrawal_notification(
        self,
        notification_id: int,
        recipient: str,
        template: str,
        payload: dict[str, Any],
        channel: NotificationChannel = NotificationChannel.EMAIL,
    ) -> bool:
        """Enqueue withdrawal notification for async processing.

        Args:
            notification_id: ID of the notification record
            recipient: Recipient address (email or phone number)
            template: Template name
            payload: Template variables
            channel: Notification channel (EMAIL or WHATSAPP)

        Returns:
            True if notification was enqueued, False if Redis unavailable
        """
        queue = self.queue
        if queue is None:
            loguru_logger.warning(f"Skipping withdrawal notification {notification_id}: Redis unavailable")
            return False

        # Select job function based on channel
        job_func_map = {
            NotificationChannel.EMAIL: "app.workers.jobs.send_email.send_email_message",
            NotificationChannel.WHATSAPP: "app.workers.jobs.send_whatsapp.send_whatsapp_message",
        }

        job_func = job_func_map.get(channel)
        if not job_func:
            loguru_logger.error(f"Unknown notification channel: {channel}")
            return False

        # Enqueue job with tenant context
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
