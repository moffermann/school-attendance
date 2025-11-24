# School Attendance – Progreso en curso

## 2024-XX-XX
- Inicia nueva fase: migraciones, integración RQ, seed script y vistas.
- Último estado estable: backend FastAPI estructurado con modelos/servicios base y docs actualizadas.

### TODO siguiente ciclo
1. Implementar ejecución real de jobs (`send_whatsapp`, `send_email`) con clientes externos. ✅
2. Añadir endpoints y flujos POST en vistas web (horarios, broadcast, preferencias) usando fetch/JS. ✅
3. Cubrir servicios clave con pruebas (`AttendanceService`, `ScheduleService`, `NotificationDispatcher`). ✅
4. Configurar CI (GitHub Actions) con lint + tests. ✅

### Próximo backlog sugerido (en progreso)
1. Implementar cálculo automático de “no ingreso” y disparo de alertas. ✅
2. Añadir soporte de subida de fotos (endpoint + almacenamiento S3) y limpieza programada. ✅
3. Completar lógica integral de broadcast (job RQ real, métricas, auditoría). ✅
4. Fortalecer autenticación: refresh persistente, roles granulares y protección de endpoints de kiosco. ✅
5. Producir reportes y métricas detalladas en portal. ✅

### Próximos candidatos
- Persistir historial de acciones sobre alertas (usuarios, comentarios).
- Generar reportes PDF con resumen semanal de “no ingreso”.
- Integrar carga de fotos desde kiosco real (UI + captura) y visor con miniaturas.
- Añadir métricas y bitácora detallada para broadcasts/notificaciones en el portal.

### Progreso reciente
- ✅ 0001_initial creada en `app/db/migrations/versions/0001_initial.py`.
- ✅ Se agregó `alembic.ini` para ejecutar migraciones.
- ✅ `NotificationDispatcher` ahora encola jobs RQ para WhatsApp/Email.
- ✅ `scripts/dev_seed.py` inserta cursos, alumnos, apoderados y horarios base.
- ✅ Vistas Jinja muestran datos reales (dashboard, horarios, broadcast, preferencias).
- ✅ Guía `docs/local-dev.md` con pasos para levantar entorno.
- ✅ `make seed` agregado para recargar datos demo.
- ✅ Worker jobs envían notificaciones con clientes reales y actualizan estado.
- ✅ Formularios web consumen APIs (`app/web/static/js/app.js`).
- ✅ Nuevas pruebas en `tests/test_services.py`.
- ✅ Workflow CI en `.github/workflows/ci.yml`.
- ✅ Job de “no ingreso” (`app/workers/jobs/detect_no_ingreso.py`) integrado con notificaciones.
- ✅ Endpoint de carga de fotos y limpieza automática (`app/api/v1/attendance.py`, `app/workers/jobs/cleanup_photos.py`).
- ✅ Broadcasts encolados en RQ con cálculo de audiencia (`app/services/broadcast_service.py`).
- ✅ Autenticación de staff en vistas + API key para kioscos (`app/web/router.py`, `.env.example`).
- ✅ Panel de alertas con filtros/export y resumen (`/alerts`).
- ✅ Visor de evidencias fotográficas (`/photos`).
- ✅ Solicitudes de ausencia en SPA integradas con backend (`AbsenceService`, `/api/v1/absences`, `Views.parentAbsences`).
- ✅ Preferencias de apoderado en SPA integradas con backend (`ConsentService`, `/api/v1/parents/{id}/preferences`, `Views.parentPrefs`).

### Notas sesión 2025-10-10
- Adoptamos SQLite (`dev.db`) para entorno local; ajustar `.env` y migraciones para compatibilidad.
- Scheduler documentado (`docs/scheduler.md`) para correr jobs (`detect_no_ingreso`, `cleanup_photos`).
- Se identificó que la UI Jinja sólo sirve como shell funcional: tarea pendiente migrar la maqueta `src/web-app` al backend real.
- Login fallaba sin Postgres; ya funciona con SQLite tras actualizar seeds y migraciones.

_Actualiza esta bitácora al finalizar cada sub-tarea._

### Notas sesión 2025-10-12
- Se montó la maqueta SPA en `app/web/static/spa/` y se ajustaron rutas de assets/script para servirla vía FastAPI (`/app`).
- Nuevo flujo de sesión: endpoint `/api/v1/auth/session`, esquemas `SessionResponse` y helper `SessionUser` para exponer el usuario autenticado al front.
- Se creó `WebAppDataService` + endpoint `/api/v1/web-app/bootstrap` que entrega estudiantes, cursos, horarios, eventos, dispositivos, ausencias y notificaciones reales (filtrado por rol).
- `State.init()` ahora usa los datos reales del backend (sin `localStorage`), incluye helpers `apiFetch`, `upsertSchedule`, `addScheduleException` y `deleteScheduleException` contra los endpoints actualizados.
- API de horarios ampliada: `PUT /api/v1/schedules/{id}` y `DELETE /api/v1/schedules/exceptions/{id}`; la vista de horarios/excepciones ya consume estas rutas con manejo básico de errores.
- Se creó `DashboardService` + endpoints `/api/v1/web-app/dashboard` y `/dashboard/export` con estadísticas reales, filtros por fecha/curso/tipo y enlaces de foto; la vista `directorDashboard` ahora consume estos datos (sin mocks).
- Nuevos reportes reales: endpoint `/api/v1/web-app/reports` calcula asistencia por curso y tendencia diaria, la vista `directorReports` consume esta API (sin datos mock).
- API de dispositivos extendida (`GET /api/v1/devices`, `POST /devices/{id}/ping`, `/devices/{id}/logs`) y la vista `directorDevices` ahora usa datos reales y acciones de backend.
- Vista de alertas de no ingreso en SPA (`/director/alerts`) consumiendo endpoints reales (`/api/v1/alerts/no-entry`, export, resolve) con filtros y export CSV.

Pendientes próximos:
1. Extender métricas compartidas (ausencias/notificaciones) y vistas para que muestren datos y exportes reales (parent/portal).
2. Ajustar backend para exponer endpoints faltantes (absences CRUD completos, notifications por guardian, métricas) o adaptar la SPA a los disponibles.
3. Documentar en `docs/roadmap.md` el plan detallado para la segunda fase (PWA y kiosco) una vez que la SPA quede totalmente integrada.
4. Añadir pruebas de servicio para rutas nuevas (`auth/session`, `web-app/bootstrap`, schedules update/delete, devices/alerts) y completar cobertura.

**Siguiente paso inmediato:** Extender métricas/estadísticas de ausencias y notificaciones en el portal y documentar el roadmap de la segunda fase (PWA/kiosco).
