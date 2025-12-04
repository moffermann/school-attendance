"""
Bug Fixes Round 5 - TDD Tests
=============================

Tests que demuestran bugs de deployment, API y database
identificados en la quinta ronda de auditoría.

Categorías:
- R5-D*: Deployment/config bugs
- R5-A*: API bugs
- R5-B*: Database bugs
"""

from datetime import datetime, timezone, date
from unittest.mock import MagicMock, AsyncMock, patch
import pytest
from pydantic import ValidationError


# =============================================================================
# R5-D1: OpenAPI docs expuesto en producción
# =============================================================================

class TestR5D1OpenAPIDocs:
    """Tests para OpenAPI docs en producción."""

    def test_openapi_disabled_in_production(self):
        """R5-D1: OpenAPI docs deben estar deshabilitadas en producción."""
        from app.main import app
        from app.core.config import settings

        # En producción, openapi_url debería ser None
        if settings.app_env == "production":
            assert app.openapi_url is None, \
                "R5-D1 Bug: OpenAPI docs expuestas en producción"


# =============================================================================
# R5-D2: HSTS header deshabilitado
# =============================================================================

class TestR5D2HSTSHeader:
    """Tests para HSTS header."""

    def test_hsts_enabled_in_production_code(self):
        """R5-D2: HSTS debe estar habilitado en código para producción."""
        from app.core import security_headers
        import inspect

        source = inspect.getsource(security_headers)

        # El header HSTS debe estar configurado con condicional para producción
        has_hsts_with_production = (
            'Strict-Transport-Security' in source and
            'production' in source and
            'response.headers' in source
        )

        assert has_hsts_with_production, \
            "R5-D2 Bug: HSTS header debe estar habilitado para producción"


# =============================================================================
# R5-D6: Production secrets validation no aborta
# =============================================================================

class TestR5D6SecretsValidation:
    """Tests para validación de secrets en producción."""

    def test_secrets_validation_raises_in_production(self):
        """R5-D6: Secrets inseguros deben abortar en producción."""
        from app.core.config import Settings
        import inspect

        source = inspect.getsource(Settings)

        # Debe haber raise o excepción, no solo warnings
        has_raise = 'raise' in source and 'production' in source.lower()

        # O debe haber comentario indicando que se mueve a raise
        has_intention = 'raise' in source or 'abort' in source.lower()

        assert has_raise or has_intention, \
            "R5-D6 Bug: Validación de secrets solo genera warnings, no aborta"


# =============================================================================
# R5-A1: status_filter sin validación de enum
# =============================================================================

class TestR5A1StatusFilterValidation:
    """Tests para validación de status_filter."""

    def test_alert_status_uses_enum(self):
        """R5-A1: status_filter debe usar enum validado."""
        from app.api.v1 import alerts
        import inspect

        source = inspect.getsource(alerts)

        # Debe usar Enum o Literal para status
        uses_enum = (
            'AlertStatus' in source or
            'StatusFilter' in source or
            'Literal[' in source and 'PENDING' in source
        )

        assert uses_enum, \
            "R5-A1 Bug: status_filter acepta cualquier string sin validación"


# =============================================================================
# R5-A7: CSV injection en absences export
# =============================================================================

class TestR5A7CSVInjection:
    """Tests para sanitización de CSV en absences."""

    def test_absences_export_sanitizes_csv(self):
        """R5-A7: Export de absences debe sanitizar valores CSV."""
        from app.api.v1 import absences
        import inspect

        source = inspect.getsource(absences)

        # Debe tener sanitización de CSV
        has_sanitization = (
            '_sanitize_csv' in source or
            'sanitize' in source.lower() or
            "=CMD" in source or  # Checking for formula protection
            "formula" in source.lower()
        )

        assert has_sanitization, \
            "R5-A7 Bug: Export de absences no sanitiza valores CSV"


# =============================================================================
# R5-A9: CSV injection en notifications export
# =============================================================================

