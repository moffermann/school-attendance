"""Absence request endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.core import deps
from app.core.auth import AuthUser
from app.schemas.absences import AbsenceRequestCreate, AbsenceRequestRead, AbsenceStatus, AbsenceType
from app.services.absence_service import AbsenceService


router = APIRouter()


@router.post("", response_model=AbsenceRequestRead, status_code=201)
async def submit_absence_request(
    payload: AbsenceRequestCreate,
    service: AbsenceService = Depends(deps.get_absence_service),
    user: AuthUser = Depends(deps.require_roles("PARENT", "ADMIN", "DIRECTOR", "INSPECTOR")),
) -> AbsenceRequestRead:
    try:
        record = await service.submit_absence(user, payload)
    except PermissionError as exc:  # pragma: no cover - guard rails
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        message = str(exc) or "Solicitud inválida"
        status_code = status.HTTP_404_NOT_FOUND if "not found" in message.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=message) from exc

    status_value = record.status or AbsenceStatus.PENDING.value
    type_value = record.type or payload.type.value

    return AbsenceRequestRead(
        id=record.id,
        student_id=record.student_id,
        type=AbsenceType(type_value),
        start=record.start_date,
        end=record.end_date,
        comment=record.comment,
        attachment_name=record.attachment_ref,
        status=AbsenceStatus(status_value),
        ts_submitted=record.ts_submitted,
    )
