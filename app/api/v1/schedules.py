"""Schedules endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Path, status

from app.core import deps
from app.core.auth import AuthUser
from app.schemas.schedules import (
    ScheduleCreate,
    ScheduleExceptionCreate,
    ScheduleExceptionRead,
    ScheduleRead,
)
from app.services.schedule_service import ScheduleService


router = APIRouter()


@router.get("/courses/{course_id}", response_model=list[ScheduleRead])
async def list_course_schedule(
    # R7-A6 fix: Validate path parameter is positive
    course_id: int = Path(..., ge=1, description="ID del curso"),
    service: ScheduleService = Depends(deps.get_schedule_service),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR", "INSPECTOR")),
) -> list[ScheduleRead]:
    return await service.list_course_schedule(course_id)


@router.post("/courses/{course_id}", response_model=ScheduleRead, status_code=status.HTTP_201_CREATED)
async def create_schedule_entry(
    payload: ScheduleCreate,
    course_id: int = Path(..., ge=1, description="ID del curso"),
    service: ScheduleService = Depends(deps.get_schedule_service),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR")),
) -> ScheduleRead:
    return await service.create_schedule(course_id, payload)


@router.post("/exceptions", response_model=ScheduleExceptionRead, status_code=status.HTTP_201_CREATED)
async def create_exception(
    payload: ScheduleExceptionCreate,
    service: ScheduleService = Depends(deps.get_schedule_service),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR")),
) -> ScheduleExceptionRead:
    return await service.create_exception(payload)


@router.put("/{schedule_id}", response_model=ScheduleRead)
async def update_schedule_entry(
    payload: ScheduleCreate,
    schedule_id: int = Path(..., ge=1, description="ID del horario"),
    service: ScheduleService = Depends(deps.get_schedule_service),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR")),
) -> ScheduleRead:
    try:
        return await service.update_schedule_entry(schedule_id, payload)
    except ValueError:
        # R4-S3 fix: Use generic message to avoid information disclosure
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Horario no encontrado")


@router.delete("/exceptions/{exception_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule_exception(
    exception_id: int = Path(..., ge=1, description="ID de la excepcion"),
    service: ScheduleService = Depends(deps.get_schedule_service),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR")),
) -> None:
    try:
        await service.delete_exception(exception_id)
    except ValueError:
        # R4-S3 fix: Use generic message to avoid information disclosure
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Excepción no encontrada")
