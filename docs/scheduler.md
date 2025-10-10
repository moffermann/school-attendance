# Scheduler de Jobs

## 1. Contexto
- El archivo `app/workers/scheduler.py` usa APScheduler para ejecutar:
  - `detect_no_ingreso`: cada 5 minutos, genera alertas y dispara notificaciones.
  - `cleanup_photos`: diariamente a las 02:00 UTC, elimina evidencias vencidas.
- En `docker-compose` se agrega el servicio `scheduler` que comparte la misma imagen y entorno que el worker.

## 2. Uso local
```bash
python -m app.workers.scheduler
```
- Mantiene el scheduler en el loop principal; detener con `Ctrl+C`.
- Para pruebas puntuales, los jobs pueden ejecutarse de forma manual:
  - `python -m app.workers.jobs.detect_no_ingreso`
  - `python -m app.workers.jobs.cleanup_photos`

## 3. Variables relevantes
- `NO_SHOW_GRACE_MINUTES`: minutos de tolerancia antes de generar alertas.
- `PHOTO_RETENTION_DAYS`: días de retención de evidencias.
- `REDIS_URL`, `DATABASE_URL`, `S3_*`: necesarios para que los jobs accedan a la misma infraestructura.

## 4. Despliegue (cuando exista otro entorno)
- **Docker/Kubernetes**: replicar el servicio `scheduler` con la misma imagen/base que `worker`, montando variables de entorno necesarias.
- **Supervisor/Cron**: ejecutar `python -m app.workers.scheduler` como proceso demonio, asegurando reinicio automático.
- **Monitoreo**: recomendado conectar logs (`loguru`) a un agregador central y exponer métricas (pendiente) para cada job.

## 5. Pruebas recomendadas
1. Ejecutar `make seed` para datos demo.
2. Levantar `uvicorn`, `python -m app.workers.rq_worker` y `python -m app.workers.scheduler`.
3. Visitar `http://localhost:8000/alerts` y verificar que se generen alertas.
4. Cancelar el scheduler y confirmar que el job se detiene sin dejar eventos en curso.
