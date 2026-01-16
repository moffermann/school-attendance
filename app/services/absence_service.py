"""Absence request management service.

Enterprise pattern implementation with:
- Role-based access control
- SQL-based filtering (no in-memory filtering)
- Audit logging with IP tracking
- Pagination support
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import TYPE_CHECKING

from fastapi import HTTPException, Request, UploadFile
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import AuditEvent, audit_log
from app.core.auth import AuthUser
from app.db.repositories.absences import AbsenceRepository
from app.db.repositories.guardians import GuardianRepository
from app.db.repositories.students import StudentRepository
from app.schemas.absences import (
    AbsenceCreate,
    AbsenceFilters,
    AbsenceRead,
    AbsenceRejectRequest,
    AbsenceRequestCreate,
    AbsenceStatsResponse,
    AbsenceStatus,
    PaginatedAbsences,
)

if TYPE_CHECKING:
    from app.core.deps import TenantAuthUser


class AbsenceService:
    """Service for managing absence requests with enterprise patterns."""

    # Roles que pueden ver todas las ausencias
    READ_ALL_ROLES = {"ADMIN", "DIRECTOR", "INSPECTOR"}
    # Roles que pueden aprobar/rechazar
    APPROVE_ROLES = {"ADMIN", "DIRECTOR", "INSPECTOR"}
    # Roles que pueden eliminar
    DELETE_ROLES = {"ADMIN", "DIRECTOR"}
    # Roles que pueden exportar
    EXPORT_ROLES = {"ADMIN", "DIRECTOR", "INSPECTOR"}

    def __init__(self, session: AsyncSession):
        self.session = session
        self.absence_repo = AbsenceRepository(session)
        self.student_repo = StudentRepository(session)
        self.guardian_repo = GuardianRepository(session)

    # -------------------------------------------------------------------------
    # Helpers de autorizacion
    # -------------------------------------------------------------------------

    async def _get_student_ids_for_user(
        self, user: "AuthUser | TenantAuthUser"
    ) -> list[int] | None:
        """Get student IDs accessible by user based on role.

        Returns:
            None: User can access ALL students (admin/director/inspector)
            list[int]: Specific student IDs the user can access
            []: Empty list means no access
        """
        if user.role in self.READ_ALL_ROLES:
            return None  # None = todos los estudiantes

        # PARENT: solo sus estudiantes vinculados via guardian
        if user.guardian_id:
            guardian = await self.guardian_repo.get(user.guardian_id)
            if guardian:
                return [s.id for s in guardian.students]

        return []  # Empty = sin acceso

    # -------------------------------------------------------------------------
    # Metodos legacy (mantener compatibilidad con codigo existente)
    # -------------------------------------------------------------------------

    async def submit_absence(
        self, user: AuthUser, payload: AbsenceRequestCreate
    ) -> object:
        """Legacy method: Submit absence request (backward compatible)."""
        student = await self.student_repo.get(payload.student_id)
        if not student:
            raise ValueError("Student not found")

        if payload.start > payload.end:
            raise ValueError("La fecha de fin debe ser mayor o igual a la de inicio")

        if user.role == "PARENT":
            if not user.guardian_id:
                raise PermissionError("Apoderado no asociado a un alumno")

            guardian = await self.guardian_repo.get(user.guardian_id)
            if not guardian:
                raise ValueError("Guardian not found")

            student_ids = {item.id for item in guardian.students}
            if payload.student_id not in student_ids:
                raise PermissionError("El alumno no pertenece al apoderado")

        submitted_at = datetime.now(timezone.utc)
        record = await self.absence_repo.create(
            student_id=payload.student_id,
            type_=payload.type.value,
            start_date=payload.start,
            end_date=payload.end,
            comment=payload.comment,
            attachment_ref=payload.attachment_name,
            submitted_at=submitted_at,
        )

        await self.session.commit()
        # Re-fetch instead of refresh to avoid detached instance issues
        record = await self.absence_repo.get(record.id)
        return record

    async def update_status(self, absence_id: int, status: AbsenceStatus) -> object:
        """Legacy method: Update status (backward compatible)."""
        record = await self.absence_repo.update_status(absence_id, status.value)
        await self.session.commit()
        return record

    # -------------------------------------------------------------------------
    # Listados (nuevo patron empresarial)
    # -------------------------------------------------------------------------

    async def list_absences(
        self,
        user: "AuthUser | TenantAuthUser",
        *,
        start_date: date | None = None,
        end_date: date | None = None,
        status: str | None = None,
    ) -> list:
        """Legacy list method with in-memory filtering (backward compatible).

        NOTE: Para nuevo codigo usar list_absences_paginated() que usa filtrado SQL.
        """
        # Staff roles can see all absence records
        if user.role in self.READ_ALL_ROLES:
            records = await self.absence_repo.list_all()
        # Parents can only see their own children's records
        elif not user.guardian_id:
            records = []
        else:
            guardian = await self.guardian_repo.get(user.guardian_id)
            if not guardian:
                records = []
            else:
                student_ids = [student.id for student in guardian.students]
                records = await self.absence_repo.list_by_student_ids(student_ids)

        # Filtrado in-memory (legacy - mantener por compatibilidad)
        if start_date:
            records = [r for r in records if r.start_date >= start_date]
        if end_date:
            records = [r for r in records if r.end_date <= end_date]
        if status:
            records = [r for r in records if (r.status or "").upper() == status.upper()]
        return records

    async def list_absences_paginated(
        self,
        user: "AuthUser | TenantAuthUser",
        filters: AbsenceFilters,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> PaginatedAbsences:
        """List absence requests with SQL filtering and pagination."""
        student_ids = await self._get_student_ids_for_user(user)

        # Si student_ids es lista vacia, no tiene acceso a ninguno
        if student_ids is not None and len(student_ids) == 0:
            return PaginatedAbsences.create(
                items=[],
                total=0,
                limit=limit,
                offset=offset,
                counts={},
            )

        # Aplicar filtro de curso si es necesario
        if filters.course_id:
            course_students = await self.student_repo.list_by_course(filters.course_id)
            course_student_ids = [s.id for s in course_students]
            if student_ids is None:
                student_ids = course_student_ids
            else:
                student_ids = [sid for sid in student_ids if sid in course_student_ids]

        items, total = await self.absence_repo.list_paginated(
            student_ids=student_ids,
            status=filters.status,
            absence_type=filters.type,
            start_date=filters.start_date,
            end_date=filters.end_date,
            limit=limit,
            offset=offset,
        )

        # Obtener contadores por estado (normalizar a minusculas para frontend)
        raw_counts = await self.absence_repo.count_by_status(student_ids)
        counts = {k.lower(): v for k, v in raw_counts.items()}

        # Convertir a schema con info adicional
        absence_reads = []
        for item in items:
            read = AbsenceRead(
                id=item.id,
                student_id=item.student_id,
                student_name=item.student.full_name if item.student else None,
                course_name=(
                    item.student.course.name
                    if item.student and hasattr(item.student, "course") and item.student.course
                    else None
                ),
                type=item.type,
                start_date=item.start_date,
                end_date=item.end_date,
                comment=item.comment,
                attachment_ref=item.attachment_ref,
                attachment_url=self._build_attachment_url(item.attachment_ref),
                status=item.status,
                rejection_reason=item.rejection_reason,
                ts_submitted=item.ts_submitted,
                ts_resolved=item.ts_resolved,
                created_at=item.created_at,
                updated_at=item.updated_at,
            )
            absence_reads.append(read)

        return PaginatedAbsences.create(
            items=absence_reads,
            total=total,
            limit=limit,
            offset=offset,
            counts=counts,
        )

    # -------------------------------------------------------------------------
    # CRUD individual
    # -------------------------------------------------------------------------

    async def get_absence(
        self,
        user: "AuthUser | TenantAuthUser",
        absence_id: int,
    ) -> AbsenceRead:
        """Get a single absence request by ID."""
        absence = await self.absence_repo.get(absence_id)
        if not absence:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada")

        # Verificar acceso
        student_ids = await self._get_student_ids_for_user(user)
        if student_ids is not None and absence.student_id not in student_ids:
            raise HTTPException(status_code=403, detail="Sin acceso a esta solicitud")

        return AbsenceRead(
            id=absence.id,
            student_id=absence.student_id,
            student_name=absence.student.full_name if absence.student else None,
            course_name=(
                absence.student.course.name
                if absence.student and hasattr(absence.student, "course") and absence.student.course
                else None
            ),
            type=absence.type,
            start_date=absence.start_date,
            end_date=absence.end_date,
            comment=absence.comment,
            attachment_ref=absence.attachment_ref,
            attachment_url=self._build_attachment_url(absence.attachment_ref),
            status=absence.status,
            rejection_reason=absence.rejection_reason,
            ts_submitted=absence.ts_submitted,
            ts_resolved=absence.ts_resolved,
            created_at=absence.created_at,
            updated_at=absence.updated_at,
        )

    async def create_absence(
        self,
        user: "AuthUser | TenantAuthUser",
        payload: AbsenceCreate,
        request: Request | None = None,
    ) -> AbsenceRead:
        """Create a new absence request."""
        # Verificar que el estudiante existe y es accesible
        student = await self.student_repo.get(payload.student_id)
        if not student:
            raise HTTPException(status_code=404, detail="Estudiante no encontrado")

        student_ids = await self._get_student_ids_for_user(user)
        if student_ids is not None and student.id not in student_ids:
            raise HTTPException(status_code=403, detail="Sin acceso a este estudiante")

        try:
            submitted_at = datetime.now(timezone.utc)
            absence = await self.absence_repo.create(
                student_id=payload.student_id,
                type_=payload.type.upper(),
                start_date=payload.start_date,
                end_date=payload.end_date,
                comment=payload.comment,
                attachment_ref=payload.attachment_ref,
                submitted_at=submitted_at,
            )
            await self.session.commit()
            # Re-fetch instead of refresh to avoid detached instance issues
            absence = await self.absence_repo.get(absence.id)

            ip_address = request.client.host if request and request.client else None
            audit_log(
                AuditEvent.ABSENCE_CREATED,
                user_id=user.id,
                ip_address=ip_address,
                resource_type="absence",
                resource_id=absence.id,
                details={
                    "student_id": payload.student_id,
                    "type": payload.type,
                    "start_date": str(payload.start_date),
                    "end_date": str(payload.end_date),
                },
            )

            return AbsenceRead(
                id=absence.id,
                student_id=absence.student_id,
                student_name=student.full_name,
                type=absence.type,
                start_date=absence.start_date,
                end_date=absence.end_date,
                comment=absence.comment,
                attachment_ref=absence.attachment_ref,
                status=absence.status,
                ts_submitted=absence.ts_submitted,
            )

        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error creating absence: {e}")
            raise

    async def delete_absence(
        self,
        user: "AuthUser | TenantAuthUser",
        absence_id: int,
        request: Request | None = None,
    ) -> dict:
        """Delete an absence request (only PENDING can be deleted)."""
        if user.role not in self.DELETE_ROLES:
            raise HTTPException(status_code=403, detail="Sin permisos para eliminar")

        absence = await self.absence_repo.get(absence_id)
        if not absence:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada")

        if absence.status != "PENDING":
            raise HTTPException(
                status_code=400,
                detail="Solo se pueden eliminar solicitudes pendientes",
            )

        try:
            student_id = absence.student_id
            deleted_absence = await self.absence_repo.delete(
                absence_id, deleted_by_id=user.id
            )
            await self.session.commit()

            ip_address = request.client.host if request and request.client else None
            audit_log(
                AuditEvent.ABSENCE_DELETED,
                user_id=user.id,
                ip_address=ip_address,
                resource_type="absence",
                resource_id=absence_id,
                details={
                    "student_id": student_id,
                    "soft_delete": True,
                    "deleted_by_id": user.id,
                },
            )

            return {"deleted": True, "id": absence_id}

        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error deleting absence: {e}")
            raise

    # -------------------------------------------------------------------------
    # Acciones de estado
    # -------------------------------------------------------------------------

    async def approve_absence(
        self,
        user: "AuthUser | TenantAuthUser",
        absence_id: int,
        request: Request | None = None,
    ) -> AbsenceRead:
        """Approve an absence request."""
        if user.role not in self.APPROVE_ROLES:
            raise HTTPException(status_code=403, detail="Sin permisos para aprobar")

        absence = await self.absence_repo.get(absence_id)
        if not absence:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada")

        if absence.status != "PENDING":
            raise HTTPException(
                status_code=400,
                detail=f"Solo se pueden aprobar solicitudes pendientes. Estado actual: {absence.status}",
            )

        try:
            absence = await self.absence_repo.approve(
                absence_id,
                resolved_by_id=user.id,
            )
            await self.session.commit()
            # Re-fetch instead of refresh to avoid detached instance issues
            absence = await self.absence_repo.get(absence_id)

            ip_address = request.client.host if request and request.client else None
            audit_log(
                AuditEvent.ABSENCE_APPROVED,
                user_id=user.id,
                ip_address=ip_address,
                resource_type="absence",
                resource_id=absence_id,
                details={
                    "student_id": absence.student_id,
                    "previous_status": "PENDING",
                },
            )

            return AbsenceRead(
                id=absence.id,
                student_id=absence.student_id,
                student_name=absence.student.full_name if absence.student else None,
                type=absence.type,
                start_date=absence.start_date,
                end_date=absence.end_date,
                comment=absence.comment,
                attachment_ref=absence.attachment_ref,
                status=absence.status,
                ts_submitted=absence.ts_submitted,
                ts_resolved=absence.ts_resolved,
            )

        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error approving absence: {e}")
            raise

    async def reject_absence(
        self,
        user: "AuthUser | TenantAuthUser",
        absence_id: int,
        payload: AbsenceRejectRequest,
        request: Request | None = None,
    ) -> AbsenceRead:
        """Reject an absence request with optional reason."""
        if user.role not in self.APPROVE_ROLES:
            raise HTTPException(status_code=403, detail="Sin permisos para rechazar")

        absence = await self.absence_repo.get(absence_id)
        if not absence:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada")

        if absence.status != "PENDING":
            raise HTTPException(
                status_code=400,
                detail=f"Solo se pueden rechazar solicitudes pendientes. Estado actual: {absence.status}",
            )

        try:
            absence = await self.absence_repo.reject(
                absence_id,
                resolved_by_id=user.id,
                rejection_reason=payload.rejection_reason,
            )
            await self.session.commit()
            # Re-fetch instead of refresh to avoid detached instance issues
            absence = await self.absence_repo.get(absence_id)

            ip_address = request.client.host if request and request.client else None
            audit_log(
                AuditEvent.ABSENCE_REJECTED,
                user_id=user.id,
                ip_address=ip_address,
                resource_type="absence",
                resource_id=absence_id,
                details={
                    "student_id": absence.student_id,
                    "rejection_reason": payload.rejection_reason,
                },
            )

            return AbsenceRead(
                id=absence.id,
                student_id=absence.student_id,
                student_name=absence.student.full_name if absence.student else None,
                type=absence.type,
                start_date=absence.start_date,
                end_date=absence.end_date,
                comment=absence.comment,
                attachment_ref=absence.attachment_ref,
                status=absence.status,
                rejection_reason=absence.rejection_reason,
                ts_submitted=absence.ts_submitted,
                ts_resolved=absence.ts_resolved,
            )

        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error rejecting absence: {e}")
            raise

    # -------------------------------------------------------------------------
    # Estadisticas y busqueda
    # -------------------------------------------------------------------------

    async def get_stats(
        self,
        user: "AuthUser | TenantAuthUser",
    ) -> AbsenceStatsResponse:
        """Get absence statistics (counts by status)."""
        student_ids = await self._get_student_ids_for_user(user)
        counts = await self.absence_repo.count_by_status(student_ids)

        return AbsenceStatsResponse(
            pending=counts.get("PENDING", 0),
            approved=counts.get("APPROVED", 0),
            rejected=counts.get("REJECTED", 0),
            total=sum(counts.values()),
        )

    async def search_absences(
        self,
        user: "AuthUser | TenantAuthUser",
        query: str,
        *,
        limit: int = 20,
    ) -> list[AbsenceRead]:
        """Search absences by student name or comment."""
        student_ids = await self._get_student_ids_for_user(user)
        items = await self.absence_repo.search(query, student_ids=student_ids, limit=limit)

        return [
            AbsenceRead(
                id=item.id,
                student_id=item.student_id,
                student_name=item.student.full_name if item.student else None,
                type=item.type,
                start_date=item.start_date,
                end_date=item.end_date,
                comment=item.comment,
                attachment_ref=item.attachment_ref,
                attachment_url=self._build_attachment_url(item.attachment_ref),
                status=item.status,
                ts_submitted=item.ts_submitted,
            )
            for item in items
        ]

    # -------------------------------------------------------------------------
    # Exportacion
    # -------------------------------------------------------------------------

    async def list_absences_for_export(
        self,
        user: "AuthUser | TenantAuthUser",
        filters: AbsenceFilters,
        request: Request | None = None,
    ) -> list[AbsenceRead]:
        """List all absences for CSV export."""
        if user.role not in self.EXPORT_ROLES:
            raise HTTPException(status_code=403, detail="Sin permisos para exportar")

        student_ids = await self._get_student_ids_for_user(user)

        items = await self.absence_repo.list_for_export(
            student_ids=student_ids,
            status=filters.status,
            start_date=filters.start_date,
            end_date=filters.end_date,
        )

        ip_address = request.client.host if request and request.client else None
        audit_log(
            AuditEvent.ABSENCE_EXPORTED,
            user_id=user.id,
            ip_address=ip_address,
            resource_type="absence",
            details={"count": len(items), "filters": filters.model_dump()},
        )

        return [
            AbsenceRead(
                id=item.id,
                student_id=item.student_id,
                student_name=item.student.full_name if item.student else None,
                course_name=(
                    item.student.course.name
                    if item.student and hasattr(item.student, "course") and item.student.course
                    else None
                ),
                type=item.type,
                start_date=item.start_date,
                end_date=item.end_date,
                comment=item.comment,
                attachment_ref=item.attachment_ref,
                status=item.status,
                rejection_reason=item.rejection_reason,
                ts_submitted=item.ts_submitted,
                ts_resolved=item.ts_resolved,
            )
            for item in items
        ]

    # -------------------------------------------------------------------------
    # Attachment upload
    # -------------------------------------------------------------------------

    async def upload_attachment(
        self,
        user: "AuthUser | TenantAuthUser",
        absence_id: int,
        file: UploadFile,
        request: Request | None = None,
    ) -> AbsenceRead:
        """Upload attachment for an absence request.

        Only the absence owner or admin roles can upload attachments.
        Only PENDING absences can have attachments uploaded.
        """
        from app.services.photo_service import PhotoService

        # Validar que la ausencia existe
        absence = await self.absence_repo.get(absence_id)
        if not absence:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada")

        # Verificar acceso - solo el dueño o admin puede subir
        student_ids = await self._get_student_ids_for_user(user)
        if student_ids is not None and absence.student_id not in student_ids:
            raise HTTPException(status_code=403, detail="Sin acceso a esta solicitud")

        # Solo se puede subir attachment a solicitudes pendientes
        if absence.status != "PENDING":
            raise HTTPException(
                status_code=400,
                detail="Solo se pueden adjuntar archivos a solicitudes pendientes",
            )

        # Validar tipo de archivo
        allowed_types = {"application/pdf", "image/jpeg", "image/png", "image/jpg"}
        content_type = file.content_type or "application/octet-stream"
        if content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"Tipo de archivo no permitido. Permitidos: PDF, JPG, PNG",
            )

        # Validar tamaño (max 5MB)
        max_size = 5 * 1024 * 1024  # 5MB
        content = await file.read()
        if len(content) > max_size:
            raise HTTPException(
                status_code=400,
                detail="El archivo excede el tamaño máximo de 5MB",
            )

        # Generar key unico para MinIO
        ext = file.filename.split(".")[-1] if file.filename and "." in file.filename else "bin"
        key = f"absences/{absence_id}/{uuid.uuid4()}.{ext}"

        # Subir a MinIO
        photo_service = PhotoService()
        try:
            await photo_service.store_photo(key, content, content_type)

            # Actualizar registro con el attachment_ref
            absence.attachment_ref = key
            await self.session.commit()
            # Re-fetch instead of refresh to avoid detached instance issues
            absence = await self.absence_repo.get(absence_id)

            ip_address = request.client.host if request and request.client else None
            audit_log(
                AuditEvent.ABSENCE_UPDATED,
                user_id=user.id,
                ip_address=ip_address,
                resource_type="absence",
                resource_id=absence_id,
                details={
                    "action": "attachment_uploaded",
                    "filename": file.filename,
                    "content_type": content_type,
                    "size_bytes": len(content),
                },
            )

            return AbsenceRead(
                id=absence.id,
                student_id=absence.student_id,
                student_name=absence.student.full_name if absence.student else None,
                type=absence.type,
                start_date=absence.start_date,
                end_date=absence.end_date,
                comment=absence.comment,
                attachment_ref=absence.attachment_ref,
                attachment_url=self._build_attachment_url(absence.attachment_ref),
                status=absence.status,
                ts_submitted=absence.ts_submitted,
            )

        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error uploading attachment: {e}")
            raise HTTPException(status_code=500, detail="Error al subir archivo")
        finally:
            photo_service.close()

    # -------------------------------------------------------------------------
    # Helpers
    # -------------------------------------------------------------------------

    def _build_attachment_url(self, attachment_ref: str | None) -> str | None:
        """Build URL for attachment (presigned URL or direct path)."""
        if not attachment_ref:
            return None
        from app.core.config import settings

        base_url = str(settings.public_base_url).rstrip("/")
        return f"{base_url}/api/v1/photos/{attachment_ref}"
