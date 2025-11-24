# School Attendance – Roadmap (Fase 2)

## Estado actual
- Portal SPA montado sobre FastAPI: autenticación por sesión (`/api/v1/auth/session`), bootstrap real (`/api/v1/web-app/bootstrap`) y vistas conectadas (dashboard, reportes, dispositivos, alertas, horarios, ausencias, preferencias).
- Métricas operativas: tablero en vivo (`/web-app/dashboard`), reportes por curso/tendencia (`/web-app/reports`), alertas de no ingreso y export CSV, jobs RQ y scheduler documentados.
- Datos demo via `make seed` y migraciones (`0001_initial`, `0002_add_absence_comment`) listas para SQLite local; CI en GitHub Actions ejecuta lint + tests.

## Próximas entregas (portal web)
1. **Métricas extendidas**
   - Ausencias: bandeja con filtros/exports y KPIs agregados.
   - Notificaciones: métricas de envíos por canal/plantilla y bitácora de broadcast.
2. **Cobertura de pruebas**
   - Servicios/rutas: `auth/session`, `web-app/bootstrap`, horarios (update/delete), devices/alerts y reportes.
   - Mantener `tests/test_services.py` como concentración de unitarios + agregar pruebas de rutas ligeras (TestClient) si aplica.
3. **UX y accesibilidad**
   - Estados vacíos/errores coherentes en todas las vistas SPA.
   - Ajustar navegación para roles (director/inspector/padre) y revisar accesos protegidos.

## Kiosco (fase siguiente)
1. Exponer catálogos necesarios (`/api/v1/tags`, estudiantes por curso/token, horarios vigentes) y consumo real en la maqueta.
2. Encolar eventos/offline: usar `POST /api/v1/attendance/events` + `POST /events/{id}/photo` con idempotencia (`local_seq`) y reconciliación.
3. Provisioning de dispositivos: script `scripts/provision_kiosk.py` + documentación (`docs/kiosk.md`) para enrolar y rotar device keys.

## PWA Profesores (fase siguiente)
1. Crear rol/endpoint docente (`/api/v1/teachers/courses`, `/attendance/bulk`, `/alerts/summary`).
2. Reemplazar IndexedDB mock por sync real con manejo offline/online y resolución de conflictos.
3. Pruebas E2E (Playwright) cubriendo toma de asistencia y reintentos offline.

## Seguridad y despliegue
- Fortalecer refresh tokens persistentes, rotación de device keys y MFA para staff.
- Documentar despliegue en producción (env vars, S3, Redis/RQ workers, scheduler) y variantes locales (SQLite vs Postgres).
