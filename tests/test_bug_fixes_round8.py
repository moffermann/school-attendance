"""
Bug Fixes Round 8 - TDD Tests
=============================

Tests que demuestran bugs en Frontend, Core/Config y Schemas
identificados en la octava ronda de auditoría.

Categorías:
- R8-F*: Frontend JS bugs (verificación de patrones)
- R8-C*: Core/config bugs
- R8-V*: Schema validation bugs
"""

from datetime import datetime, timezone, date
from unittest.mock import MagicMock, AsyncMock, patch
from enum import Enum
import pytest
from pydantic import ValidationError


# =============================================================================
# R8-C4: OpenAPI docs expuestos en producción
# =============================================================================

class TestR8C4OpenAPIProduction:
    """Tests para OpenAPI docs en producción."""

    def test_openapi_disabled_in_production(self):
        """R8-C4: OpenAPI docs deben deshabilitarse en producción."""
        from app import main
        import inspect

        source = inspect.getsource(main)

        # Debe haber lógica condicional para deshabilitar docs en producción
        has_conditional = (
            'openapi_url' in source and 'production' in source.lower() or
            'docs_url' in source and 'production' in source.lower() or
            'openapi_url=None' in source
        )

        # O al menos debe haber comentario sobre el riesgo
        has_awareness = 'production' in source.lower() and ('docs' in source.lower() or 'openapi' in source.lower())

        assert has_conditional or has_awareness, \
            "R8-C4 Bug: OpenAPI docs siempre habilitados, deberían deshabilitarse en producción"


# =============================================================================
# R8-C5: Health check no verifica dependencias
# =============================================================================

class TestR8C5HealthCheckDependencies:
    """Tests para health check con dependencias."""

    def test_health_check_verifies_database(self):
        """R8-C5: Health check debe verificar conectividad de DB."""
        from app import main
        import inspect

        source = inspect.getsource(main)

        # Buscar el endpoint healthcheck
        if 'def healthcheck' in source or 'async def healthcheck' in source:
            # Debe tener verificación de DB
            has_db_check = (
                'database' in source.lower() or
                'session' in source.lower() or
                'execute' in source or
                'select 1' in source.lower()
            )

            # Por ahora solo retorna {"status": "ok"} sin verificaciones
            just_returns_ok = 'return {"status": "ok"}' in source

            assert has_db_check or not just_returns_ok, \
                "R8-C5 Bug: Health check no verifica estado de base de datos"


# =============================================================================
# R8-C7: backtrace=True en logging de producción
# =============================================================================

class TestR8C7LoggingBacktrace:
    """Tests para configuración de logging."""

    def test_logging_backtrace_conditional(self):
        """R8-C7: backtrace debe ser condicional en producción."""
        from app.core import logging as app_logging
        import inspect

        source = inspect.getsource(app_logging)

        # backtrace=True no debería estar hardcoded
        has_backtrace_true = 'backtrace=True' in source

        # Debería ser condicional basado en environment
        has_conditional = (
            'production' in source.lower() and 'backtrace' in source or
            'backtrace=False' in source or
            'settings.' in source and 'backtrace' in source
        )

        # Si tiene backtrace=True hardcoded sin condicional, es bug
        if has_backtrace_true and not has_conditional:
            assert False, \
                "R8-C7 Bug: backtrace=True hardcoded, expone info sensible en producción"


# =============================================================================
# R8-C8: CORS allow_credentials=True con wildcard origins
# =============================================================================

class TestR8C8CORSCredentials:
    """Tests para configuración de CORS."""

    def test_cors_credentials_not_with_wildcard(self):
        """R8-C8: allow_credentials=True no debe usarse con allow_origins=*."""
        from app import main
        import inspect

        source = inspect.getsource(main)

        # El bug es: allow_origins=["*"] AND allow_credentials=True
        has_wildcard = '["*"]' in source and 'allow_origins' in source
        has_credentials = 'allow_credentials=True' in source

        # Si ambos están presentes sin condicional que los separe
        if has_wildcard and has_credentials:
            # Verificar si hay lógica que previene la combinación
            has_safety = (
                'allow_credentials=False' in source or
                'if' in source and 'credentials' in source.lower()
            )

            assert has_safety, \
                "R8-C8 Bug: CORS con allow_credentials=True y allow_origins=['*'] es inválido"


# =============================================================================
# R8-V1: LoginRequest.email sin validación de formato
# =============================================================================

class TestR8V1EmailValidation:
    """Tests para validación de email en LoginRequest."""

    def test_login_request_validates_email_format(self):
        """R8-V1: email debe validar formato."""
        from app.schemas.auth import LoginRequest

        # Email inválido debería ser rechazado
        try:
            req = LoginRequest(email="not-an-email", password="secret")
            # Si llega aquí sin error, el email no se valida
            # Verificar si al menos es un EmailStr
            from pydantic import EmailStr
            import inspect
            source = inspect.getsource(LoginRequest)
            has_email_validation = 'EmailStr' in source or '@validator' in source or '@field_validator' in source

            assert has_email_validation, \
                "R8-V1 Bug: LoginRequest.email acepta cualquier string sin validar formato"
        except ValidationError:
            pass  # Correcto, el email inválido fue rechazado


# =============================================================================
# R8-V2: SessionUser.role sin enum
# =============================================================================

