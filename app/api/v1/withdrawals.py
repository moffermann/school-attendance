"""Withdrawal endpoints for authorized student pickups."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Path, Query, Request, Response, UploadFile, status
from loguru import logger
from pydantic import BaseModel, ConfigDict, Field, field_serializer
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core import deps
from app.core.auth import AuthUser
from app.core.deps import TenantAuthUser
from app.db.models.student_withdrawal import WithdrawalStatus, WithdrawalVerificationMethod
from app.services.photo_service import PhotoService
from app.services.withdrawal_service import WithdrawalService

limiter = Limiter(key_func=get_remote_address)
router = APIRouter()


# ==================== Schemas ====================


class WithdrawalInitiateRequest(BaseModel):
    """Request to initiate a withdrawal."""

    student_ids: list[int] = Field(..., min_length=1)
    authorized_pickup_id: int | None = None
    device_id: str | None = None
    device_timezone: str | None = Field(None, description="Device timezone (e.g. America/Santiago)")


class WithdrawalVerifyRequest(BaseModel):
    """Request to verify identity for a withdrawal."""

    verification_method: WithdrawalVerificationMethod
    pickup_photo_ref: str | None = None  # S3 reference to selfie


class WithdrawalCompleteRequest(BaseModel):
    """Request to complete a withdrawal with signature."""

    signature_data: str | None = None  # Base64 PNG/SVG
    reason: str | None = Field(None, max_length=500)


class WithdrawalCancelRequest(BaseModel):
    """Request to cancel a withdrawal."""

    reason: str = Field(..., min_length=10, max_length=500)


class AdminOverrideRequest(BaseModel):
    """Request for admin to manually approve a withdrawal."""

    student_id: int
    reason: str = Field(..., min_length=10, max_length=500)
    signature_data: str | None = None
    device_id: str | None = None


class WithdrawalResponse(BaseModel):
    """Response for a withdrawal."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    student_name: str | None = None
    course_name: str | None = None
    authorized_pickup_id: int | None
    pickup_name: str | None = None
    pickup_relationship: str | None = None
    status: str
    verification_method: str | None
    device_id: str | None = None
    initiated_at: datetime
    verified_at: datetime | None
    completed_at: datetime | None
    cancelled_at: datetime | None
    reason: str | None
    cancellation_reason: str | None
    signature_data: str | None = None
    pickup_photo_ref: str | None = None

    @field_serializer("initiated_at", "verified_at", "completed_at", "cancelled_at")
    def serialize_datetime(self, value: datetime | None) -> str | None:
        """Serialize datetime to ISO 8601 format for JavaScript compatibility."""
        if value is None:
            return None
        # Use isoformat() which produces JavaScript-parseable format
        return value.isoformat()


