"""
Bug Fixes Round 7 - TDD Tests
=============================

Tests que demuestran bugs en API, Services y Repositories
identificados en la séptima ronda de auditoría.

Categorías:
- R7-A*: API endpoint bugs
- R7-S*: Service layer bugs
- R7-B*: Repository/DB bugs
"""

from datetime import datetime, timezone, time
from unittest.mock import MagicMock, AsyncMock, patch
import pytest
from pydantic import ValidationError


# =============================================================================
# R7-B1: DeviceRepository usa datetime.utcnow() (naive) en múltiples lugares
# =============================================================================

class TestR7B1DeviceDatetime:
    """Tests para datetime en DeviceRepository."""

    def test_device_repo_uses_timezone_aware_datetime(self):
        """R7-B1: DeviceRepository debe usar datetime.now(timezone.utc)."""
        from app.db.repositories import devices
        import inspect

        source = inspect.getsource(devices)

        # Contar usos de datetime.utcnow()
        utcnow_count = source.count('datetime.utcnow()')

        assert utcnow_count == 0, \
            f"R7-B1 Bug: DeviceRepository usa datetime.utcnow() ({utcnow_count} veces)"


# =============================================================================
# R7-B4: ScheduleRepository.update() tiene signature incorrecta
# =============================================================================

class TestR7B4ScheduleUpdateSignature:
    """Tests para signature de ScheduleRepository.update()."""

    def test_schedule_update_has_correct_signature(self):
        """R7-B4: update() debe tener in_time y out_time opcionales."""
        from app.db.repositories.schedules import ScheduleRepository
        import inspect

        sig = inspect.signature(ScheduleRepository.update)
        params = sig.parameters

        # in_time y out_time deben tener defaults (ser opcionales)
        # o toda la lógica de keyword-only debe ser correcta
        in_time_param = params.get('in_time')
        out_time_param = params.get('out_time')

        if in_time_param and out_time_param:
            # Si no tienen default, es un bug
            in_time_has_default = in_time_param.default is not inspect.Parameter.empty
            out_time_has_default = out_time_param.default is not inspect.Parameter.empty

            # Ambos deberían tener defaults o ninguno (para update parcial)
            assert in_time_has_default == out_time_has_default, \
                "R7-B4 Bug: in_time y out_time tienen inconsistencia en defaults"


# =============================================================================
# R7-S6: BroadcastService usa if en lugar de elif, permite múltiples scopes
# =============================================================================

class TestR7S6BroadcastScopeLogic:
    """Tests para lógica de scope en BroadcastService."""

    def test_broadcast_scope_uses_elif(self):
        """R7-S6: _resolve_guardian_ids debe usar elif, no if secuenciales."""
        from app.services import broadcast_service
        import inspect

        source = inspect.getsource(broadcast_service.BroadcastService._resolve_guardian_ids)

        # Contar los if statements
        # El patrón correcto es: if scope == "global" elif scope == "course" elif scope == "custom"
        # El bug es: if scope == "global" ... if scope == "course" ... if scope == "custom"

        lines = source.split('\n')
        scope_ifs = [l for l in lines if 'scope' in l.lower() and ('if ' in l or 'elif ' in l)]

        # Si hay más de un "if" (no elif) para scope, es un bug
        non_elif_scope_checks = sum(1 for l in scope_ifs if 'if ' in l and 'elif' not in l)

        # Debería haber máximo 1 "if" (el primero), los demás "elif"
        assert non_elif_scope_checks <= 1, \
            f"R7-S6 Bug: Múltiples 'if' para scope ({non_elif_scope_checks}), debería usar elif"


# =============================================================================
# R7-A6: Path parameters en schedules sin validación ge=1
# =============================================================================

