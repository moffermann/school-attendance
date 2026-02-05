"""Service layer for parent-initiated withdrawal requests."""

from __future__ import annotations

import logging
from datetime import UTC, date, datetime

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.withdrawal_request import WithdrawalRequest, WithdrawalRequestStatus
from app.db.repositories.authorized_pickups import AuthorizedPickupRepository
from app.db.repositories.guardians import GuardianRepository
from app.db.repositories.withdrawal_requests import WithdrawalRequestRepository

logger = logging.getLogger(__name__)


class WithdrawalRequestService:
    """Business logic for parent withdrawal requests."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.request_repo = WithdrawalRequestRepository(session)
        self.pickup_repo = AuthorizedPickupRepository(session)
        self.guardian_repo = GuardianRepository(session)

    async def create_request(
        self,
        guardian_id: int,
        user_id: int,
        *,
        student_id: int,
        authorized_pickup_id: int,
        scheduled_date: date,
        scheduled_time: object | None = None,
        reason: str | None = None,
    ) -> WithdrawalRequest:
        """Create a new withdrawal request.

        Validates:
        - Student belongs to the guardian
        - Pickup is authorized for the student
        - No duplicate active request for same student+date
        - Date is today or future
        """
        # Validate student belongs to guardian
        guardian = await self.guardian_repo.get(guardian_id)
        if not guardian:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Apoderado no encontrado",
            )

        student_ids = [s.id for s in guardian.students] if guardian.students else []
        if student_id not in student_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="El estudiante no pertenece a este apoderado",
            )

        # Validate pickup is authorized for the student
        is_authorized = await self.pickup_repo.is_authorized_for_student(
            authorized_pickup_id, student_id
        )
        if not is_authorized:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La persona no está autorizada para retirar a este estudiante",
            )

        # Validate pickup is active
        pickup = await self.pickup_repo.get_active(authorized_pickup_id)
        if not pickup:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La persona autorizada está inactiva",
            )

        # Validate date is not in the past
        today = datetime.now(UTC).date()
        if scheduled_date < today:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La fecha debe ser hoy o futura",
            )

        # Check for duplicate
        has_active = await self.request_repo.has_active_request(student_id, scheduled_date)
        if has_active:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe una solicitud activa para este estudiante en esta fecha",
            )

        return await self.request_repo.create(
            student_id=student_id,
            authorized_pickup_id=authorized_pickup_id,
            scheduled_date=scheduled_date,
            scheduled_time=scheduled_time,
            reason=reason,
            requested_by_guardian_id=guardian_id,
            requested_by_user_id=user_id,
        )

    async def approve_request(
        self,
        request_id: int,
        reviewer_user_id: int,
        notes: str | None = None,
    ) -> WithdrawalRequest:
        """Approve a pending withdrawal request (staff action)."""
        req = await self.request_repo.get(request_id)
        if not req:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Solicitud no encontrada",
            )
        if not req.can_be_reviewed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Solo se pueden aprobar solicitudes pendientes (estado actual: {req.status})",
            )

        updated = await self.request_repo.update_status(
            request_id,
            WithdrawalRequestStatus.APPROVED.value,
            reviewed_by=reviewer_user_id,
            review_notes=notes,
        )
        return updated  # type: ignore[return-value]

    async def reject_request(
        self,
        request_id: int,
        reviewer_user_id: int,
        notes: str | None = None,
    ) -> WithdrawalRequest:
        """Reject a pending withdrawal request (staff action)."""
        req = await self.request_repo.get(request_id)
        if not req:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Solicitud no encontrada",
            )
        if not req.can_be_reviewed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Solo se pueden rechazar solicitudes pendientes (estado actual: {req.status})",
            )

        updated = await self.request_repo.update_status(
            request_id,
            WithdrawalRequestStatus.REJECTED.value,
            reviewed_by=reviewer_user_id,
            review_notes=notes,
        )
        return updated  # type: ignore[return-value]

    async def cancel_request(
        self,
        request_id: int,
        guardian_id: int,
    ) -> WithdrawalRequest:
        """Cancel a withdrawal request (parent action).

        Only the guardian who created it can cancel.
        Only PENDING or APPROVED can be cancelled.
        """
        req = await self.request_repo.get(request_id)
        if not req:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Solicitud no encontrada",
            )
        if req.requested_by_guardian_id != guardian_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tiene permiso para cancelar esta solicitud",
            )
        if not req.can_be_cancelled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No se puede cancelar una solicitud en estado {req.status}",
            )

        updated = await self.request_repo.cancel(request_id)
        return updated  # type: ignore[return-value]

    async def complete_from_withdrawal(
        self,
        student_withdrawal_id: int,
        student_id: int,
        pickup_id: int | None,
    ) -> WithdrawalRequest | None:
        """Auto-link an APPROVED request when a real withdrawal occurs.

        Called from WithdrawalService.complete_withdrawal().
        Non-critical: returns None if no matching request found.
        """
        if not pickup_id:
            return None

        today = datetime.now(UTC).date()
        matching = await self.request_repo.find_matching_request(
            student_id=student_id,
            authorized_pickup_id=pickup_id,
            target_date=today,
        )
        if not matching:
            return None

        return await self.request_repo.link_to_withdrawal(
            matching.id, student_withdrawal_id
        )