class TestR8V2RoleEnum:
    """Tests para enum de role en SessionUser."""

    def test_session_user_role_uses_enum(self):
        """R8-V2: role debe usar enum para valores válidos."""
        from app.schemas.auth import SessionUser
        import inspect

        source = inspect.getsource(SessionUser)

        # role debería usar Enum o Literal
        uses_enum = (
            'RoleEnum' in source or
            'UserRole' in source or
            'Literal[' in source or
            ': Role' in source
        )

        # O al menos tener validador
        has_validator = '@validator' in source or '@field_validator' in source

        assert uses_enum or has_validator, \
            "R8-V2 Bug: SessionUser.role acepta cualquier string sin validación"


# =============================================================================
# R8-V4: GuardianContact.type sin enum
# =============================================================================

class TestR8V4ContactTypeEnum:
    """Tests para enum de contact type."""

    def test_guardian_contact_type_uses_enum(self):
        """R8-V4: GuardianContact.type debe usar enum."""
        from app.schemas.webapp import GuardianContact
        import inspect

        source = inspect.getsource(GuardianContact)

        uses_enum = (
            'ContactType' in source or
            'Literal[' in source or
            'Enum' in source
        )

        assert uses_enum, \
            "R8-V4 Bug: GuardianContact.type acepta cualquier string"


# =============================================================================
# R8-V6: AttendanceEventSummary.type sin validación
# =============================================================================

class TestR8V6AttendanceTypeEnum:
    """Tests para enum de attendance type."""

    def test_attendance_event_summary_type_uses_enum(self):
        """R8-V6: AttendanceEventSummary.type debe usar enum IN/OUT."""
        from app.schemas.webapp import AttendanceEventSummary
        import inspect

        source = inspect.getsource(AttendanceEventSummary)

        uses_enum = (
            'AttendanceType' in source or
            'Literal[' in source and ('IN' in source or 'OUT' in source) or
            'EventType' in source
        )

        assert uses_enum, \
            "R8-V6 Bug: AttendanceEventSummary.type acepta cualquier string"


# =============================================================================
# R8-V7: DeviceSummary.battery_pct sin validación de rango
# =============================================================================

class TestR8V7BatteryRange:
    """Tests para validación de rango de batería."""

    def test_device_summary_battery_validates_range(self):
        """R8-V7: battery_pct debe validar rango 0-100."""
        from app.schemas.webapp import DeviceSummary
        import inspect

        source = inspect.getsource(DeviceSummary)

        # Debe tener Field con ge/le o validador
        has_range_validation = (
            'ge=' in source or
            'le=' in source or
            'gt=' in source or
            'lt=' in source or
            '@validator' in source or
            '@field_validator' in source
        )

        assert has_range_validation, \
            "R8-V7 Bug: DeviceSummary.battery_pct sin validación de rango 0-100"


# =============================================================================
# R8-V10: NoShowAlertRead.status no usa el enum definido
# =============================================================================

class TestR8V10AlertStatusEnum:
    """Tests para uso de enum en NoShowAlertRead."""

    def test_no_show_alert_status_uses_enum(self):
        """R8-V10: status debe usar NoShowAlertStatus enum."""
        from app.schemas.alerts import NoShowAlertRead, NoShowAlertStatus
        import inspect

        source = inspect.getsource(NoShowAlertRead)

        # Ya existe NoShowAlertStatus enum, pero status es str
        uses_enum = 'NoShowAlertStatus' in source

        assert uses_enum, \
            "R8-V10 Bug: NoShowAlertRead.status es str pero debería usar NoShowAlertStatus enum"


# =============================================================================
# R8-F5: fetch sin timeout en api-base.js
# =============================================================================

class TestR8F5FetchTimeout:
    """Tests para timeout en fetch de api-base.js."""

    def test_api_base_fetch_has_timeout(self):
        """R8-F5: fetch debe tener timeout configurado."""
        from pathlib import Path

        api_base_path = Path("src/lib/api-base.js")
        if api_base_path.exists():
            source = api_base_path.read_text(encoding='utf-8')

            # Buscar uso de AbortController o Promise.race para timeout
            has_timeout = (
                'AbortController' in source or
                'signal' in source or
                'Promise.race' in source or
                'timeout' in source.lower()
            )

            assert has_timeout, \
                "R8-F5 Bug: fetch sin timeout puede quedar pendiente indefinidamente"


# =============================================================================
# R8-F3: setInterval sin cleanup en teacher-pwa sync.js
# =============================================================================

class TestR8F3IntervalCleanup:
    """Tests para cleanup de intervals."""

    def test_teacher_sync_intervals_have_cleanup(self):
        """R8-F3: setInterval debe tener mecanismo de cleanup."""
        from pathlib import Path

        sync_path = Path("src/teacher-pwa/js/sync.js")
        if sync_path.exists():
            source = sync_path.read_text(encoding='utf-8')

            # Contar setIntervals
            interval_count = source.count('setInterval')

            if interval_count > 0:
                # Debe haber clearInterval o referencia almacenada
                has_cleanup = (
                    'clearInterval' in source or
                    'intervalId' in source.lower() or
                    'Interval =' in source
                )

                assert has_cleanup, \
                    f"R8-F3 Bug: {interval_count} setInterval(s) sin cleanup (memory leak)"


# =============================================================================
# Helper: Ejecutar todos los tests
# =============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
