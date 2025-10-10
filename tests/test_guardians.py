from app.schemas.guardians import ContactPreference, GuardianPreferencesRead


def test_guardian_preferences_read_structure() -> None:
    pref = GuardianPreferencesRead(
        guardian_id=1,
        preferences={
            "INGRESO_OK": [ContactPreference(channel="WHATSAPP", enabled=True)],
        },
    )

    assert pref.guardian_id == 1
    assert pref.preferences["INGRESO_OK"][0].channel == "WHATSAPP"
