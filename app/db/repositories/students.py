"""Student repository stub."""

from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.student import Student


class StudentRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, student_id: int) -> Student | None:
        return await self.session.get(Student, student_id)

    async def list_by_ids(self, student_ids: list[int]) -> list[Student]:
        if not student_ids:
            return []
        stmt = select(Student).where(Student.id.in_(student_ids))
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_by_course_ids(self, course_ids: set[int]) -> list[Student]:
        if not course_ids:
            return []
        stmt = (
            select(Student)
            .where(Student.course_id.in_(course_ids))
            .options(selectinload(Student.guardians))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_by_course(self, course_id: int) -> list[Student]:
        stmt = (
            select(Student)
            .where(Student.course_id == course_id)
            .options(selectinload(Student.guardians))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_all(
        self, limit: int = 5000, *, include_guardians: bool = False
    ) -> list[Student]:
        """List all students for kiosk provisioning.

        R7-B7 fix: Add limit parameter to prevent OOM on large deployments.
        Default is 5000 which should cover most schools.

        Args:
            limit: Maximum number of students to return
            include_guardians: If True, eagerly load guardians for each student
        """
        stmt = select(Student).order_by(Student.full_name).limit(limit)
        if include_guardians:
            stmt = stmt.options(selectinload(Student.guardians))
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_with_guardians(self, student_id: int) -> Student | None:
        """Get a student with their guardians eagerly loaded."""
        stmt = (
            select(Student)
            .where(Student.id == student_id)
            .options(selectinload(Student.guardians))
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_with_course(self, student_id: int) -> Student | None:
        """Get a student with their course eagerly loaded."""
        stmt = (
            select(Student)
            .where(Student.id == student_id)
            .options(selectinload(Student.course))
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def update_photo_url(self, student_id: int, photo_url: str | None) -> Student | None:
        """Update a student's photo URL (or clear it by passing None)."""
        student = await self.get(student_id)
        if not student:
            return None
        student.photo_url = photo_url
        await self.session.flush()
        return student

    async def update(self, student_id: int, **kwargs) -> Student | None:
        """Update a student's fields."""
        student = await self.get(student_id)
        if not student:
            return None
        for key, value in kwargs.items():
            if hasattr(student, key):
                setattr(student, key, value)
        await self.session.flush()
        return student

    async def delete(self, student_id: int) -> bool:
        """Hard delete a student by ID (use soft_delete instead for production).

        Args:
            student_id: The student's ID

        Returns:
            True if deleted, False if not found
        """
        student = await self.get(student_id)
        if not student:
            return False
        await self.session.delete(student)
        await self.session.flush()
        return True

    async def soft_delete(self, student_id: int) -> bool:
        """Soft delete a student by marking status as DELETED.

        Args:
            student_id: The student's ID

        Returns:
            True if soft deleted, False if not found
        """
        student = await self.get(student_id)
        if not student:
            return False
        student.status = "DELETED"
        await self.session.flush()
        return True

    async def create(
        self,
        full_name: str,
        course_id: int,
        national_id: str | None = None,
        evidence_preference: str = "none",
        status: str = "ACTIVE",
    ) -> Student:
        """Create a new student.

        Args:
            full_name: Student's full name
            course_id: ID of the course/class
            national_id: Optional national ID (RUT)
            evidence_preference: Evidence type preference (photo/audio/none)
            status: Student status (default: ACTIVE)

        Returns:
            The created Student instance
        """
        student = Student(
            full_name=full_name,
            course_id=course_id,
            national_id=national_id,
            evidence_preference=evidence_preference,
            status=status,
        )
        self.session.add(student)
        await self.session.flush()
        await self.session.refresh(student)
        return student

    async def list_paginated(
        self,
        *,
        skip: int = 0,
        limit: int = 50,
        search: str | None = None,
        course_id: int | None = None,
        status: str | None = None,
        include_deleted: bool = False,
    ) -> tuple[list[Student], int]:
        """List students with pagination, search, and filters.

        Args:
            skip: Number of records to skip (offset)
            limit: Maximum number of records to return
            search: Search term for full_name or national_id (case-insensitive)
            course_id: Filter by course ID
            status: Filter by specific status (ACTIVE, INACTIVE, DELETED)
            include_deleted: If False (default), excludes DELETED students

        Returns:
            Tuple of (students list, total count)
        """
        # Base query
        base_query = select(Student)

        # Apply filters
        if course_id is not None:
            base_query = base_query.where(Student.course_id == course_id)

        # Exclude DELETED by default unless explicitly requested
        if not include_deleted:
            base_query = base_query.where(Student.status != "DELETED")

        if status is not None:
            base_query = base_query.where(Student.status == status)

        if search:
            search_term = f"%{search}%"
            base_query = base_query.where(
                func.lower(Student.full_name).like(func.lower(search_term))
                | (Student.national_id.ilike(search_term))
            )

        # Get total count
        count_query = select(func.count()).select_from(base_query.subquery())
        total_result = await self.session.execute(count_query)
        total = total_result.scalar() or 0

        # Get paginated results
        paginated_query = (
            base_query
            .order_by(Student.full_name)
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(paginated_query)
        students = list(result.scalars().all())

        return students, total

    async def count_all(self, status: str | None = "ACTIVE") -> int:
        """Count all students, optionally filtered by status."""
        query = select(func.count(Student.id))
        if status:
            query = query.where(Student.status == status)
        result = await self.session.execute(query)
        return result.scalar() or 0

    async def restore(self, student_id: int) -> bool:
        """Restore a soft-deleted student.

        Args:
            student_id: The student's ID

        Returns:
            True if restored, False if not found or not deleted
        """
        student = await self.get(student_id)
        if not student or student.status != "DELETED":
            return False
        student.status = "ACTIVE"
        await self.session.flush()
        return True

    async def get_active(self, student_id: int) -> Student | None:
        """Get a student only if not DELETED.

        Args:
            student_id: The student's ID

        Returns:
            Student if found and not deleted, None otherwise
        """
        student = await self.get(student_id)
        if student and student.status != "DELETED":
            return student
        return None

    async def fuzzy_search(self, query: str, *, limit: int = 20) -> list[Student]:
        """Fuzzy search students with ranking by relevance.

        Searches by name (case-insensitive) and national_id.
        Results are ranked with exact prefix matches first.

        Args:
            query: Search term
            limit: Maximum results (default 20)

        Returns:
            List of matching students, ordered by relevance
        """
        query_lower = query.lower()
        stmt = (
            select(Student)
            .where(
                or_(
                    func.lower(Student.full_name).contains(query_lower),
                    Student.national_id.ilike(f"%{query}%"),
                ),
                Student.status != "DELETED",
            )
            .order_by(
                # Prioridad 1: Match exacto al inicio
                case((func.lower(Student.full_name).startswith(query_lower), 1), else_=2),
                # Prioridad 2: Ordenar alfabéticamente
                Student.full_name,
            )
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_for_export(
        self,
        *,
        status: str | None = None,
        course_id: int | None = None,
        include_deleted: bool = False,
    ) -> list[Student]:
        """List all students for export (no pagination).

        Args:
            status: Filter by specific status
            course_id: Filter by course ID
            include_deleted: If True, includes DELETED students

        Returns:
            List of students with course and guardians loaded
        """
        stmt = select(Student).options(
            selectinload(Student.course),
            selectinload(Student.guardians),
        )

        if course_id is not None:
            stmt = stmt.where(Student.course_id == course_id)
        if not include_deleted:
            stmt = stmt.where(Student.status != "DELETED")
        if status is not None:
            stmt = stmt.where(Student.status == status)

        stmt = stmt.order_by(Student.full_name)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count_guardians(self, student_id: int) -> int:
        """Count guardians linked to a student.

        Args:
            student_id: The student's ID

        Returns:
            Number of guardians linked to the student
        """
        from app.db.models.associations import student_guardian_table

        stmt = select(func.count()).select_from(student_guardian_table).where(
            student_guardian_table.c.student_id == student_id
        )
        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def count_attendance_events(self, student_id: int) -> int:
        """Count attendance events for a student.

        Args:
            student_id: The student's ID

        Returns:
            Number of attendance events for the student
        """
        from app.db.models.attendance_event import AttendanceEvent

        stmt = select(func.count()).select_from(AttendanceEvent).where(
            AttendanceEvent.student_id == student_id
        )
        result = await self.session.execute(stmt)
        return result.scalar() or 0
