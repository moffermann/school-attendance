# Backlog - Tareas Pendientes

Este archivo contiene tareas técnicas pendientes que deben atenderse.

---

## Infraestructura

### [ ] Reconstruir imagen Docker con código actualizado
**Fecha**: 2026-01-21
**Prioridad**: Media
**Contexto**: La imagen `moffermann/school-attendance:latest` tiene código desactualizado. El worker de RQ falla con:
```
ImportError: cannot import name 'Connection' from 'rq'
```

**Solución**:
```bash
cd C:\Users\RT LOCAL\Proyectos GOCODE\GOCODE\school-attendance
docker build -t moffermann/school-attendance:latest .
docker compose -f docker-compose.yml up -d --force-recreate worker scheduler
```

**Impacto**: Sin esto, el worker de broadcasts/notificaciones debe ejecutarse manualmente:
```bash
python -c "from rq import SimpleWorker; from redis import Redis; from app.core.config import settings; r = Redis.from_url(settings.redis_url); w = SimpleWorker(['default', 'notifications', 'broadcasts'], connection=r); w.work()"
```

---

## Modelos / Base de Datos

### [x] Fix PushSubscription model - guardian_id
**Fecha**: 2026-01-21
**Estado**: Completado
**Descripción**: El modelo tenía `user_id` pero la DB tiene `guardian_id`.

---

## Frontend

### [x] Fix fotos 403 en biometric_enroll.js
**Fecha**: 2026-01-21
**Estado**: Completado
**Descripción**: No usaba el patrón Blob URL para cargar fotos autenticadas.

---

## Notas

- Las tareas completadas se mantienen por 30 días para referencia histórica
- Usar `[ ]` para pendientes, `[x]` para completadas
- Agregar fecha y contexto para facilitar el seguimiento
