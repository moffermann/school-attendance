"""Service layer for student management."""

from __future__ import annotations

import logging
import uuid
from typing import TYPE_CHECKING, Any

from fastapi import HTTPException, Request, status

from app.core.audit import AuditEvent, audit_log
from app.db.repositories.courses import CourseRepository
from app.db.repositories.students import StudentRepository
from app.schemas.students import (
    PaginatedStudents,
    StudentCreate,
    StudentDeleteResponse,
    StudentFilters,
    StudentRead,
    StudentUpdate,
    StudentWithStats,
)
from app.services.photo_service import PhotoService

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.core.deps import TenantAuthUser

logger = logging.getLogger(__name__)


class StudentService:
    """Business logic for student management."""

    # Roles that can create/update/delete students
    WRITE_ROLES = {"ADMIN", "DIRECTOR"}
    # Roles that can list and view students
    READ_ROLES = {"ADMIN", "DIRECTOR", "INSPECTOR"}
    # Roles that can export students
    EXPORT_ROLES = {"ADMIN", "DIRECTOR", "INSPECTOR"}

    def __init__(self, session: "AsyncSession"):
        self.session = session
        self.student_repo = StudentRepository(session)
        self.course_repo = CourseRepository(session)
        self.photo_service = PhotoService()

    # -------------------------------------------------------------------------
    # List operations
    # -------------------------------------------------------------------------

    async def list_students(
        self,
        user: "TenantAuthUser",
        filters: StudentFilters,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> PaginatedStudents:
        """List students with pagination and filters."""
        if user.role not in self.READ_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para ver estudiantes",
            )

        # If status is DELETED, include deleted students
        include_deleted = filters.status == "DELETED" or filters.include_deleted

        students, total = await self.student_repo.list_paginated(
            skip=offset,
            limit=limit,
            search=filters.search,
            course_id=filters.course_id,
            status=filters.status,
            include_deleted=include_deleted,
        )

        items = [StudentRead.model_validate(s) for s in students]

        return PaginatedStudents.create(
            items=items,
            total=total,
            limit=limit,
            offset=offset,
        )

    async def list_students_for_export(
        self,
        user: "TenantAuthUser",
        filters: StudentFilters,
        request: Request | None = None,
    ) -> list[StudentWithStats]:
        """List all students for CSV export with statistics."""
        if user.role not in self.EXPORT_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para exportar estudiantes",
            )

        students = await self.student_repo.list_for_export(
            status=filters.status,
            course_id=filters.course_id,
            include_deleted=filters.include_deleted,
        )

        result = []
        for student in students:
            # Get counts for each student
            guardians_count = await self.student_repo.count_guardians(student.id)
            attendance_count = await self.student_repo.count_attendance_events(student.id)
            course_name = student.course.name if student.course else None

            result.append(
                StudentWithStats(
                    id=student.id,
                    full_name=student.full_name,
                    national_id=student.national_id,
                    course_id=student.course_id,
                    status=student.status,
                    photo_url=student.photo_url,
                    evidence_preference=student.evidence_preference or "none",
                    created_at=student.created_at,
                    updated_at=student.updated_at,
                    course_name=course_name,
                    guardians_count=guardians_count,
                    attendance_events_count=attendance_count,
                    last_attendance_date=None,  # Could be added later
                    has_photo=bool(student.photo_url),
                )
            )

        # Audit log
        client_ip = request.client.host if request and request.client else None
        audit_log(
            AuditEvent.STUDENT_EXPORTED,
            user_id=user.id,
            ip_address=client_ip,
            resource_type="student",
            details={"count": len(result), "filters": filters.model_dump()},
        )

        return result

    # -------------------------------------------------------------------------
    # Get operations
    # -------------------------------------------------------------------------

    async def get_student_detail(
        self,
        user: "TenantAuthUser",
        student_id: int,
        request: Request | None = None,
    ) -> StudentWithStats:
        """Get student detail with statistics."""
        if user.role not in self.READ_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para ver estudiantes",
            )

        student = await self.student_repo.get_with_course(student_id)
        if not student or student.status == "DELETED":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Estudiante no encontrado",
            )

        guardians_count = await self.student_repo.count_guardians(student_id)
        attendance_count = await self.student_repo.count_attendance_events(student_id)
        course_name = student.course.name if student.course else None

        return StudentWithStats(
            id=student.id,
            full_name=student.full_name,
            national_id=student.national_id,
            course_id=student.course_id,
            status=student.status,
            photo_url=student.photo_url,
            evidence_preference=student.evidence_preference or "none",
            created_at=student.created_at,
            updated_at=student.updated_at,
            course_name=course_name,
            guardians_count=guardians_count,
            attendance_events_count=attendance_count,
            last_attendance_date=None,
            has_photo=bool(student.photo_url),
        )

    # -------------------------------------------------------------------------
    # Create operations
    # -------------------------------------------------------------------------

    async def create_student(
        self,
        user: "TenantAuthUser",
        payload: StudentCreate,
        request: Request | None = None,
    ) -> StudentRead:
        """Create a new student."""
        # 1. Validate permissions
        if user.role not in self.WRITE_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para crear estudiantes",
            )

        # 2. Validate course exists
        course = await self.course_repo.get_active(payload.course_id)
        if not course:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Curso con ID {payload.course_id} no encontrado o inactivo",
            )

        try:
            # 3. Create student
            student = await self.student_repo.create(
                full_name=payload.full_name,
                course_id=payload.course_id,
                national_id=payload.national_id,
                evidence_preference=payload.evidence_preference,
                status=payload.status,
            )

            # 4. Commit and get fresh instance
            await self.session.commit()
            # Re-fetch instead of refresh to avoid detached instance issues
            created_student = await self.student_repo.get(student.id)
            assert created_student is not None, "Student should exist after creation"

            # 5. Audit log with IP
            client_ip = request.client.host if request and request.client else None
            audit_log(
                AuditEvent.STUDENT_CREATED,
                user_id=user.id,
                ip_address=client_ip,
                resource_type="student",
                resource_id=created_student.id,
                details={
                    "full_name": created_student.full_name,
                    "course_id": created_student.course_id,
                    "national_id": created_student.national_id,
                },
            )

            return StudentRead.model_validate(created_student)

        except HTTPException:
            await self.session.rollback()
            raise
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Failed to create student: {e}")
            raise

    # -------------------------------------------------------------------------
    # Update operations
    # -------------------------------------------------------------------------

    async def update_student(
        self,
        user: "TenantAuthUser",
        student_id: int,
        payload: StudentUpdate,
        request: Request | None = None,
    ) -> StudentRead:
        """Update student information."""
        # 1. Validate permissions
        if user.role not in self.WRITE_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para editar estudiantes",
            )

        # 2. Validate student exists
        student = await self.student_repo.get(student_id)
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Estudiante no encontrado",
            )

        if student.status == "DELETED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede editar un estudiante eliminado",
            )

        # 3. Validate course if changing
        if payload.course_id and payload.course_id != student.course_id:
            course = await self.course_repo.get_active(payload.course_id)
            if not course:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Curso con ID {payload.course_id} no encontrado o inactivo",
                )

        try:
            # 4. Track changes for audit
            changes: dict[str, Any] = {}
            if payload.full_name and payload.full_name != student.full_name:
                changes["full_name"] = {"old": student.full_name, "new": payload.full_name}
            if payload.national_id is not None and payload.national_id != student.national_id:
                changes["national_id"] = {"old": student.national_id, "new": payload.national_id}
            if payload.course_id and payload.course_id != student.course_id:
                changes["course_id"] = {"old": student.course_id, "new": payload.course_id}
            if payload.evidence_preference and payload.evidence_preference != student.evidence_preference:
                changes["evidence_preference"] = {"old": student.evidence_preference, "new": payload.evidence_preference}
            if payload.status and payload.status != student.status:
                changes["status"] = {"old": student.status, "new": payload.status}

            # 5. Update student
            update_data: dict[str, Any] = {}
            if payload.full_name is not None:
                update_data["full_name"] = payload.full_name
            if payload.national_id is not None:
                update_data["national_id"] = payload.national_id
            if payload.course_id is not None:
                update_data["course_id"] = payload.course_id
            if payload.evidence_preference is not None:
                update_data["evidence_preference"] = payload.evidence_preference
            if payload.status is not None:
                update_data["status"] = payload.status

            if update_data:
                updated = await self.student_repo.update(student_id, **update_data)
            else:
                updated = student

            # 6. Commit and get fresh instance
            await self.session.commit()
            # Re-fetch instead of refresh to avoid detached instance issues
            updated_student = await self.student_repo.get(student_id)
            assert updated_student is not None, "Student should exist after update"

            # 7. Audit log with IP (only if there were changes)
            if changes:
                client_ip = request.client.host if request and request.client else None
                audit_log(
                    AuditEvent.STUDENT_UPDATED,
                    user_id=user.id,
                    ip_address=client_ip,
                    resource_type="student",
                    resource_id=student_id,
                    details={"changes": changes},
                )

            return StudentRead.model_validate(updated_student)

        except HTTPException:
            await self.session.rollback()
            raise
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Failed to update student {student_id}: {e}")
            raise

    # -------------------------------------------------------------------------
    # Delete operations
    # -------------------------------------------------------------------------

    async def delete_student(
        self,
        user: "TenantAuthUser",
        student_id: int,
        request: Request | None = None,
    ) -> StudentDeleteResponse:
        """Soft delete student with dependency warnings."""
        # 1. Validate permissions
        if user.role not in self.WRITE_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para eliminar estudiantes",
            )

        # 2. Validate student exists
        student = await self.student_repo.get(student_id)
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Estudiante no encontrado",
            )

        if student.status == "DELETED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El estudiante ya está eliminado",
            )

        # 3. Check dependencies and generate warnings
        attendance_count = await self.student_repo.count_attendance_events(student_id)
        guardians_count = await self.student_repo.count_guardians(student_id)

        warnings = []
        if attendance_count > 0:
            warnings.append(f"El estudiante tiene {attendance_count} registros de asistencia")
        if guardians_count > 0:
            warnings.append(f"El estudiante está vinculado a {guardians_count} apoderado(s)")

        try:
            # 4. Soft delete
            student_name = student.full_name
            await self.student_repo.soft_delete(student_id)

            # 5. Commit
            await self.session.commit()

            # 6. Audit log with IP
            client_ip = request.client.host if request and request.client else None
            audit_log(
                AuditEvent.STUDENT_DELETED,
                user_id=user.id,
                ip_address=client_ip,
                resource_type="student",
                resource_id=student_id,
                details={
                    "student_name": student_name,
                    "warnings": warnings,
                    "attendance_events": attendance_count,
                    "guardians": guardians_count,
                },
            )

            return StudentDeleteResponse(deleted=True, warnings=warnings)

        except Exception as e:
            await self.session.rollback()
            logger.error(f"Failed to delete student {student_id}: {e}")
            raise

    async def restore_student(
        self,
        user: "TenantAuthUser",
        student_id: int,
        request: Request | None = None,
    ) -> StudentRead:
        """Restore a deleted student."""
        # 1. Validate permissions
        if user.role not in self.WRITE_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para restaurar estudiantes",
            )

        # 2. Validate student exists
        student = await self.student_repo.get(student_id)
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Estudiante no encontrado",
            )

        if student.status != "DELETED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El estudiante no está eliminado",
            )

        try:
            # 3. Restore
            await self.student_repo.restore(student_id)

            # 4. Commit and get fresh instance
            await self.session.commit()
            # Re-fetch instead of refresh to avoid detached instance issues
            student = await self.student_repo.get(student_id)

            # 5. Audit log with IP
            client_ip = request.client.host if request and request.client else None
            audit_log(
                AuditEvent.STUDENT_UPDATED,
                user_id=user.id,
                ip_address=client_ip,
                resource_type="student",
                resource_id=student_id,
                details={"action": "restored", "old_status": "DELETED", "new_status": "ACTIVE"},
            )

            return StudentRead.model_validate(student)

        except Exception as e:
            await self.session.rollback()
            logger.error(f"Failed to restore student {student_id}: {e}")
            raise

    # -------------------------------------------------------------------------
    # Search operations
    # -------------------------------------------------------------------------

    async def search_students(
        self,
        user: "TenantAuthUser",
        query: str,
        *,
        limit: int = 20,
        fuzzy: bool = False,
    ) -> list[StudentRead]:
        """Search students by name/national_id."""
        if user.role not in self.READ_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para buscar estudiantes",
            )

        if fuzzy:
            students = await self.student_repo.fuzzy_search(query, limit=limit)
        else:
            # Use list_paginated with search for non-fuzzy search
            students, _ = await self.student_repo.list_paginated(
                skip=0,
                limit=limit,
                search=query,
            )

        return [StudentRead.model_validate(s) for s in students]

    # -------------------------------------------------------------------------
    # Photo operations
    # -------------------------------------------------------------------------

    async def upload_photo(
        self,
        user: "TenantAuthUser",
        student_id: int,
        content: bytes,
        content_type: str,
        request: Request | None = None,
    ) -> StudentRead:
        """Upload student photo with audit logging.

        Note: HEIC conversion should be done in the endpoint before calling this method.
        This method receives already-processed content and content_type.
        """
        if user.role not in self.WRITE_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para subir fotos",
            )

        student = await self.student_repo.get_active(student_id)
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Estudiante no encontrado",
            )

        try:
            # Delete old photo if exists
            old_photo = student.photo_url
            if old_photo:
                try:
                    await self.photo_service.delete_photo(old_photo)
                    logger.info(f"Deleted old photo for student {student_id}: {old_photo}")
                except Exception as e:
                    logger.warning(f"Failed to delete old photo for student {student_id}: {e}")

            # Generate unique key and store new photo
            extension = content_type.split("/")[-1]
            if extension == "jpeg":
                extension = "jpg"
            photo_key = f"students/{student_id}/profile_{uuid.uuid4().hex[:8]}.{extension}"

            await self.photo_service.store_photo(photo_key, content, content_type)
            await self.student_repo.update_photo_url(student_id, photo_key)
            await self.session.commit()
            # Re-fetch instead of refresh to avoid detached instance issues
            student = await self.student_repo.get(student_id)

            # Audit log
            client_ip = request.client.host if request and request.client else None
            audit_log(
                AuditEvent.STUDENT_UPDATED,
                user_id=user.id,
                ip_address=client_ip,
                resource_type="student",
                resource_id=student_id,
                details={
                    "action": "photo_uploaded",
                    "old_photo": old_photo,
                    "new_photo": photo_key,
                },
            )

            logger.info(f"Uploaded photo for student {student_id}: {photo_key}")
            return StudentRead.model_validate(student)

        except HTTPException:
            await self.session.rollback()
            raise
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Failed to upload photo for student {student_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al subir la foto",
            ) from e

    async def delete_photo(
        self,
        user: "TenantAuthUser",
        student_id: int,
        request: Request | None = None,
    ) -> StudentRead:
        """Delete student photo with audit logging."""
        if user.role not in self.WRITE_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para eliminar fotos",
            )

        student = await self.student_repo.get_active(student_id)
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Estudiante no encontrado",
            )

        if not student.photo_url:
            return StudentRead.model_validate(student)

        try:
            old_photo = student.photo_url
            await self.photo_service.delete_photo(old_photo)
            await self.student_repo.update_photo_url(student_id, None)
            await self.session.commit()
            # Re-fetch instead of refresh to avoid detached instance issues
            student = await self.student_repo.get(student_id)

            # Audit log
            client_ip = request.client.host if request and request.client else None
            audit_log(
                AuditEvent.STUDENT_UPDATED,
                user_id=user.id,
                ip_address=client_ip,
                resource_type="student",
                resource_id=student_id,
                details={
                    "action": "photo_deleted",
                    "deleted_photo": old_photo,
                },
            )

            logger.info(f"Deleted photo for student {student_id}: {old_photo}")
            return StudentRead.model_validate(student)

        except HTTPException:
            await self.session.rollback()
            raise
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Failed to delete photo for student {student_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al eliminar la foto",
            ) from e

    def close(self) -> None:
        """Close resources (like photo service connection)."""
        self.photo_service.close()
