"""Regression tests for webapp bootstrap payload.

Verifies that the bootstrap payload includes new fields added in Phases 2-4:
- withdrawals (Phase 2)
- authorized_pickups (Phase 3)
- withdrawal_requests (Phase 4)
"""

from __future__ import annotations

from datetime import date, time

import pytest

from app.schemas.auth import SessionUser
from app.schemas.webapp import (
    AuthorizedPickupSummary,
    WebAppBootstrap,
    WithdrawalRequestSummary,
    WithdrawalSummary,
)


def _make_session_user():
    return SessionUser(id=1, full_name="Test User", role="PARENT", guardian_id=1)


class TestBootstrapSchema:
    """Verify schema fields exist and work correctly."""

    def test_bootstrap_includes_withdrawals_field(self):
        """WebAppBootstrap schema should have a 'withdrawals' list field."""
        bootstrap = WebAppBootstrap(
            current_user=_make_session_user(),
            withdrawals=[
                WithdrawalSummary(
                    id=1, student_id=10, status="COMPLETED",
                    initiated_at="2026-02-05T10:00:00",
                )
            ],
        )
        assert len(bootstrap.withdrawals) == 1
        assert bootstrap.withdrawals[0].status == "COMPLETED"

    def test_bootstrap_includes_authorized_pickups_field(self):
        """WebAppBootstrap schema should have an 'authorized_pickups' list field."""
        bootstrap = WebAppBootstrap(
            current_user=_make_session_user(),
            authorized_pickups=[
                AuthorizedPickupSummary(
                    id=5, full_name="Juan Pérez",
                    relationship_type="Tío", is_active=True,
                    student_ids=[10],
                )
            ],
        )
        assert len(bootstrap.authorized_pickups) == 1
        assert bootstrap.authorized_pickups[0].full_name == "Juan Pérez"

    def test_bootstrap_includes_withdrawal_requests_field(self):
        """WebAppBootstrap schema should have a 'withdrawal_requests' list field."""
        bootstrap = WebAppBootstrap(
            current_user=_make_session_user(),
            withdrawal_requests=[
                WithdrawalRequestSummary(
                    id=1, student_id=10, authorized_pickup_id=5,
                    status="PENDING",
                    scheduled_date=date.today(),
                    created_at="2026-02-05T10:00:00",
                )
            ],
        )
        assert len(bootstrap.withdrawal_requests) == 1
        assert bootstrap.withdrawal_requests[0].status == "PENDING"

    def test_bootstrap_defaults_empty_lists(self):
        """New list fields should default to empty lists."""
        bootstrap = WebAppBootstrap(
            current_user=_make_session_user(),
        )
        assert bootstrap.withdrawals == []
        assert bootstrap.authorized_pickups == []
        assert bootstrap.withdrawal_requests == []

    def test_withdrawal_summary_fields(self):
        """WithdrawalSummary should have all required fields."""
        ws = WithdrawalSummary(
            id=1, student_id=10, status="COMPLETED",
            authorized_pickup_id=5,
            pickup_name="Juan Pérez",
            pickup_relationship="Tío",
            initiated_at="2026-02-05T10:00:00",
            completed_at="2026-02-05T10:30:00",
            reason="Cita médica",
        )
        assert ws.pickup_name == "Juan Pérez"
        assert ws.completed_at == "2026-02-05T10:30:00"

    def test_authorized_pickup_summary_fields(self):
        """AuthorizedPickupSummary should have all required fields."""
        ps = AuthorizedPickupSummary(
            id=5, full_name="Juan Pérez",
            relationship_type="Tío",
            national_id="12345678-9",
            phone="+56987654321",
            email="juan@test.com",
            is_active=True,
            student_ids=[10, 20],
            has_photo=True,
            has_qr=True,
        )
        assert ps.student_ids == [10, 20]
        assert ps.has_photo is True
        assert ps.has_qr is True

    def test_withdrawal_request_summary_fields(self):
        """WithdrawalRequestSummary should have all required fields."""
        wrs = WithdrawalRequestSummary(
            id=1, student_id=10, authorized_pickup_id=5,
            status="APPROVED",
            scheduled_date=date.today(),
            scheduled_time="12:30",
            reason="Cita médica",
            pickup_name="Juan Pérez",
            pickup_relationship="Tío",
            student_name="Pedro González",
            review_notes="OK",
            created_at="2026-02-05T10:00:00",
        )
        assert wrs.pickup_name == "Juan Pérez"
        assert wrs.student_name == "Pedro González"
        assert wrs.reason == "Cita médica"
