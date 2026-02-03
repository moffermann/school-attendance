"""Service layer for course management."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from fastapi import HTTPException, Request, status

from app.core.audit import AuditEvent, audit_log
from app.db.models.course import CourseStatus
from app.db.repositories.courses import CourseRepository
from app.db.repositories.teachers import TeacherRepository
from app.schemas.courses import (
    CourseCreate,
    CourseFilters,
    CourseRead,
    CourseUpdate,
    CourseWithStats,
    PaginatedCourses,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.core.deps import TenantAuthUser

logger = logging.getLogger(__name__)


class CourseService:
    """Business logic for course management."""

    # Roles that can create/update/delete courses
    WRITE_ROLES = {"ADMIN", "DIRECTOR"}
    # Roles that can list and view courses
    READ_ROLES = {"ADMIN", "DIRECTOR", "INSPECTOR", "TEACHER"}
    # Roles that can export courses
    EXPORT_ROLES = {"ADMIN", "DIRECTOR", "INSPECTOR"}

    def __init__(self, session: "AsyncSession"):
        self.session = session
        self.course_repo = CourseRepository(session)
        self.teacher_repo = TeacherRepository(session)

    # -------------------------------------------------------------------------
    # List operations
    # -------------------------------------------------------------------------

    async def list_courses(
        self,
        user: "TenantAuthUser",
        filters: CourseFilters,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> PaginatedCourses:
        """List courses with pagination and filters."""
        if user.role not in self.READ_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para ver cursos",
            )

        courses = await self.course_repo.list_all(
            limit=limit,
            offset=offset,
            grade=filters.grade,
            status=filters.status,
        )

        total = await self.course_repo.count(
            grade=filters.grade,
            status=filters.status,
        )

        items = [CourseRead.model_validate(c) for c in courses]

        return PaginatedCourses(
            items=items,
            total=total,
            limit=limit,
            offset=offset,
            has_more=(offset + len(items)) < total,
        )

    async def list_courses_for_export(
        self,
        user: "TenantAuthUser",
        filters: CourseFilters,
        request: Request | None = None,
    ) -> list[CourseWithStats]:
        """List all courses for CSV export with statistics."""
        if user.role not in self.EXPORT_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para exportar cursos",
            )

        courses = await self.course_repo.list_for_export(
            grade=filters.grade,
            status=filters.status,
        )

        result = []
        for course in courses:
            students_count = await self.course_repo.count_active_students(course.id)
            schedules_count = await self.course_repo.count_schedules(course.id)
            enrollments_count = await self.course_repo.count_active_enrollments(course.id)

            result.append(
                CourseWithStats(
                    id=course.id,
                    name=course.name,
                    grade=course.grade,
                    status=course.status,
                    created_at=course.created_at,
                    updated_at=course.updated_at,
                    active_students_count=students_count,
                    schedules_count=schedules_count,
                    enrollments_count=enrollments_count,
                )
            )

        # Audit log
        client_ip = request.client.host if request and request.client else None
        audit_log(
            AuditEvent.COURSE_EXPORTED,
            user_id=user.id,
            ip_address=client_ip,
            resource_type="course",
            details={"count": len(result), "filters": filters.model_dump()},
        )

        return result

    # -------------------------------------------------------------------------
    # Get operations
    # -------------------------------------------------------------------------

    async def get_course_detail(
        self,
        user: "TenantAuthUser",
        course_id: int,
        request: Request | None = None,
    ) -> CourseWithStats:
        """Get course detail with statistics."""
        if user.role not in self.READ_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para ver cursos",
            )

        course = await self.course_repo.get(course_id)
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Curso no encontrado",
            )

        students_count = await self.course_repo.count_active_students(course_id)
        schedules_count = await self.course_repo.count_schedules(course_id)
        enrollments_count = await self.course_repo.count_active_enrollments(course_id)

        # Audit log
        client_ip = request.client.host if request and request.client else None
        audit_log(
            AuditEvent.COURSE_VIEWED,
            user_id=user.id,
            ip_address=client_ip,
            resource_type="course",
            resource_id=course_id,
        )

        return CourseWithStats(
            id=course.id,
            name=course.name,
            grade=course.grade,
            status=course.status,
            created_at=course.created_at,
            updated_at=course.updated_at,
            active_students_count=students_count,
            schedules_count=schedules_count,
            enrollments_count=enrollments_count,
        )

    # -------------------------------------------------------------------------
    # Create operations
    # -------------------------------------------------------------------------

    async def create_course(
        self,
        user: "TenantAuthUser",
        payload: CourseCreate,
        request: Request | None = None,
    ) -> CourseRead:
        """Create a new course with optional teacher assignment."""
        # 1. Validate permissions
        if user.role not in self.WRITE_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para crear cursos",
            )

        # 2. Validate unique name
        existing = await self.course_repo.get_by_name(payload.name)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe un curso con el nombre '{payload.name}'",
            )

        # 3. Validate teachers exist (if provided)
        teachers = []
        if payload.teacher_ids:
            teachers = await self.teacher_repo.get_by_ids(payload.teacher_ids)
            if len(teachers) != len(payload.teacher_ids):
                found_ids = {t.id for t in teachers}
                missing = [tid for tid in payload.teacher_ids if tid not in found_ids]
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Profesor(es) no encontrado(s): {missing}",
                )

        try:
            # 4. Create course
            course = await self.course_repo.create(
                name=payload.name,
                grade=payload.grade,
            )

            # 5. Assign teachers if provided
            if teachers:
                course.teachers = teachers
                await self.session.flush()

            # 6. Commit and get fresh instance
            await self.session.commit()
            # Re-fetch instead of refresh to avoid detached instance issues
            created_course = await self.course_repo.get_with_details(course.id)
            assert created_course is not None, "Course should exist after creation"

            # 7. Build teacher_ids for response
            teacher_ids = [t.id for t in (created_course.teachers or [])]

            # 8. Audit log with IP
            client_ip = request.client.host if request and request.client else None
            audit_log(
                AuditEvent.COURSE_CREATED,
                user_id=user.id,
                ip_address=client_ip,
                resource_type="course",
                resource_id=created_course.id,
                details={
                    "name": created_course.name,
                    "grade": created_course.grade,
                    "teacher_count": len(teacher_ids),
                },
            )

            return CourseRead(
                id=created_course.id,
                name=created_course.name,
                grade=created_course.grade,
                status=created_course.status,
                teacher_ids=teacher_ids,
                created_at=created_course.created_at,
                updated_at=created_course.updated_at,
            )

        except HTTPException:
            await self.session.rollback()
            raise
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Failed to create course: {e}")
            raise

    # -------------------------------------------------------------------------
    # Update operations
    # -------------------------------------------------------------------------

    async def update_course(
        self,
        user: "TenantAuthUser",
        course_id: int,
        payload: CourseUpdate,
        request: Request | None = None,
    ) -> CourseRead:
        """Update course with optional teacher reassignment."""
        # 1. Validate permissions
        if user.role not in self.WRITE_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para editar cursos",
            )

        # 2. Validate course exists and is active (with teachers loaded)
        course = await self.course_repo.get_with_details(course_id)
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Curso no encontrado",
            )

        if course.status != CourseStatus.ACTIVE.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede editar un curso eliminado o archivado",
            )

        # 3. Validate unique name (if changing)
        if payload.name and payload.name != course.name:
            existing = await self.course_repo.get_by_name(
                payload.name, exclude_id=course_id
            )
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ya existe un curso con el nombre '{payload.name}'",
                )

        # 4. Validate teachers exist (if provided)
        new_teachers = None
        if payload.teacher_ids is not None:
            if payload.teacher_ids:
                new_teachers = await self.teacher_repo.get_by_ids(payload.teacher_ids)
                if len(new_teachers) != len(payload.teacher_ids):
                    found_ids = {t.id for t in new_teachers}
                    missing = [tid for tid in payload.teacher_ids if tid not in found_ids]
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Profesor(es) no encontrado(s): {missing}",
                    )
            else:
                new_teachers = []  # Empty list means remove all teachers

        try:
            # 5. Update course fields
            old_name = course.name
            old_grade = course.grade
            old_teacher_ids = [t.id for t in (course.teachers or [])]

            if payload.name is not None:
                course.name = payload.name.strip()
            if payload.grade is not None:
                course.grade = payload.grade.strip()

            # 6. Update teachers if provided
            if new_teachers is not None:
                course.teachers = new_teachers

            await self.session.flush()

            # 7. Commit and get fresh instance
            await self.session.commit()
            # Re-fetch instead of refresh to avoid detached instance issues
            updated_course = await self.course_repo.get_with_details(course_id)
            assert updated_course is not None, "Course should exist after update"

            # 8. Build response teacher_ids
            teacher_ids = [t.id for t in (updated_course.teachers or [])]

            # 9. Audit log with IP
            client_ip = request.client.host if request and request.client else None
            changes: dict[str, Any] = {}
            if payload.name and payload.name != old_name:
                changes["name"] = {"old": old_name, "new": payload.name}
            if payload.grade and payload.grade != old_grade:
                changes["grade"] = {"old": old_grade, "new": payload.grade}
            if payload.teacher_ids is not None and set(teacher_ids) != set(old_teacher_ids):
                changes["teachers"] = {"old": old_teacher_ids, "new": teacher_ids}

            audit_log(
                AuditEvent.COURSE_UPDATED,
                user_id=user.id,
                ip_address=client_ip,
                resource_type="course",
                resource_id=course_id,
                details={"changes": changes},
            )

            return CourseRead(
                id=updated_course.id,
                name=updated_course.name,
                grade=updated_course.grade,
                status=updated_course.status,
                teacher_ids=teacher_ids,
                created_at=updated_course.created_at,
                updated_at=updated_course.updated_at,
            )

        except HTTPException:
            await self.session.rollback()
            raise
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Failed to update course {course_id}: {e}")
            raise

    # -------------------------------------------------------------------------
    # Delete operations
    # -------------------------------------------------------------------------

    async def delete_course(
        self,
        user: "TenantAuthUser",
        course_id: int,
        request: Request | None = None,
    ) -> bool:
        """Soft delete course with dependency validation and audit."""
        # 1. Validate permissions
        if user.role not in self.WRITE_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para eliminar cursos",
            )

        # 2. Validate course exists
        course = await self.course_repo.get(course_id)
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Curso no encontrado",
            )

        if course.status == CourseStatus.DELETED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El curso ya esta eliminado",
            )

        # 3. Validate NO dependencies
        students = await self.course_repo.count_active_students(course_id)
        if students > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No se puede eliminar: tiene {students} alumno(s) asignado(s)",
            )

        schedules = await self.course_repo.count_schedules(course_id)
        if schedules > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No se puede eliminar: tiene {schedules} horario(s) configurado(s)",
            )

        enrollments = await self.course_repo.count_active_enrollments(course_id)
        if enrollments > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No se puede eliminar: tiene {enrollments} inscripcion(es) activa(s)",
            )

        try:
            # 4. Soft delete
            course_name = course.name
            await self.course_repo.soft_delete(course_id)

            # 5. Commit
            await self.session.commit()

            # 6. Audit log with IP
            client_ip = request.client.host if request and request.client else None
            audit_log(
                AuditEvent.COURSE_DELETED,
                user_id=user.id,
                ip_address=client_ip,
                resource_type="course",
                resource_id=course_id,
                details={"name": course_name},
            )

            return True

        except Exception as e:
            await self.session.rollback()
            logger.error(f"Failed to delete course {course_id}: {e}")
            raise

    # -------------------------------------------------------------------------
    # Search operations
    # -------------------------------------------------------------------------

    async def search_courses(
        self,
        user: "TenantAuthUser",
        query: str,
        *,
        limit: int = 20,
        fuzzy: bool = False,
    ) -> list[CourseRead]:
        """Search courses by name/grade."""
        if user.role not in self.READ_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para buscar cursos",
            )

        if fuzzy:
            courses = await self.course_repo.fuzzy_search(query, limit=limit)
        else:
            courses = await self.course_repo.search(query, limit=limit)

        return [CourseRead.model_validate(c) for c in courses]
