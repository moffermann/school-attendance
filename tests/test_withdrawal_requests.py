"""Tests for WithdrawalRequest repository, service, and API endpoints."""

from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.db.models.authorized_pickup import AuthorizedPickup, student_authorized_pickup_table
from app.db.models.withdrawal_request import WithdrawalRequest, WithdrawalRequestStatus
from app.db.repositories.withdrawal_requests import WithdrawalRequestRepository
from app.services.withdrawal_request_service import WithdrawalRequestService


# ==================== Fixtures ====================


@pytest.fixture
async def sample_pickup(db_session, sample_student):
    """Create an authorized pickup linked to the sample student."""
    pickup = AuthorizedPickup(
        full_name="Juan Pérez",
        relationship_type="Tío",
        national_id="12345678-9",
        phone="+56987654321",
        is_active=True,
    )
    db_session.add(pickup)
    await db_session.flush()

    await db_session.execute(
        student_authorized_pickup_table.insert().values(
            student_id=sample_student.id,
            authorized_pickup_id=pickup.id,
        )
    )
    await db_session.flush()
    return pickup


@pytest.fixture
async def wr_repo(db_session):
    """WithdrawalRequestRepository instance."""
    return WithdrawalRequestRepository(db_session)


@pytest.fixture
async def sample_request(db_session, sample_student, sample_guardian, sample_pickup):
    """Create a PENDING withdrawal request."""
    req = WithdrawalRequest(
        student_id=sample_student.id,
        authorized_pickup_id=sample_pickup.id,
        status=WithdrawalRequestStatus.PENDING.value,
        scheduled_date=date.today(),
        requested_by_guardian_id=sample_guardian.id,
        requested_by_user_id=1,
    )
    db_session.add(req)
    await db_session.flush()
    return req


# ==================== Repository Tests ====================


