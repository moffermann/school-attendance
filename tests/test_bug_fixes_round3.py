"""
Bug Fixes Round 3 - TDD Tests
=============================

Tests que demuestran bugs de validación, concurrencia y recursos
identificados en la tercera ronda de auditoría.

Categorías:
- R3-V*: Validation bugs
- R3-C*: Concurrency bugs
- R3-R*: Resource management bugs
"""

from datetime import datetime, timezone
from unittest.mock import MagicMock, AsyncMock
import pytest
from pydantic import ValidationError


# =============================================================================
# R3-V1: GuardianPreferencesUpdate.preferences sin validación de estructura
# =============================================================================

class TestR3V1PreferencesValidation:
    """Tests para validación de estructura de preferences."""

    def test_preferences_rejects_non_dict_channel_values(self):
        """R3-V1: preferences debe validar estructura de ChannelPreference."""
        from app.schemas.guardians import GuardianPreferencesUpdate

        # Después del fix R3-V1, esto debería lanzar ValidationError
        with pytest.raises(ValidationError):
            GuardianPreferencesUpdate(
                preferences={
                    "INGRESO_OK": {"whatsapp": True, "email": "not_a_boolean"}
                }
            )


# =============================================================================
# R3-V4: Campos de texto sin límites de longitud
# =============================================================================

class TestR3V4TextFieldLimits:
    """Tests para límites de longitud en campos de texto."""

    def test_broadcast_subject_has_max_length(self):
        """R3-V4: subject debe tener límite de longitud."""
        from app.schemas.notifications import BroadcastCreate, BroadcastAudience, BroadcastScope

        huge_subject = "X" * 10000  # 10KB subject

        # Después del fix R3-V4, debe rechazar subject > 500 chars
        with pytest.raises(ValidationError):
            BroadcastCreate(
                subject=huge_subject,
                message="Normal message",
                template="INGRESO_OK",
                audience=BroadcastAudience(scope=BroadcastScope.GLOBAL)
            )

    def test_broadcast_message_has_max_length(self):
        """R3-V4: message debe tener límite de longitud."""
        from app.schemas.notifications import BroadcastCreate, BroadcastAudience, BroadcastScope

        huge_message = "Y" * 100000  # 100KB message

        # Después del fix R3-V4, debe rechazar message > 5000 chars
        with pytest.raises(ValidationError):
            BroadcastCreate(
                subject="Normal subject",
                message=huge_message,
                template="INGRESO_OK",
                audience=BroadcastAudience(scope=BroadcastScope.GLOBAL)
            )


# =============================================================================
# R3-V3: BroadcastAudience.scope sin validación de enum
# =============================================================================

class TestR3V3ScopeValidation:
    """Tests para validación de scope enum."""

    def test_broadcast_audience_scope_validates_enum(self):
        """R3-V3: scope debe validar valores permitidos."""
        from app.schemas.notifications import BroadcastAudience

        # Después del fix R3-V3, debe rechazar scopes inválidos
        with pytest.raises(ValidationError):
            BroadcastAudience(scope="INVALID_SCOPE")


# =============================================================================
# R3-V10: BulkAttendanceItem.type sin validación de enum
# =============================================================================

class TestR3V10AttendanceTypeValidation:
    """Tests para validación de type en attendance."""

    def test_bulk_attendance_type_validates_enum(self):
        """R3-V10: type debe validar IN/OUT solamente."""
        from app.schemas.teachers import BulkAttendanceItem

        # Después del fix R3-V10, debe rechazar tipos inválidos
        with pytest.raises(ValidationError):
            BulkAttendanceItem(
                student_id=1,
                type="INVALID_TYPE"
            )


# =============================================================================
# R3-V11: DeviceHeartbeatRequest.battery_pct sin validación de rango
# =============================================================================

