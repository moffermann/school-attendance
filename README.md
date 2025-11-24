# School Attendance

MVP robusto para control de ingreso/salida escolar con monitoreo en tiempo real, notificaciones a apoderados y herramientas de operación para Dirección/Inspectoría.

## Características clave
- Registro de eventos **IN/OUT** desde kioscos Android (NFC/QR) con soporte offline.
- Notificaciones transaccionales a padres por **WhatsApp (Meta Cloud API)** y **Email (Amazon SES)**.
- Tablero web para Dirección con eventos en vivo, gestión de horarios y excepciones.
- Preferencias de notificación y consentimiento por alumno/familia.
- Integración con almacenamiento S3-compatible para evidencia fotográfica.
- Jobs asíncronos con **Redis + RQ** para envíos y mantenimiento.
- Job programable de alerta por “no ingreso” y limpieza automática de fotos vencidas.
- Reportes de “no ingreso” con vista web y exportación CSV.
- Visor de evidencias fotográficas con enlaces presignados.

## Estructura del repositorio

```
app/
  main.py                # Punto de entrada FastAPI
  core/                  # Configuración, auth, utilidades
  db/                    # Sesiones, modelos SQLAlchemy, migraciones
  schemas/               # Pydantic
  services/              # Lógica de negocio
  workers/               # Jobs RQ y worker runner
  api/                   # Routers REST
  web/                   # Vistas HTML (Jinja)
infra/
  docker-compose.yml     # Postgres, Redis, MinIO, API, workers
kiosk-sdk/               # Stubs Kotlin para integración de kiosco Android
docs/                    # Arquitectura, roadmap, prompts, etc.
scripts/                 # Semillas y utilidades
tests/                   # Pruebas automatizadas
```

Las maquetas front-end originales se mantienen en `src/` para referencia visual.

## Requisitos previos
- Python 3.11+
- Docker y Docker Compose
- `make`, `poetry`/`pip` (o uso de `pipx` para `uvicorn` en local)

## Configuración rápida

```bash
cp .env.example .env
python -m venv .venv
source .venv/bin/activate
pip install -e .[dev]
pre-commit install
```

Variables clave en `.env`:
- `DEVICE_API_KEY`: clave compartida para kioscos/puertas.
- `NO_SHOW_GRACE_MINUTES`: minutos de tolerancia antes de alertar “no ingreso”.

### Migraciones
```bash
alembic upgrade head
```

### Ejecutar API (dev)
```bash
uvicorn app.main:app --reload
```

### Docker Compose
```bash
docker compose -f infra/docker-compose.yml up --build
```

Servicios incluidos: API, worker RQ, scheduler (jobs “no ingreso” y limpieza), PostgreSQL, Redis, MinIO y RQ dashboard.

## Scripts útiles
- `scripts/dev_seed.py`: carga datos de ejemplo (alumnos, cursos, tags, etc.).
- Jobs manuales:
  - `python -m app.workers.jobs.detect_no_ingreso`
  - `python -m app.workers.jobs.cleanup_photos`

## Testing
```bash
pytest
```

## Docker

Build & push (usa tu usuario de registry, p. ej. Docker Hub):
```bash
REGISTRY_USER=<tu_user> IMAGE_NAME=school-attendance ./scripts/build_and_push.sh
```

Ejecutar local con la imagen generada:
```bash
docker run --rm -p 8080:8080 <tu_user>/school-attendance:<tag>
```

Healthcheck manual:
```bash
curl http://127.0.0.1:8080/healthz
```

Variables relevantes:
- `PORT` (default 8080)
- `LOG_LEVEL`
- `DATABASE_URL`, `REDIS_URL`, `S3_*`, `SECRET_KEY`, `DEVICE_API_KEY`, etc. (ver `app/core/config.py`)

## Linters
```bash
ruff check app tests
black --check app tests
mypy app
```

## Kiosco Android (stub)
En `kiosk-sdk/` se incluye un módulo Kotlin con contratos de sincronización, ejemplos de manejo de cola offline y documentación de provisión NFC/QR.

## Cuentas demo
- Dirección: `director@example.com` / `secret123`
- Inspectoría: `inspector@example.com` / `secret123`
- Apoderado: `maria@example.com` / `secret123`
- Accede al tablero y sección de Alertas en `http://localhost:8000/`.

## Documentación
- `docs/architecture.md`: supuestos y componentes principales.
- `docs/backend-overview.md`: resumen de módulos backend.
- `docs/roadmap.md`: próximos pasos (maquetas y backend).
- `docs/prompts/main.md`: prompt original de alcance.
- `docs/local-dev.md`: guía paso a paso para levantar entorno local.
- `docs/reporting/no_ingreso.md`: métricas y reportes de alertas.
- `docs/scheduler.md`: guía para ejecutar/deployar el scheduler.

## Roadmap
Revisa `docs/roadmap.md` y `docs/architecture.md` para la planificación actualizada y próximos hitos.