class TestWithdrawalRequestRepository:
    """Tests for WithdrawalRequestRepository CRUD operations."""

    async def test_create(self, wr_repo, sample_student, sample_guardian, sample_pickup):
        req = await wr_repo.create(
            student_id=sample_student.id,
            authorized_pickup_id=sample_pickup.id,
            scheduled_date=date.today(),
            requested_by_guardian_id=sample_guardian.id,
            requested_by_user_id=1,
            reason="Cita médica",
        )
        assert req.id is not None
        assert req.student_id == sample_student.id
        assert req.status == WithdrawalRequestStatus.PENDING.value
        assert req.reason == "Cita médica"
        assert req.scheduled_date == date.today()

    async def test_get(self, wr_repo, sample_request):
        fetched = await wr_repo.get(sample_request.id)
        assert fetched is not None
        assert fetched.id == sample_request.id
        assert fetched.status == WithdrawalRequestStatus.PENDING.value

    async def test_get_nonexistent(self, wr_repo):
        result = await wr_repo.get(99999)
        assert result is None

    async def test_list_by_guardian(self, wr_repo, sample_request, sample_guardian):
        items = await wr_repo.list_by_guardian(sample_guardian.id)
        assert len(items) >= 1
        assert any(r.id == sample_request.id for r in items)

    async def test_list_by_guardian_with_status_filter(
        self, wr_repo, sample_request, sample_guardian
    ):
        pending = await wr_repo.list_by_guardian(sample_guardian.id, status="PENDING")
        assert len(pending) >= 1

        approved = await wr_repo.list_by_guardian(sample_guardian.id, status="APPROVED")
        assert len(approved) == 0

    async def test_list_by_guardian_empty(self, wr_repo):
        items = await wr_repo.list_by_guardian(99999)
        assert items == []

    async def test_list_by_student(self, wr_repo, sample_request, sample_student):
        items = await wr_repo.list_by_student(sample_student.id)
        assert len(items) >= 1
        assert items[0].student_id == sample_student.id

    async def test_list_pending(self, wr_repo, sample_request):
        items = await wr_repo.list_pending()
        assert len(items) >= 1
        assert all(r.status == "PENDING" for r in items)

    async def test_list_all(self, wr_repo, sample_request):
        items = await wr_repo.list_all()
        assert len(items) >= 1

    async def test_update_status_to_approved(self, wr_repo, sample_request):
        updated = await wr_repo.update_status(
            sample_request.id,
            WithdrawalRequestStatus.APPROVED.value,
            reviewed_by=10,
            review_notes="Ok",
        )
        assert updated is not None
        assert updated.status == WithdrawalRequestStatus.APPROVED.value
        assert updated.reviewed_by_user_id == 10
        assert updated.review_notes == "Ok"
        assert updated.reviewed_at is not None

    async def test_update_status_to_rejected(self, wr_repo, sample_request):
        updated = await wr_repo.update_status(
            sample_request.id,
            WithdrawalRequestStatus.REJECTED.value,
            reviewed_by=10,
            review_notes="No procede",
        )
        assert updated is not None
        assert updated.status == WithdrawalRequestStatus.REJECTED.value

    async def test_cancel(self, wr_repo, sample_request):
        updated = await wr_repo.cancel(sample_request.id)
        assert updated is not None
        assert updated.status == WithdrawalRequestStatus.CANCELLED.value
        assert updated.cancelled_at is not None

    async def test_link_to_withdrawal(
        self, db_session, wr_repo, sample_request, sample_student, sample_pickup
    ):
        # Create a real StudentWithdrawal to satisfy the FK
        from app.db.models.student_withdrawal import StudentWithdrawal

        sw = StudentWithdrawal(
            student_id=sample_student.id,
            authorized_pickup_id=sample_pickup.id,
            status="COMPLETED",
        )
        db_session.add(sw)
        await db_session.flush()

        # First approve
        await wr_repo.update_status(
            sample_request.id, WithdrawalRequestStatus.APPROVED.value
        )
        # Then link to real withdrawal
        updated = await wr_repo.link_to_withdrawal(sample_request.id, sw.id)
        assert updated is not None
        assert updated.status == WithdrawalRequestStatus.COMPLETED.value
        assert updated.student_withdrawal_id == sw.id

    async def test_find_matching_request(
        self, wr_repo, sample_request, sample_student, sample_pickup
    ):
        # Request is PENDING, so it shouldn't match
        result = await wr_repo.find_matching_request(
            sample_student.id, sample_pickup.id, date.today()
        )
        assert result is None

        # Approve it, then it should match
        await wr_repo.update_status(
            sample_request.id, WithdrawalRequestStatus.APPROVED.value
        )
        result = await wr_repo.find_matching_request(
            sample_student.id, sample_pickup.id, date.today()
        )
        assert result is not None
        assert result.id == sample_request.id

    async def test_find_matching_request_none(self, wr_repo):
        result = await wr_repo.find_matching_request(99999, 99999, date.today())
        assert result is None

    async def test_has_active_request(
        self, wr_repo, sample_request, sample_student
    ):
        has = await wr_repo.has_active_request(sample_student.id, date.today())
        assert has is True

        has_other = await wr_repo.has_active_request(
            sample_student.id, date.today() + timedelta(days=5)
        )
        assert has_other is False

    async def test_expire_old_requests(
        self, db_session, wr_repo, sample_student, sample_guardian, sample_pickup
    ):
        # Create a PENDING request for yesterday
        old_req = WithdrawalRequest(
            student_id=sample_student.id,
            authorized_pickup_id=sample_pickup.id,
            status=WithdrawalRequestStatus.PENDING.value,
            scheduled_date=date.today() - timedelta(days=1),
            requested_by_guardian_id=sample_guardian.id,
            requested_by_user_id=1,
        )
        db_session.add(old_req)
        await db_session.flush()

        count = await wr_repo.expire_old_requests(date.today())
        assert count >= 1

        fetched = await wr_repo.get(old_req.id)
        assert fetched is not None
        assert fetched.status == WithdrawalRequestStatus.EXPIRED.value


# ==================== Service Tests ====================


