# Guía de entorno local

## 1. Preparar entorno Python
```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .[dev]
pre-commit install
```

## 2. Iniciar infraestructura base (opcional)
- Para desarrollo rápido usamos SQLite (`dev.db`). No necesitas servicios externos.
- Si prefieres PostgreSQL/Redis/MinIO, levanta `docker compose -f infra/docker-compose.yml up -d postgres redis minio`.

## 3. Crear esquema y datos demo
```bash
alembic upgrade head
make seed  # o python scripts/dev_seed.py
```

## 4. Ejecutar API + worker
```bash
uvicorn app.main:app --reload
python -m app.workers.rq_worker
```

## 5. Navegar
- API docs: `http://localhost:8000/api/docs`
- Web dashboard: `http://localhost:8000/`
- RQ dashboard: `http://localhost:9181`
- Credenciales demo: director@example.com / secret123 (u otra en README)
- Vista de alertas: `http://localhost:8000/alerts`
- Visor de fotos: `http://localhost:8000/photos`

## 6. Mantenimiento
- `make migrate` para aplicar migraciones
- `make seed` para recargar datos de ejemplo
- `make dev-down` para apagar servicios Docker
- Ejecutar jobs manuales:
  - Detección “no ingreso”: `python -m app.workers.jobs.detect_no_ingreso`
  - Limpieza fotos: `python -m app.workers.jobs.cleanup_photos`
