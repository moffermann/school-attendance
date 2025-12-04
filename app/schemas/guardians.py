"""Guardian schemas."""

from typing import Any

from pydantic import BaseModel, Field


class ChannelPreference(BaseModel):
    """Preference for a notification channel."""
    whatsapp: bool = True
    email: bool = False


class GuardianPreferencesRead(BaseModel):
    """Response schema for guardian preferences."""
    guardian_id: int
    preferences: dict[str, ChannelPreference] = Field(default_factory=dict)
    photo_consents: dict[str, bool] = Field(default_factory=dict)

    class Config:
        json_schema_extra = {
            "example": {
                "guardian_id": 1,
                "preferences": {
                    "INGRESO_OK": {"whatsapp": True, "email": False},
                    "SALIDA_OK": {"whatsapp": True, "email": False},
                    "NO_INGRESO_UMBRAL": {"whatsapp": True, "email": True},
                    "CAMBIO_HORARIO": {"whatsapp": True, "email": True}
                },
                "photo_consents": {
                    "1": True,
                    "2": False
                }
            }
        }


class GuardianPreferencesUpdate(BaseModel):
    """Request schema for updating guardian preferences."""
    # R3-V1 fix: Use proper type for preferences with ChannelPreference
    preferences: dict[str, ChannelPreference] | None = Field(default=None)
    photo_consents: dict[str, bool] | None = Field(default=None)

    class Config:
        json_schema_extra = {
            "example": {
                "preferences": {
                    "INGRESO_OK": {"whatsapp": True, "email": False},
                    "SALIDA_OK": {"whatsapp": True, "email": False}
                },
                "photo_consents": {
                    "1": True,
                    "2": False
                }
            }
        }
