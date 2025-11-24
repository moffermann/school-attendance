"""Guardian schemas."""

from pydantic import BaseModel, Field


class ContactPreference(BaseModel):
    channel: str
    enabled: bool


class GuardianPreferencesRead(BaseModel):
    guardian_id: int
    preferences: dict[str, list[ContactPreference]]
    photo_consents: dict[int, bool] = Field(default_factory=dict)


class GuardianPreferencesUpdate(BaseModel):
    preferences: dict[str, list[ContactPreference]] = Field(default_factory=dict)
    photo_consents: dict[int, bool] = Field(default_factory=dict)
