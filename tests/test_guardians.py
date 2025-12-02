from app.schemas.guardians import ChannelPreference, GuardianPreferencesRead


def test_guardian_preferences_read_structure() -> None:
    pref = GuardianPreferencesRead(
        guardian_id=1,
        preferences={
            "INGRESO_OK": ChannelPreference(whatsapp=True, email=False),
        },
    )

    assert pref.guardian_id == 1
    assert pref.preferences["INGRESO_OK"].whatsapp is True
