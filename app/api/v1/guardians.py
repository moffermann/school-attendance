"""Guardian endpoints for admin CRUD."""

import csv
from io import StringIO
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request, Response, status
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core import deps
from app.core.deps import TenantAuthUser
from app.db.repositories.users import UserRepository
from app.services.guardian_service import GuardianService
from app.services.user_invitation_service import UserInvitationService
from app.schemas.guardians import (
    GuardianCreateRequest,
    GuardianFilters,
    GuardianListItem,
    GuardianResponse,
    GuardianStudentsRequest,
    GuardianUpdateRequest,
    GuardianWithStats,
    PaginatedGuardians,
)

limiter = Limiter(key_func=get_remote_address)


router = APIRouter()


def _sanitize_csv_value(val: str | None) -> str:
    """Sanitize value for CSV to prevent formula injection."""
    if not val:
        return ""
    val = str(val)
    stripped = val.lstrip()
    if stripped and stripped[0] in "=+-@|":
        return "'" + val
    return val


# NOTE: Export and search endpoints MUST be defined BEFORE /{guardian_id}
# to avoid route conflicts with FastAPI


@router.get("/export", response_class=Response)
@limiter.limit("10/minute")
async def export_guardians(
    request: Request,
    status_filter: str | None = Query(default=None, alias="status"),
    service: GuardianService = Depends(deps.get_guardian_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> Response:
    """Export guardians to CSV file."""
    filters = GuardianFilters(status=status_filter)
    guardians = await service.list_guardians_for_export(user, filters, request)

    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["ID", "Nombre", "Email", "Teléfono", "WhatsApp", "Estado", "Estudiantes", "Creado"])

    for g in guardians:
        contacts = g.contacts or {}
        writer.writerow([
            g.id,
            _sanitize_csv_value(g.full_name),
            _sanitize_csv_value(contacts.get("email")) if contacts.get("email") else "",
            _sanitize_csv_value(contacts.get("phone")) if contacts.get("phone") else "",
            _sanitize_csv_value(contacts.get("whatsapp")) if contacts.get("whatsapp") else "",
            g.status,
            g.students_count,
            g.created_at.isoformat() if g.created_at else "",
        ])

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=apoderados.csv"},
    )


