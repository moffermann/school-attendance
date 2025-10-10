# Changelog

## [Unreleased]
### Added
- Configuración por defecto con SQLite (`.env.example`, `app/db/session.py`) y soporte en Alembic; migraciones adaptadas para tipos portables.
- Persistencia de alertas de "no ingreso" (`no_show_alerts`), repositorios, servicio `AlertService`, endpoints `/api/v1/alerts/*` y vista web con filtros/export.
- Job de detección `app/workers/jobs/detect_no_ingreso.py` actualizado para alinear con la nueva tabla; scheduler documentado (`docs/scheduler.md`).
- Visor de evidencias (`/photos`) con presigned URLs y helpers de almacenamiento (`PhotoService`).
- Tests adicionales (`tests/test_services.py`) cubriendo alertas y flujos recientes; CI y seeds ajustados para SQLite (`scripts/dev_seed.py`).

### Changed
- `AttendanceService`, `BroadcastService`, vistas Jinja y JS para usar datos almacenados, filtros y acciones POST.
- `docs/local-dev.md`, `docs/backend-overview.md`, `docs/architecture.md`, `docs/reporting/no_ingreso.md`, `docs/next.md`, `docs/roadmap.md`, `README.md` actualizados al nuevo flujo.

### Fixed
- Bloqueo por ausencia de Postgres documentado; seeds no dependen más de Postgres.
