"""Tests for NoShowAlertRepository."""

from __future__ import annotations

from datetime import date, datetime, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.course import Course
from app.db.models.guardian import Guardian
from app.db.models.no_show_alert import NoShowAlert
from app.db.models.student import Student
from app.db.repositories.no_show_alerts import NoShowAlertRepository


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
async def alert_repo(db_session: AsyncSession) -> NoShowAlertRepository:
    return NoShowAlertRepository(db_session)


@pytest.fixture
async def alert_course(db_session: AsyncSession) -> Course:
    course = Course(name="Test Course", grade="1° Básico")
    db_session.add(course)
    await db_session.flush()
    return course


@pytest.fixture
async def alert_guardian(db_session: AsyncSession) -> Guardian:
    guardian = Guardian(
        full_name="Alert Guardian",
        contacts={"email": "guardian@test.com"},
        notification_prefs={},
    )
    db_session.add(guardian)
    await db_session.flush()
    return guardian


@pytest.fixture
async def alert_student(db_session: AsyncSession, alert_course: Course) -> Student:
    student = Student(
        full_name="Alert Student",
        course_id=alert_course.id,
    )
    db_session.add(student)
    await db_session.flush()
    return student


# =============================================================================
# Repository Tests
# =============================================================================

class TestNoShowAlertRepository:
    """Tests for NoShowAlertRepository."""

    @pytest.mark.asyncio
    async def test_create_alert(self, alert_repo, alert_student, alert_guardian, alert_course):
        """Should create a new alert."""
        alert = await alert_repo.create(
            student_id=alert_student.id,
            guardian_id=alert_guardian.id,
            course_id=alert_course.id,
            schedule_id=None,
            alert_date=date(2025, 1, 15),
            alerted_at=datetime.now(timezone.utc),
        )

        assert alert.id is not None
        assert alert.student_id == alert_student.id
        assert alert.guardian_id == alert_guardian.id
        assert alert.status == "PENDING"

    @pytest.mark.asyncio
    async def test_get_by_unique(self, alert_repo, alert_student, alert_guardian, alert_course):
        """Should get alert by unique constraint."""
        alert_date = date(2025, 1, 16)

        # Create alert
        await alert_repo.create(
            student_id=alert_student.id,
            guardian_id=alert_guardian.id,
            course_id=alert_course.id,
            schedule_id=None,
            alert_date=alert_date,
            alerted_at=datetime.now(timezone.utc),
        )

        # Get by unique constraint
        result = await alert_repo.get_by_unique(
            alert_student.id, alert_guardian.id, alert_date
        )

        assert result is not None
        assert result.student_id == alert_student.id

    @pytest.mark.asyncio
    async def test_get_by_unique_not_found(self, alert_repo):
        """Should return None for non-existent alert."""
        result = await alert_repo.get_by_unique(999, 999, date(2025, 1, 1))
        assert result is None

    @pytest.mark.asyncio
    async def test_get_or_create_new(self, alert_repo, alert_student, alert_guardian, alert_course):
        """Should create new alert when doesn't exist."""
        alert, created = await alert_repo.get_or_create(
            student_id=alert_student.id,
            guardian_id=alert_guardian.id,
            course_id=alert_course.id,
            schedule_id=None,
            alert_date=date(2025, 1, 17),
            alerted_at=datetime.now(timezone.utc),
        )

        assert created is True
        assert alert.id is not None

    @pytest.mark.asyncio
    async def test_get_or_create_existing(self, alert_repo, alert_student, alert_guardian, alert_course):
        """Should return existing alert when already exists."""
        alert_date = date(2025, 1, 18)

        # Create first
        first_alert, first_created = await alert_repo.get_or_create(
            student_id=alert_student.id,
            guardian_id=alert_guardian.id,
            course_id=alert_course.id,
            schedule_id=None,
            alert_date=alert_date,
            alerted_at=datetime.now(timezone.utc),
        )

        # Try to create again
        second_alert, second_created = await alert_repo.get_or_create(
            student_id=alert_student.id,
            guardian_id=alert_guardian.id,
            course_id=alert_course.id,
            schedule_id=None,
            alert_date=alert_date,
            alerted_at=datetime.now(timezone.utc),
        )

        assert first_created is True
        assert second_created is False
        assert second_alert.id == first_alert.id

    @pytest.mark.asyncio
    async def test_mark_notified(self, alert_repo, alert_student, alert_guardian, alert_course):
        """Should increment notification attempts."""
        alert = await alert_repo.create(
            student_id=alert_student.id,
            guardian_id=alert_guardian.id,
            course_id=alert_course.id,
            schedule_id=None,
            alert_date=date(2025, 1, 19),
            alerted_at=datetime.now(timezone.utc),
        )

        await alert_repo.mark_notified(alert.id, datetime.now(timezone.utc))

        # Refresh and check
        updated = await alert_repo.get_by_unique(
            alert_student.id, alert_guardian.id, date(2025, 1, 19)
        )
        assert updated.notification_attempts == 1

    @pytest.mark.asyncio
    async def test_mark_notified_non_existent(self, alert_repo):
        """Should handle non-existent alert gracefully."""
        # Should not raise an error
        await alert_repo.mark_notified(99999, datetime.now(timezone.utc))

    @pytest.mark.asyncio
    async def test_mark_resolved(self, alert_repo, alert_student, alert_guardian, alert_course):
        """Should mark alert as resolved."""
        alert = await alert_repo.create(
            student_id=alert_student.id,
            guardian_id=alert_guardian.id,
            course_id=alert_course.id,
            schedule_id=None,
            alert_date=date(2025, 1, 20),
            alerted_at=datetime.now(timezone.utc),
        )

        resolved = await alert_repo.mark_resolved(
            alert.id,
            notes="Contactado por teléfono",
            resolved_at=datetime.now(timezone.utc),
        )

        assert resolved is not None
        assert resolved.status == "RESOLVED"
        assert resolved.notes == "Contactado por teléfono"

    @pytest.mark.asyncio
    async def test_mark_resolved_without_notes(self, alert_repo, alert_student, alert_guardian, alert_course):
        """Should mark alert as resolved without notes."""
        alert = await alert_repo.create(
            student_id=alert_student.id,
            guardian_id=alert_guardian.id,
            course_id=alert_course.id,
            schedule_id=None,
            alert_date=date(2025, 1, 21),
            alerted_at=datetime.now(timezone.utc),
        )

        resolved = await alert_repo.mark_resolved(
            alert.id,
            notes=None,
            resolved_at=datetime.now(timezone.utc),
        )

        assert resolved is not None
        assert resolved.status == "RESOLVED"

    @pytest.mark.asyncio
    async def test_mark_resolved_non_existent(self, alert_repo):
        """Should return None for non-existent alert."""
        result = await alert_repo.mark_resolved(
            99999,
            notes="Test",
            resolved_at=datetime.now(timezone.utc),
        )
        assert result is None

    @pytest.mark.asyncio
    async def test_list_alerts_basic(self, alert_repo, alert_student, alert_guardian, alert_course):
        """Should list alerts."""
        await alert_repo.create(
            student_id=alert_student.id,
            guardian_id=alert_guardian.id,
            course_id=alert_course.id,
            schedule_id=None,
            alert_date=date(2025, 1, 22),
            alerted_at=datetime.now(timezone.utc),
        )

        alerts = await alert_repo.list_alerts()

        assert len(alerts) >= 1
        assert alerts[0]["student_name"] == "Alert Student"

    @pytest.mark.asyncio
    async def test_list_alerts_filter_by_date(self, alert_repo, alert_student, alert_guardian, alert_course):
        """Should filter alerts by date range."""
        await alert_repo.create(
            student_id=alert_student.id,
            guardian_id=alert_guardian.id,
            course_id=alert_course.id,
            schedule_id=None,
            alert_date=date(2025, 2, 1),
            alerted_at=datetime.now(timezone.utc),
        )

        alerts = await alert_repo.list_alerts(
            start_date=date(2025, 2, 1),
            end_date=date(2025, 2, 28),
        )

        assert all(
            date(2025, 2, 1) <= a["alert_date"] <= date(2025, 2, 28)
            for a in alerts
        )

    @pytest.mark.asyncio
    async def test_list_alerts_filter_by_status(self, alert_repo, alert_student, alert_guardian, alert_course):
        """Should filter alerts by status."""
        alert = await alert_repo.create(
            student_id=alert_student.id,
            guardian_id=alert_guardian.id,
            course_id=alert_course.id,
            schedule_id=None,
            alert_date=date(2025, 2, 2),
            alerted_at=datetime.now(timezone.utc),
        )
        await alert_repo.mark_resolved(alert.id, "Resuelto", datetime.now(timezone.utc))

        alerts = await alert_repo.list_alerts(status="RESOLVED")

        assert all(a["status"] == "RESOLVED" for a in alerts)

    @pytest.mark.asyncio
    async def test_list_alerts_filter_by_course(self, alert_repo, alert_student, alert_guardian, alert_course):
        """Should filter alerts by course."""
        await alert_repo.create(
            student_id=alert_student.id,
            guardian_id=alert_guardian.id,
            course_id=alert_course.id,
            schedule_id=None,
            alert_date=date(2025, 2, 3),
            alerted_at=datetime.now(timezone.utc),
        )

        alerts = await alert_repo.list_alerts(course_id=alert_course.id)

        assert all(a["course_id"] == alert_course.id for a in alerts)

    @pytest.mark.asyncio
    async def test_list_alerts_filter_by_guardian(self, alert_repo, alert_student, alert_guardian, alert_course):
        """Should filter alerts by guardian."""
        await alert_repo.create(
            student_id=alert_student.id,
            guardian_id=alert_guardian.id,
            course_id=alert_course.id,
            schedule_id=None,
            alert_date=date(2025, 2, 4),
            alerted_at=datetime.now(timezone.utc),
        )

        alerts = await alert_repo.list_alerts(guardian_id=alert_guardian.id)

        assert all(a["guardian_id"] == alert_guardian.id for a in alerts)

    @pytest.mark.asyncio
    async def test_list_alerts_filter_by_student(self, alert_repo, alert_student, alert_guardian, alert_course):
        """Should filter alerts by student."""
        await alert_repo.create(
            student_id=alert_student.id,
            guardian_id=alert_guardian.id,
            course_id=alert_course.id,
            schedule_id=None,
            alert_date=date(2025, 2, 5),
            alerted_at=datetime.now(timezone.utc),
        )

        alerts = await alert_repo.list_alerts(student_id=alert_student.id)

        assert all(a["student_id"] == alert_student.id for a in alerts)

    @pytest.mark.asyncio
    async def test_list_alerts_with_limit_offset(self, alert_repo, alert_student, alert_guardian, alert_course):
        """Should apply limit and offset."""
        for i in range(5):
            await alert_repo.create(
                student_id=alert_student.id,
                guardian_id=alert_guardian.id,
                course_id=alert_course.id,
                schedule_id=None,
                alert_date=date(2025, 3, i + 1),
                alerted_at=datetime.now(timezone.utc),
            )

        alerts = await alert_repo.list_alerts(limit=2, offset=1)

        assert len(alerts) <= 2

    @pytest.mark.asyncio
    async def test_counts_by_course(self, alert_repo, alert_student, alert_guardian, alert_course):
        """Should count alerts by course."""
        test_date = date(2025, 3, 10)

        await alert_repo.create(
            student_id=alert_student.id,
            guardian_id=alert_guardian.id,
            course_id=alert_course.id,
            schedule_id=None,
            alert_date=test_date,
            alerted_at=datetime.now(timezone.utc),
        )

        counts = await alert_repo.counts_by_course(test_date)

        assert isinstance(counts, list)
        # Should have at least one entry for our course
        course_count = next((c for c in counts if c["course_id"] == alert_course.id), None)
        if course_count:
            assert course_count["total"] >= 1
