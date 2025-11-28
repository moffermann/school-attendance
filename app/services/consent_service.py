"""Consent and preferences service implementation."""

from app.db.repositories.guardians import GuardianRepository
from app.schemas.guardians import GuardianPreferencesRead, GuardianPreferencesUpdate


class ConsentService:
    def __init__(self, session):
        self.session = session
        self.guardian_repo = GuardianRepository(session)

    async def get_guardian_preferences(self, guardian_id: int) -> GuardianPreferencesRead:
        guardian = await self.guardian_repo.get(guardian_id)
        if not guardian:
            raise ValueError("Guardian not found")

        prefs = guardian.notification_prefs or {}
        return GuardianPreferencesRead(
            guardian_id=guardian.id,
            preferences=prefs,
            photo_consents=self._collect_photo_consents(guardian),
        )

    async def update_guardian_preferences(
        self, guardian_id: int, payload: GuardianPreferencesUpdate
    ) -> GuardianPreferencesRead:
        guardian = await self.guardian_repo.get(guardian_id)
        if not guardian:
            raise ValueError("Guardian not found")

        guardian.notification_prefs = payload.preferences or {}

        if payload.photo_consents:
            student_map = {student.id: student for student in guardian.students}
            for key, allowed in payload.photo_consents.items():
                try:
                    student_id = int(key)
                except (TypeError, ValueError):
                    continue
                student = student_map.get(student_id)
                if not student:
                    continue
                student.photo_pref_opt_in = bool(allowed)

        await self.guardian_repo.save(guardian)
        await self.session.commit()

        return GuardianPreferencesRead(
            guardian_id=guardian.id,
            preferences=guardian.notification_prefs,
            photo_consents=self._collect_photo_consents(guardian),
        )

    @staticmethod
    def _collect_photo_consents(guardian) -> dict[str, bool]:
        """Collect photo consents for all students of a guardian.

        Returns dict with string keys for JSON serialization compatibility.
        """
        return {
            str(student.id): bool(getattr(student, "photo_pref_opt_in", False))
            for student in getattr(guardian, "students", [])
        }