class WithdrawalListItem(BaseModel):
    """List item for withdrawal."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    student_name: str
    course_name: str | None = None
    pickup_name: str | None = None
    pickup_relationship: str | None = None
    status: str
    verification_method: str | None = None
    device_id: str | None = None
    initiated_at: datetime
    completed_at: datetime | None

    @field_serializer("initiated_at", "completed_at")
    def serialize_datetime(self, value: datetime | None) -> str | None:
        """Serialize datetime to ISO 8601 format for JavaScript compatibility."""
        if value is None:
            return None
        return value.isoformat()


class PaginatedWithdrawals(BaseModel):
    """Paginated list of withdrawals."""

    items: list[WithdrawalListItem]
    total: int
    limit: int
    offset: int
    has_more: bool


class WithdrawalStats(BaseModel):
    """Withdrawal statistics for a day."""

    initiated: int = 0
    verified: int = 0
    completed: int = 0
    cancelled: int = 0


class QRLookupResponse(BaseModel):
    """Response from QR code lookup."""

    id: int
    full_name: str
    relationship_type: str
    photo_url: str | None
    student_ids: list[int]


# ==================== Helpers ====================


def _build_withdrawal_response(w) -> WithdrawalResponse:
    """Build a WithdrawalResponse from a StudentWithdrawal model."""
    return WithdrawalResponse(
        id=w.id,
        student_id=w.student_id,
        student_name=w.student.full_name if w.student else None,
        course_name=w.student.course.name if w.student and w.student.course else None,
        authorized_pickup_id=w.authorized_pickup_id,
        pickup_name=w.authorized_pickup.full_name if w.authorized_pickup else None,
        pickup_relationship=w.authorized_pickup.relationship_type if w.authorized_pickup else None,
        status=w.status,
        verification_method=w.verification_method,
        device_id=w.device_id,
        initiated_at=w.initiated_at,
        verified_at=w.verified_at,
        completed_at=w.completed_at,
        cancelled_at=w.cancelled_at,
        reason=w.reason,
        cancellation_reason=w.cancellation_reason,
        signature_data=w.signature_data,
        pickup_photo_ref=w.pickup_photo_ref,
    )


def _build_withdrawal_list_item(w) -> WithdrawalListItem:
    """Build a WithdrawalListItem from a StudentWithdrawal model."""
    return WithdrawalListItem(
        id=w.id,
        student_id=w.student_id,
        student_name=w.student.full_name if w.student else "Desconocido",
        course_name=w.student.course.name if w.student and w.student.course else None,
        pickup_name=w.authorized_pickup.full_name if w.authorized_pickup else "Admin",
        pickup_relationship=w.authorized_pickup.relationship_type if w.authorized_pickup else None,
        status=w.status,
        verification_method=w.verification_method,
        device_id=w.device_id,
        initiated_at=w.initiated_at,
        completed_at=w.completed_at,
    )


# ==================== Endpoints ====================


@router.post("/initiate", response_model=list[WithdrawalResponse])
@limiter.limit("30/minute")
async def initiate_withdrawal(
    request: Request,
    payload: WithdrawalInitiateRequest,
    service: WithdrawalService = Depends(deps.get_withdrawal_service),
    user: AuthUser | None = Depends(deps.get_current_user_optional),
    device_authenticated: bool = Depends(deps.verify_device_key),
) -> list[WithdrawalResponse]:
    """Initiate withdrawal for one or more students.

    This is step 1 of the withdrawal process:
    1. Validates that each student can be withdrawn (entered today, not already withdrawn)
    2. If authorized_pickup_id provided, validates authorization
    3. Creates withdrawal records in INITIATED status

    Supports both device key auth (kiosk) and JWT auth (web admin).
    """
    if not device_authenticated:
        if not user or user.role not in {"ADMIN", "DIRECTOR", "INSPECTOR"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para iniciar retiros",
            )

    ip_address = request.client.host if request.client else None

    withdrawals = await service.initiate_withdrawal(
        student_ids=payload.student_ids,
        authorized_pickup_id=payload.authorized_pickup_id,
        device_id=payload.device_id,
        device_timezone=payload.device_timezone,
        ip_address=ip_address,
        user_agent=request.headers.get("user-agent"),
        request=request,
    )

    return [_build_withdrawal_response(w) for w in withdrawals]


@router.post("/{withdrawal_id}/verify", response_model=WithdrawalResponse)
@limiter.limit("30/minute")
async def verify_withdrawal(
    request: Request,
    payload: WithdrawalVerifyRequest,
    withdrawal_id: int = Path(..., gt=0),
    service: WithdrawalService = Depends(deps.get_withdrawal_service),
    user: AuthUser | None = Depends(deps.get_current_user_optional),
    device_authenticated: bool = Depends(deps.verify_device_key),
) -> WithdrawalResponse:
    """Verify identity for a withdrawal.

    This is step 2 of the withdrawal process:
    1. Validates that withdrawal is in INITIATED status
    2. Records verification method (QR_SCAN, PHOTO_MATCH, ADMIN_OVERRIDE)
    3. Moves withdrawal to VERIFIED status

    Supports both device key auth (kiosk) and JWT auth (web admin).
    """
    if not device_authenticated:
        if not user or user.role not in {"ADMIN", "DIRECTOR", "INSPECTOR"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para verificar retiros",
            )

    # Only set verified_by for ADMIN_OVERRIDE with actual user
    verified_by = None
    if payload.verification_method == WithdrawalVerificationMethod.ADMIN_OVERRIDE and user:
        verified_by = user.id

    w = await service.verify_withdrawal(
        withdrawal_id,
        verification_method=payload.verification_method,
        verified_by_user_id=verified_by,
        pickup_photo_ref=payload.pickup_photo_ref,
        request=request,
    )

    return _build_withdrawal_response(w)


@router.post("/{withdrawal_id}/complete", response_model=WithdrawalResponse)
@limiter.limit("30/minute")
async def complete_withdrawal(
    request: Request,
    payload: WithdrawalCompleteRequest,
    withdrawal_id: int = Path(..., gt=0),
    service: WithdrawalService = Depends(deps.get_withdrawal_service),
    user: AuthUser | None = Depends(deps.get_current_user_optional),
    device_authenticated: bool = Depends(deps.verify_device_key),
) -> WithdrawalResponse:
    """Complete a withdrawal with signature.

    This is step 3 (final) of the withdrawal process:
    1. Validates that withdrawal is in VERIFIED status
    2. Records signature and reason
    3. Moves withdrawal to COMPLETED status

    Supports both device key auth (kiosk) and JWT auth (web admin).
    """
    if not device_authenticated:
        if not user or user.role not in {"ADMIN", "DIRECTOR", "INSPECTOR"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para completar retiros",
            )

    w = await service.complete_withdrawal(
        withdrawal_id,
        signature_data=payload.signature_data,
        reason=payload.reason,
        request=request,
    )

    return _build_withdrawal_response(w)


@router.post("/{withdrawal_id}/cancel", response_model=WithdrawalResponse)
@limiter.limit("20/minute")
async def cancel_withdrawal(
    request: Request,
    payload: WithdrawalCancelRequest,
    withdrawal_id: int = Path(..., gt=0),
    service: WithdrawalService = Depends(deps.get_withdrawal_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> WithdrawalResponse:
    """Cancel a withdrawal (requires reason).

    Can cancel from INITIATED or VERIFIED status.
    Cannot cancel COMPLETED or already CANCELLED withdrawals.
    """
    if user.role not in {"ADMIN", "DIRECTOR"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para cancelar retiros",
        )

    w = await service.cancel_withdrawal(
        withdrawal_id,
        cancelled_by_user_id=user.id,
        cancellation_reason=payload.reason,
        request=request,
    )

    return _build_withdrawal_response(w)


@router.post("/admin-override", response_model=WithdrawalResponse)
@limiter.limit("10/minute")
async def admin_override_withdrawal(
    request: Request,
    payload: AdminOverrideRequest,
    service: WithdrawalService = Depends(deps.get_withdrawal_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> WithdrawalResponse:
    """Admin manually approves a withdrawal without QR/photo verification.

    This combines initiate + verify + complete in one step.
    Requires a reason for audit purposes.
    """
    w = await service.admin_override_withdrawal(
        user,
        payload.student_id,
        reason=payload.reason,
        signature_data=payload.signature_data,
        device_id=payload.device_id,
        request=request,
    )

    return _build_withdrawal_response(w)


@router.get("/today", response_model=list[WithdrawalListItem])
async def list_today_withdrawals(
    service: WithdrawalService = Depends(deps.get_withdrawal_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> list[WithdrawalListItem]:
    """List all withdrawals for today."""
    withdrawals = await service.list_today_withdrawals(user)

    return [_build_withdrawal_list_item(w) for w in withdrawals]


@router.get("/stats", response_model=WithdrawalStats)
async def get_withdrawal_stats(
    date: datetime | None = Query(None, description="Date for stats (default: today)"),
    service: WithdrawalService = Depends(deps.get_withdrawal_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> WithdrawalStats:
    """Get withdrawal statistics for a day."""
    stats = await service.get_withdrawal_stats(user, date)

    return WithdrawalStats(
        initiated=stats.get(WithdrawalStatus.INITIATED.value, 0),
        verified=stats.get(WithdrawalStatus.VERIFIED.value, 0),
        completed=stats.get(WithdrawalStatus.COMPLETED.value, 0),
        cancelled=stats.get(WithdrawalStatus.CANCELLED.value, 0),
    )


@router.get("/lookup-qr/{qr_hash}", response_model=QRLookupResponse)
@limiter.limit("60/minute")
async def lookup_qr_code(
    request: Request,
    qr_hash: str = Path(..., min_length=10),
    service: WithdrawalService = Depends(deps.get_withdrawal_service),
) -> QRLookupResponse:
    """Lookup authorized pickup by QR code hash.

    Used by kiosk for QR scan verification.
    Does not require user authentication (kiosk uses device auth).
    """
    result = await service.lookup_by_qr_hash(qr_hash)

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="QR no reconocido o persona desactivada",
        )

    return QRLookupResponse(
        id=result["id"],
        full_name=result["full_name"],
        relationship_type=result["relationship_type"],
        photo_url=result["photo_url"],
        student_ids=result["student_ids"],
    )


@router.get("", response_model=PaginatedWithdrawals)
async def list_withdrawals(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    student_id: int | None = Query(None),
    pickup_id: int | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    service: WithdrawalService = Depends(deps.get_withdrawal_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> PaginatedWithdrawals:
    """List withdrawals with filters and pagination."""
    status_enum = WithdrawalStatus(status_filter) if status_filter else None

    withdrawals, total = await service.list_withdrawals(
        user,
        skip=offset,
        limit=limit,
        student_id=student_id,
        pickup_id=pickup_id,
        status=status_enum,
        date_from=date_from,
        date_to=date_to,
    )

    items = [_build_withdrawal_list_item(w) for w in withdrawals]

    return PaginatedWithdrawals(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + len(items) < total,
    )


@router.get("/{withdrawal_id}", response_model=WithdrawalResponse)
async def get_withdrawal(
    withdrawal_id: int = Path(..., gt=0),
    service: WithdrawalService = Depends(deps.get_withdrawal_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> WithdrawalResponse:
    """Get withdrawal by ID."""
    w = await service.get_withdrawal(user, withdrawal_id)

    return _build_withdrawal_response(w)


@router.post("/{withdrawal_id}/photo")
@limiter.limit("30/minute")
async def upload_withdrawal_photo(
    request: Request,
    withdrawal_id: int = Path(..., gt=0),
    file: UploadFile = File(...),
    service: WithdrawalService = Depends(deps.get_withdrawal_service),
    user: AuthUser | None = Depends(deps.get_current_user_optional),
    device_authenticated: bool = Depends(deps.verify_device_key),
) -> dict:
    """Upload a selfie photo for withdrawal identity verification.

    Accepts multipart file upload. Stores the photo in S3/MinIO
    and updates the withdrawal's pickup_photo_ref field.

    Supports both device key auth (kiosk) and JWT auth (web admin).
    """
    if not device_authenticated:
        if not user or user.role not in {"ADMIN", "DIRECTOR", "INSPECTOR"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No autorizado",
            )

    # Validate file type
    content_type = file.content_type or "image/jpeg"
    if not content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se permiten archivos de imagen",
        )

    # Read file data (limit to 10MB)
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Archivo demasiado grande (máximo 10MB)",
        )

    # Get the withdrawal to validate it exists
    withdrawal = await service.withdrawal_repo.get(withdrawal_id)
    if not withdrawal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Retiro no encontrado",
        )

    # Store photo in S3
    photo_service = PhotoService()
    try:
        ext = content_type.split("/")[-1] if "/" in content_type else "jpg"
        key = f"withdrawals/{withdrawal_id}/selfie.{ext}"
        await photo_service.store_photo(key, data, content_type)

        # Update the withdrawal record
        withdrawal.pickup_photo_ref = key
        await service.session.flush()

        logger.info(f"Uploaded withdrawal photo: {key} for withdrawal {withdrawal_id}")

        return {"photo_ref": key, "withdrawal_id": withdrawal_id}
    except Exception as e:
        logger.error(f"Failed to upload withdrawal photo: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al guardar foto",
        ) from e
    finally:
        photo_service.close()


@router.get("/{withdrawal_id}/photo")
@limiter.limit("60/minute")
async def get_withdrawal_photo(
    request: Request,
    withdrawal_id: int = Path(..., gt=0),
    service: WithdrawalService = Depends(deps.get_withdrawal_service),
    user: TenantAuthUser = Depends(deps.get_current_tenant_user),
) -> Response:
    """Get the pickup photo for a withdrawal.

    Returns the photo taken during identity verification (selfie).
    Returns 404 if no photo was captured for this withdrawal.
    """
    w = await service.get_withdrawal(user, withdrawal_id)

    if not w.pickup_photo_ref:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Este retiro no tiene foto de verificación",
        )

    photo_service = PhotoService()
    try:
        result = await photo_service.get_photo(w.pickup_photo_ref)

        if result is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Foto no encontrada en almacenamiento",
            )

        photo_data, content_type = result

        return Response(
            content=photo_data,
            media_type=content_type,
            headers={
                "Cache-Control": "private, max-age=3600",
                "X-Content-Type-Options": "nosniff",
            },
        )
    finally:
        photo_service.close()