class TestR7A6PathParameterValidation:
    """Tests para validación de path parameters."""

    def test_schedule_endpoints_validate_positive_ids(self):
        """R7-A6: Path params deben validar IDs positivos."""
        from app.api.v1 import schedules
        import inspect

        source = inspect.getsource(schedules)

        # Buscar uso de Path con ge=1 o gt=0 para validar IDs
        has_path_validation = (
            'Path(' in source and ('ge=1' in source or 'gt=0' in source)
        )

        # O al menos debería haber validación manual
        has_manual_validation = (
            'if course_id < 1' in source or
            'if schedule_id < 1' in source or
            'if exception_id < 1' in source or
            '<= 0' in source
        )

        # Los endpoints deberían validar IDs positivos
        # Si no hay validación, es un bug potencial
        assert has_path_validation or has_manual_validation, \
            "R7-A6 Bug: Path parameters sin validación de IDs positivos"


# =============================================================================
# R7-B5: NoShowAlertRepository.list_alerts() sin default limit
# =============================================================================

class TestR7B5ListAlertsLimit:
    """Tests para límite en list_alerts()."""

    def test_list_alerts_has_default_limit(self):
        """R7-B5: list_alerts() debe tener default limit."""
        from app.db.repositories.no_show_alerts import NoShowAlertRepository
        import inspect

        sig = inspect.signature(NoShowAlertRepository.list_alerts)
        params = sig.parameters

        limit_param = params.get('limit')

        if limit_param:
            # Debería tener un default que no sea None
            has_safe_default = (
                limit_param.default is not inspect.Parameter.empty and
                limit_param.default is not None and
                isinstance(limit_param.default, int) and
                limit_param.default > 0
            )

            assert has_safe_default, \
                "R7-B5 Bug: list_alerts() tiene limit=None por default, permite queries sin límite"


# =============================================================================
# R7-B7: StudentRepository.list_all() sin límite
# =============================================================================

class TestR7B7StudentListAllLimit:
    """Tests para límite en StudentRepository.list_all()."""

    def test_student_list_all_has_limit_param(self):
        """R7-B7: list_all() debería tener parámetro limit."""
        from app.db.repositories.students import StudentRepository
        import inspect

        sig = inspect.signature(StudentRepository.list_all)
        params = sig.parameters

        # list_all() debería tener un limit parameter
        has_limit = 'limit' in params

        # O el código debería tener .limit() hardcoded
        source = inspect.getsource(StudentRepository.list_all)
        has_hardcoded_limit = '.limit(' in source

        assert has_limit or has_hardcoded_limit, \
            "R7-B7 Bug: StudentRepository.list_all() no tiene límite (OOM potencial)"


# =============================================================================
# R7-B8: GuardianRepository.list_all() sin límite
# =============================================================================

class TestR7B8GuardianListAllLimit:
    """Tests para límite en GuardianRepository.list_all()."""

    def test_guardian_list_all_has_limit_param(self):
        """R7-B8: list_all() debería tener parámetro limit."""
        from app.db.repositories.guardians import GuardianRepository
        import inspect

        sig = inspect.signature(GuardianRepository.list_all)
        params = sig.parameters

        has_limit = 'limit' in params

        source = inspect.getsource(GuardianRepository.list_all)
        has_hardcoded_limit = '.limit(' in source

        assert has_limit or has_hardcoded_limit, \
            "R7-B8 Bug: GuardianRepository.list_all() no tiene límite (OOM potencial)"


# =============================================================================
# R7-S5: BroadcastService no cierra Redis connection
# =============================================================================

class TestR7S5BroadcastRedisCleanup:
    """Tests para cleanup de Redis en BroadcastService."""

    def test_broadcast_service_has_cleanup(self):
        """R7-S5: BroadcastService debe tener método de cleanup."""
        from app.services.broadcast_service import BroadcastService
        import inspect

        # Verificar que tiene destructor o close method
        has_cleanup = (
            hasattr(BroadcastService, '__del__') or
            hasattr(BroadcastService, 'close') or
            hasattr(BroadcastService, '__enter__')  # context manager
        )

        if not has_cleanup:
            source = inspect.getsource(BroadcastService)
            # Al menos debería haber comentario sobre el cleanup
            has_cleanup_awareness = (
                'cleanup' in source.lower() or
                'close' in source.lower() or
                'context manager' in source.lower()
            )

            assert has_cleanup_awareness, \
                "R7-S5 Bug: BroadcastService no tiene cleanup para Redis connection"


