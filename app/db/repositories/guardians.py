"""Guardian repository."""

from typing import Any

from sqlalchemy import case, delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.guardian import Guardian
from app.db.models.student import Student
from app.db.models.associations import student_guardian_table


class GuardianRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, guardian_id: int) -> Guardian | None:
        stmt = (
            select(Guardian)
            .options(selectinload(Guardian.students))
            .where(Guardian.id == guardian_id)
        )
        result = await self.session.execute(stmt)
        return result.scalars().unique().one_or_none()

    async def get_active(self, guardian_id: int) -> Guardian | None:
        """Get guardian by ID only if not DELETED."""
        stmt = (
            select(Guardian)
            .options(selectinload(Guardian.students))
            .where(
                Guardian.id == guardian_id,
                Guardian.status != "DELETED",
            )
        )
        result = await self.session.execute(stmt)
        return result.scalars().unique().one_or_none()

    async def save(self, guardian: Guardian) -> Guardian:
        self.session.add(guardian)
        await self.session.flush()
        return guardian

    async def list_by_student_ids(self, student_ids: list[int]) -> list[Guardian]:
        if not student_ids:
            return []
        stmt = (
            select(Guardian)
            .options(selectinload(Guardian.students))
            .join(Guardian.students)
            .where(Student.id.in_(student_ids))
        )
        result = await self.session.execute(stmt)
        # R5-B4 fix: Use .unique() to properly handle duplicates from joined results
        guardians = result.scalars().unique().all()
        return list(guardians)

    async def list_all(self, limit: int = 5000, *, include_deleted: bool = False) -> list[Guardian]:
        """R7-B8 fix: Add limit parameter to prevent OOM on large deployments."""
        stmt = select(Guardian).options(selectinload(Guardian.students))
        if not include_deleted:
            stmt = stmt.where(Guardian.status != "DELETED")
        stmt = stmt.limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create(
        self,
        full_name: str,
        contacts: dict[str, Any] | None = None,
        notification_prefs: dict[str, Any] | None = None,
    ) -> Guardian:
        """Create a new guardian.

        Args:
            full_name: Guardian's full name
            contacts: Contact information (email, phone, whatsapp)
            notification_prefs: Notification preferences

        Returns:
            The created Guardian instance
        """
        guardian = Guardian(
            full_name=full_name,
            contacts=contacts or {},
            notification_prefs=notification_prefs or {},
        )
        guardian.students = []  # Initialize to avoid lazy load issues
        self.session.add(guardian)
        await self.session.flush()
        await self.session.refresh(guardian)
        return guardian

    async def update(self, guardian_id: int, **kwargs) -> Guardian | None:
        """Update a guardian's fields.

        Args:
            guardian_id: The guardian's ID
            **kwargs: Fields to update (full_name, contacts, notification_prefs)

        Returns:
            Updated Guardian or None if not found
        """
        guardian = await self.get(guardian_id)
        if not guardian:
            return None
        for key, value in kwargs.items():
            if hasattr(guardian, key):
                setattr(guardian, key, value)
        await self.session.flush()
        return guardian

    async def delete(self, guardian_id: int) -> bool:
        """Delete a guardian by ID.

        Args:
            guardian_id: The guardian's ID

        Returns:
            True if deleted, False if not found
        """
        guardian = await self.get(guardian_id)
        if not guardian:
            return False
        await self.session.delete(guardian)
        await self.session.flush()
        return True

    async def list_paginated(
        self,
        *,
        skip: int = 0,
        limit: int = 50,
        search: str | None = None,
        status: str | None = None,
        include_deleted: bool = False,
    ) -> tuple[list[Guardian], int]:
        """List guardians with pagination and search.

        Args:
            skip: Number of records to skip (offset)
            limit: Maximum number of records to return
            search: Search term for full_name (case-insensitive)
            status: Filter by specific status
            include_deleted: Include DELETED guardians

        Returns:
            Tuple of (guardians list, total count)
        """
        # Base query
        base_query = select(Guardian)

        # Apply status filter
        if status:
            base_query = base_query.where(Guardian.status == status)
        elif not include_deleted:
            base_query = base_query.where(Guardian.status != "DELETED")

        # Apply search filter
        if search:
            search_term = f"%{search}%"
            base_query = base_query.where(
                func.lower(Guardian.full_name).like(func.lower(search_term))
            )

        # Get total count
        count_query = select(func.count()).select_from(base_query.subquery())
        total_result = await self.session.execute(count_query)
        total = total_result.scalar() or 0

        # Get paginated results with students eagerly loaded
        paginated_query = (
            base_query
            .options(selectinload(Guardian.students))
            .order_by(Guardian.full_name)
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(paginated_query)
        guardians = list(result.scalars().unique().all())

        return guardians, total

    async def add_student(self, guardian_id: int, student_id: int) -> bool:
        """Associate a student with a guardian.

        Args:
            guardian_id: The guardian's ID
            student_id: The student's ID

        Returns:
            True if association created, False if guardian not found
        """
        guardian = await self.get(guardian_id)
        if not guardian:
            return False

        # Check if student exists
        student = await self.session.get(Student, student_id)
        if not student:
            return False

        # Check if association already exists
        if student in guardian.students:
            return True  # Already associated

        guardian.students.append(student)
        await self.session.flush()
        return True

    async def remove_student(self, guardian_id: int, student_id: int) -> bool:
        """Remove a student association from a guardian.

        Args:
            guardian_id: The guardian's ID
            student_id: The student's ID

        Returns:
            True if removed, False if not found
        """
        guardian = await self.get(guardian_id)
        if not guardian:
            return False

        # Find and remove the student
        for student in guardian.students:
            if student.id == student_id:
                guardian.students.remove(student)
                await self.session.flush()
                return True

        return False

    async def set_students(self, guardian_id: int, student_ids: list[int]) -> bool:
        """Set the complete list of students for a guardian.

        Replaces all existing associations with the new list.

        Args:
            guardian_id: The guardian's ID
            student_ids: List of student IDs to associate

        Returns:
            True if successful, False if guardian not found
        """
        guardian = await self.get(guardian_id)
        if not guardian:
            return False

        # Get all students by IDs
        if student_ids:
            stmt = select(Student).where(Student.id.in_(student_ids))
            result = await self.session.execute(stmt)
            students = list(result.scalars().all())
        else:
            students = []

        # Replace all associations
        guardian.students = students
        await self.session.flush()
        return True

    # -------------------------------------------------------------------------
    # Soft delete operations
    # -------------------------------------------------------------------------

    async def soft_delete(self, guardian_id: int) -> Guardian | None:
        """Mark guardian as DELETED (soft delete)."""
        guardian = await self.get(guardian_id)
        if not guardian:
            return None

        guardian.status = "DELETED"
        await self.session.flush()
        return guardian

    async def restore(self, guardian_id: int) -> Guardian | None:
        """Restore a DELETED guardian to ACTIVE status."""
        guardian = await self.get(guardian_id)
        if not guardian:
            return None

        guardian.status = "ACTIVE"
        await self.session.flush()
        return guardian

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
        """Count guardians for pagination."""
        stmt = select(func.count(Guardian.id))

        if status:
            stmt = stmt.where(Guardian.status == status)
        elif not include_deleted:
            stmt = stmt.where(Guardian.status != "DELETED")

        if search:
            search_term = f"%{search}%"
            stmt = stmt.where(
                func.lower(Guardian.full_name).like(func.lower(search_term))
            )

        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def count_students(self, guardian_id: int) -> int:
        """Count students associated with this guardian."""
        guardian = await self.get(guardian_id)
        if not guardian:
            return 0
        return len(guardian.students)

    # -------------------------------------------------------------------------
    # Search operations
    # -------------------------------------------------------------------------

    async def search(self, query: str, *, limit: int = 20) -> list[Guardian]:
        """Basic search by name (exact contains)."""
        stmt = (
            select(Guardian)
            .options(selectinload(Guardian.students))
            .where(
                Guardian.full_name.ilike(f"%{query}%"),
                Guardian.status != "DELETED",
            )
            .order_by(Guardian.full_name)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().unique().all())

    async def fuzzy_search(self, query: str, *, limit: int = 20) -> list[Guardian]:
        """Fuzzy search with ILIKE and ranking.

        Searches in full_name field, prioritizing matches
        where the name starts with the query.
        """
        query_lower = query.lower()
        stmt = (
            select(Guardian)
            .options(selectinload(Guardian.students))
            .where(
                func.lower(Guardian.full_name).contains(query_lower),
                Guardian.status != "DELETED",
            )
            .order_by(
                # Prioritize exact matches at start
                case(
                    (func.lower(Guardian.full_name).startswith(query_lower), 1),
                    else_=2,
                ),
                Guardian.full_name,
            )
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().unique().all())

    # -------------------------------------------------------------------------
    # Export operations
    # -------------------------------------------------------------------------

    async def list_for_export(
        self,
        *,
        status: str | None = None,
    ) -> list[Guardian]:
        """List all guardians for CSV export (no pagination)."""
        stmt = (
            select(Guardian)
            .options(selectinload(Guardian.students))
            .order_by(Guardian.full_name)
        )

        if status:
            stmt = stmt.where(Guardian.status == status)
        else:
            stmt = stmt.where(Guardian.status != "DELETED")

        result = await self.session.execute(stmt)
        return list(result.scalars().unique().all())