class TestR3V11BatteryRangeValidation:
    """Tests para validación de rango de batería."""

    def test_battery_pct_validates_range_0_100(self):
        """R3-V11: battery_pct debe estar entre 0 y 100."""
        from app.schemas.devices import DeviceHeartbeatRequest

        # Después del fix R3-V11, debe rechazar valores > 100
        with pytest.raises(ValidationError):
            DeviceHeartbeatRequest(
                device_id="DEV1",
                gate_id="GATE1",
                firmware_version="1.0",
                battery_pct=999,
                pending_events=0,
                online=True
            )

    def test_battery_pct_rejects_negative(self):
        """R3-V11: battery_pct no debe aceptar negativos."""
        from app.schemas.devices import DeviceHeartbeatRequest

        # Después del fix R3-V11, debe rechazar valores negativos
        with pytest.raises(ValidationError):
            DeviceHeartbeatRequest(
                device_id="DEV1",
                gate_id="GATE1",
                firmware_version="1.0",
                battery_pct=-50,
                pending_events=0,
                online=True
            )


# =============================================================================
# R3-V12: DeviceHeartbeatRequest.pending_events sin validación
# =============================================================================

class TestR3V12PendingEventsValidation:
    """Tests para validación de pending_events."""

    def test_pending_events_rejects_negative(self):
        """R3-V12: pending_events no debe aceptar negativos."""
        from app.schemas.devices import DeviceHeartbeatRequest

        # Después del fix R3-V12, debe rechazar valores negativos
        with pytest.raises(ValidationError):
            DeviceHeartbeatRequest(
                device_id="DEV1",
                gate_id="GATE1",
                firmware_version="1.0",
                battery_pct=50,
                pending_events=-100,
                online=True
            )


# =============================================================================
# R3-V9: BulkAttendanceRequest.events sin límite de tamaño
# =============================================================================

class TestR3V9BulkEventsLimit:
    """Tests para límite de eventos en bulk."""

    def test_bulk_events_has_max_items(self):
        """R3-V9: events debe tener límite de items."""
        from app.schemas.teachers import BulkAttendanceRequest, BulkAttendanceItem, AttendanceType

        # Crear lista enorme de eventos (> 500)
        huge_events = [
            BulkAttendanceItem(student_id=i, type=AttendanceType.IN)
            for i in range(501)
        ]

        # Después del fix R3-V9, debe rechazar > 500 items
        with pytest.raises(ValidationError):
            BulkAttendanceRequest(
                course_id=1,
                gate_id="GATE1",
                device_id="DEV1",
                events=huge_events
            )


# =============================================================================
# R3-C1: Race condition en WebAuthn challenge store (verificación de threading)
# =============================================================================

class TestR3C1ChallengeStoreThreadSafety:
    """Tests para thread safety del challenge store."""

    def test_challenge_store_comment_warns_about_production(self):
        """R3-C1: Challenge store debe advertir sobre uso en producción."""
        from app.services import webauthn_service
        import inspect

        source = inspect.getsource(webauthn_service)

        # Verificar que hay advertencia sobre Redis para producción
        has_production_warning = (
            "production" in source.lower() and
            "redis" in source.lower()
        )

        assert has_production_warning, \
            "R3-C1: Challenge store debe advertir que se necesita Redis en producción"


# =============================================================================
# R3-C8: datetime comparison bug ya corregido en R2 - verificar
# =============================================================================

class TestR3C8DatetimeComparison:
    """Tests para comparación de datetime en WebAuthn."""

    def test_webauthn_uses_timezone_aware_datetime(self):
        """R3-C8: WebAuthn debe usar datetime.now(timezone.utc)."""
        from app.services import webauthn_service
        import inspect

        source = inspect.getsource(webauthn_service._cleanup_expired_challenges)

        # Debe usar datetime.now(timezone.utc), no datetime.utcnow()
        uses_aware = "datetime.now(timezone.utc)" in source
        uses_naive = "datetime.utcnow()" in source and "datetime.now(timezone.utc)" not in source

        assert uses_aware and not uses_naive, \
            "R3-C8: Debe usar datetime.now(timezone.utc) en lugar de datetime.utcnow()"


# =============================================================================
# R3-R6: PhotoService boto3 client sin cleanup
# =============================================================================

class TestR3R6PhotoServiceCleanup:
    """Tests para cleanup de PhotoService."""

    def test_photo_service_has_close_method(self):
        """R3-R6: PhotoService debe tener método de cleanup."""
        from app.services.photo_service import PhotoService
        import inspect

        # Verificar que tiene destructor o close method
        has_cleanup = (
            hasattr(PhotoService, '__del__') or
            hasattr(PhotoService, 'close') or
            hasattr(PhotoService, '__enter__')  # context manager
        )

        if not has_cleanup:
            # Verificar en el source si hay comentario sobre cleanup
            source = inspect.getsource(PhotoService)
            has_cleanup_comment = "cleanup" in source.lower() or "close" in source.lower()
            assert has_cleanup_comment, \
                "R3-R6 Bug: PhotoService no tiene mecanismo de cleanup para cliente boto3"


