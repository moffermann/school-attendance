"""Course repository with full CRUD operations."""

from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.course import Course, CourseStatus
from app.db.models.enrollment import Enrollment
from app.db.models.schedule import Schedule
from app.db.models.student import Student


class CourseRepository:
    """Data access helpers for courses."""

    def __init__(self, session: AsyncSession):
        self.session = session

    # -------------------------------------------------------------------------
    # Read operations
    # -------------------------------------------------------------------------

    async def list_all(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
        include_deleted: bool = False,
        grade: str | None = None,
        status: str | None = None,
    ) -> list[Course]:
        """List courses with pagination and optional filters."""
        stmt = select(Course).order_by(Course.name)

        if not include_deleted and status is None:
            stmt = stmt.where(Course.status == CourseStatus.ACTIVE.value)
        elif status:
            stmt = stmt.where(Course.status == status)

        if grade:
            stmt = stmt.where(Course.grade == grade)

        stmt = stmt.offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count(
        self,
        *,
        include_deleted: bool = False,
        grade: str | None = None,
        status: str | None = None,
    ) -> int:
        """Count courses for pagination."""
        stmt = select(func.count(Course.id))

        if not include_deleted and status is None:
            stmt = stmt.where(Course.status == CourseStatus.ACTIVE.value)
        elif status:
            stmt = stmt.where(Course.status == status)

        if grade:
            stmt = stmt.where(Course.grade == grade)

        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def get(self, course_id: int) -> Course | None:
        """Get course by ID (any status)."""
        return await self.session.get(Course, course_id)

    async def get_active(self, course_id: int) -> Course | None:
        """Get course by ID only if ACTIVE."""
        stmt = select(Course).where(
            Course.id == course_id,
            Course.status == CourseStatus.ACTIVE.value,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_name(
        self, name: str, *, exclude_id: int | None = None
    ) -> Course | None:
        """Get active course by exact name (for uniqueness validation)."""
        stmt = select(Course).where(
            func.lower(Course.name) == name.lower(),
            Course.status == CourseStatus.ACTIVE.value,
        )
        if exclude_id:
            stmt = stmt.where(Course.id != exclude_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_with_details(self, course_id: int) -> Course | None:
        """Get course with eagerly loaded relationships."""
        stmt = (
            select(Course)
            .where(Course.id == course_id)
            .options(
                selectinload(Course.students),
                selectinload(Course.teachers),
                selectinload(Course.schedules),
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    # -------------------------------------------------------------------------
    # Write operations
    # -------------------------------------------------------------------------

    async def create(self, *, name: str, grade: str) -> Course:
        """Create a new course."""
        course = Course(
            name=name.strip(),
            grade=grade.strip(),
            status=CourseStatus.ACTIVE.value,
        )
        # Initialize relationships to avoid lazy-load issues in async context
        course.teachers = []
        course.students = []
        course.schedules = []
        self.session.add(course)
        await self.session.flush()
        return course

    async def update(
        self,
        course_id: int,
        *,
        name: str | None = None,
        grade: str | None = None,
    ) -> Course | None:
        """Update course fields."""
        course = await self.get(course_id)
        if not course:
            return None

        if name is not None:
            course.name = name.strip()
        if grade is not None:
            course.grade = grade.strip()

        await self.session.flush()
        return course

    async def soft_delete(self, course_id: int) -> Course | None:
        """Mark course as DELETED (soft delete)."""
        course = await self.get(course_id)
        if not course:
            return None

        course.status = CourseStatus.DELETED.value
        await self.session.flush()
        return course

    # -------------------------------------------------------------------------
    # Dependency validation (for delete)
    # -------------------------------------------------------------------------

    async def count_active_students(self, course_id: int) -> int:
        """Count students assigned to this course."""
        stmt = select(func.count(Student.id)).where(Student.course_id == course_id)
        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def count_schedules(self, course_id: int) -> int:
        """Count schedules associated with this course."""
        stmt = select(func.count(Schedule.id)).where(Schedule.course_id == course_id)
        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def count_active_enrollments(self, course_id: int) -> int:
        """Count enrollments for this course."""
        stmt = select(func.count(Enrollment.id)).where(
            Enrollment.course_id == course_id,
        )
        result = await self.session.execute(stmt)
        return result.scalar() or 0

    # -------------------------------------------------------------------------
    # Search operations
    # -------------------------------------------------------------------------

    async def search(self, query: str, *, limit: int = 20) -> list[Course]:
        """Basic search by name (exact contains)."""
        stmt = (
            select(Course)
            .where(
                Course.name.ilike(f"%{query}%"),
                Course.status == CourseStatus.ACTIVE.value,
            )
            .order_by(Course.name)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def fuzzy_search(self, query: str, *, limit: int = 20) -> list[Course]:
        """Fuzzy search with ILIKE and ranking.

        Searches in both name and grade fields, prioritizing matches
        where the name starts with the query.
        """
        query_lower = query.lower()
        stmt = (
            select(Course)
            .where(
                or_(
                    func.lower(Course.name).contains(query_lower),
                    func.lower(Course.grade).contains(query_lower),
                ),
                Course.status == CourseStatus.ACTIVE.value,
            )
            .order_by(
                # Prioritize exact matches at start
                case(
                    (func.lower(Course.name).startswith(query_lower), 1),
                    else_=2,
                ),
                Course.name,
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
        grade: str | None = None,
        status: str | None = None,
    ) -> list[Course]:
        """List all courses for CSV export (no pagination)."""
        stmt = select(Course).order_by(Course.grade, Course.name)

        if status:
            stmt = stmt.where(Course.status == status)
        else:
            stmt = stmt.where(Course.status == CourseStatus.ACTIVE.value)

        if grade:
            stmt = stmt.where(Course.grade == grade)

        result = await self.session.execute(stmt)
        return list(result.scalars().all())
