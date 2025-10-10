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
        return GuardianPreferencesRead(guardian_id=guardian.id, preferences=prefs)

    async def update_guardian_preferences(
        self, guardian_id: int, payload: GuardianPreferencesUpdate
    ) -> GuardianPreferencesRead:
        guardian = await self.guardian_repo.get(guardian_id)
        if not guardian:
            raise ValueError("Guardian not found")

        guardian.notification_prefs = payload.preferences
        await self.guardian_repo.save(guardian)
        await self.session.commit()

        return GuardianPreferencesRead(guardian_id=guardian.id, preferences=guardian.notification_prefs)
