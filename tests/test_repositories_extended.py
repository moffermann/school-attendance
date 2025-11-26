"""Extended tests for repositories with low coverage."""

from __future__ import annotations

from datetime import datetime, time, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.course import Course
from app.db.models.guardian import Guardian
from app.db.models.notification import Notification
from app.db.models.student import Student
from app.db.models.teacher import Teacher
from app.db.repositories.notifications import NotificationRepository
from app.db.repositories.teachers import TeacherRepository
from app.db.repositories.guardians import GuardianRepository
from app.db.repositories.students import StudentRepository


# =============================================================================
# Teacher Repository Tests
# =============================================================================

class TestTeacherRepository:
    """Tests for TeacherRepository."""

    @pytest.fixture
    async def teacher_repo(self, db_session: AsyncSession) -> TeacherRepository:
        return TeacherRepository(db_session)

    @pytest.fixture
    async def sample_teacher(self, db_session: AsyncSession) -> Teacher:
        teacher = Teacher(full_name="Prof. García", email="garcia@school.com")
        db_session.add(teacher)
        await db_session.flush()
        return teacher

    @pytest.fixture
    async def sample_course_for_teacher(self, db_session: AsyncSession) -> Course:
        course = Course(name="Matemáticas 1A", grade="1° Básico")
        db_session.add(course)
        await db_session.flush()
        return course

    @pytest.mark.asyncio
    async def test_get_teacher(self, teacher_repo, sample_teacher):
        """Should get teacher by ID."""
        result = await teacher_repo.get(sample_teacher.id)
        assert result is not None
        assert result.full_name == "Prof. García"

    @pytest.mark.asyncio
    async def test_get_teacher_not_found(self, teacher_repo):
        """Should return None for non-existent teacher."""
        result = await teacher_repo.get(99999)
        assert result is None

    @pytest.mark.asyncio
    async def test_get_by_email(self, teacher_repo, sample_teacher):
        """Should get teacher by email."""
        result = await teacher_repo.get_by_email("garcia@school.com")
        assert result is not None
        assert result.id == sample_teacher.id

    @pytest.mark.asyncio
    async def test_get_by_email_not_found(self, teacher_repo):
        """Should return None for non-existent email."""
        result = await teacher_repo.get_by_email("nonexistent@school.com")
        assert result is None

    @pytest.mark.asyncio
    async def test_create_teacher(self, teacher_repo):
        """Should create a new teacher."""
        teacher = await teacher_repo.create(
            full_name="Prof. López",
            email="lopez@school.com"
        )
        assert teacher.id is not None
        assert teacher.full_name == "Prof. López"
        assert teacher.email == "lopez@school.com"

    @pytest.mark.asyncio
    async def test_list_all_teachers(self, teacher_repo, sample_teacher):
        """Should list all teachers."""
        # Create another teacher
        await teacher_repo.create(full_name="Prof. Martínez")

        teachers = await teacher_repo.list_all()
        assert len(teachers) >= 2

    @pytest.mark.asyncio
    async def test_assign_course(self, teacher_repo, sample_teacher, sample_course_for_teacher):
        """Should assign course to teacher."""
        result = await teacher_repo.assign_course(
            sample_teacher.id,
            sample_course_for_teacher.id
        )
        assert result is True

        # Verify assignment
        teacher = await teacher_repo.get_with_courses(sample_teacher.id)
        assert len(teacher.courses) == 1
        assert teacher.courses[0].id == sample_course_for_teacher.id

    @pytest.mark.asyncio
    async def test_assign_course_teacher_not_found(self, teacher_repo, sample_course_for_teacher):
        """Should return False for non-existent teacher."""
        result = await teacher_repo.assign_course(99999, sample_course_for_teacher.id)
        assert result is False

    @pytest.mark.asyncio
    async def test_assign_course_course_not_found(self, teacher_repo, sample_teacher):
        """Should return False for non-existent course."""
        result = await teacher_repo.assign_course(sample_teacher.id, 99999)
        assert result is False

    @pytest.mark.asyncio
    async def test_list_courses(self, teacher_repo, sample_teacher, sample_course_for_teacher):
        """Should list courses for a teacher."""
        await teacher_repo.assign_course(sample_teacher.id, sample_course_for_teacher.id)

        courses = await teacher_repo.list_courses(sample_teacher.id)
        assert len(courses) == 1
        assert courses[0].name == "Matemáticas 1A"

    @pytest.mark.asyncio
    async def test_list_courses_teacher_not_found(self, teacher_repo):
        """Should return empty list for non-existent teacher."""
        courses = await teacher_repo.list_courses(99999)
        assert courses == []

    @pytest.mark.asyncio
    async def test_list_course_students(
        self, db_session, teacher_repo, sample_teacher, sample_course_for_teacher
    ):
        """Should list students in a teacher's assigned course."""
        # Assign course to teacher
        await teacher_repo.assign_course(sample_teacher.id, sample_course_for_teacher.id)

        # Create students in the course
        student1 = Student(full_name="Ana López", course_id=sample_course_for_teacher.id)
        student2 = Student(full_name="Pedro Martínez", course_id=sample_course_for_teacher.id)
        db_session.add_all([student1, student2])
        await db_session.flush()

        students = await teacher_repo.list_course_students(
            sample_teacher.id,
            sample_course_for_teacher.id
        )
        assert len(students) == 2

    @pytest.mark.asyncio
    async def test_list_course_students_not_assigned(
        self, teacher_repo, sample_teacher, sample_course_for_teacher
    ):
        """Should return empty list if teacher not assigned to course."""
        students = await teacher_repo.list_course_students(
            sample_teacher.id,
            sample_course_for_teacher.id
        )
        assert students == []


