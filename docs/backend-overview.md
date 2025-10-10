# Backend Overview

## FastAPI routers
- `/api/v1/auth`: login/refresh basado en JWT para usuarios del portal.
- `/api/v1/attendance`: registro de eventos IN/OUT, consulta por alumno y carga de fotos (staff/kiosco autorizado).
- `/api/v1/notifications`: encola notificaciones manuales a guardians.
- `/api/v1/schedules`: CRUD básico de horarios y excepciones.
- `/api/v1/broadcasts`: endpoints para previsualizar y encolar difusiones.
- `/api/v1/parents`: gestión de preferencias de notificaciones por apoderado.
- `/api/v1/tags`: provisión, confirmación y revocación de tags NFC/QR.
- `/api/v1/devices`: heartbeat de kioscos.
- `/api/v1/alerts`: listados, exportación y resolución de alertas de “no ingreso”.

## Servicios
- `AttendanceService`: valida alumnos, crea eventos y detecta alertas de “no ingreso”.
- `AlertService`: listado/resolución de alertas y exportación.
- `NotificationDispatcher`: persiste notificaciones, resuelve contactos y encola jobs RQ.
- `ScheduleService`: administra horarios base y excepciones.
- `ConsentService`: lectura/actualización de preferencias guardian.
- `TagProvisionService`: genera tokens NFC, arma NDEF y controla ciclo de vida.
- `DeviceService`: upsert de heartbeats con métricas del kiosco.
- `BroadcastService`: calcula audiencia, encola jobs RQ y delega notificaciones masivas.
- `PhotoService`: almacenamiento de evidencias en S3/MinIO.

## Workers
- `app/workers/rq_worker.py`: entrypoint para workers RQ.
- Jobs (`app/workers/jobs/*`): procesamiento real de WhatsApp/Email, detección de no ingreso, cleanup y broadcast.

## Infra
- `infra/docker-compose.yml`: stack completo (Postgres, Redis, MinIO, API, worker, dashboard RQ).

## Scripts
- `scripts/dev_seed.py`: carga cursos, alumnos, apoderados y horarios de ejemplo.

## Frontend web
- Vistas Jinja en `app/web/templates/` con login de staff, dashboard en tiempo real, formularios para crear horarios, previsualizar broadcast y editar preferencias de apoderado.
