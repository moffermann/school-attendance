"""Authorized pickup repository for managing adults authorized to withdraw students."""

from __future__ import annotations

import secrets
from hashlib import sha256

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.authorized_pickup import AuthorizedPickup, student_authorized_pickup_table
from app.db.models.student import Student


class AuthorizedPickupRepository:
    """Repository for AuthorizedPickup CRUD operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, pickup_id: int) -> AuthorizedPickup | None:
        """Get authorized pickup by ID with students loaded."""
        stmt = (
            select(AuthorizedPickup)
            .options(selectinload(AuthorizedPickup.students))
            .where(AuthorizedPickup.id == pickup_id)
        )
        result = await self.session.execute(stmt)
        return result.scalars().unique().one_or_none()

    async def get_active(self, pickup_id: int) -> AuthorizedPickup | None:
        """Get pickup by ID only if active."""
        stmt = (
            select(AuthorizedPickup)
            .options(selectinload(AuthorizedPickup.students))
            .where(
                AuthorizedPickup.id == pickup_id,
                AuthorizedPickup.is_active == True,  # noqa: E712
            )
        )
        result = await self.session.execute(stmt)
        return result.scalars().unique().one_or_none()

    async def get_by_qr_hash(self, qr_hash: str) -> AuthorizedPickup | None:
        """Get active authorized pickup by QR code hash."""
        stmt = (
            select(AuthorizedPickup)
            .options(selectinload(AuthorizedPickup.students))
            .where(
                AuthorizedPickup.qr_code_hash == qr_hash,
                AuthorizedPickup.is_active == True,  # noqa: E712
            )
        )
        result = await self.session.execute(stmt)
        return result.scalars().unique().one_or_none()

    async def get_by_national_id(self, national_id: str) -> AuthorizedPickup | None:
        """Get authorized pickup by national ID (RUT/DNI)."""
        stmt = (
            select(AuthorizedPickup)
            .options(selectinload(AuthorizedPickup.students))
            .where(AuthorizedPickup.national_id == national_id)
        )
        result = await self.session.execute(stmt)
        return result.scalars().unique().one_or_none()

    async def create(
        self,
        full_name: str,
        relationship_type: str,
        *,
        national_id: str | None = None,
        phone: str | None = None,
        email: str | None = None,
        photo_url: str | None = None,
        created_by_user_id: int | None = None,
    ) -> AuthorizedPickup:
        """Create a new authorized pickup with a QR code hash."""
        print(f"[REPO] create() called with: full_name={full_name}, relationship_type={relationship_type}, national_id={national_id}")

        # Generate unique QR code hash
        qr_token = secrets.token_urlsafe(32)
        qr_hash = sha256(qr_token.encode()).hexdigest()[:64]

        pickup = AuthorizedPickup(
            full_name=full_name,
            relationship_type=relationship_type,
            national_id=national_id,
            phone=phone,
            email=email,
            photo_url=photo_url,
            qr_code_hash=qr_hash,
            created_by_user_id=created_by_user_id,
        )
        print(f"[REPO] AuthorizedPickup object created: national_id={pickup.national_id}")
        pickup.students = []  # Initialize to avoid lazy load issues
        self.session.add(pickup)
        await self.session.flush()
        print(f"[REPO] After flush: pickup.id={pickup.id}, pickup.national_id={pickup.national_id}")
        await self.session.refresh(pickup)
        print(f"[REPO] After refresh: pickup.id={pickup.id}, pickup.national_id={pickup.national_id}")
        return pickup

    async def update(self, pickup_id: int, **kwargs) -> AuthorizedPickup | None:
        """Update an authorized pickup's fields."""
        pickup = await self.get(pickup_id)
        if not pickup:
            return None
        for key, value in kwargs.items():
            if hasattr(pickup, key):
                setattr(pickup, key, value)
        await self.session.flush()
        return pickup

    async def deactivate(self, pickup_id: int) -> AuthorizedPickup | None:
        """Deactivate an authorized pickup (soft delete)."""
        pickup = await self.get(pickup_id)
        if not pickup:
            return None
        pickup.is_active = False
        await self.session.flush()
        return pickup

    async def activate(self, pickup_id: int) -> AuthorizedPickup | None:
        """Reactivate a deactivated pickup."""
        pickup = await self.get(pickup_id)
        if not pickup:
            return None
        pickup.is_active = True
        await self.session.flush()
        return pickup

    async def regenerate_qr(self, pickup_id: int) -> tuple[AuthorizedPickup, str] | None:
        """Regenerate QR code for an authorized pickup.

        Returns:
            Tuple of (pickup, qr_token) if found, None otherwise.
            The qr_token should be encoded in the QR image (shown once only).
        """
        pickup = await self.get(pickup_id)
        if not pickup:
            return None

        qr_token = secrets.token_urlsafe(32)
        qr_hash = sha256(qr_token.encode()).hexdigest()[:64]
        pickup.qr_code_hash = qr_hash
        await self.session.flush()
        return pickup, qr_token

    # -------------------------------------------------------------------------
    # Student association operations
    # -------------------------------------------------------------------------

    async def list_by_student(self, student_id: int) -> list[AuthorizedPickup]:
        """List all authorized pickups for a student."""
        stmt = (
            select(AuthorizedPickup)
            .options(selectinload(AuthorizedPickup.students))
            .join(AuthorizedPickup.students)
            .where(
                Student.id == student_id,
                AuthorizedPickup.is_active == True,  # noqa: E712
            )
            .order_by(AuthorizedPickup.full_name)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().unique().all())

    async def add_student(
        self,
        pickup_id: int,
        student_id: int,
        *,
        priority: int = 0,
        notes: str | None = None,
    ) -> bool:
        """Associate a student with an authorized pickup."""
        pickup = await self.get(pickup_id)
        if not pickup:
            return False

        student = await self.session.get(Student, student_id)
        if not student:
            return False

        # Check if already associated
        if student in pickup.students:
            return True

        pickup.students.append(student)
        await self.session.flush()

        # Update association table with extra fields if needed
        if priority != 0 or notes:
            stmt = (
                student_authorized_pickup_table.update()
                .where(
                    student_authorized_pickup_table.c.student_id == student_id,
                    student_authorized_pickup_table.c.authorized_pickup_id == pickup_id,
                )
                .values(priority=priority, notes=notes)
            )
            await self.session.execute(stmt)
            await self.session.flush()

        return True

    async def remove_student(self, pickup_id: int, student_id: int) -> bool:
        """Remove a student association from an authorized pickup."""
        pickup = await self.get(pickup_id)
        if not pickup:
            return False

        for student in pickup.students:
            if student.id == student_id:
                pickup.students.remove(student)
                await self.session.flush()
                return True
        return False

    async def set_students(self, pickup_id: int, student_ids: list[int]) -> bool:
        """Set the complete list of students for an authorized pickup."""
        print(f"[REPO] set_students() called: pickup_id={pickup_id}, student_ids={student_ids}")
        pickup = await self.get(pickup_id)
        if not pickup:
            print(f"[REPO] set_students: pickup not found!")
            return False

        print(f"[REPO] set_students: pickup found, current students={[s.id for s in pickup.students] if pickup.students else []}")

        if student_ids:
            stmt = select(Student).where(Student.id.in_(student_ids))
            result = await self.session.execute(stmt)
            students = list(result.scalars().all())
            print(f"[REPO] set_students: found {len(students)} students: {[s.id for s in students]}")
        else:
            students = []
            print(f"[REPO] set_students: no student_ids provided, setting empty list")

        pickup.students = students
        await self.session.flush()
        print(f"[REPO] set_students: after flush, pickup.students={[s.id for s in pickup.students]}")
        return True

    async def get_student_ids(self, pickup_id: int) -> list[int]:
        """Get list of student IDs associated with a pickup."""
        stmt = (
            select(student_authorized_pickup_table.c.student_id)
            .where(student_authorized_pickup_table.c.authorized_pickup_id == pickup_id)
        )
        result = await self.session.execute(stmt)
        return [row[0] for row in result.fetchall()]

    async def is_authorized_for_student(self, pickup_id: int, student_id: int) -> bool:
        """Check if pickup is authorized for a specific student."""
        stmt = (
            select(func.count())
            .select_from(student_authorized_pickup_table)
            .where(
                student_authorized_pickup_table.c.authorized_pickup_id == pickup_id,
                student_authorized_pickup_table.c.student_id == student_id,
            )
        )
        result = await self.session.execute(stmt)
        return (result.scalar() or 0) > 0

    # -------------------------------------------------------------------------
    # List and search operations
    # -------------------------------------------------------------------------

    async def list_all(self, *, include_inactive: bool = False, limit: int = 1000) -> list[AuthorizedPickup]:
        """List all authorized pickups."""
        stmt = (
            select(AuthorizedPickup)
            .options(selectinload(AuthorizedPickup.students))
            .order_by(AuthorizedPickup.full_name)
            .limit(limit)
        )
        if not include_inactive:
            stmt = stmt.where(AuthorizedPickup.is_active == True)  # noqa: E712
        result = await self.session.execute(stmt)
        return list(result.scalars().unique().all())

    async def list_paginated(
        self,
        *,
        skip: int = 0,
        limit: int = 50,
        search: str | None = None,
        include_inactive: bool = False,
    ) -> tuple[list[AuthorizedPickup], int]:
        """List authorized pickups with pagination."""
        base_query = select(AuthorizedPickup)

        if not include_inactive:
            base_query = base_query.where(AuthorizedPickup.is_active == True)  # noqa: E712

        if search:
            search_term = f"%{search}%"
            base_query = base_query.where(
                func.lower(AuthorizedPickup.full_name).like(func.lower(search_term))
                | (AuthorizedPickup.national_id.ilike(search_term))
            )

        # Get total count
        count_query = select(func.count()).select_from(base_query.subquery())
        total_result = await self.session.execute(count_query)
        total = total_result.scalar() or 0

        # Get paginated results
        paginated_query = (
            base_query.options(selectinload(AuthorizedPickup.students))
            .order_by(AuthorizedPickup.full_name)
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(paginated_query)
        pickups = list(result.scalars().unique().all())

        return pickups, total

    async def search(self, query: str, *, limit: int = 20) -> list[AuthorizedPickup]:
        """Search pickups by name or national ID."""
        stmt = (
            select(AuthorizedPickup)
            .options(selectinload(AuthorizedPickup.students))
            .where(
                AuthorizedPickup.is_active == True,  # noqa: E712
                func.lower(AuthorizedPickup.full_name).contains(query.lower())
                | (AuthorizedPickup.national_id.ilike(f"%{query}%")),
            )
            .order_by(AuthorizedPickup.full_name)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().unique().all())

    # -------------------------------------------------------------------------
    # Kiosk sync operations
    # -------------------------------------------------------------------------

    async def list_for_kiosk_sync(self, limit: int = 5000) -> list[dict]:
        """Get authorized pickups formatted for kiosk bootstrap sync.

        Returns a list of dicts with essential fields for offline verification.
        """
        stmt = (
            select(AuthorizedPickup)
            .options(selectinload(AuthorizedPickup.students))
            .where(AuthorizedPickup.is_active == True)  # noqa: E712
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        pickups = result.scalars().unique().all()

        return [
            {
                "id": p.id,
                "full_name": p.full_name,
                "relationship_type": p.relationship_type,
                "qr_code_hash": p.qr_code_hash,
                "photo_url": p.photo_url,
                "student_ids": [s.id for s in p.students],
            }
            for p in pickups
        ]
