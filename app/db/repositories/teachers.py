"""Teacher repository."""

from sqlalchemy import case, func, or_, select
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

    async def get_active(self, teacher_id: int) -> Teacher | None:
        """Get teacher by ID only if not DELETED."""
        stmt = select(Teacher).where(
            Teacher.id == teacher_id,
            Teacher.status != "DELETED",
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_all(self, *, include_deleted: bool = False) -> list[Teacher]:
        """List all teachers for kiosk provisioning."""
        stmt = select(Teacher).order_by(Teacher.full_name)
        if not include_deleted:
            stmt = stmt.where(Teacher.status != "DELETED")
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_ids(self, teacher_ids: list[int]) -> list[Teacher]:
        """Get multiple teachers by their IDs."""
        if not teacher_ids:
            return []
        stmt = select(Teacher).where(Teacher.id.in_(teacher_ids))
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

    async def list_paginated(
        self,
        page: int = 1,
        page_size: int = 20,
        search: str | None = None,
        status: str | None = None,
        include_deleted: bool = False,
    ) -> tuple[list[Teacher], int]:
        """List teachers with pagination and optional search.

        Returns tuple of (teachers, total_count).
        """
        # Base query with courses eagerly loaded
        base_query = select(Teacher).options(selectinload(Teacher.courses))

        # Apply status filter
        if status:
            base_query = base_query.where(Teacher.status == status)
        elif not include_deleted:
            base_query = base_query.where(Teacher.status != "DELETED")

        # Apply search filter if provided
        if search:
            search_term = f"%{search}%"
            base_query = base_query.where(
                or_(
                    Teacher.full_name.ilike(search_term),
                    Teacher.email.ilike(search_term),
                )
            )

        # Get total count
        count_query = select(func.count()).select_from(base_query.subquery())
        total_result = await self.session.execute(count_query)
        total = total_result.scalar() or 0

        # Apply pagination and ordering
        paginated_query = (
            base_query
            .order_by(Teacher.full_name)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )

        result = await self.session.execute(paginated_query)
        teachers = list(result.scalars().all())

        return teachers, total

    async def update(
        self,
        teacher_id: int,
        *,
        full_name: str | None = None,
        email: str | None = None,
        status: str | None = None,
        can_enroll_biometric: bool | None = None,
    ) -> Teacher | None:
        """Update a teacher's information."""
        teacher = await self.get(teacher_id)
        if not teacher:
            return None

        if full_name is not None:
            teacher.full_name = full_name
        if email is not None:
            teacher.email = email
        if status is not None:
            teacher.status = status
        if can_enroll_biometric is not None:
            teacher.can_enroll_biometric = can_enroll_biometric

        await self.session.flush()
        return teacher

    async def delete(self, teacher_id: int) -> bool:
        """Delete a teacher by ID.

        Returns True if deleted, False if not found.
        """
        teacher = await self.get(teacher_id)
        if not teacher:
            return False

        await self.session.delete(teacher)
        await self.session.flush()
        return True

    async def unassign_course(self, teacher_id: int, course_id: int) -> bool:
        """Remove a course assignment from a teacher."""
        teacher = await self.get_with_courses(teacher_id)
        if not teacher:
            return False

        course = await self.session.get(Course, course_id)
        if not course:
            return False

        if course in teacher.courses:
            teacher.courses.remove(course)
            await self.session.flush()

        return True

    # -------------------------------------------------------------------------
    # Soft delete operations
    # -------------------------------------------------------------------------

    async def soft_delete(self, teacher_id: int) -> Teacher | None:
        """Mark teacher as DELETED (soft delete)."""
        teacher = await self.get(teacher_id)
        if not teacher:
            return None

        teacher.status = "DELETED"
        await self.session.flush()
        return teacher

    async def restore(self, teacher_id: int) -> Teacher | None:
        """Restore a DELETED teacher to ACTIVE status."""
        teacher = await self.get(teacher_id)
        if not teacher:
            return None

        teacher.status = "ACTIVE"
        await self.session.flush()
        return teacher

    # -------------------------------------------------------------------------
    # Count operations
    # -------------------------------------------------------------------------

    async def count(
        self,
        *,
        status: str | None = None,
        include_deleted: bool = False,
        search: str | None = None,
    ) -> int:
        """Count teachers for pagination."""
        stmt = select(func.count(Teacher.id))

        if status:
            stmt = stmt.where(Teacher.status == status)
        elif not include_deleted:
            stmt = stmt.where(Teacher.status != "DELETED")

        if search:
            search_term = f"%{search}%"
            stmt = stmt.where(
                or_(
                    Teacher.full_name.ilike(search_term),
                    Teacher.email.ilike(search_term),
                )
            )

        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def count_courses(self, teacher_id: int) -> int:
        """Count courses assigned to this teacher."""
        teacher = await self.get_with_courses(teacher_id)
        if not teacher:
            return 0
        return len(teacher.courses)

    # -------------------------------------------------------------------------
    # Search operations
    # -------------------------------------------------------------------------

    async def search(self, query: str, *, limit: int = 20) -> list[Teacher]:
        """Basic search by name or email (exact contains)."""
        stmt = (
            select(Teacher)
            .where(
                or_(
                    Teacher.full_name.ilike(f"%{query}%"),
                    Teacher.email.ilike(f"%{query}%"),
                ),
                Teacher.status != "DELETED",
            )
            .order_by(Teacher.full_name)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def fuzzy_search(self, query: str, *, limit: int = 20) -> list[Teacher]:
        """Fuzzy search with ILIKE and ranking.

        Searches in both full_name and email fields, prioritizing matches
        where the name starts with the query.
        """
        query_lower = query.lower()
        stmt = (
            select(Teacher)
            .where(
                or_(
                    func.lower(Teacher.full_name).contains(query_lower),
                    func.lower(Teacher.email).contains(query_lower),
                ),
                Teacher.status != "DELETED",
            )
            .order_by(
                # Prioritize exact matches at start
                case(
                    (func.lower(Teacher.full_name).startswith(query_lower), 1),
                    else_=2,
                ),
                Teacher.full_name,
            )
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    # -------------------------------------------------------------------------
    # Export operations
    # -------------------------------------------------------------------------

    async def list_for_export(
        self,
        *,
        status: str | None = None,
    ) -> list[Teacher]:
        """List all teachers for CSV export (no pagination)."""
        stmt = (
            select(Teacher)
            .options(selectinload(Teacher.courses))
            .order_by(Teacher.full_name)
        )

        if status:
            stmt = stmt.where(Teacher.status == status)
        else:
            stmt = stmt.where(Teacher.status != "DELETED")

        result = await self.session.execute(stmt)
        return list(result.scalars().all())
