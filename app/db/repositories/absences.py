"""Repository for absence requests."""

from collections.abc import Iterable
from datetime import UTC, date, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.absence_request import AbsenceRequest
from app.db.models.student import Student


class AbsenceRepository:
    """Data access helpers for absence requests."""

    def __init__(self, session: AsyncSession):
        self.session = session

    # -------------------------------------------------------------------------
    # CRUD basico
    # -------------------------------------------------------------------------

    async def get(self, absence_id: int, include_deleted: bool = False) -> AbsenceRequest | None:
        """Get absence request by ID with student and course relationships loaded."""
        stmt = (
            select(AbsenceRequest)
            .options(selectinload(AbsenceRequest.student).selectinload(Student.course))
            .where(AbsenceRequest.id == absence_id)
        )
        if not include_deleted:
            stmt = stmt.where(AbsenceRequest.deleted_at.is_(None))
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def create(
        self,
        *,
        student_id: int,
        type_: str,
        start_date: date,
        end_date: date,
        comment: str | None,
        attachment_ref: str | None,
        submitted_at: datetime,
    ) -> AbsenceRequest:
        record = AbsenceRequest(
            student_id=student_id,
            type=type_,
            start_date=start_date,
            end_date=end_date,
            comment=comment,
            attachment_ref=attachment_ref,
            ts_submitted=submitted_at,
        )
        self.session.add(record)
        await self.session.flush()
        return record

    async def delete(self, absence_id: int, *, deleted_by_id: int) -> AbsenceRequest | None:
        """Soft delete an absence request (sets deleted_at timestamp)."""
        absence = await self.get(absence_id)
        if not absence:
            return None
        absence.deleted_at = datetime.now(UTC)
        absence.deleted_by_id = deleted_by_id
        await self.session.flush()
        return absence

    async def hard_delete(self, absence_id: int) -> bool:
        """Hard delete an absence request (use with caution, only for admin cleanup)."""
        absence = await self.get(absence_id, include_deleted=True)
        if not absence:
            return False
        await self.session.delete(absence)
        await self.session.flush()
        return True

    # -------------------------------------------------------------------------
    # Listados legacy (mantener compatibilidad)
    # -------------------------------------------------------------------------

    async def list_all(self) -> list[AbsenceRequest]:
        stmt = (
            select(AbsenceRequest)
            .where(AbsenceRequest.deleted_at.is_(None))
            .order_by(AbsenceRequest.ts_submitted.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_by_student_ids(self, student_ids: Iterable[int]) -> list[AbsenceRequest]:
        ids = list(student_ids)
        if not ids:
            return []
        stmt = (
            select(AbsenceRequest)
            .where(AbsenceRequest.student_id.in_(ids))
            .where(AbsenceRequest.deleted_at.is_(None))
            .order_by(AbsenceRequest.ts_submitted.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    # -------------------------------------------------------------------------
    # Listados con filtrado SQL (nuevo patron empresarial)
    # -------------------------------------------------------------------------

    async def list_paginated(
        self,
        *,
        student_ids: list[int] | None = None,
        status: str | None = None,
        absence_type: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[AbsenceRequest], int]:
        """List absences with SQL filtering and pagination."""
        stmt = (
            select(AbsenceRequest)
            .options(selectinload(AbsenceRequest.student).selectinload(Student.course))
            .where(AbsenceRequest.deleted_at.is_(None))
        )
        count_stmt = (
            select(func.count())
            .select_from(AbsenceRequest)
            .where(AbsenceRequest.deleted_at.is_(None))
        )

        # Filtros SQL (no in-memory)
        if student_ids is not None:
            stmt = stmt.where(AbsenceRequest.student_id.in_(student_ids))
            count_stmt = count_stmt.where(AbsenceRequest.student_id.in_(student_ids))
        if status:
            stmt = stmt.where(AbsenceRequest.status == status.upper())
            count_stmt = count_stmt.where(AbsenceRequest.status == status.upper())
        if absence_type:
            stmt = stmt.where(AbsenceRequest.type == absence_type.upper())
            count_stmt = count_stmt.where(AbsenceRequest.type == absence_type.upper())
        if start_date:
            stmt = stmt.where(AbsenceRequest.start_date >= start_date)
            count_stmt = count_stmt.where(AbsenceRequest.start_date >= start_date)
        if end_date:
            stmt = stmt.where(AbsenceRequest.end_date <= end_date)
            count_stmt = count_stmt.where(AbsenceRequest.end_date <= end_date)

        # Ordenamiento y paginacion
        stmt = stmt.order_by(AbsenceRequest.created_at.desc()).offset(offset).limit(limit)

        result = await self.session.execute(stmt)
        items = list(result.scalars().all())

        count_result = await self.session.execute(count_stmt)
        total = count_result.scalar() or 0

        return items, total

    async def list_for_export(
        self,
        *,
        student_ids: list[int] | None = None,
        status: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> list[AbsenceRequest]:
        """List all absences for export (no pagination)."""
        stmt = (
            select(AbsenceRequest)
            .options(selectinload(AbsenceRequest.student).selectinload(Student.course))
            .where(AbsenceRequest.deleted_at.is_(None))
        )

        if student_ids is not None:
            stmt = stmt.where(AbsenceRequest.student_id.in_(student_ids))
        if status:
            stmt = stmt.where(AbsenceRequest.status == status.upper())
        if start_date:
            stmt = stmt.where(AbsenceRequest.start_date >= start_date)
        if end_date:
            stmt = stmt.where(AbsenceRequest.end_date <= end_date)

        stmt = stmt.order_by(AbsenceRequest.start_date.desc())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    # -------------------------------------------------------------------------
    # Estadisticas
    # -------------------------------------------------------------------------

    async def count_by_status(
        self,
        student_ids: list[int] | None = None,
    ) -> dict[str, int]:
        """Count absences grouped by status (excludes soft-deleted)."""
        stmt = (
            select(
                AbsenceRequest.status,
                func.count().label("total"),
            )
            .where(AbsenceRequest.deleted_at.is_(None))
            .group_by(AbsenceRequest.status)
        )

        if student_ids is not None:
            stmt = stmt.where(AbsenceRequest.student_id.in_(student_ids))

        result = await self.session.execute(stmt)
        return {row.status: row.total for row in result.all()}

    # -------------------------------------------------------------------------
    # Busqueda
    # -------------------------------------------------------------------------

    async def search(
        self,
        query: str,
        *,
        student_ids: list[int] | None = None,
        limit: int = 20,
    ) -> list[AbsenceRequest]:
        """Search absences by student name or comment (excludes soft-deleted)."""
        stmt = (
            select(AbsenceRequest)
            .join(AbsenceRequest.student)
            .where(AbsenceRequest.deleted_at.is_(None))
            .where(
                or_(
                    func.lower(Student.full_name).contains(query.lower()),
                    func.lower(AbsenceRequest.comment).contains(query.lower()),
                )
            )
            .options(selectinload(AbsenceRequest.student).selectinload(Student.course))
            .order_by(AbsenceRequest.created_at.desc())
            .limit(limit)
        )

        if student_ids is not None:
            stmt = stmt.where(AbsenceRequest.student_id.in_(student_ids))

        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    # -------------------------------------------------------------------------
    # Acciones de estado
    # -------------------------------------------------------------------------

    async def update_status(self, absence_id: int, status: str) -> AbsenceRequest:
        """Update status (legacy method for backward compatibility)."""
        record = await self.session.get(AbsenceRequest, absence_id)
        if record is None:
            raise ValueError("Solicitud no encontrada")
        record.status = status
        await self.session.flush()
        return record

    async def approve(
        self,
        absence_id: int,
        *,
        resolved_by_id: int,
    ) -> AbsenceRequest | None:
        """Approve an absence request."""
        absence = await self.get(absence_id)
        if not absence or absence.status != "PENDING":
            return None

        absence.status = "APPROVED"
        absence.ts_resolved = datetime.now(UTC)
        absence.resolved_by_id = resolved_by_id
        await self.session.flush()
        return absence

    async def reject(
        self,
        absence_id: int,
        *,
        resolved_by_id: int,
        rejection_reason: str | None = None,
    ) -> AbsenceRequest | None:
        """Reject an absence request."""
        absence = await self.get(absence_id)
        if not absence or absence.status != "PENDING":
            return None

        absence.status = "REJECTED"
        absence.ts_resolved = datetime.now(UTC)
        absence.resolved_by_id = resolved_by_id
        absence.rejection_reason = rejection_reason
        await self.session.flush()
        return absence