# =============================================================================
# Notification Repository Tests
# =============================================================================

class TestNotificationRepository:
    """Tests for NotificationRepository."""

    @pytest.fixture
    async def notif_repo(self, db_session: AsyncSession) -> NotificationRepository:
        return NotificationRepository(db_session)

    @pytest.fixture
    async def sample_guardian_for_notif(self, db_session: AsyncSession) -> Guardian:
        guardian = Guardian(
            full_name="María González",
            contacts={"email": "maria@example.com"},
            notification_prefs={},
        )
        db_session.add(guardian)
        await db_session.flush()
        return guardian

    @pytest.mark.asyncio
    async def test_create_notification(self, notif_repo, sample_guardian_for_notif):
        """Should create a notification."""
        notif = await notif_repo.create(
            guardian_id=sample_guardian_for_notif.id,
            channel="email",
            template="welcome",
            payload={"name": "María"},
        )
        assert notif.id is not None
        assert notif.channel == "email"
        assert notif.status == "queued"

    @pytest.mark.asyncio
    async def test_get_notification(self, notif_repo, sample_guardian_for_notif):
        """Should get notification by ID."""
        notif = await notif_repo.create(
            guardian_id=sample_guardian_for_notif.id,
            channel="email",
            template="test",
            payload={},
        )

        result = await notif_repo.get(notif.id)
        assert result is not None
        assert result.id == notif.id

    @pytest.mark.asyncio
    async def test_mark_sent(self, notif_repo, sample_guardian_for_notif):
        """Should mark notification as sent."""
        notif = await notif_repo.create(
            guardian_id=sample_guardian_for_notif.id,
            channel="email",
            template="test",
            payload={},
        )

        updated = await notif_repo.mark_sent(notif)
        assert updated.status == "sent"
        assert updated.ts_sent is not None

    @pytest.mark.asyncio
    async def test_mark_failed(self, notif_repo, sample_guardian_for_notif):
        """Should mark notification as failed and increment retries."""
        notif = await notif_repo.create(
            guardian_id=sample_guardian_for_notif.id,
            channel="email",
            template="test",
            payload={},
        )

        updated = await notif_repo.mark_failed(notif)
        assert updated.status == "failed"
        assert updated.retries == 1

        # Fail again
        updated = await notif_repo.mark_failed(updated)
        assert updated.retries == 2

    @pytest.mark.asyncio
    async def test_list_notifications_basic(self, notif_repo, sample_guardian_for_notif):
        """Should list notifications."""
        await notif_repo.create(
            guardian_id=sample_guardian_for_notif.id,
            channel="email",
            template="test1",
            payload={},
        )
        await notif_repo.create(
            guardian_id=sample_guardian_for_notif.id,
            channel="whatsapp",
            template="test2",
            payload={},
        )

        results = await notif_repo.list_notifications()
        assert len(results) >= 2

    @pytest.mark.asyncio
    async def test_list_notifications_filter_by_channel(self, notif_repo, sample_guardian_for_notif):
        """Should filter notifications by channel."""
        await notif_repo.create(
            guardian_id=sample_guardian_for_notif.id,
            channel="email",
            template="test",
            payload={},
        )
        await notif_repo.create(
            guardian_id=sample_guardian_for_notif.id,
            channel="whatsapp",
            template="test",
            payload={},
        )

        results = await notif_repo.list_notifications(channel="email")
        assert all(n.channel == "email" for n in results)

    @pytest.mark.asyncio
    async def test_list_notifications_filter_by_status(self, notif_repo, sample_guardian_for_notif):
        """Should filter notifications by status."""
        notif1 = await notif_repo.create(
            guardian_id=sample_guardian_for_notif.id,
            channel="email",
            template="test",
            payload={},
        )
        await notif_repo.mark_sent(notif1)

        await notif_repo.create(
            guardian_id=sample_guardian_for_notif.id,
            channel="email",
            template="test2",
            payload={},
        )

        results = await notif_repo.list_notifications(status="sent")
        assert all(n.status == "sent" for n in results)

    @pytest.mark.asyncio
    async def test_list_notifications_filter_by_guardian(self, db_session, notif_repo, sample_guardian_for_notif):
        """Should filter notifications by guardian IDs."""
        # Create another guardian
        guardian2 = Guardian(
            full_name="Pedro López",
            contacts={"email": "pedro@example.com"},
            notification_prefs={},
        )
        db_session.add(guardian2)
        await db_session.flush()

        await notif_repo.create(
            guardian_id=sample_guardian_for_notif.id,
            channel="email",
            template="test",
            payload={},
        )
        await notif_repo.create(
            guardian_id=guardian2.id,
            channel="email",
            template="test",
            payload={},
        )

        results = await notif_repo.list_notifications(
            guardian_ids=[sample_guardian_for_notif.id]
        )
        assert all(n.guardian_id == sample_guardian_for_notif.id for n in results)


