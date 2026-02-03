"""Tests for teacher endpoints."""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app import main
from app.core import deps
from app.core.auth import AuthUser


@pytest.fixture
def app_with_teacher_auth():
    """Get app with TEACHER role auth."""
    app = main.app
    app.dependency_overrides[deps.get_current_user] = lambda: AuthUser(
        id=10, role="TEACHER", full_name="Prof. García", guardian_id=None, teacher_id=1
    )
    yield app
    app.dependency_overrides.clear()


@pytest.fixture
def app_with_teacher_no_profile():
    """Get app with TEACHER role but no teacher_id."""
    app = main.app
    app.dependency_overrides[deps.get_current_user] = lambda: AuthUser(
        id=10, role="TEACHER", full_name="Prof. Sin Perfil", guardian_id=None, teacher_id=None
    )
    yield app
    app.dependency_overrides.clear()


@pytest.fixture
def app_with_parent_auth():
    """Get app with PARENT role auth."""
    app = main.app
    app.dependency_overrides[deps.get_current_user] = lambda: AuthUser(
        id=20, role="PARENT", full_name="Padre User", guardian_id=5, teacher_id=None
    )
    yield app
    app.dependency_overrides.clear()


# ============================================================================
# /teachers/me tests
# ============================================================================


def test_teacher_me_success(app_with_teacher_auth):
    """Teacher can get their own profile and courses."""
    app = app_with_teacher_auth

    class FakeTeacherRepo:
        async def get_with_courses(self, teacher_id):
            return SimpleNamespace(
                id=teacher_id,
                full_name="Prof. García",
                email="garcia@school.com",
                status="ACTIVE",
                courses=[
                    SimpleNamespace(id=1, name="1° Básico A", grade="1° Básico"),
                    SimpleNamespace(id=2, name="2° Básico A", grade="2° Básico"),
                ],
            )

    from app.api.v1.teachers import get_teacher_repo

    app.dependency_overrides[get_teacher_repo] = lambda: FakeTeacherRepo()

    with TestClient(app) as client:
        resp = client.get("/api/v1/teachers/me")
        assert resp.status_code == 200
        data = resp.json()
        assert data["teacher"]["full_name"] == "Prof. García"
        assert len(data["courses"]) == 2


def test_teacher_me_no_profile(app_with_teacher_no_profile):
    """Teacher without teacher_id gets 403."""
    with TestClient(app_with_teacher_no_profile) as client:
        resp = client.get("/api/v1/teachers/me")
        assert resp.status_code == 403


def test_teacher_me_parent_forbidden(app_with_parent_auth):
    """Parent role cannot access teacher endpoint."""
    with TestClient(app_with_parent_auth) as client:
        resp = client.get("/api/v1/teachers/me")
        assert resp.status_code == 403


# ============================================================================
# /teachers/courses/{id}/students tests
# ============================================================================


def test_teacher_course_students_success(app_with_teacher_auth):
    """Teacher can list students from their assigned course."""
    app = app_with_teacher_auth

    class FakeTeacherRepo:
        async def get_with_courses(self, teacher_id):
            return SimpleNamespace(
                id=teacher_id,
                courses=[SimpleNamespace(id=1, name="1° Básico A", grade="1° Básico")],
            )

        async def list_course_students(self, teacher_id, course_id):
            return [
                SimpleNamespace(id=1, full_name="Ana López", status="ACTIVE"),
                SimpleNamespace(id=2, full_name="Pedro Martínez", status="ACTIVE"),
            ]

    from app.api.v1.teachers import get_teacher_repo

    app.dependency_overrides[get_teacher_repo] = lambda: FakeTeacherRepo()

    with TestClient(app) as client:
        resp = client.get("/api/v1/teachers/courses/1/students")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert data[0]["full_name"] == "Ana López"


def test_teacher_course_students_not_assigned(app_with_teacher_auth):
    """Teacher cannot access course they're not assigned to."""
    app = app_with_teacher_auth

    class FakeTeacherRepo:
        async def get_with_courses(self, teacher_id):
            return SimpleNamespace(
                id=teacher_id,
                courses=[SimpleNamespace(id=1, name="1° Básico A", grade="1° Básico")],
            )

        async def list_course_students(self, teacher_id, course_id):
            return []  # No students because teacher not assigned

    from app.api.v1.teachers import get_teacher_repo

    app.dependency_overrides[get_teacher_repo] = lambda: FakeTeacherRepo()

    with TestClient(app) as client:
        resp = client.get("/api/v1/teachers/courses/999/students")
        assert resp.status_code == 403


# ============================================================================
# /teachers/attendance/bulk tests
# ============================================================================


def test_teacher_bulk_attendance_success(app_with_teacher_auth):
    """Teacher can submit bulk attendance."""
    app = app_with_teacher_auth

    class FakeTeacherRepo:
        async def get_with_courses(self, teacher_id):
            return SimpleNamespace(
                id=teacher_id,
                courses=[SimpleNamespace(id=1, name="1° Básico A", grade="1° Básico")],
            )

    class FakeAttendanceRepo:
        async def create_event(self, **kwargs):
            return SimpleNamespace(id=1, **kwargs)

    class FakeSession:
        async def commit(self):
            pass

    from app.api.v1.teachers import get_attendance_repo, get_teacher_repo

    app.dependency_overrides[get_teacher_repo] = lambda: FakeTeacherRepo()
    app.dependency_overrides[get_attendance_repo] = lambda: FakeAttendanceRepo()
    app.dependency_overrides[deps.get_db] = lambda: FakeSession()

    with TestClient(app) as client:
        resp = client.post(
            "/api/v1/teachers/attendance/bulk",
            json={
                "course_id": 1,
                "gate_id": "GATE-A",
                "device_id": "PWA-001",
                "events": [
                    {"student_id": 1, "type": "IN"},
                    {"student_id": 2, "type": "IN"},
                ],
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["processed"] == 2
        assert data["errors"] == []


def test_teacher_bulk_attendance_wrong_course(app_with_teacher_auth):
    """Teacher cannot submit bulk attendance for unassigned course."""
    app = app_with_teacher_auth

    class FakeTeacherRepo:
        async def get_with_courses(self, teacher_id):
            return SimpleNamespace(
                id=teacher_id,
                courses=[SimpleNamespace(id=1, name="1° Básico A", grade="1° Básico")],
            )

    from app.api.v1.teachers import get_teacher_repo

    app.dependency_overrides[get_teacher_repo] = lambda: FakeTeacherRepo()

    with TestClient(app) as client:
        resp = client.post(
            "/api/v1/teachers/attendance/bulk",
            json={
                "course_id": 999,  # Not assigned
                "gate_id": "GATE-A",
                "device_id": "PWA-001",
                "events": [{"student_id": 1, "type": "IN"}],
            },
        )
        assert resp.status_code == 403