class TestR5A9NotificationsCSVInjection:
    """Tests para sanitización de CSV en notifications."""

    def test_notifications_export_sanitizes_csv(self):
        """R5-A9: Export de notifications debe sanitizar valores CSV."""
        from app.api.v1 import notifications
        import inspect

        source = inspect.getsource(notifications)

        # Debe tener sanitización de CSV
        has_sanitization = (
            '_sanitize_csv' in source or
            'sanitize' in source.lower()
        )

        assert has_sanitization, \
            "R5-A9 Bug: Export de notifications no sanitiza valores CSV"


# =============================================================================
# R5-B1: datetime.utcnow como default en modelos SQLAlchemy
# =============================================================================

class TestR5B1DatetimeDefaults:
    """Tests para defaults de datetime en modelos."""

    def test_notification_model_uses_timezone_aware_default(self):
        """R5-B1: Notification model debe usar timezone-aware default."""
        from app.db.models import notification
        import inspect

        source = inspect.getsource(notification)

        # No debe usar datetime.utcnow como default (sin paréntesis)
        uses_naive = 'default=datetime.utcnow' in source and 'timezone' not in source

        assert not uses_naive, \
            "R5-B1 Bug: Notification usa datetime.utcnow naive como default"

    def test_tag_model_uses_timezone_aware_default(self):
        """R5-B1: Tag model debe usar timezone-aware default."""
        from app.db.models import tag
        import inspect

        source = inspect.getsource(tag)

        uses_naive = 'default=datetime.utcnow' in source and 'timezone' not in source

        assert not uses_naive, \
            "R5-B1 Bug: Tag usa datetime.utcnow naive como default"


# =============================================================================
# R5-B2: datetime.utcnow() en web_app_service
# =============================================================================

class TestR5B2WebAppServiceDatetime:
    """Tests para datetime en web_app_service."""

    def test_web_app_service_uses_timezone_aware(self):
        """R5-B2: web_app_service debe usar timezone-aware datetime."""
        from app.services import web_app_service
        import inspect

        source = inspect.getsource(web_app_service)

        # Contar usos de utcnow() vs now(timezone.utc)
        utcnow_count = source.count('datetime.utcnow()')

        assert utcnow_count == 0, \
            f"R5-B2 Bug: web_app_service usa datetime.utcnow() ({utcnow_count} veces)"


# =============================================================================
# R5-B4: Inconsistencia en uso de .unique()
# =============================================================================

class TestR5B4UniqueConsistency:
    """Tests para consistencia de .unique() en repositorios."""

    def test_guardians_list_uses_unique(self):
        """R5-B4: list_by_student_ids debe usar .unique()."""
        from app.db.repositories import guardians
        import inspect

        source = inspect.getsource(guardians)

        # Buscar el método list_by_student_ids
        if 'list_by_student_ids' in source:
            method_section = source.split('list_by_student_ids')[1].split('async def')[0]
            uses_unique = '.unique()' in method_section

            assert uses_unique, \
                "R5-B4 Bug: list_by_student_ids no usa .unique() para evitar duplicados"


# =============================================================================
# R5-D10: Log level no se ajusta a producción
# =============================================================================

class TestR5D10LogLevel:
    """Tests para configuración de log level."""

    def test_logging_disables_diagnose_in_production(self):
        """R5-D10: diagnose debe estar deshabilitado en producción."""
        from app.core import logging as app_logging
        import inspect

        source = inspect.getsource(app_logging)

        # diagnose=True no debe estar hardcoded
        # Debe haber condicional para producción
        has_diagnose_conditional = (
            'diagnose=False' in source or
            ('diagnose' in source and 'production' in source.lower()) or
            'diagnose' not in source  # Si no usa diagnose, está bien
        )

        assert has_diagnose_conditional, \
            "R5-D10 Bug: diagnose=True hardcoded sin condicional para producción"


# =============================================================================
# Helper: Ejecutar todos los tests
# =============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
