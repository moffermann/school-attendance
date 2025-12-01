# Guía de entorno local

## 1. Preparar entorno Python
```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .[dev]
pre-commit install
```

## 2. Iniciar infraestructura base
Levanta los servicios necesarios con Docker Compose:
```bash
docker compose up -d postgres redis minio
```

Esto inicia:
- **PostgreSQL 15** en puerto 5432
- **Redis 7** en puerto 6379
- **MinIO** (S3-compatible) en puertos 9000/9001

## 3. Crear esquema y datos demo
```bash
alembic upgrade head
make seed  # o python scripts/dev_seed.py
```

## 4. Ejecutar API + worker
```bash
# Terminal 1: API
uvicorn app.main:app --reload --port 8000

# Terminal 2: Worker
python -m app.workers.rq_worker

# Terminal 3 (opcional): Scheduler
python -m app.workers.scheduler
```

## 5. Navegar
- API docs: `http://localhost:8000/api/docs`
- Web dashboard: `http://localhost:8000/`
- MinIO console: `http://localhost:9001`
- Credenciales demo: director@example.com / secret123

## 6. Tests
```bash
# Backend tests
pytest

# Con cobertura
pytest --cov=app --cov-report=html

# Frontend E2E (requiere Playwright instalado)
npm ci
npx playwright install --with-deps
npm run test:all
```

## 7. Mantenimiento
- `make migrate` - aplicar migraciones
- `make seed` - recargar datos de ejemplo
- `docker compose down` - detener servicios Docker
- Ejecutar jobs manuales:
  - Detección "no ingreso": `python -m app.workers.jobs.detect_no_ingreso`
  - Limpieza fotos: `python -m app.workers.jobs.cleanup_photos`

## 8. Variables de entorno
Copia `.env.example` a `.env` y configura:
```bash
DATABASE_URL=postgresql+asyncpg://school_attendance:school_attendance@localhost:5432/school_attendance
REDIS_URL=redis://localhost:6379/0
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=attendance-photos
S3_ACCESS_KEY=dev-access
S3_SECRET_KEY=dev-secret
SECRET_KEY=your-dev-secret-key
DEVICE_API_KEY=your-device-key
```
