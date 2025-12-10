"""Teacher repository."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.teacher import Teacher
from app.db.models.course import Course
from app.db.models.student import Student


class TeacherRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, teacher_id: int) -> Teacher | None:
        """Get teacher by ID."""
        return await self.session.get(Teacher, teacher_id)

    async def get_with_courses(self, teacher_id: int) -> Teacher | None:
        """Get teacher with courses eagerly loaded."""
        stmt = (
            select(Teacher)
            .where(Teacher.id == teacher_id)
            .options(selectinload(Teacher.courses))
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Teacher | None:
        """Get teacher by email."""
        stmt = select(Teacher).where(Teacher.email == email)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_courses(self, teacher_id: int) -> list[Course]:
        """List courses assigned to a teacher."""
        teacher = await self.get_with_courses(teacher_id)
        if not teacher:
            return []
        return list(teacher.courses)

    async def list_course_students(self, teacher_id: int, course_id: int) -> list[Student]:
        """List students in a course that the teacher is assigned to.

        Returns empty list if teacher is not assigned to the course.
        """
        # Verify teacher is assigned to this course
        teacher = await self.get_with_courses(teacher_id)
        if not teacher:
            return []

        course_ids = {c.id for c in teacher.courses}
        if course_id not in course_ids:
            return []

        # Get students with guardians eager loaded
        stmt = (
            select(Student)
            .where(Student.course_id == course_id, Student.status == "ACTIVE")
            .options(selectinload(Student.guardians))
            .order_by(Student.full_name)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create(self, *, full_name: str, email: str | None = None) -> Teacher:
        """Create a new teacher."""
        teacher = Teacher(full_name=full_name, email=email)
        self.session.add(teacher)
        await self.session.flush()
        return teacher

    async def assign_course(self, teacher_id: int, course_id: int) -> bool:
        """Assign a course to a teacher."""
        teacher = await self.get_with_courses(teacher_id)
        if not teacher:
            return False

        course = await self.session.get(Course, course_id)
        if not course:
            return False

        if course not in teacher.courses:
            teacher.courses.append(course)
            await self.session.flush()

        return True

    async def list_all(self) -> list[Teacher]:
        """List all teachers for kiosk provisioning."""
        stmt = select(Teacher).order_by(Teacher.full_name)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_all_courses(self) -> list[Course]:
        """List all courses (for admin access)."""
        stmt = select(Course).order_by(Course.grade, Course.name)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_all_course_students(self, course_id: int) -> list[Student]:
        """List students in any course (for admin access)."""
        stmt = (
            select(Student)
            .where(Student.course_id == course_id, Student.status == "ACTIVE")
            .options(selectinload(Student.guardians))
            .order_by(Student.full_name)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
