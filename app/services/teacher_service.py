"""Service layer for teacher management."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from fastapi import HTTPException, Request, status

from app.core.audit import AuditEvent, audit_log
from app.db.repositories.courses import CourseRepository
from app.db.repositories.teachers import TeacherRepository
from app.schemas.teachers import (
    PaginatedTeachers,
    TeacherCreate,
    TeacherFilters,
    TeacherRead,
    TeacherUpdate,
    TeacherWithStats,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.core.deps import TenantAuthUser

logger = logging.getLogger(__name__)


class TeacherService:
    """Business logic for teacher management."""

    # Roles that can create/update/delete teachers
    WRITE_ROLES = {"ADMIN", "DIRECTOR"}
    # Roles that can list and view teachers
    READ_ROLES = {"ADMIN", "DIRECTOR", "INSPECTOR"}
    # Roles that can export teachers
    EXPORT_ROLES = {"ADMIN", "DIRECTOR", "INSPECTOR"}

    def __init__(self, session: "AsyncSession"):
        self.session = session
        self.teacher_repo = TeacherRepository(session)
        self.course_repo = CourseRepository(session)

    # -------------------------------------------------------------------------
    # List operations
    # -------------------------------------------------------------------------

    async def list_teachers(
        self,
        user: "TenantAuthUser",
        filters: TeacherFilters,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> PaginatedTeachers:
        """List teachers with pagination and filters."""
        if user.role not in self.READ_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para ver profesores",
            )

        # Convert limit/offset to page/page_size for repository
        page = (offset // limit) + 1 if limit > 0 else 1
        page_size = limit

        teachers, total = await self.teacher_repo.list_paginated(
            page=page,
            page_size=page_size,
            search=filters.search,
            status=filters.status,
        )

        items = [TeacherRead.model_validate(t) for t in teachers]

        return PaginatedTeachers.create(
            items=items,
            total=total,
            limit=limit,
            offset=offset,
        )

    async def list_teachers_for_export(
        self,
        user: "TenantAuthUser",
        filters: TeacherFilters,
        request: Request | None = None,
    ) -> list[TeacherWithStats]:
        """List all teachers for CSV export with statistics."""
        if user.role not in self.EXPORT_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para exportar profesores",
            )

        teachers = await self.teacher_repo.list_for_export(
            status=filters.status,
        )

        result = []
        for teacher in teachers:
            courses_count = len(teacher.courses) if teacher.courses else 0

            result.append(
                TeacherWithStats(
                    id=teacher.id,
                    full_name=teacher.full_name,
                    email=teacher.email,
                    status=teacher.status,
                    can_enroll_biometric=teacher.can_enroll_biometric,
                    created_at=teacher.created_at,
                    updated_at=teacher.updated_at,
                    courses_count=courses_count,
                )
            )

        # Audit log
        client_ip = request.client.host if request and request.client else None
        audit_log(
            AuditEvent.TEACHER_EXPORTED,
            user_id=user.id,
            ip_address=client_ip,
            resource_type="teacher",
            details={"count": len(result), "filters": filters.model_dump()},
        )

        return result

    # -------------------------------------------------------------------------
    # Get operations
    # -------------------------------------------------------------------------

    async def get_teacher_detail(
        self,
        user: "TenantAuthUser",
        teacher_id: int,
        request: Request | None = None,
    ) -> TeacherWithStats:
        """Get teacher detail with statistics."""
        if user.role not in self.READ_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para ver profesores",
            )

        teacher = await self.teacher_repo.get_with_courses(teacher_id)
        if not teacher:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profesor no encontrado",
            )

        courses_count = len(teacher.courses) if teacher.courses else 0

        return TeacherWithStats(
            id=teacher.id,
            full_name=teacher.full_name,
            email=teacher.email,
            status=teacher.status,
            can_enroll_biometric=teacher.can_enroll_biometric,
            created_at=teacher.created_at,
            updated_at=teacher.updated_at,
            courses_count=courses_count,
        )

    # -------------------------------------------------------------------------
    # Create operations
    # -------------------------------------------------------------------------

    async def create_teacher(
        self,
        user: "TenantAuthUser",
        payload: TeacherCreate,
        request: Request | None = None,
    ) -> TeacherRead:
        """Create a new teacher."""
        # 1. Validate permissions
        if user.role not in self.WRITE_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para crear profesores",
            )

        # 2. Validate unique email (if provided)
        if payload.email:
            existing = await self.teacher_repo.get_by_email(payload.email)
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ya existe un profesor con el email '{payload.email}'",
                )

        try:
            # 3. Create teacher
            teacher = await self.teacher_repo.create(
                full_name=payload.full_name,
                email=payload.email,
            )

            # 4. Update additional fields
            if payload.status != "ACTIVE":
                teacher.status = payload.status
            if payload.can_enroll_biometric:
                teacher.can_enroll_biometric = payload.can_enroll_biometric

            await self.session.flush()

            # 5. Commit and get fresh instance
            await self.session.commit()
            # Re-fetch instead of refresh to avoid detached instance issues
            created_teacher = await self.teacher_repo.get(teacher.id)
            assert created_teacher is not None, "Teacher should exist after creation"

            # 6. Audit log with IP
            client_ip = request.client.host if request and request.client else None
            audit_log(
                AuditEvent.TEACHER_CREATED,
                user_id=user.id,
                ip_address=client_ip,
                resource_type="teacher",
                resource_id=created_teacher.id,
                details={
                    "full_name": created_teacher.full_name,
                    "email": created_teacher.email,
                },
            )

            return TeacherRead.model_validate(created_teacher)

        except HTTPException:
            await self.session.rollback()
            raise
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Failed to create teacher: {e}")
            raise

    # -------------------------------------------------------------------------
    # Update operations
    # -------------------------------------------------------------------------

    async def update_teacher(
        self,
        user: "TenantAuthUser",
        teacher_id: int,
        payload: TeacherUpdate,
        request: Request | None = None,
    ) -> TeacherRead:
        """Update teacher information."""
        # 1. Validate permissions
        if user.role not in self.WRITE_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para editar profesores",
            )

        # 2. Validate teacher exists
        teacher = await self.teacher_repo.get(teacher_id)
        if not teacher:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profesor no encontrado",
            )

        if teacher.status == "DELETED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede editar un profesor eliminado",
            )

        # 3. Validate unique email (if changing)
        if payload.email and payload.email != teacher.email:
            existing = await self.teacher_repo.get_by_email(payload.email)
            if existing and existing.id != teacher_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ya existe un profesor con el email '{payload.email}'",
                )

        try:
            # 4. Track changes for audit
            changes: dict[str, Any] = {}
            if payload.full_name and payload.full_name != teacher.full_name:
                changes["full_name"] = {"old": teacher.full_name, "new": payload.full_name}
            if payload.email is not None and payload.email != teacher.email:
                changes["email"] = {"old": teacher.email, "new": payload.email}
            if payload.status and payload.status != teacher.status:
                changes["status"] = {"old": teacher.status, "new": payload.status}
            if payload.can_enroll_biometric is not None and payload.can_enroll_biometric != teacher.can_enroll_biometric:
                changes["can_enroll_biometric"] = {"old": teacher.can_enroll_biometric, "new": payload.can_enroll_biometric}

            # 5. Update teacher
            updated = await self.teacher_repo.update(
                teacher_id,
                full_name=payload.full_name,
                email=payload.email,
                status=payload.status,
                can_enroll_biometric=payload.can_enroll_biometric,
            )

            # 6. Commit and get fresh instance
            await self.session.commit()
            # Re-fetch instead of refresh to avoid detached instance issues
            updated_teacher = await self.teacher_repo.get(teacher_id)
            assert updated_teacher is not None, "Teacher should exist after update"

            # 7. Audit log with IP
            client_ip = request.client.host if request and request.client else None
            audit_log(
                AuditEvent.TEACHER_UPDATED,
                user_id=user.id,
                ip_address=client_ip,
                resource_type="teacher",
                resource_id=teacher_id,
                details={"changes": changes},
            )

            return TeacherRead.model_validate(updated_teacher)

        except HTTPException:
            await self.session.rollback()
            raise
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Failed to update teacher {teacher_id}: {e}")
            raise

    # -------------------------------------------------------------------------
    # Delete operations
    # -------------------------------------------------------------------------

    async def delete_teacher(
        self,
        user: "TenantAuthUser",
        teacher_id: int,
        request: Request | None = None,
    ) -> bool:
        """Soft delete teacher with audit."""
        # 1. Validate permissions
        if user.role not in self.WRITE_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para eliminar profesores",
            )

        # 2. Validate teacher exists
        teacher = await self.teacher_repo.get(teacher_id)
        if not teacher:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profesor no encontrado",
            )

        if teacher.status == "DELETED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El profesor ya esta eliminado",
            )

        # 3. Check courses (warn but allow)
        courses_count = await self.teacher_repo.count_courses(teacher_id)

        try:
            # 4. Soft delete
            teacher_name = teacher.full_name
            await self.teacher_repo.soft_delete(teacher_id)

            # 5. Commit
            await self.session.commit()

            # 6. Audit log with IP
            client_ip = request.client.host if request and request.client else None
            audit_log(
                AuditEvent.TEACHER_DELETED,
                user_id=user.id,
                ip_address=client_ip,
                resource_type="teacher",
                resource_id=teacher_id,
                details={
                    "full_name": teacher_name,
                    "had_courses": courses_count,
                },
            )

            return True

        except Exception as e:
            await self.session.rollback()
            logger.error(f"Failed to delete teacher {teacher_id}: {e}")
            raise

    async def restore_teacher(
        self,
        user: "TenantAuthUser",
        teacher_id: int,
        request: Request | None = None,
    ) -> TeacherRead:
        """Restore a deleted teacher."""
        # 1. Validate permissions
        if user.role not in self.WRITE_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para restaurar profesores",
            )

        # 2. Validate teacher exists
        teacher = await self.teacher_repo.get(teacher_id)
        if not teacher:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profesor no encontrado",
            )

        if teacher.status != "DELETED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El profesor no está eliminado",
            )

        try:
            # 3. Restore
            await self.teacher_repo.restore(teacher_id)

            # 4. Commit and get fresh instance
            await self.session.commit()
            # Re-fetch instead of refresh to avoid detached instance issues
            teacher = await self.teacher_repo.get(teacher_id)

            # 5. Audit log with IP
            client_ip = request.client.host if request and request.client else None
            audit_log(
                AuditEvent.TEACHER_UPDATED,
                user_id=user.id,
                ip_address=client_ip,
                resource_type="teacher",
                resource_id=teacher_id,
                details={"action": "restored", "old_status": "DELETED", "new_status": "ACTIVE"},
            )

            return TeacherRead.model_validate(teacher)

        except Exception as e:
            await self.session.rollback()
            logger.error(f"Failed to restore teacher {teacher_id}: {e}")
            raise

    # -------------------------------------------------------------------------
    # Search operations
    # -------------------------------------------------------------------------

    async def search_teachers(
        self,
        user: "TenantAuthUser",
        query: str,
        *,
        limit: int = 20,
        fuzzy: bool = False,
    ) -> list[TeacherRead]:
        """Search teachers by name/email."""
        if user.role not in self.READ_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para buscar profesores",
            )

        if fuzzy:
            teachers = await self.teacher_repo.fuzzy_search(query, limit=limit)
        else:
            teachers = await self.teacher_repo.search(query, limit=limit)

        return [TeacherRead.model_validate(t) for t in teachers]

    # -------------------------------------------------------------------------
    # Course assignment operations
    # -------------------------------------------------------------------------

    async def assign_course(
        self,
        user: "TenantAuthUser",
        teacher_id: int,
        course_id: int,
        request: Request | None = None,
    ) -> bool:
        """Assign a course to a teacher."""
        if user.role not in self.WRITE_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para asignar cursos",
            )

        # Validate teacher exists and is not deleted
        teacher = await self.teacher_repo.get_active(teacher_id)
        if not teacher:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profesor no encontrado o eliminado",
            )

        # Validate course exists and is active
        course = await self.course_repo.get_active(course_id)
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Curso no encontrado o inactivo",
            )

        try:
            success = await self.teacher_repo.assign_course(teacher_id, course_id)
            await self.session.commit()

            # Audit log
            client_ip = request.client.host if request and request.client else None
            audit_log(
                AuditEvent.TEACHER_UPDATED,
                user_id=user.id,
                ip_address=client_ip,
                resource_type="teacher",
                resource_id=teacher_id,
                details={"action": "course_assigned", "course_id": course_id},
            )

            return success

        except Exception as e:
            await self.session.rollback()
            logger.error(f"Failed to assign course {course_id} to teacher {teacher_id}: {e}")
            raise

    async def unassign_course(
        self,
        user: "TenantAuthUser",
        teacher_id: int,
        course_id: int,
        request: Request | None = None,
    ) -> bool:
        """Remove a course assignment from a teacher."""
        if user.role not in self.WRITE_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para desasignar cursos",
            )

        # Validate teacher exists
        teacher = await self.teacher_repo.get(teacher_id)
        if not teacher:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profesor no encontrado",
            )

        try:
            success = await self.teacher_repo.unassign_course(teacher_id, course_id)
            await self.session.commit()

            # Audit log
            client_ip = request.client.host if request and request.client else None
            audit_log(
                AuditEvent.TEACHER_UPDATED,
                user_id=user.id,
                ip_address=client_ip,
                resource_type="teacher",
                resource_id=teacher_id,
                details={"action": "course_unassigned", "course_id": course_id},
            )

            return success

        except Exception as e:
            await self.session.rollback()
            logger.error(f"Failed to unassign course {course_id} from teacher {teacher_id}: {e}")
            raise