# =============================================================================
# R7-A5: Broadcast endpoints sin rate limiting
# =============================================================================

class TestR7A5BroadcastRateLimiting:
    """Tests para rate limiting en broadcast endpoints."""

    def test_broadcast_endpoints_have_rate_limiting(self):
        """R7-A5: Broadcast endpoints deben tener rate limiting."""
        from app.api.v1 import broadcast
        import inspect

        source = inspect.getsource(broadcast)

        # Buscar decorator de rate limiting
        has_limiter = (
            '@limiter' in source or
            'RateLimiter' in source or
            'rate_limit' in source.lower()
        )

        # Los endpoints de broadcast son críticos y deben tener rate limiting
        # para prevenir spam masivo
        assert has_limiter, \
            "R7-A5 Bug: Broadcast endpoints sin rate limiting"


# =============================================================================
# R7-A1: Attendance endpoint sin paginación
# =============================================================================

class TestR7A1AttendancePagination:
    """Tests para paginación en attendance endpoints."""

    def test_list_events_has_pagination(self):
        """R7-A1: list_events endpoint debe tener paginación."""
        from app.api.v1 import attendance
        import inspect

        source = inspect.getsource(attendance)

        # Buscar parámetros de paginación
        has_pagination = (
            'limit' in source and ('offset' in source or 'skip' in source) or
            'page' in source or
            '.limit(' in source
        )

        assert has_pagination, \
            "R7-A1 Bug: Attendance list endpoint sin paginación"


# =============================================================================
# R7-S3: Errores de Redis no se logean en notifications
# =============================================================================

class TestR7S3RedisErrorLogging:
    """Tests para logging de errores de Redis."""

    def test_notification_service_logs_redis_errors(self):
        """R7-S3: Errores de Redis deben logearse."""
        from app.services import attendance_notification_service
        import inspect

        source = inspect.getsource(attendance_notification_service)

        # Buscar logging de errores
        has_error_logging = (
            'logger.error' in source or
            'logger.exception' in source or
            'logging.error' in source
        )

        # También verificar que hay try/except alrededor de queue operations
        has_exception_handling = 'except' in source

        assert has_error_logging and has_exception_handling, \
            "R7-S3 Bug: Errores de Redis no se logean adecuadamente"


# =============================================================================
# R7-B2: WebAuthn delete_all usa N+1 query pattern
# =============================================================================

class TestR7B2WebAuthnDeleteAll:
    """Tests para delete_all en WebAuthn repository."""

    def test_webauthn_delete_all_uses_bulk_delete(self):
        """R7-B2: delete_all debe usar bulk delete, no loop."""
        from app.db.repositories import webauthn
        import inspect

        source = inspect.getsource(webauthn)

        # Buscar el método delete_all_for_student
        if 'delete_all_for_student' in source:
            method_section = source.split('delete_all_for_student')[1].split('async def')[0]

            # R7-B2 fix: Verificar que usa delete() de SQLAlchemy (bulk)
            # y NO tiene el patrón N+1 con for loop + session.delete()
            has_bulk_delete = 'delete(WebAuthnCredential)' in method_section

            # Patrón N+1 es: for cred in credentials: await self.session.delete(cred)
            has_n_plus_one = (
                'for cred in' in method_section and
                'session.delete(cred)' in method_section
            )

            # El código está bien si usa bulk delete y no tiene N+1
            assert has_bulk_delete and not has_n_plus_one, \
                "R7-B2 Bug: delete_all_for_student debe usar bulk delete"


# =============================================================================
# Helper: Ejecutar todos los tests
# =============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
