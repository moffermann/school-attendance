"""Tests for parent pickup management API endpoints."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient


class TestParentPickupsAPI:
    """Tests for parent-facing authorized pickup endpoints."""

    @pytest.fixture
    def parent_client(self):
        """TestClient with PARENT auth override (guardian_id=1)."""
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

    @pytest.fixture
    def admin_client(self):
        """TestClient with ADMIN auth override."""
        from app import main
        from app.core import deps
        from app.core.deps import TenantAuthUser

        app = main.app
        app.dependency_overrides[deps.get_current_tenant_user] = lambda: TenantAuthUser(
            id=20, role="ADMIN", full_name="Admin Test",
            guardian_id=None, teacher_id=None, tenant_id=1, tenant_slug="test",
        )
        mock_session = MagicMock()
        mock_session.commit = AsyncMock()
        app.dependency_overrides[deps.get_tenant_db] = lambda: mock_session

        overrides = [deps.get_current_tenant_user, deps.get_tenant_db]
        yield app, mock_session
        for key in overrides:
            app.dependency_overrides.pop(key, None)

    def _fake_pickup(self, **overrides):
        """Create a fake AuthorizedPickup-like object.

        Matches the attributes accessed by _pickup_to_response():
          pickup.id, full_name, relationship_type, national_id, phone,
          email, photo_url, is_active, students (list), qr_code_hash
        """
        defaults = dict(
            id=5, full_name="Juan Pérez", relationship_type="Tío",
            national_id="12345678-9", phone="+56987654321",
            email=None, photo_url=None, is_active=True,
            qr_code_hash="abc123",
            students=[SimpleNamespace(id=10)],
        )
        defaults.update(overrides)
        return SimpleNamespace(**defaults)

    def _fake_guardian(self, guardian_id=1, student_ids=None):
        """Create a fake guardian with students."""
        if student_ids is None:
            student_ids = [10]
        return SimpleNamespace(
            id=guardian_id,
            students=[SimpleNamespace(id=sid) for sid in student_ids],
        )

    def test_parent_list_pickups(self, parent_client):
        app, mock_session = parent_client
        fake_pickup = self._fake_pickup()
        fake_guardian = self._fake_guardian()

        with patch(
            "app.api.v1.parent_pickups.GuardianRepository"
        ) as MockGuardianRepo, patch(
            "app.api.v1.parent_pickups.AuthorizedPickupRepository"
        ) as MockPickupRepo:
            MockGuardianRepo.return_value.get = AsyncMock(return_value=fake_guardian)
            MockPickupRepo.return_value.list_by_student = AsyncMock(
                return_value=[fake_pickup]
            )

            with TestClient(app) as client:
                resp = client.get("/api/v1/parents/1/pickups")
                assert resp.status_code == 200
                data = resp.json()
                assert len(data) == 1
                assert data[0]["full_name"] == "Juan Pérez"
                assert data[0]["has_qr"] is True
                assert data[0]["has_photo"] is False

    def test_parent_create_pickup(self, parent_client):
        app, mock_session = parent_client
        fake_pickup = self._fake_pickup()
        fake_guardian = self._fake_guardian()

        with patch(
            "app.api.v1.parent_pickups.GuardianRepository"
        ) as MockGuardianRepo, patch(
            "app.api.v1.parent_pickups.AuthorizedPickupRepository"
        ) as MockPickupRepo:
            MockGuardianRepo.return_value.get = AsyncMock(return_value=fake_guardian)
            # create endpoint flow: get_by_national_id → create → set_students → commit → get
            MockPickupRepo.return_value.get_by_national_id = AsyncMock(return_value=None)
            MockPickupRepo.return_value.create = AsyncMock(return_value=fake_pickup)
            MockPickupRepo.return_value.set_students = AsyncMock(return_value=True)
            MockPickupRepo.return_value.get = AsyncMock(return_value=fake_pickup)

            with TestClient(app) as client:
                resp = client.post(
                    "/api/v1/parents/1/pickups",
                    json={
                        "full_name": "Juan Pérez",
                        "relationship_type": "Tío",
                        "national_id": "12345678-9",
                        "phone": "+56987654321",
                        "student_ids": [10],
                    },
                )
                assert resp.status_code == 201
                data = resp.json()
                assert data["full_name"] == "Juan Pérez"

    def test_parent_create_pickup_invalid_students(self, parent_client):
        """Creating a pickup with student_ids NOT belonging to guardian should 403."""
        app, mock_session = parent_client
        fake_guardian = self._fake_guardian()  # owns student 10 only

        with patch(
            "app.api.v1.parent_pickups.GuardianRepository"
        ) as MockGuardianRepo:
            MockGuardianRepo.return_value.get = AsyncMock(return_value=fake_guardian)

            with TestClient(app) as client:
                resp = client.post(
                    "/api/v1/parents/1/pickups",
                    json={
                        "full_name": "Desconocido",
                        "relationship_type": "Otro",
                        "student_ids": [999],  # Not guardian's student
                    },
                )
                assert resp.status_code == 403

    def test_parent_update_pickup(self, parent_client):
        app, mock_session = parent_client
        fake_pickup = self._fake_pickup()
        updated_pickup = self._fake_pickup(full_name="Juan Pérez González")
        fake_guardian = self._fake_guardian()

        with patch(
            "app.api.v1.parent_pickups.GuardianRepository"
        ) as MockGuardianRepo, patch(
            "app.api.v1.parent_pickups.AuthorizedPickupRepository"
        ) as MockPickupRepo:
            MockGuardianRepo.return_value.get = AsyncMock(return_value=fake_guardian)
            # update flow: get(pickup_id) → update → commit → get(pickup_id) again
            MockPickupRepo.return_value.get = AsyncMock(
                side_effect=[fake_pickup, updated_pickup]
            )
            MockPickupRepo.return_value.update = AsyncMock(return_value=updated_pickup)

            with TestClient(app) as client:
                resp = client.patch(
                    "/api/v1/parents/1/pickups/5",
                    json={"full_name": "Juan Pérez González"},
                )
                assert resp.status_code == 200
                data = resp.json()
                assert data["full_name"] == "Juan Pérez González"

    def test_parent_deactivate_pickup(self, parent_client):
        app, mock_session = parent_client
        fake_pickup = self._fake_pickup()
        deactivated_pickup = self._fake_pickup(is_active=False)
        fake_guardian = self._fake_guardian()

        with patch(
            "app.api.v1.parent_pickups.GuardianRepository"
        ) as MockGuardianRepo, patch(
            "app.api.v1.parent_pickups.AuthorizedPickupRepository"
        ) as MockPickupRepo:
            MockGuardianRepo.return_value.get = AsyncMock(return_value=fake_guardian)
            # deactivate flow: get(pickup_id) → deactivate → commit → get(pickup_id) again
            MockPickupRepo.return_value.get = AsyncMock(
                side_effect=[fake_pickup, deactivated_pickup]
            )
            MockPickupRepo.return_value.deactivate = AsyncMock(return_value=True)

            with TestClient(app) as client:
                resp = client.delete("/api/v1/parents/1/pickups/5")
                assert resp.status_code == 200
                data = resp.json()
                assert data["id"] == 5
                assert data["is_active"] is False

    def test_parent_cannot_see_other_guardian(self, parent_client):
        """Parent with guardian_id=1 should NOT access guardian_id=999."""
        app, mock_session = parent_client

        with TestClient(app) as client:
            resp = client.get("/api/v1/parents/999/pickups")
            assert resp.status_code == 403

    def test_admin_can_access(self, admin_client):
        """ADMIN role should be able to access parent pickups."""
        app, mock_session = admin_client
        fake_pickup = self._fake_pickup()
        fake_guardian = self._fake_guardian()

        with patch(
            "app.api.v1.parent_pickups.GuardianRepository"
        ) as MockGuardianRepo, patch(
            "app.api.v1.parent_pickups.AuthorizedPickupRepository"
        ) as MockPickupRepo:
            MockGuardianRepo.return_value.get = AsyncMock(return_value=fake_guardian)
            MockPickupRepo.return_value.list_by_student = AsyncMock(
                return_value=[fake_pickup]
            )

            with TestClient(app) as client:
                resp = client.get("/api/v1/parents/1/pickups")
                assert resp.status_code == 200

    def test_parent_regenerate_qr(self, parent_client):
        app, mock_session = parent_client
        fake_pickup = self._fake_pickup()
        fake_guardian = self._fake_guardian()

        with patch(
            "app.api.v1.parent_pickups.GuardianRepository"
        ) as MockGuardianRepo, patch(
            "app.api.v1.parent_pickups.AuthorizedPickupRepository"
        ) as MockPickupRepo:
            MockGuardianRepo.return_value.get = AsyncMock(return_value=fake_guardian)
            # regenerate_qr flow: get(pickup_id) → regenerate_qr → commit → get(pickup_id) again
            MockPickupRepo.return_value.get = AsyncMock(return_value=fake_pickup)
            # regenerate_qr returns a tuple (pickup, qr_token)
            MockPickupRepo.return_value.regenerate_qr = AsyncMock(
                return_value=(fake_pickup, "new_qr_token_abc")
            )

            with TestClient(app) as client:
                resp = client.post("/api/v1/parents/1/pickups/5/regenerate-qr")
                assert resp.status_code == 200
                data = resp.json()
                assert data["qr_token"] == "new_qr_token_abc"
                assert data["full_name"] == "Juan Pérez"
                assert data["has_qr"] is True
                assert data["has_photo"] is False