class TestWithdrawalRequestService:
    """Tests for WithdrawalRequestService business logic (with mocks)."""

    def _mock_service(self):
        """Create a service with mocked repos."""
        session = MagicMock()
        service = WithdrawalRequestService.__new__(WithdrawalRequestService)
        service.session = session
        service.request_repo = MagicMock()
        service.pickup_repo = MagicMock()
        service.guardian_repo = MagicMock()
        return service

    async def test_create_request_success(self):
        service = self._mock_service()

        guardian = SimpleNamespace(
            id=1, students=[SimpleNamespace(id=10)]
        )
        service.guardian_repo.get = AsyncMock(return_value=guardian)
        service.pickup_repo.is_authorized_for_student = AsyncMock(return_value=True)
        service.pickup_repo.get_active = AsyncMock(
            return_value=SimpleNamespace(id=5, is_active=True)
        )
        service.request_repo.has_active_request = AsyncMock(return_value=False)
        service.request_repo.create = AsyncMock(
            return_value=SimpleNamespace(
                id=1, student_id=10, status="PENDING",
                scheduled_date=date.today() + timedelta(days=1),
            )
        )

        result = await service.create_request(
            guardian_id=1,
            user_id=100,
            student_id=10,
            authorized_pickup_id=5,
            scheduled_date=date.today() + timedelta(days=1),
        )
        assert result.status == "PENDING"
        service.request_repo.create.assert_awaited_once()

    async def test_create_request_student_not_owned(self):
        service = self._mock_service()

        guardian = SimpleNamespace(id=1, students=[SimpleNamespace(id=10)])
        service.guardian_repo.get = AsyncMock(return_value=guardian)

        with pytest.raises(HTTPException) as exc:
            await service.create_request(
                guardian_id=1, user_id=100,
                student_id=999,  # Not guardian's student
                authorized_pickup_id=5,
                scheduled_date=date.today() + timedelta(days=1),
            )
        assert exc.value.status_code == 403

    async def test_create_request_pickup_not_authorized(self):
        service = self._mock_service()

        guardian = SimpleNamespace(id=1, students=[SimpleNamespace(id=10)])
        service.guardian_repo.get = AsyncMock(return_value=guardian)
        service.pickup_repo.is_authorized_for_student = AsyncMock(return_value=False)

        with pytest.raises(HTTPException) as exc:
            await service.create_request(
                guardian_id=1, user_id=100,
                student_id=10, authorized_pickup_id=5,
                scheduled_date=date.today() + timedelta(days=1),
            )
        assert exc.value.status_code == 400

    async def test_create_request_duplicate_date(self):
        service = self._mock_service()

        guardian = SimpleNamespace(id=1, students=[SimpleNamespace(id=10)])
        service.guardian_repo.get = AsyncMock(return_value=guardian)
        service.pickup_repo.is_authorized_for_student = AsyncMock(return_value=True)
        service.pickup_repo.get_active = AsyncMock(
            return_value=SimpleNamespace(id=5, is_active=True)
        )
        service.request_repo.has_active_request = AsyncMock(return_value=True)

        with pytest.raises(HTTPException) as exc:
            await service.create_request(
                guardian_id=1, user_id=100,
                student_id=10, authorized_pickup_id=5,
                scheduled_date=date.today() + timedelta(days=1),
            )
        assert exc.value.status_code == 409

    async def test_create_request_past_date(self):
        service = self._mock_service()

        guardian = SimpleNamespace(id=1, students=[SimpleNamespace(id=10)])
        service.guardian_repo.get = AsyncMock(return_value=guardian)
        service.pickup_repo.is_authorized_for_student = AsyncMock(return_value=True)
        service.pickup_repo.get_active = AsyncMock(
            return_value=SimpleNamespace(id=5, is_active=True)
        )

        with pytest.raises(HTTPException) as exc:
            await service.create_request(
                guardian_id=1, user_id=100,
                student_id=10, authorized_pickup_id=5,
                scheduled_date=date.today() - timedelta(days=1),
            )
        assert exc.value.status_code == 400

    async def test_approve_success(self):
        service = self._mock_service()

        req = SimpleNamespace(
            id=1, status="PENDING", can_be_reviewed=True,
        )
        service.request_repo.get = AsyncMock(return_value=req)
        service.request_repo.update_status = AsyncMock(
            return_value=SimpleNamespace(id=1, status="APPROVED")
        )

        result = await service.approve_request(1, reviewer_user_id=10, notes="OK")
        assert result.status == "APPROVED"

    async def test_approve_already_approved(self):
        service = self._mock_service()

        req = SimpleNamespace(
            id=1, status="APPROVED", can_be_reviewed=False,
        )
        service.request_repo.get = AsyncMock(return_value=req)

        with pytest.raises(HTTPException) as exc:
            await service.approve_request(1, reviewer_user_id=10)
        assert exc.value.status_code == 400

    async def test_reject_success(self):
        service = self._mock_service()

        req = SimpleNamespace(id=1, status="PENDING", can_be_reviewed=True)
        service.request_repo.get = AsyncMock(return_value=req)
        service.request_repo.update_status = AsyncMock(
            return_value=SimpleNamespace(id=1, status="REJECTED")
        )

        result = await service.reject_request(1, reviewer_user_id=10, notes="No procede")
        assert result.status == "REJECTED"

    async def test_cancel_by_guardian_success(self):
        service = self._mock_service()

        req = SimpleNamespace(
            id=1, status="PENDING",
            requested_by_guardian_id=1, can_be_cancelled=True,
        )
        service.request_repo.get = AsyncMock(return_value=req)
        service.request_repo.cancel = AsyncMock(
            return_value=SimpleNamespace(id=1, status="CANCELLED")
        )

        result = await service.cancel_request(1, guardian_id=1)
        assert result.status == "CANCELLED"

    async def test_cancel_by_wrong_guardian(self):
        service = self._mock_service()

        req = SimpleNamespace(
            id=1, status="PENDING",
            requested_by_guardian_id=1, can_be_cancelled=True,
        )
        service.request_repo.get = AsyncMock(return_value=req)

        with pytest.raises(HTTPException) as exc:
            await service.cancel_request(1, guardian_id=999)
        assert exc.value.status_code == 403

    async def test_cancel_completed_request(self):
        service = self._mock_service()

        req = SimpleNamespace(
            id=1, status="COMPLETED",
            requested_by_guardian_id=1, can_be_cancelled=False,
        )
        service.request_repo.get = AsyncMock(return_value=req)

        with pytest.raises(HTTPException) as exc:
            await service.cancel_request(1, guardian_id=1)
        assert exc.value.status_code == 400

    async def test_complete_from_withdrawal_match(self):
        service = self._mock_service()

        matching = SimpleNamespace(id=5)
        service.request_repo.find_matching_request = AsyncMock(return_value=matching)
        service.request_repo.link_to_withdrawal = AsyncMock(
            return_value=SimpleNamespace(id=5, status="COMPLETED", student_withdrawal_id=42)
        )

        result = await service.complete_from_withdrawal(
            student_withdrawal_id=42, student_id=10, pickup_id=5
        )
        assert result is not None
        assert result.status == "COMPLETED"

    async def test_complete_from_withdrawal_no_match(self):
        service = self._mock_service()

        service.request_repo.find_matching_request = AsyncMock(return_value=None)

        result = await service.complete_from_withdrawal(
            student_withdrawal_id=42, student_id=10, pickup_id=5
        )
        assert result is None

    async def test_complete_from_withdrawal_no_pickup(self):
        service = self._mock_service()

        result = await service.complete_from_withdrawal(
            student_withdrawal_id=42, student_id=10, pickup_id=None
        )
        assert result is None


