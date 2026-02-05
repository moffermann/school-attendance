"""Withdrawal repository for managing student withdrawal records."""

from __future__ import annotations

from datetime import UTC, datetime, time, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.attendance_event import AttendanceEvent, AttendanceTypeEnum
from app.db.models.student import Student
from app.db.models.student_withdrawal import (
    StudentWithdrawal,
    WithdrawalStatus,
    WithdrawalVerificationMethod,
)


class WithdrawalRepository:
    """Repository for StudentWithdrawal CRUD operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, withdrawal_id: int) -> StudentWithdrawal | None:
        """Get withdrawal by ID with relationships loaded."""
        stmt = (
            select(StudentWithdrawal)
            .options(
                selectinload(StudentWithdrawal.student).selectinload(Student.course),
                selectinload(StudentWithdrawal.authorized_pickup),
            )
            .where(StudentWithdrawal.id == withdrawal_id)
        )
        result = await self.session.execute(stmt)
        return result.scalars().one_or_none()

    async def create(
        self,
        student_id: int,
        *,
        authorized_pickup_id: int | None = None,
        device_id: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> StudentWithdrawal:
        """Create a new withdrawal record in INITIATED status."""
        withdrawal = StudentWithdrawal(
            student_id=student_id,
            authorized_pickup_id=authorized_pickup_id,
            status=WithdrawalStatus.INITIATED.value,
            device_id=device_id,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        self.session.add(withdrawal)
        await self.session.flush()
        # Re-fetch with relationships loaded to avoid lazy loading issues
        return await self.get(withdrawal.id)  # type: ignore

    async def update_to_verified(
        self,
        withdrawal_id: int,
        *,
        verification_method: WithdrawalVerificationMethod,
        verified_by_user_id: int | None = None,
        pickup_photo_ref: str | None = None,
    ) -> StudentWithdrawal | None:
        """Update withdrawal to VERIFIED status after identity confirmation."""
        withdrawal = await self.get(withdrawal_id)
        if not withdrawal:
            return None

        if withdrawal.status != WithdrawalStatus.INITIATED.value:
            return None  # Can only verify from INITIATED

        withdrawal.status = WithdrawalStatus.VERIFIED.value
        withdrawal.verification_method = verification_method.value
        withdrawal.verified_by_user_id = verified_by_user_id
        withdrawal.verified_at = datetime.now(UTC)
        if pickup_photo_ref:
            withdrawal.pickup_photo_ref = pickup_photo_ref

        await self.session.flush()
        return withdrawal

    async def update_to_completed(
        self,
        withdrawal_id: int,
        *,
        signature_data: str | None = None,
        reason: str | None = None,
    ) -> StudentWithdrawal | None:
        """Complete the withdrawal with signature."""
        withdrawal = await self.get(withdrawal_id)
        if not withdrawal:
            return None

        if withdrawal.status != WithdrawalStatus.VERIFIED.value:
            return None  # Can only complete from VERIFIED

        withdrawal.status = WithdrawalStatus.COMPLETED.value
        withdrawal.completed_at = datetime.now(UTC)
        if signature_data:
            withdrawal.signature_data = signature_data
        if reason:
            withdrawal.reason = reason

        await self.session.flush()
        return withdrawal

    async def cancel(
        self,
        withdrawal_id: int,
        *,
        cancelled_by_user_id: int,
        cancellation_reason: str,
    ) -> StudentWithdrawal | None:
        """Cancel a withdrawal (from INITIATED or VERIFIED status)."""
        withdrawal = await self.get(withdrawal_id)
        if not withdrawal:
            return None

        if not withdrawal.can_be_cancelled:
            return None  # Already completed or cancelled

        withdrawal.status = WithdrawalStatus.CANCELLED.value
        withdrawal.cancelled_by_user_id = cancelled_by_user_id
        withdrawal.cancellation_reason = cancellation_reason
        withdrawal.cancelled_at = datetime.now(UTC)

        await self.session.flush()
        return withdrawal

    # -------------------------------------------------------------------------
    # Timezone-aware date range helper
    # -------------------------------------------------------------------------

    @staticmethod
    def _get_day_utc_range(dt: datetime) -> tuple[datetime, datetime]:
        """Convert a timezone-aware datetime to UTC start/end of its LOCAL day.

        This is critical for correct date filtering: a withdrawal at 9:50 PM
        Chile time (UTC-3) = 00:50 AM UTC next day. Using UTC date cast would
        incorrectly count it as the next day. Instead, we compute the local
        day boundaries and convert to UTC for proper range queries.

        Args:
            dt: A timezone-aware datetime. If naive, UTC is assumed.

        Returns:
            Tuple of (start_of_day_utc, end_of_day_utc) for the LOCAL date.
        """
        tz = dt.tzinfo or UTC
        local_date = dt.date()
        start_local = datetime.combine(local_date, time.min, tzinfo=tz)
        end_local = datetime.combine(local_date + timedelta(days=1), time.min, tzinfo=tz)
        return start_local.astimezone(UTC), end_local.astimezone(UTC)

    # -------------------------------------------------------------------------
    # Validation helpers (for WithdrawalService)
    # -------------------------------------------------------------------------

    async def has_completed_withdrawal_today(
        self, student_id: int, date: datetime | None = None
    ) -> bool:
        """Check if student already has a COMPLETED withdrawal today."""
        if date is None:
            date = datetime.now(UTC)

        day_start, day_end = self._get_day_utc_range(date)

        stmt = (
            select(func.count())
            .select_from(StudentWithdrawal)
            .where(
                StudentWithdrawal.student_id == student_id,
                StudentWithdrawal.status == WithdrawalStatus.COMPLETED.value,
                StudentWithdrawal.initiated_at >= day_start,
                StudentWithdrawal.initiated_at < day_end,
            )
        )
        result = await self.session.execute(stmt)
        count = result.scalar() or 0
        return count > 0

    async def get_completed_withdrawal_today(
        self, student_id: int, date: datetime | None = None
    ) -> StudentWithdrawal | None:
        """Get the completed withdrawal for a student today if exists."""
        if date is None:
            date = datetime.now(UTC)

        day_start, day_end = self._get_day_utc_range(date)

        stmt = (
            select(StudentWithdrawal)
            .options(selectinload(StudentWithdrawal.authorized_pickup))
            .where(
                StudentWithdrawal.student_id == student_id,
                StudentWithdrawal.status == WithdrawalStatus.COMPLETED.value,
                StudentWithdrawal.initiated_at >= day_start,
                StudentWithdrawal.initiated_at < day_end,
            )
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_pending_withdrawal(self, student_id: int) -> StudentWithdrawal | None:
        """Get any pending (INITIATED or VERIFIED) withdrawal for a student."""
        stmt = (
            select(StudentWithdrawal)
            .options(
                selectinload(StudentWithdrawal.student).selectinload(Student.course),
                selectinload(StudentWithdrawal.authorized_pickup),
            )
            .where(
                StudentWithdrawal.student_id == student_id,
                StudentWithdrawal.status.in_([
                    WithdrawalStatus.INITIATED.value,
                    WithdrawalStatus.VERIFIED.value,
                ]),
            )
            .order_by(StudentWithdrawal.initiated_at.desc())
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def student_entered_today(self, student_id: int, date: datetime | None = None) -> bool:
        """Check if student has an IN attendance event today.

        This is a critical validation - a student cannot be withdrawn
        if they didn't enter school today.
        """
        if date is None:
            date = datetime.now(UTC)

        day_start, day_end = self._get_day_utc_range(date)

        stmt = (
            select(func.count())
            .select_from(AttendanceEvent)
            .where(
                AttendanceEvent.student_id == student_id,
                AttendanceEvent.type == AttendanceTypeEnum.IN,
                AttendanceEvent.occurred_at >= day_start,
                AttendanceEvent.occurred_at < day_end,
            )
        )
        result = await self.session.execute(stmt)
        count = result.scalar() or 0
        return count > 0

    async def student_exited_today(self, student_id: int, date: datetime | None = None) -> bool:
        """Check if student already has an OUT event today (normal exit)."""
        if date is None:
            date = datetime.now(UTC)

        day_start, day_end = self._get_day_utc_range(date)

        # Get the last event today
        stmt = (
            select(AttendanceEvent)
            .where(
                AttendanceEvent.student_id == student_id,
                AttendanceEvent.occurred_at >= day_start,
                AttendanceEvent.occurred_at < day_end,
            )
            .order_by(AttendanceEvent.occurred_at.desc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        last_event = result.scalars().first()

        if last_event and last_event.type == AttendanceTypeEnum.OUT:
            return True
        return False

    # -------------------------------------------------------------------------
    # List and query operations
    # -------------------------------------------------------------------------

    async def list_by_student(
        self, student_id: int, *, limit: int = 50
    ) -> list[StudentWithdrawal]:
        """List withdrawals for a student (most recent first)."""
        stmt = (
            select(StudentWithdrawal)
            .options(selectinload(StudentWithdrawal.authorized_pickup))
            .where(StudentWithdrawal.student_id == student_id)
            .order_by(StudentWithdrawal.initiated_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_by_pickup(
        self, pickup_id: int, *, limit: int = 50
    ) -> list[StudentWithdrawal]:
        """List withdrawals made by an authorized pickup."""
        stmt = (
            select(StudentWithdrawal)
            .options(selectinload(StudentWithdrawal.student).selectinload(Student.course))
            .where(StudentWithdrawal.authorized_pickup_id == pickup_id)
            .order_by(StudentWithdrawal.initiated_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_today(self, date: datetime | None = None) -> list[StudentWithdrawal]:
        """List all withdrawals for today (timezone-aware)."""
        if date is None:
            date = datetime.now(UTC)

        day_start, day_end = self._get_day_utc_range(date)

        stmt = (
            select(StudentWithdrawal)
            .options(
                selectinload(StudentWithdrawal.student).selectinload(Student.course),
                selectinload(StudentWithdrawal.authorized_pickup),
            )
            .where(
                StudentWithdrawal.initiated_at >= day_start,
                StudentWithdrawal.initiated_at < day_end,
            )
            .order_by(StudentWithdrawal.initiated_at.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_completed_today(self, date: datetime | None = None) -> list[StudentWithdrawal]:
        """List only completed withdrawals for today (for kiosk sync)."""
        if date is None:
            date = datetime.now(UTC)

        day_start, day_end = self._get_day_utc_range(date)

        stmt = (
            select(StudentWithdrawal)
            .options(
                selectinload(StudentWithdrawal.student).selectinload(Student.course),
                selectinload(StudentWithdrawal.authorized_pickup),
            )
            .where(
                StudentWithdrawal.status == WithdrawalStatus.COMPLETED.value,
                StudentWithdrawal.initiated_at >= day_start,
                StudentWithdrawal.initiated_at < day_end,
            )
            .order_by(StudentWithdrawal.completed_at)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_paginated(
        self,
        *,
        skip: int = 0,
        limit: int = 50,
        student_id: int | None = None,
        pickup_id: int | None = None,
        status: WithdrawalStatus | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> tuple[list[StudentWithdrawal], int]:
        """List withdrawals with pagination and filters."""
        base_query = select(StudentWithdrawal)

        # Apply filters
        if student_id is not None:
            base_query = base_query.where(StudentWithdrawal.student_id == student_id)
        if pickup_id is not None:
            base_query = base_query.where(StudentWithdrawal.authorized_pickup_id == pickup_id)
        if status is not None:
            base_query = base_query.where(StudentWithdrawal.status == status.value)
        if date_from is not None:
            base_query = base_query.where(StudentWithdrawal.initiated_at >= date_from)
        if date_to is not None:
            base_query = base_query.where(StudentWithdrawal.initiated_at <= date_to)

        # Get total count
        count_query = select(func.count()).select_from(base_query.subquery())
        total_result = await self.session.execute(count_query)
        total = total_result.scalar() or 0

        # Get paginated results
        paginated_query = (
            base_query.options(
                selectinload(StudentWithdrawal.student).selectinload(Student.course),
                selectinload(StudentWithdrawal.authorized_pickup),
            )
            .order_by(StudentWithdrawal.initiated_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(paginated_query)
        withdrawals = list(result.scalars().all())

        return withdrawals, total

    # -------------------------------------------------------------------------
    # Kiosk sync operations
    # -------------------------------------------------------------------------

    async def list_for_kiosk_sync(self, date: datetime | None = None) -> list[dict]:
        """Get today's completed withdrawals for kiosk sync.

        This prevents duplicate withdrawals when kiosk is offline.
        """
        if date is None:
            date = datetime.now(UTC)

        withdrawals = await self.list_completed_today(date)

        return [
            {
                "student_id": w.student_id,
                "withdrawn_at": w.completed_at.isoformat() if w.completed_at else None,
                "pickup_name": w.authorized_pickup.full_name if w.authorized_pickup else "Admin",
            }
            for w in withdrawals
        ]

    # -------------------------------------------------------------------------
    # Statistics
    # -------------------------------------------------------------------------

    async def count_by_status(
        self, date: datetime | None = None
    ) -> dict[str, int]:
        """Count withdrawals by status for a given day (timezone-aware)."""
        if date is None:
            date = datetime.now(UTC)

        day_start, day_end = self._get_day_utc_range(date)

        stmt = (
            select(
                StudentWithdrawal.status,
                func.count(StudentWithdrawal.id),
            )
            .where(
                StudentWithdrawal.initiated_at >= day_start,
                StudentWithdrawal.initiated_at < day_end,
            )
            .group_by(StudentWithdrawal.status)
        )
        result = await self.session.execute(stmt)
        rows = result.fetchall()

        return {row[0]: row[1] for row in rows}