# =============================================================================
# Guardian Repository Tests
# =============================================================================

class TestGuardianRepository:
    """Tests for GuardianRepository."""

    @pytest.fixture
    async def guardian_repo(self, db_session: AsyncSession) -> GuardianRepository:
        return GuardianRepository(db_session)

    @pytest.mark.asyncio
    async def test_get_guardian(self, guardian_repo, sample_guardian):
        """Should get guardian by ID."""
        result = await guardian_repo.get(sample_guardian.id)
        assert result is not None
        assert result.full_name == "María González"

    @pytest.mark.asyncio
    async def test_get_guardian_not_found(self, guardian_repo):
        """Should return None for non-existent guardian."""
        result = await guardian_repo.get(99999)
        assert result is None

    @pytest.mark.asyncio
    async def test_list_by_student_ids(self, guardian_repo, sample_student):
        """Should list guardians for student IDs."""
        guardians = await guardian_repo.list_by_student_ids([sample_student.id])
        assert len(guardians) >= 1


# =============================================================================
# Student Repository Tests
# =============================================================================

class TestStudentRepository:
    """Tests for StudentRepository."""

    @pytest.fixture
    async def student_repo(self, db_session: AsyncSession) -> StudentRepository:
        return StudentRepository(db_session)

    @pytest.mark.asyncio
    async def test_get_student(self, student_repo, sample_student):
        """Should get student by ID."""
        result = await student_repo.get(sample_student.id)
        assert result is not None
        assert result.full_name == "Pedro González"

    @pytest.mark.asyncio
    async def test_get_student_not_found(self, student_repo):
        """Should return None for non-existent student."""
        result = await student_repo.get(99999)
        assert result is None

    @pytest.mark.asyncio
    async def test_list_by_course(self, student_repo, sample_student, sample_course):
        """Should list students by course."""
        students = await student_repo.list_by_course(sample_course.id)
        assert len(students) >= 1

    @pytest.mark.asyncio
    async def test_list_by_course_ids(self, student_repo, sample_student, sample_course):
        """Should list students by multiple course IDs."""
        students = await student_repo.list_by_course_ids({sample_course.id})
        assert len(students) >= 1
