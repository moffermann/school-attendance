"""Attendance endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, status
from loguru import logger

from app.core import deps
from app.core.auth import AuthUser
from app.core.rate_limiter import limiter
from app.schemas.attendance import AttendanceEventCreate, AttendanceEventRead
from app.services.attendance_service import AttendanceService


router = APIRouter()


@router.post("/events", response_model=AttendanceEventRead, status_code=status.HTTP_201_CREATED)
@limiter.limit("60/minute")
async def register_event(
    request: Request,
    payload: AttendanceEventCreate,
    service: AttendanceService = Depends(deps.get_attendance_service),
    user: AuthUser | None = Depends(deps.get_current_user_optional),
    device_authenticated: bool = Depends(deps.verify_device_key),
) -> AttendanceEventRead:
    """Registrar un evento IN/OUT reportado por kiosco u otro canal."""
    if not device_authenticated:
        if not user or user.role not in {"ADMIN", "DIRECTOR", "INSPECTOR"}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    try:
        return await service.register_event(payload)
    except ValueError as exc:
        # R15-ERR1 fix: Log error details but only return safe message to client
        logger.warning(f"Validation error in register_event: {exc}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/students/{student_id}", response_model=list[AttendanceEventRead])
async def list_events_by_student(
    student_id: int,
    service: AttendanceService = Depends(deps.get_attendance_service),
    _: AuthUser = Depends(deps.require_roles("ADMIN", "DIRECTOR", "INSPECTOR")),
) -> list[AttendanceEventRead]:
    """Obtener eventos recientes para un alumno."""

    return await service.list_events_by_student(student_id)


@router.post("/events/{event_id}/photo", response_model=AttendanceEventRead)
@limiter.limit("30/minute")
async def upload_event_photo(
    request: Request,
    event_id: int,
    file: UploadFile = File(...),
    service: AttendanceService = Depends(deps.get_attendance_service),
    user: AuthUser | None = Depends(deps.get_current_user_optional),
    device_authenticated: bool = Depends(deps.verify_device_key),
) -> AttendanceEventRead:
    if not device_authenticated:
        if not user or user.role not in {"ADMIN", "DIRECTOR", "INSPECTOR"}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    try:
        return await service.attach_photo(event_id, file)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/events/{event_id}/audio", response_model=AttendanceEventRead)
@limiter.limit("30/minute")
async def upload_event_audio(
    request: Request,
    event_id: int,
    file: UploadFile = File(...),
    service: AttendanceService = Depends(deps.get_attendance_service),
    user: AuthUser | None = Depends(deps.get_current_user_optional),
    device_authenticated: bool = Depends(deps.verify_device_key),
) -> AttendanceEventRead:
    """Upload audio evidence for an attendance event."""
    if not device_authenticated:
        if not user or user.role not in {"ADMIN", "DIRECTOR", "INSPECTOR"}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    try:
        return await service.attach_audio(event_id, file)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
