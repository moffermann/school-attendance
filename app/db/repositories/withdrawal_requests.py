"""Repository for WithdrawalRequest CRUD operations."""

from __future__ import annotations

from datetime import UTC, date, datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.withdrawal_request import WithdrawalRequest, WithdrawalRequestStatus


class WithdrawalRequestRepository:
    """Repository for WithdrawalRequest CRUD operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        *,
        student_id: int,
        authorized_pickup_id: int,
        scheduled_date: date,
        requested_by_guardian_id: int,
        requested_by_user_id: int,
        scheduled_time: object | None = None,
        reason: str | None = None,
    ) -> WithdrawalRequest:
        """Create a new withdrawal request."""
        request = WithdrawalRequest(
            student_id=student_id,
            authorized_pickup_id=authorized_pickup_id,
            scheduled_date=scheduled_date,
            scheduled_time=scheduled_time,
            reason=reason,
            requested_by_guardian_id=requested_by_guardian_id,
            requested_by_user_id=requested_by_user_id,
            status=WithdrawalRequestStatus.PENDING.value,
        )
        self.session.add(request)
        await self.session.flush()
        # Reload with relationships
        return await self.get(request.id)  # type: ignore[return-value]

    async def get(self, request_id: int) -> WithdrawalRequest | None:
        """Get a withdrawal request by ID with relationships."""
        stmt = (
            select(WithdrawalRequest)
            .where(WithdrawalRequest.id == request_id)
            .options(
                selectinload(WithdrawalRequest.student),
                selectinload(WithdrawalRequest.authorized_pickup),
                selectinload(WithdrawalRequest.guardian),
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_guardian(
        self,
        guardian_id: int,
        *,
        status: str | None = None,
        student_id: int | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        limit: int = 100,
    ) -> list[WithdrawalRequest]:
        """List withdrawal requests for a specific guardian."""
        stmt = (
            select(WithdrawalRequest)
            .where(WithdrawalRequest.requested_by_guardian_id == guardian_id)
            .options(
                selectinload(WithdrawalRequest.student),
                selectinload(WithdrawalRequest.authorized_pickup),
            )
            .order_by(WithdrawalRequest.created_at.desc())
            .limit(limit)
        )
        if status:
            stmt = stmt.where(WithdrawalRequest.status == status)
        if student_id:
            stmt = stmt.where(WithdrawalRequest.student_id == student_id)
        if date_from:
            stmt = stmt.where(WithdrawalRequest.scheduled_date >= date_from)
        if date_to:
            stmt = stmt.where(WithdrawalRequest.scheduled_date <= date_to)

        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_by_student(
        self,
        student_id: int,
        *,
        status: str | None = None,
        limit: int = 100,
    ) -> list[WithdrawalRequest]:
        """List withdrawal requests for a specific student."""
        stmt = (
            select(WithdrawalRequest)
            .where(WithdrawalRequest.student_id == student_id)
            .options(
                selectinload(WithdrawalRequest.authorized_pickup),
            )
            .order_by(WithdrawalRequest.created_at.desc())
            .limit(limit)
        )
        if status:
            stmt = stmt.where(WithdrawalRequest.status == status)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_pending(
        self,
        *,
        date_from: date | None = None,
        date_to: date | None = None,
        course_id: int | None = None,
        limit: int = 200,
    ) -> list[WithdrawalRequest]:
        """List pending requests for staff review."""
        stmt = (
            select(WithdrawalRequest)
            .where(WithdrawalRequest.status == WithdrawalRequestStatus.PENDING.value)
            .options(
                selectinload(WithdrawalRequest.student),
                selectinload(WithdrawalRequest.authorized_pickup),
                selectinload(WithdrawalRequest.guardian),
            )
            .order_by(WithdrawalRequest.scheduled_date.asc(), WithdrawalRequest.created_at.asc())
            .limit(limit)
        )
        if date_from:
            stmt = stmt.where(WithdrawalRequest.scheduled_date >= date_from)
        if date_to:
            stmt = stmt.where(WithdrawalRequest.scheduled_date <= date_to)
        # Course filtering requires join through student
        if course_id:
            from app.db.models.student import Student
            stmt = stmt.join(Student, WithdrawalRequest.student_id == Student.id).where(
                Student.course_id == course_id
            )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_all(
        self,
        *,
        status: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        limit: int = 200,
    ) -> list[WithdrawalRequest]:
        """List all withdrawal requests (staff view)."""
        stmt = (
            select(WithdrawalRequest)
            .options(
                selectinload(WithdrawalRequest.student),
                selectinload(WithdrawalRequest.authorized_pickup),
                selectinload(WithdrawalRequest.guardian),
            )
            .order_by(WithdrawalRequest.created_at.desc())
            .limit(limit)
        )
        if status:
            stmt = stmt.where(WithdrawalRequest.status == status)
        if date_from:
            stmt = stmt.where(WithdrawalRequest.scheduled_date >= date_from)
        if date_to:
            stmt = stmt.where(WithdrawalRequest.scheduled_date <= date_to)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_approved_for_today(
        self, *, student_id: int | None = None
    ) -> list[WithdrawalRequest]:
        """List APPROVED requests for today (used by kiosk and staff)."""
        today = datetime.now(UTC).date()
        stmt = (
            select(WithdrawalRequest)
            .where(
                WithdrawalRequest.status == WithdrawalRequestStatus.APPROVED.value,
                WithdrawalRequest.scheduled_date == today,
            )
            .options(
                selectinload(WithdrawalRequest.student),
                selectinload(WithdrawalRequest.authorized_pickup),
                selectinload(WithdrawalRequest.guardian),
            )
            .order_by(WithdrawalRequest.scheduled_time.asc().nulls_last())
        )
        if student_id:
            stmt = stmt.where(WithdrawalRequest.student_id == student_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def update_status(
        self,
        request_id: int,
        new_status: str,
        *,
        reviewed_by: int | None = None,
        review_notes: str | None = None,
    ) -> WithdrawalRequest | None:
        """Update the status of a withdrawal request."""
        now = datetime.now(UTC)
        values: dict = {"status": new_status, "updated_at": now}

        if reviewed_by is not None:
            values["reviewed_by_user_id"] = reviewed_by
            values["reviewed_at"] = now
        if review_notes is not None:
            values["review_notes"] = review_notes

        stmt = (
            update(WithdrawalRequest)
            .where(WithdrawalRequest.id == request_id)
            .values(**values)
        )
        await self.session.execute(stmt)
        await self.session.flush()
        return await self.get(request_id)

    async def cancel(self, request_id: int) -> WithdrawalRequest | None:
        """Cancel a withdrawal request."""
        now = datetime.now(UTC)
        stmt = (
            update(WithdrawalRequest)
            .where(WithdrawalRequest.id == request_id)
            .values(
                status=WithdrawalRequestStatus.CANCELLED.value,
                cancelled_at=now,
                updated_at=now,
            )
        )
        await self.session.execute(stmt)
        await self.session.flush()
        return await self.get(request_id)

    async def link_to_withdrawal(
        self, request_id: int, student_withdrawal_id: int
    ) -> WithdrawalRequest | None:
        """Link a request to an actual StudentWithdrawal and mark COMPLETED."""
        now = datetime.now(UTC)
        stmt = (
            update(WithdrawalRequest)
            .where(WithdrawalRequest.id == request_id)
            .values(
                status=WithdrawalRequestStatus.COMPLETED.value,
                student_withdrawal_id=student_withdrawal_id,
                updated_at=now,
            )
        )
        await self.session.execute(stmt)
        await self.session.flush()
        return await self.get(request_id)

    async def find_matching_request(
        self,
        student_id: int,
        authorized_pickup_id: int,
        target_date: date,
    ) -> WithdrawalRequest | None:
        """Find an APPROVED request matching student + pickup + date.

        Used by the kiosk cross-reference to auto-link withdrawals.
        """
        stmt = (
            select(WithdrawalRequest)
            .where(
                WithdrawalRequest.student_id == student_id,
                WithdrawalRequest.authorized_pickup_id == authorized_pickup_id,
                WithdrawalRequest.scheduled_date == target_date,
                WithdrawalRequest.status == WithdrawalRequestStatus.APPROVED.value,
            )
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def expire_old_requests(self, before_date: date) -> int:
        """Expire PENDING requests whose scheduled_date has passed."""
        now = datetime.now(UTC)
        stmt = (
            update(WithdrawalRequest)
            .where(
                WithdrawalRequest.status == WithdrawalRequestStatus.PENDING.value,
                WithdrawalRequest.scheduled_date < before_date,
            )
            .values(
                status=WithdrawalRequestStatus.EXPIRED.value,
                updated_at=now,
            )
        )
        result = await self.session.execute(stmt)
        await self.session.flush()
        return result.rowcount  # type: ignore[return-value]

    async def has_active_request(
        self, student_id: int, scheduled_date: date
    ) -> bool:
        """Check if there's already a PENDING or APPROVED request for this student on this date."""
        stmt = (
            select(WithdrawalRequest.id)
            .where(
                WithdrawalRequest.student_id == student_id,
                WithdrawalRequest.scheduled_date == scheduled_date,
                WithdrawalRequest.status.in_([
                    WithdrawalRequestStatus.PENDING.value,
                    WithdrawalRequestStatus.APPROVED.value,
                ]),
            )
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none() is not None
