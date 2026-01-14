"""Guardian endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import deps
from app.core.auth import AuthUser
from app.db.repositories.guardians import GuardianRepository
from app.schemas.guardians import (
    GuardianCreateRequest,
    GuardianListItem,
    GuardianListResponse,
    GuardianResponse,
    GuardianStudentsRequest,
    GuardianUpdateRequest,
)


router = APIRouter()


def _guardian_to_response(guardian) -> GuardianResponse:
    """Convert a Guardian model to response schema."""
    return GuardianResponse(
        id=guardian.id,
        full_name=guardian.full_name,
        contacts=guardian.contacts or {},
        student_ids=[s.id for s in guardian.students] if guardian.students else [],
    )


def _guardian_to_list_item(guardian) -> GuardianListItem:
    """Convert a Guardian model to list item schema."""
    student_ids = [s.id for s in guardian.students] if guardian.students else []
    return GuardianListItem(
        id=guardian.id,
        full_name=guardian.full_name,
        contacts=guardian.contacts or {},
        student_ids=student_ids,
        student_count=len(student_ids),
    )


@router.get("", response_model=GuardianListResponse)
async def list_guardians(
    q: str | None = Query(None, min_length=2, description="Buscar por nombre"),
    skip: int = Query(0, ge=0, description="Registros a saltar"),
    limit: int = Query(50, ge=1, le=200, description="Límite de registros"),
    session: AsyncSession = Depends(deps.get_tenant_db),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR", "INSPECTOR")),
) -> GuardianListResponse:
    """List guardians with pagination and search.

    - **q**: Search by name (case-insensitive, min 2 chars)
    - **skip/limit**: Pagination controls
    """
    repo = GuardianRepository(session)
    guardians, total = await repo.list_paginated(
        skip=skip,
        limit=limit,
        search=q,
    )

    items = [_guardian_to_list_item(g) for g in guardians]

    return GuardianListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
        has_more=(skip + len(items)) < total,
    )


@router.post("", response_model=GuardianResponse, status_code=status.HTTP_201_CREATED)
async def create_guardian(
    payload: GuardianCreateRequest,
    session: AsyncSession = Depends(deps.get_tenant_db),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR")),
) -> GuardianResponse:
    """Create a new guardian.

    - **full_name**: Guardian's full name (required, 2-255 chars)
    - **contacts**: Contact information (email, phone, whatsapp)
    - **student_ids**: Optional list of student IDs to associate
    """
    repo = GuardianRepository(session)

    # Convert contacts to dict if provided
    contacts = payload.contacts.model_dump() if payload.contacts else {}

    # Create the guardian
    guardian = await repo.create(
        full_name=payload.full_name,
        contacts=contacts,
    )

    # Associate students if provided
    if payload.student_ids:
        await repo.set_students(guardian.id, payload.student_ids)

    # Always reload with eager loading to avoid lazy load issues
    guardian = await repo.get(guardian.id)

    await session.commit()

    logger.info(f"Created guardian {guardian.id}: {guardian.full_name}")

    return _guardian_to_response(guardian)


@router.get("/{guardian_id}", response_model=GuardianResponse)
async def get_guardian(
    guardian_id: int = Path(..., ge=1, description="ID del apoderado"),
    session: AsyncSession = Depends(deps.get_tenant_db),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR", "INSPECTOR")),
) -> GuardianResponse:
    """Get a guardian by ID."""
    repo = GuardianRepository(session)
    guardian = await repo.get(guardian_id)

    if not guardian:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Apoderado no encontrado"
        )

    return _guardian_to_response(guardian)


@router.patch("/{guardian_id}", response_model=GuardianResponse)
async def update_guardian(
    payload: GuardianUpdateRequest,
    guardian_id: int = Path(..., ge=1, description="ID del apoderado"),
    session: AsyncSession = Depends(deps.get_tenant_db),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR")),
) -> GuardianResponse:
    """Update a guardian's information."""
    repo = GuardianRepository(session)
    guardian = await repo.get(guardian_id)

    if not guardian:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Apoderado no encontrado"
        )

    # Build update dict with only provided fields
    update_data = {}
    if payload.full_name is not None:
        update_data["full_name"] = payload.full_name
    if payload.contacts is not None:
        update_data["contacts"] = payload.contacts.model_dump()

    if update_data:
        guardian = await repo.update(guardian_id, **update_data)

    # Update student associations if provided
    if payload.student_ids is not None:
        await repo.set_students(guardian_id, payload.student_ids)
        # Refresh to get updated students list
        guardian = await repo.get(guardian_id)

    await session.commit()

    return _guardian_to_response(guardian)


@router.delete("/{guardian_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_guardian(
    guardian_id: int = Path(..., ge=1, description="ID del apoderado"),
    session: AsyncSession = Depends(deps.get_tenant_db),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR")),
) -> None:
    """Delete a guardian.

    This will also remove all student associations.
    """
    repo = GuardianRepository(session)
    guardian = await repo.get(guardian_id)

    if not guardian:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Apoderado no encontrado"
        )

    deleted = await repo.delete(guardian_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al eliminar apoderado"
        )

    await session.commit()

    logger.info(f"Deleted guardian {guardian_id}: {guardian.full_name}")


@router.put("/{guardian_id}/students", response_model=GuardianResponse)
async def set_guardian_students(
    payload: GuardianStudentsRequest,
    guardian_id: int = Path(..., ge=1, description="ID del apoderado"),
    session: AsyncSession = Depends(deps.get_tenant_db),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR")),
) -> GuardianResponse:
    """Set the complete list of students for a guardian.

    Replaces all existing student associations.
    """
    repo = GuardianRepository(session)
    guardian = await repo.get(guardian_id)

    if not guardian:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Apoderado no encontrado"
        )

    success = await repo.set_students(guardian_id, payload.student_ids)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al actualizar estudiantes"
        )

    await session.commit()

    # Refresh to get updated data
    guardian = await repo.get(guardian_id)

    return _guardian_to_response(guardian)


@router.post("/{guardian_id}/students/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def add_student_to_guardian(
    guardian_id: int = Path(..., ge=1, description="ID del apoderado"),
    student_id: int = Path(..., ge=1, description="ID del estudiante"),
    session: AsyncSession = Depends(deps.get_tenant_db),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR")),
) -> None:
    """Add a student to a guardian."""
    repo = GuardianRepository(session)

    success = await repo.add_student(guardian_id, student_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Apoderado o estudiante no encontrado"
        )

    await session.commit()


@router.delete("/{guardian_id}/students/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_student_from_guardian(
    guardian_id: int = Path(..., ge=1, description="ID del apoderado"),
    student_id: int = Path(..., ge=1, description="ID del estudiante"),
    session: AsyncSession = Depends(deps.get_tenant_db),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR")),
) -> None:
    """Remove a student from a guardian."""
    repo = GuardianRepository(session)

    success = await repo.remove_student(guardian_id, student_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asociación no encontrada"
        )

    await session.commit()
