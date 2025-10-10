"""Schedules endpoints."""

from fastapi import APIRouter, Depends, status

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
    course_id: int,
    service: ScheduleService = Depends(deps.get_schedule_service),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR", "INSPECTOR")),
) -> list[ScheduleRead]:
    return await service.list_course_schedule(course_id)


@router.post("/courses/{course_id}", response_model=ScheduleRead, status_code=status.HTTP_201_CREATED)
async def create_schedule_entry(
    course_id: int,
    payload: ScheduleCreate,
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