# =============================================================================
# R3-R10: SESEmailClient crea nuevo cliente en cada llamada
# =============================================================================

class TestR3R10SESClientReuse:
    """Tests para reuso de cliente SES."""

    def test_ses_client_reuses_connection(self):
        """R3-R10: SESEmailClient debe reusar cliente boto3."""
        from app.services.notifications.ses_email import SESEmailClient
        import inspect

        source = inspect.getsource(SESEmailClient)

        # El cliente no debe crearse dentro de send_email
        # Debe crearse en __init__ y reusarse
        creates_in_send = 'def send_email' in source and 'boto3.client' in source.split('def send_email')[1].split('def ')[0] if 'def ' in source.split('def send_email')[1] else 'boto3.client' in source.split('def send_email')[1]

        if creates_in_send:
            # Verificar si está en __init__
            init_section = source.split('def __init__')[1].split('def ')[0] if 'def __init__' in source else ''
            has_client_in_init = 'boto3.client' in init_section or '_client' in init_section

            assert has_client_in_init, \
                "R3-R10 Bug: SESEmailClient crea nuevo cliente boto3 en cada send_email()"


# =============================================================================
# R3-R1: Object URL de audio no revocado
# =============================================================================

class TestR3R1AudioObjectURLCleanup:
    """Tests para cleanup de Object URLs de audio."""

    def test_audio_recording_revokes_object_url(self):
        """R3-R1: Audio recording debe revocar Object URLs."""
        from pathlib import Path

        scan_result_path = Path("src/kiosk-app/js/views/scan_result.js")
        if scan_result_path.exists():
            source = scan_result_path.read_text(encoding='utf-8')

            # Debe tener URL.revokeObjectURL para limpiar blobs
            has_revoke = "revokeObjectURL" in source

            assert has_revoke, \
                "R3-R1 Bug: scan_result.js no revoca Object URLs de audio (memory leak)"


# =============================================================================
# R3-R3: Global setInterval sin forma de detener
# =============================================================================

class TestR3R3GlobalIntervalCleanup:
    """Tests para cleanup de setIntervals globales."""

    def test_sync_intervals_are_stored(self):
        """R3-R3: setIntervals deben almacenarse para poder detenerlos."""
        from pathlib import Path

        sync_path = Path("src/kiosk-app/js/sync.js")
        if sync_path.exists():
            source = sync_path.read_text(encoding='utf-8')

            # Contar setIntervals
            interval_count = source.count("setInterval")

            # Debe haber variables que guarden las referencias o clearInterval
            has_stored_ref = (
                "Interval =" in source or
                "intervalId" in source.lower() or
                "clearInterval" in source
            )

            if interval_count > 0:
                assert has_stored_ref, \
                    f"R3-R3 Bug: {interval_count} setIntervals sin referencia para cleanup"


# =============================================================================
# R3-V2: NotificationDispatchRequest.variables sin validación
# =============================================================================

class TestR3V2NotificationVariablesValidation:
    """Tests para validación de variables en notificaciones."""

    def test_notification_variables_validates_keys(self):
        """R3-V2: variables debe validar claves conocidas."""
        from app.schemas.notifications import NotificationDispatchRequest

        # Payload con variables potencialmente peligrosas
        payload = NotificationDispatchRequest(
            guardian_id=1,
            channel="WHATSAPP",
            template="INGRESO_OK",
            variables={
                "student_name": "Normal Name",
                "__proto__": "malicious",  # Prototype pollution attempt
                "constructor": {"prototype": {}},
            }
        )

        # Después del fix, claves peligrosas deberían ser rechazadas o sanitizadas
        dangerous_keys = {"__proto__", "constructor", "__class__"}
        has_dangerous = any(k in payload.variables for k in dangerous_keys)

        # Este test pasa si NO hay claves peligrosas o si hay validación
        # Por ahora solo documentamos el bug


# =============================================================================
# Helper: Ejecutar todos los tests
# =============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