# ==================== API Endpoint Tests ====================


class TestWithdrawalRequestAPI:
    """Tests for withdrawal request API endpoints using TestClient."""

    @pytest.fixture
    def staff_client(self):
        """TestClient with DIRECTOR auth override."""
        from app import main
        from app.core import deps
        from app.core.deps import TenantAuthUser

        app = main.app
        app.dependency_overrides[deps.get_current_tenant_user] = lambda: TenantAuthUser(
            id=20, role="DIRECTOR", full_name="Director Test",
            guardian_id=None, teacher_id=None, tenant_id=1, tenant_slug="test",
        )
        # Mock db session
        mock_session = MagicMock()
        mock_session.commit = AsyncMock()
        app.dependency_overrides[deps.get_tenant_db] = lambda: mock_session

        overrides = [deps.get_current_tenant_user, deps.get_tenant_db]
        yield app, mock_session
        for key in overrides:
            app.dependency_overrides.pop(key, None)

    @pytest.fixture
    def parent_client(self):
        """TestClient with PARENT auth override."""
        from app import main
        from app.core import deps
        from app.core.deps import TenantAuthUser

        app = main.app
        app.dependency_overrides[deps.get_current_tenant_user] = lambda: TenantAuthUser(
            id=10, role="PARENT", full_name="María González",
            guardian_id=1, teacher_id=None, tenant_id=1, tenant_slug="test",
        )
        mock_session = MagicMock()
        mock_session.commit = AsyncMock()
        app.dependency_overrides[deps.get_tenant_db] = lambda: mock_session

        overrides = [deps.get_current_tenant_user, deps.get_tenant_db]
        yield app, mock_session
        for key in overrides:
            app.dependency_overrides.pop(key, None)

    def _fake_request(self, **overrides):
        """Create a fake WithdrawalRequest-like object for API responses."""
        defaults = dict(
            id=1, student_id=10, authorized_pickup_id=5,
            status="PENDING", scheduled_date=date.today(),
            scheduled_time=None, reason="Cita médica",
            requested_by_guardian_id=1, requested_by_user_id=10,
            reviewed_by_user_id=None, reviewed_at=None,
            review_notes=None, student_withdrawal_id=None,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC), cancelled_at=None,
            authorized_pickup=SimpleNamespace(
                full_name="Juan Pérez", relationship_type="Tío"
            ),
            student=SimpleNamespace(full_name="Pedro González"),
            guardian=SimpleNamespace(full_name="María González"),
        )
        defaults.update(overrides)
        return SimpleNamespace(**defaults)

    def test_staff_list_all(self, staff_client):
        app, mock_session = staff_client
        fake_req = self._fake_request()

        with patch(
            "app.api.v1.withdrawal_requests.WithdrawalRequestService"
        ) as MockService:
            instance = MockService.return_value
            instance.request_repo = MagicMock()
            instance.request_repo.list_all = AsyncMock(return_value=[fake_req])

            with TestClient(app) as client:
                resp = client.get("/api/v1/withdrawal-requests")
                assert resp.status_code == 200
                data = resp.json()
                assert len(data) == 1
                assert data[0]["student_name"] == "Pedro González"

    def test_staff_list_pending(self, staff_client):
        app, mock_session = staff_client
        fake_req = self._fake_request(status="PENDING")

        with patch(
            "app.api.v1.withdrawal_requests.WithdrawalRequestService"
        ) as MockService:
            instance = MockService.return_value
            instance.request_repo = MagicMock()
            instance.request_repo.list_pending = AsyncMock(return_value=[fake_req])

            with TestClient(app) as client:
                resp = client.get("/api/v1/withdrawal-requests/pending")
                assert resp.status_code == 200
                data = resp.json()
                assert len(data) == 1

    def test_staff_approve(self, staff_client):
        app, mock_session = staff_client
        fake_req = self._fake_request(status="APPROVED")

        with patch(
            "app.api.v1.withdrawal_requests.WithdrawalRequestService"
        ) as MockService:
            instance = MockService.return_value
            instance.approve_request = AsyncMock(return_value=fake_req)

            with TestClient(app) as client:
                resp = client.post(
                    "/api/v1/withdrawal-requests/1/approve",
                    json={"notes": "OK"},
                )
                assert resp.status_code == 200
                assert resp.json()["status"] == "APPROVED"

    def test_staff_reject(self, staff_client):
        app, mock_session = staff_client
        fake_req = self._fake_request(status="REJECTED")

        with patch(
            "app.api.v1.withdrawal_requests.WithdrawalRequestService"
        ) as MockService:
            instance = MockService.return_value
            instance.reject_request = AsyncMock(return_value=fake_req)

            with TestClient(app) as client:
                resp = client.post(
                    "/api/v1/withdrawal-requests/1/reject",
                    json={"notes": "No procede"},
                )
                assert resp.status_code == 200
                assert resp.json()["status"] == "REJECTED"

    def test_parent_list(self, parent_client):
        app, mock_session = parent_client
        fake_req = self._fake_request()

        with patch(
            "app.api.v1.withdrawal_requests.WithdrawalRequestService"
        ) as MockService:
            instance = MockService.return_value
            instance.request_repo = MagicMock()
            instance.request_repo.list_by_guardian = AsyncMock(
                return_value=[fake_req]
            )

            with TestClient(app) as client:
                resp = client.get("/api/v1/parents/1/withdrawal-requests")
                assert resp.status_code == 200
                data = resp.json()
                assert len(data) == 1

    def test_parent_create(self, parent_client):
        app, mock_session = parent_client
        fake_req = self._fake_request()

        with patch(
            "app.api.v1.withdrawal_requests.WithdrawalRequestService"
        ) as MockService:
            instance = MockService.return_value
            instance.create_request = AsyncMock(return_value=fake_req)

            with TestClient(app) as client:
                resp = client.post(
                    "/api/v1/parents/1/withdrawal-requests",
                    json={
                        "student_id": 10,
                        "authorized_pickup_id": 5,
                        "scheduled_date": (date.today() + timedelta(days=1)).isoformat(),
                        "reason": "Cita médica",
                    },
                )
                assert resp.status_code == 201

    def test_parent_cancel(self, parent_client):
        app, mock_session = parent_client
        fake_req = self._fake_request(status="CANCELLED")

        with patch(
            "app.api.v1.withdrawal_requests.WithdrawalRequestService"
        ) as MockService:
            instance = MockService.return_value
            instance.cancel_request = AsyncMock(return_value=fake_req)

            with TestClient(app) as client:
                resp = client.post(
                    "/api/v1/parents/1/withdrawal-requests/1/cancel",
                )
                assert resp.status_code == 200
                assert resp.json()["status"] == "CANCELLED"

    def test_parent_access_other_guardian(self, parent_client):
        """Parent with guardian_id=1 should NOT access guardian_id=999."""
        app, mock_session = parent_client

        with TestClient(app) as client:
            resp = client.get("/api/v1/parents/999/withdrawal-requests")
            assert resp.status_code == 403

    def test_staff_parent_cannot_approve(self, parent_client):
        """PARENT role should NOT be able to approve requests."""
        app, mock_session = parent_client

        with TestClient(app) as client:
            resp = client.post(
                "/api/v1/withdrawal-requests/1/approve",
                json={"notes": "OK"},
            )
            assert resp.status_code == 403
