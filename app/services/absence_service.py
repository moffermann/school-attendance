"""Service layer for absence requests."""

from __future__ import annotations

from datetime import date, datetime, timezone

from app.core.auth import AuthUser
from app.db.repositories.absences import AbsenceRepository
from app.db.repositories.guardians import GuardianRepository
from app.db.repositories.students import StudentRepository
from app.schemas.absences import AbsenceRequestCreate, AbsenceStatus


class AbsenceService:
    """Business logic for absence requests."""

    def __init__(self, session):
        self.session = session
        self.absence_repo = AbsenceRepository(session)
        self.student_repo = StudentRepository(session)
        self.guardian_repo = GuardianRepository(session)

    async def submit_absence(self, user: AuthUser, payload: AbsenceRequestCreate):
        student = await self.student_repo.get(payload.student_id)
        if not student:
            raise ValueError("Student not found")

        if payload.start > payload.end:
            raise ValueError("La fecha de fin debe ser mayor o igual a la de inicio")

        if user.role == "PARENT":
            if not user.guardian_id:
                raise PermissionError("Apoderado no asociado a un alumno")

            guardian = await self.guardian_repo.get(user.guardian_id)
            if not guardian:
                raise ValueError("Guardian not found")

            student_ids = {item.id for item in guardian.students}
            if payload.student_id not in student_ids:
                raise PermissionError("El alumno no pertenece al apoderado")

        submitted_at = datetime.now(timezone.utc)
        record = await self.absence_repo.create(
            student_id=payload.student_id,
            type_=payload.type.value,
            start_date=payload.start,
            end_date=payload.end,
            comment=payload.comment,
            attachment_ref=payload.attachment_name,
            submitted_at=submitted_at,
        )

        await self.session.commit()
        await self.session.refresh(record)
        return record

    async def list_absences(
        self,
        user: AuthUser,
        *,
        start_date: date | None = None,
        end_date: date | None = None,
        status: str | None = None,
    ) -> list:
        # Staff roles can see all absence records
        if user.role in {"ADMIN", "DIRECTOR", "INSPECTOR"}:
            records = await self.absence_repo.list_all()
        # Parents can only see their own children's records
        elif not user.guardian_id:
            records = []
        else:
            guardian = await self.guardian_repo.get(user.guardian_id)
            if not guardian:
                records = []
            else:
                student_ids = [student.id for student in guardian.students]
                records = await self.absence_repo.list_by_student_ids(student_ids)

        if start_date:
            records = [r for r in records if r.start_date >= start_date]
        if end_date:
            records = [r for r in records if r.end_date <= end_date]
        if status:
            records = [r for r in records if (r.status or "").upper() == status.upper()]
        return records

    async def update_status(self, absence_id: int, status: AbsenceStatus) -> object:
        record = await self.absence_repo.update_status(absence_id, status.value)
        await self.session.commit()
        return record
