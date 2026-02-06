"""Integration tests for the full withdrawal request lifecycle.

Tests the complete flow from request creation through approval and completion,
using real database operations (SQLite in-memory).
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.authorized_pickup import AuthorizedPickup, student_authorized_pickup_table
from app.db.models.withdrawal_request import WithdrawalRequest, WithdrawalRequestStatus
from app.db.repositories.withdrawal_requests import WithdrawalRequestRepository
from app.services.withdrawal_request_service import WithdrawalRequestService


# ==================== Fixtures ====================


@pytest.fixture
async def pickup(db_session, sample_student):
    """Create an authorized pickup linked to sample_student."""
    p = AuthorizedPickup(
        full_name="Juan Pérez",
        relationship_type="Tío",
        national_id="12345678-9",
        phone="+56987654321",
        is_active=True,
    )
    db_session.add(p)
    await db_session.flush()

    await db_session.execute(
        student_authorized_pickup_table.insert().values(
            student_id=sample_student.id,
            authorized_pickup_id=p.id,
        )
    )
    await db_session.flush()
    return p


# ==================== Integration Tests ====================


class TestWithdrawalRequestIntegration:
    """Full lifecycle integration tests."""

    async def test_full_flow_create_approve_complete(
        self, db_session, sample_student, sample_guardian, pickup
    ):
        """Test the happy path: create -> approve -> complete via cross-reference."""
        from app.db.models.student_withdrawal import StudentWithdrawal

        service = WithdrawalRequestService(db_session)

        # 1. Parent creates a request for today
        req = await service.create_request(
            guardian_id=sample_guardian.id,
            user_id=100,
            student_id=sample_student.id,
            authorized_pickup_id=pickup.id,
            scheduled_date=date.today(),
        )
        assert req.status == WithdrawalRequestStatus.PENDING.value

        # 2. Staff approves
        approved = await service.approve_request(req.id, reviewer_user_id=20, notes="OK")
        assert approved.status == WithdrawalRequestStatus.APPROVED.value

        # 3. Create a real StudentWithdrawal to satisfy FK
        sw = StudentWithdrawal(
            student_id=sample_student.id,
            authorized_pickup_id=pickup.id,
            status="COMPLETED",
        )
        db_session.add(sw)
        await db_session.flush()

        # 4. Cross-reference links to the withdrawal
        linked = await service.complete_from_withdrawal(
            student_withdrawal_id=sw.id,
            student_id=sample_student.id,
            pickup_id=pickup.id,
        )
        assert linked is not None
        assert linked.status == WithdrawalRequestStatus.COMPLETED.value
        assert linked.student_withdrawal_id == sw.id

    async def test_full_flow_create_reject(
        self, db_session, sample_student, sample_guardian, pickup
    ):
        """Create -> reject flow."""
        service = WithdrawalRequestService(db_session)

        req = await service.create_request(
            guardian_id=sample_guardian.id,
            user_id=100,
            student_id=sample_student.id,
            authorized_pickup_id=pickup.id,
            scheduled_date=date.today(),
        )
        rejected = await service.reject_request(
            req.id, reviewer_user_id=20, notes="No procede"
        )
        assert rejected.status == WithdrawalRequestStatus.REJECTED.value

    async def test_full_flow_create_cancel(
        self, db_session, sample_student, sample_guardian, pickup
    ):
        """Parent creates and then cancels their own request."""
        service = WithdrawalRequestService(db_session)

        req = await service.create_request(
            guardian_id=sample_guardian.id,
            user_id=100,
            student_id=sample_student.id,
            authorized_pickup_id=pickup.id,
            scheduled_date=date.today(),
        )
        cancelled = await service.cancel_request(req.id, guardian_id=sample_guardian.id)
        assert cancelled.status == WithdrawalRequestStatus.CANCELLED.value

    async def test_expire_old_pending(
        self, db_session, sample_student, sample_guardian, pickup
    ):
        """PENDING request from yesterday gets expired."""
        repo = WithdrawalRequestRepository(db_session)

        # Create a request for yesterday
        old_req = WithdrawalRequest(
            student_id=sample_student.id,
            authorized_pickup_id=pickup.id,
            status=WithdrawalRequestStatus.PENDING.value,
            scheduled_date=date.today() - timedelta(days=1),
            requested_by_guardian_id=sample_guardian.id,
            requested_by_user_id=100,
        )
        db_session.add(old_req)
        await db_session.flush()

        count = await repo.expire_old_requests(date.today())
        assert count >= 1

        fetched = await repo.get(old_req.id)
        assert fetched.status == WithdrawalRequestStatus.EXPIRED.value

    async def test_withdrawal_without_request(
        self, db_session, sample_student, pickup
    ):
        """A withdrawal without a pre-existing request should NOT fail.

        complete_from_withdrawal gracefully returns None when no match found.
        """
        service = WithdrawalRequestService(db_session)

        result = await service.complete_from_withdrawal(
            student_withdrawal_id=99,
            student_id=sample_student.id,
            pickup_id=pickup.id,
        )
        assert result is None

    async def test_cross_reference_wrong_pickup(
        self, db_session, sample_student, sample_guardian, pickup
    ):
        """Withdrawal with different pickup than approved request should NOT link."""
        service = WithdrawalRequestService(db_session)

        # Create and approve request for pickup.id
        req = await service.create_request(
            guardian_id=sample_guardian.id,
            user_id=100,
            student_id=sample_student.id,
            authorized_pickup_id=pickup.id,
            scheduled_date=date.today(),
        )
        await service.approve_request(req.id, reviewer_user_id=20)

        # Try cross-reference with a DIFFERENT pickup id
        result = await service.complete_from_withdrawal(
            student_withdrawal_id=42,
            student_id=sample_student.id,
            pickup_id=99999,  # different from pickup.id
        )
        assert result is None

    async def test_duplicate_request_same_date_blocked(
        self, db_session, sample_student, sample_guardian, pickup
    ):
        """Cannot create two active requests for same student on same date."""
        service = WithdrawalRequestService(db_session)

        # First request succeeds
        await service.create_request(
            guardian_id=sample_guardian.id,
            user_id=100,
            student_id=sample_student.id,
            authorized_pickup_id=pickup.id,
            scheduled_date=date.today(),
        )

        # Second request for same date should fail
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc:
            await service.create_request(
                guardian_id=sample_guardian.id,
                user_id=100,
                student_id=sample_student.id,
                authorized_pickup_id=pickup.id,
                scheduled_date=date.today(),
            )
        assert exc.value.status_code == 409