@router.get("/search", response_model=list[GuardianListItem])
@limiter.limit("60/minute")
async def search_guardians(
    request: Request,
    q: str = Query(..., min_length=2, description="Término de búsqueda"),
    limit: int = Query(20, ge=1, le=50, description="Máximo de resultados"),
    fuzzy: bool = Query(False, description="Usar búsqueda difusa"),
    service: GuardianService = Depends(deps.get_guardian_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> list[GuardianListItem]:
    """Search guardians by name."""
    return await service.search_guardians(user, q, limit=limit, fuzzy=fuzzy)


@router.get("", response_model=PaginatedGuardians)
@limiter.limit("60/minute")
async def list_guardians(
    request: Request,
    limit: int = Query(50, ge=1, le=100, description="Registros por página"),
    offset: int = Query(0, ge=0, description="Registros a saltar"),
    status_filter: str | None = Query(default=None, alias="status"),
    search: str | None = Query(None, min_length=2, description="Buscar por nombre"),
    service: GuardianService = Depends(deps.get_guardian_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> PaginatedGuardians:
    """List guardians with pagination and filters."""
    filters = GuardianFilters(status=status_filter, search=search)
    return await service.list_guardians(user, filters, limit=limit, offset=offset)


@router.post("", response_model=GuardianResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def create_guardian(
    request: Request,
    payload: GuardianCreateRequest,
    service: GuardianService = Depends(deps.get_guardian_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> GuardianResponse:
    """Create a new guardian."""
    return await service.create_guardian(user, payload, request)


@router.get("/{guardian_id}", response_model=GuardianWithStats)
@limiter.limit("60/minute")
async def get_guardian(
    request: Request,
    guardian_id: int = Path(..., ge=1, description="ID del apoderado"),
    service: GuardianService = Depends(deps.get_guardian_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> GuardianWithStats:
    """Get a guardian by ID with statistics."""
    return await service.get_guardian_detail(user, guardian_id, request)


@router.patch("/{guardian_id}", response_model=GuardianResponse)
@limiter.limit("30/minute")
async def update_guardian(
    request: Request,
    payload: GuardianUpdateRequest,
    guardian_id: int = Path(..., ge=1, description="ID del apoderado"),
    service: GuardianService = Depends(deps.get_guardian_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> GuardianResponse:
    """Update a guardian's information."""
    return await service.update_guardian(user, guardian_id, payload, request)


@router.delete("/{guardian_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
async def delete_guardian(
    request: Request,
    guardian_id: int = Path(..., ge=1, description="ID del apoderado"),
    service: GuardianService = Depends(deps.get_guardian_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> None:
    """Soft delete a guardian (marks as DELETED)."""
    await service.delete_guardian(user, guardian_id, request)


@router.patch("/{guardian_id}/restore", response_model=GuardianResponse)
@limiter.limit("10/minute")
async def restore_guardian(
    request: Request,
    guardian_id: int = Path(..., ge=1, description="ID del apoderado"),
    service: GuardianService = Depends(deps.get_guardian_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> GuardianResponse:
    """Restore a deleted guardian."""
    return await service.restore_guardian(user, guardian_id, request)


@router.post("/{guardian_id}/resend-invitation")
@limiter.limit("5/minute")
async def resend_invitation(
    request: Request,
    guardian_id: int = Path(..., ge=1, description="ID del apoderado"),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
    invitation_service: UserInvitationService = Depends(deps.get_invitation_service),
) -> dict[str, Any]:
    """Resend invitation email to a guardian's parent account."""
    if user.role not in ("DIRECTOR", "ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo directores pueden reenviar invitaciones",
        )
    # Find user linked to this guardian
    from sqlalchemy.ext.asyncio import AsyncSession
    session = invitation_service.session
    user_repo = invitation_service.user_repo
    parent_user = await user_repo.get_by_guardian_id(guardian_id)
    if not parent_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontró cuenta de usuario para este apoderado",
        )
    if parent_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El apoderado ya completó su registro",
        )
    await invitation_service.send_invitation(parent_user.id, parent_user.email)
    await session.commit()
    return {"message": "Invitación reenviada"}


@router.put("/{guardian_id}/students", response_model=GuardianResponse)
@limiter.limit("30/minute")
async def set_guardian_students(
    request: Request,
    payload: GuardianStudentsRequest,
    guardian_id: int = Path(..., ge=1, description="ID del apoderado"),
    service: GuardianService = Depends(deps.get_guardian_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> GuardianResponse:
    """Set the complete list of students for a guardian.

    Replaces all existing student associations.
    """
    success = await service.set_students(user, guardian_id, payload.student_ids, request)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al actualizar estudiantes",
        )
    # Return updated guardian
    return await service.get_guardian_detail(user, guardian_id, request)


@router.post("/{guardian_id}/students/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("30/minute")
async def add_student_to_guardian(
    request: Request,
    guardian_id: int = Path(..., ge=1, description="ID del apoderado"),
    student_id: int = Path(..., ge=1, description="ID del estudiante"),
    service: GuardianService = Depends(deps.get_guardian_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> None:
    """Add a student to a guardian."""
    # Get current students and add the new one
    detail = await service.get_guardian_detail(user, guardian_id, request)
    current_ids = detail.student_ids or []
    if student_id not in current_ids:
        new_ids = current_ids + [student_id]
        await service.set_students(user, guardian_id, new_ids, request)


@router.delete("/{guardian_id}/students/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("30/minute")
async def remove_student_from_guardian(
    request: Request,
    guardian_id: int = Path(..., ge=1, description="ID del apoderado"),
    student_id: int = Path(..., ge=1, description="ID del estudiante"),
    service: GuardianService = Depends(deps.get_guardian_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> None:
    """Remove a student from a guardian."""
    # Get current students and remove the specified one
    detail = await service.get_guardian_detail(user, guardian_id, request)
    current_ids = detail.student_ids or []
    if student_id in current_ids:
        new_ids = [sid for sid in current_ids if sid != student_id]
        await service.set_students(user, guardian_id, new_ids, request)
