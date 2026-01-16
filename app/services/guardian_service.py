"""Service layer for guardian management."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from fastapi import HTTPException, Request, status

from app.core.audit import AuditEvent, audit_log
from app.db.repositories.guardians import GuardianRepository
from app.db.repositories.students import StudentRepository
from app.schemas.guardians import (
    GuardianCreateRequest,
    GuardianFilters,
    GuardianListItem,
    GuardianResponse,
    GuardianUpdateRequest,
    GuardianWithStats,
    PaginatedGuardians,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.core.deps import TenantAuthUser

logger = logging.getLogger(__name__)


class GuardianService:
    """Business logic for guardian management."""

    # Roles that can create/update/delete guardians
    WRITE_ROLES = {"ADMIN", "DIRECTOR"}
    # Roles that can list and view guardians
    READ_ROLES = {"ADMIN", "DIRECTOR", "INSPECTOR"}
    # Roles that can export guardians
    EXPORT_ROLES = {"ADMIN", "DIRECTOR", "INSPECTOR"}

    def __init__(self, session: "AsyncSession"):
        self.session = session
        self.guardian_repo = GuardianRepository(session)
        self.student_repo = StudentRepository(session)

    # -------------------------------------------------------------------------
    # List operations
    # -------------------------------------------------------------------------

    async def list_guardians(
        self,
        user: "TenantAuthUser",
        filters: GuardianFilters,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> PaginatedGuardians:
        """List guardians with pagination and filters."""
        if user.role not in self.READ_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para ver apoderados",
            )

        guardians, total = await self.guardian_repo.list_paginated(
            skip=offset,
            limit=limit,
            search=filters.search,
            status=filters.status,
        )

        items = []
        for g in guardians:
            items.append(
                GuardianListItem(
                    id=g.id,
                    full_name=g.full_name,
                    contacts=g.contacts or {},
                    student_ids=[s.id for s in (g.students or [])],
                    student_count=len(g.students or []),
                    status=g.status,
                )
            )

        return PaginatedGuardians.create(
            items=items,
            total=total,
            limit=limit,
            offset=offset,
        )

    async def list_guardians_for_export(
        self,
        user: "TenantAuthUser",
        filters: GuardianFilters,
        request: Request | None = None,
    ) -> list[GuardianWithStats]:
        """List all guardians for CSV export with statistics."""
        if user.role not in self.EXPORT_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para exportar apoderados",
            )

        guardians = await self.guardian_repo.list_for_export(
            status=filters.status,
        )

        result = []
        for guardian in guardians:
            students_count = len(guardian.students) if guardian.students else 0

            result.append(
                GuardianWithStats(
                    id=guardian.id,
                    full_name=guardian.full_name,
                    contacts=guardian.contacts or {},
                    student_ids=[s.id for s in (guardian.students or [])],
                    status=guardian.status,
                    created_at=guardian.created_at,
                    updated_at=guardian.updated_at,
                    students_count=students_count,
                )
            )

        # Audit log
        client_ip = request.client.host if request and request.client else None
        audit_log(
            AuditEvent.GUARDIAN_EXPORTED,
            user_id=user.id,
            ip_address=client_ip,
            resource_type="guardian",
            details={"count": len(result), "filters": filters.model_dump()},
        )

        return result

    # -------------------------------------------------------------------------
    # Get operations
    # -------------------------------------------------------------------------

    async def get_guardian_detail(
        self,
        user: "TenantAuthUser",
        guardian_id: int,
        request: Request | None = None,
    ) -> GuardianWithStats:
        """Get guardian detail with statistics."""
        if user.role not in self.READ_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para ver apoderados",
            )

        guardian = await self.guardian_repo.get(guardian_id)
        if not guardian:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Apoderado no encontrado",
            )

        students_count = len(guardian.students) if guardian.students else 0

        return GuardianWithStats(
            id=guardian.id,
            full_name=guardian.full_name,
            contacts=guardian.contacts or {},
            student_ids=[s.id for s in (guardian.students or [])],
            status=guardian.status,
            created_at=guardian.created_at,
            updated_at=guardian.updated_at,
            students_count=students_count,
        )

    # -------------------------------------------------------------------------
    # Create operations
    # -------------------------------------------------------------------------

    async def create_guardian(
        self,
        user: "TenantAuthUser",
        payload: GuardianCreateRequest,
        request: Request | None = None,
    ) -> GuardianResponse:
        """Create a new guardian."""
        # 1. Validate permissions
        if user.role not in self.WRITE_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para crear apoderados",
            )

        try:
            # 2. Create guardian
            contacts_dict = payload.contacts.model_dump() if payload.contacts else {}
            guardian = await self.guardian_repo.create(
                full_name=payload.full_name,
                contacts=contacts_dict,
            )

            # 3. Associate students if provided
            if payload.student_ids:
                await self.guardian_repo.set_students(guardian.id, payload.student_ids)

            # 4. Commit and get fresh instance
            await self.session.commit()
            # Re-fetch instead of refresh to avoid detached instance issues
            guardian = await self.guardian_repo.get(guardian.id)

            # 5. Audit log with IP
            client_ip = request.client.host if request and request.client else None
            audit_log(
                AuditEvent.GUARDIAN_CREATED,
                user_id=user.id,
                ip_address=client_ip,
                resource_type="guardian",
                resource_id=guardian.id,
                details={
                    "full_name": guardian.full_name,
                    "student_count": len(payload.student_ids or []),
                },
            )

            return GuardianResponse(
                id=guardian.id,
                full_name=guardian.full_name,
                contacts=guardian.contacts or {},
                student_ids=[s.id for s in (guardian.students or [])],
                status=guardian.status,
                created_at=guardian.created_at,
                updated_at=guardian.updated_at,
            )

        except HTTPException:
            await self.session.rollback()
            raise
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Failed to create guardian: {e}")
            raise

    # -------------------------------------------------------------------------
    # Update operations
    # -------------------------------------------------------------------------

    async def update_guardian(
        self,
        user: "TenantAuthUser",
        guardian_id: int,
        payload: GuardianUpdateRequest,
        request: Request | None = None,
    ) -> GuardianResponse:
        """Update guardian information."""
        # 1. Validate permissions
        if user.role not in self.WRITE_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para editar apoderados",
            )

        # 2. Validate guardian exists
        guardian = await self.guardian_repo.get(guardian_id)
        if not guardian:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Apoderado no encontrado",
            )

        if guardian.status == "DELETED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede editar un apoderado eliminado",
            )

        try:
            # 3. Track changes for audit
            changes = {}
            if payload.full_name and payload.full_name != guardian.full_name:
                changes["full_name"] = {"old": guardian.full_name, "new": payload.full_name}

            # 4. Update guardian fields
            update_kwargs = {}
            if payload.full_name is not None:
                update_kwargs["full_name"] = payload.full_name
            if payload.contacts is not None:
                update_kwargs["contacts"] = payload.contacts.model_dump()
                changes["contacts"] = "updated"

            if update_kwargs:
                await self.guardian_repo.update(guardian_id, **update_kwargs)

            # 5. Update students if provided
            if payload.student_ids is not None:
                old_student_ids = [s.id for s in (guardian.students or [])]
                await self.guardian_repo.set_students(guardian_id, payload.student_ids)
                if set(old_student_ids) != set(payload.student_ids):
                    changes["students"] = {"old": old_student_ids, "new": payload.student_ids}

            # 6. Commit and get fresh instance
            await self.session.commit()
            # Re-fetch instead of refresh to avoid detached instance issues
            guardian = await self.guardian_repo.get(guardian_id)

            # 7. Audit log with IP
            client_ip = request.client.host if request and request.client else None
            audit_log(
                AuditEvent.GUARDIAN_UPDATED,
                user_id=user.id,
                ip_address=client_ip,
                resource_type="guardian",
                resource_id=guardian_id,
                details={"changes": changes},
            )

            return GuardianResponse(
                id=guardian.id,
                full_name=guardian.full_name,
                contacts=guardian.contacts or {},
                student_ids=[s.id for s in (guardian.students or [])],
                status=guardian.status,
                created_at=guardian.created_at,
                updated_at=guardian.updated_at,
            )

        except HTTPException:
            await self.session.rollback()
            raise
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Failed to update guardian {guardian_id}: {e}")
            raise

    # -------------------------------------------------------------------------
    # Delete operations
    # -------------------------------------------------------------------------

    async def delete_guardian(
        self,
        user: "TenantAuthUser",
        guardian_id: int,
        request: Request | None = None,
    ) -> bool:
        """Soft delete guardian with audit."""
        # 1. Validate permissions
        if user.role not in self.WRITE_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para eliminar apoderados",
            )

        # 2. Validate guardian exists
        guardian = await self.guardian_repo.get(guardian_id)
        if not guardian:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Apoderado no encontrado",
            )

        if guardian.status == "DELETED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El apoderado ya esta eliminado",
            )

        # 3. Check students (warn but allow)
        students_count = await self.guardian_repo.count_students(guardian_id)

        try:
            # 4. Soft delete
            guardian_name = guardian.full_name
            await self.guardian_repo.soft_delete(guardian_id)

            # 5. Commit
            await self.session.commit()

            # 6. Audit log with IP
            client_ip = request.client.host if request and request.client else None
            audit_log(
                AuditEvent.GUARDIAN_DELETED,
                user_id=user.id,
                ip_address=client_ip,
                resource_type="guardian",
                resource_id=guardian_id,
                details={
                    "full_name": guardian_name,
                    "had_students": students_count,
                },
            )

            return True

        except Exception as e:
            await self.session.rollback()
            logger.error(f"Failed to delete guardian {guardian_id}: {e}")
            raise

    async def restore_guardian(
        self,
        user: "TenantAuthUser",
        guardian_id: int,
        request: Request | None = None,
    ) -> GuardianResponse:
        """Restore a deleted guardian."""
        # 1. Validate permissions
        if user.role not in self.WRITE_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para restaurar apoderados",
            )

        # 2. Validate guardian exists
        guardian = await self.guardian_repo.get(guardian_id)
        if not guardian:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Apoderado no encontrado",
            )

        if guardian.status != "DELETED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El apoderado no está eliminado",
            )

        try:
            # 3. Restore
            await self.guardian_repo.restore(guardian_id)

            # 4. Commit and get fresh instance
            await self.session.commit()
            # Re-fetch instead of refresh to avoid detached instance issues
            guardian = await self.guardian_repo.get(guardian_id)

            # 5. Audit log with IP
            client_ip = request.client.host if request and request.client else None
            audit_log(
                AuditEvent.GUARDIAN_UPDATED,
                user_id=user.id,
                ip_address=client_ip,
                resource_type="guardian",
                resource_id=guardian_id,
                details={"action": "restored", "old_status": "DELETED", "new_status": "ACTIVE"},
            )

            return GuardianResponse(
                id=guardian.id,
                full_name=guardian.full_name,
                contacts=guardian.contacts or {},
                student_ids=[s.id for s in (guardian.students or [])],
                status=guardian.status,
                created_at=guardian.created_at,
                updated_at=guardian.updated_at,
            )

        except Exception as e:
            await self.session.rollback()
            logger.error(f"Failed to restore guardian {guardian_id}: {e}")
            raise

    # -------------------------------------------------------------------------
    # Search operations
    # -------------------------------------------------------------------------

    async def search_guardians(
        self,
        user: "TenantAuthUser",
        query: str,
        *,
        limit: int = 20,
        fuzzy: bool = False,
    ) -> list[GuardianListItem]:
        """Search guardians by name."""
        if user.role not in self.READ_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para buscar apoderados",
            )

        if fuzzy:
            guardians = await self.guardian_repo.fuzzy_search(query, limit=limit)
        else:
            guardians = await self.guardian_repo.search(query, limit=limit)

        return [
            GuardianListItem(
                id=g.id,
                full_name=g.full_name,
                contacts=g.contacts or {},
                student_ids=[s.id for s in (g.students or [])],
                student_count=len(g.students or []),
                status=g.status,
            )
            for g in guardians
        ]

    # -------------------------------------------------------------------------
    # Student association operations
    # -------------------------------------------------------------------------

    async def set_students(
        self,
        user: "TenantAuthUser",
        guardian_id: int,
        student_ids: list[int],
        request: Request | None = None,
    ) -> bool:
        """Set the students associated with a guardian."""
        if user.role not in self.WRITE_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para modificar asociaciones",
            )

        # Validate guardian exists and is not deleted
        guardian = await self.guardian_repo.get_active(guardian_id)
        if not guardian:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Apoderado no encontrado o eliminado",
            )

        try:
            old_student_ids = [s.id for s in (guardian.students or [])]
            success = await self.guardian_repo.set_students(guardian_id, student_ids)
            await self.session.commit()

            # Audit log
            client_ip = request.client.host if request and request.client else None
            audit_log(
                AuditEvent.GUARDIAN_UPDATED,
                user_id=user.id,
                ip_address=client_ip,
                resource_type="guardian",
                resource_id=guardian_id,
                details={
                    "action": "students_updated",
                    "old_students": old_student_ids,
                    "new_students": student_ids,
                },
            )

            return success

        except Exception as e:
            await self.session.rollback()
            logger.error(f"Failed to set students for guardian {guardian_id}: {e}")
            raise
