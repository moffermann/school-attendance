# Deployment - School Attendance

Este documento describe la configuración específica para desplegar School Attendance. Para la guía general del proceso de despliegue con `appctl`, ver [deployment_guide.md](./deployment_guide.md).

## Arquitectura de la Aplicación

School Attendance se despliega como un **monolito** containerizado con múltiples servicios:

```
┌─────────────────────────────────────────────────────────────┐
│                      Docker Compose                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │   PostgreSQL    │  │      Redis      │                   │
│  │   (DB principal)│  │  (Cache + RQ)   │                   │
│  └────────┬────────┘  └────────┬────────┘                   │
│           │                    │                            │
│  ┌────────┴────────────────────┴────────┐                   │
│  │         school-attendance             │                   │
│  │  FastAPI + Kiosk + Teacher + WebApp  │                   │
│  │            (puerto 8080)              │                   │
│  └───────────────────────────────────────┘                   │
│           │                    │                            │
│  ┌────────┴────────┐  ┌────────┴────────┐                   │
│  │     Worker      │  │    Scheduler    │                   │
│  │ (Jobs RQ async) │  │ (Tareas cron)   │                   │
│  └─────────────────┘  └─────────────────┘                   │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │     MinIO       │  │  RQ Dashboard   │                   │
│  │ (S3 compatible) │  │  (solo dev/qa)  │                   │
│  └─────────────────┘  └─────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

### URLs de la Aplicación

| Ruta | Descripción |
|------|-------------|
| `/api/v1/*` | REST API (FastAPI) |
| `/api/docs` | Documentación Swagger |
| `/kiosk/` | App para kioscos (registro asistencia) |
| `/teacher/` | PWA para profesores |
| `/app/` | Dashboard director/apoderados |

## Configuración por Ambiente

### URLs de Acceso

| Ambiente | URL |
|----------|-----|
| dev | https://school-attendance.dev.gocode.cl |
| qa | https://school-attendance.qa.gocode.cl |
| prod | https://school-attendance.gocode.cl |

### Variables de Entorno

#### Variables Comunes (todos los ambientes)

| Variable | Descripción | Default |
|----------|-------------|---------|
| `APP_ENV` | Ambiente (`development`, `qa`, `production`) | `development` |
| `APP_NAME` | Nombre de la aplicación | `school-attendance` |
| `DOCKER_NETWORK` | Red Docker | `net-dev` |

#### Base de Datos

| Variable | Descripción | Default |
|----------|-------------|---------|
| `DB_USER` | Usuario PostgreSQL | `school_attendance` |
| `DB_PASSWORD` | Password PostgreSQL | `school_attendance` |
| `DB_NAME` | Nombre de la DB | `school_attendance` |

> **PROD:** Usar passwords seguros generados con `openssl rand -hex 16`

#### Seguridad

| Variable | Descripción | Default |
|----------|-------------|---------|
| `SECRET_KEY` | Key para JWT tokens | `CHANGE-ME-IN-PRODUCTION` |
| `DEVICE_API_KEY` | Key para autenticación de kioscos | `CHANGE-ME-IN-PRODUCTION` |
| `CORS_ORIGINS` | Orígenes permitidos (JSON array) | `[]` (todos) |

> **PROD:** Generar keys con `openssl rand -hex 32`

#### Almacenamiento S3/MinIO

| Variable | Descripción | Default |
|----------|-------------|---------|
| `S3_ENDPOINT` | URL del servicio S3 | `http://minio:9000` |
| `S3_BUCKET` | Bucket para fotos | `attendance-photos` |
| `S3_ACCESS_KEY` | Access key | `dev-access` |
| `S3_SECRET_KEY` | Secret key | `dev-secret` |
| `S3_REGION` | Región | `us-east-1` |
| `S3_SECURE` | Usar HTTPS | `false` |

> **PROD:** Usar AWS S3 real con credenciales IAM

#### Notificaciones WhatsApp

| Variable | Descripción | Default |
|----------|-------------|---------|
| `WHATSAPP_ACCESS_TOKEN` | Token de WhatsApp Cloud API | `dummy` |
| `WHATSAPP_PHONE_NUMBER_ID` | ID del número de WhatsApp | `dummy` |
| `ENABLE_REAL_NOTIFICATIONS` | Habilitar envío real | `false` |

> Ver [whatsapp-templates.md](./whatsapp-templates.md) para configuración completa

#### WebAuthn (Autenticación Biométrica)

| Variable | Descripción | Default |
|----------|-------------|---------|
| `WEBAUTHN_RP_ID` | Dominio para credenciales | `localhost` |
| `WEBAUTHN_RP_NAME` | Nombre visible | `Sistema Asistencia Escolar` |
| `WEBAUTHN_RP_ORIGIN` | URL origen | `http://localhost:8080` |
| `WEBAUTHN_TIMEOUT_MS` | Timeout en ms | `60000` |

### Configuración por Ambiente

#### Development

```bash
# Usar defaults - no requiere .env
appctl pull --env dev --app school-attendance
```

Variables automáticas:
- `DOCKER_NETWORK=net-dev`
- `WEBAUTHN_RP_ID=school-attendance.dev.gocode.cl`
- `WEBAUTHN_RP_ORIGIN=https://school-attendance.dev.gocode.cl`

#### QA

```bash
# secrets/qa/.env
APP_ENV=qa
DOCKER_NETWORK=net-qa
CORS_ORIGINS=["https://school-attendance.qa.gocode.cl"]
SECRET_KEY=<generado con openssl rand -hex 32>
DEVICE_API_KEY=<generado con openssl rand -hex 32>
DB_PASSWORD=<generado con openssl rand -hex 16>
WEBAUTHN_RP_ID=school-attendance.qa.gocode.cl
WEBAUTHN_RP_ORIGIN=https://school-attendance.qa.gocode.cl
```

Deploy:
```bash
sudo mkdir -p /srv/qa/apps/school-attendance
sudo cp secrets/qa/.env /srv/qa/apps/school-attendance/.env
appctl pull --env qa --app school-attendance
```

#### Production

```bash
# secrets/prod/.env
APP_ENV=production
DOCKER_NETWORK=net-prod
CORS_ORIGINS=["https://school-attendance.gocode.cl"]
SECRET_KEY=<generado con openssl rand -hex 32>
DEVICE_API_KEY=<generado con openssl rand -hex 32>
DB_PASSWORD=<password muy seguro>

# S3 Real (AWS)
S3_ENDPOINT=https://s3.us-east-1.amazonaws.com
S3_BUCKET=school-attendance-prod
S3_ACCESS_KEY=<AWS access key>
S3_SECRET_KEY=<AWS secret key>
S3_SECURE=true

# WhatsApp (real)
WHATSAPP_ACCESS_TOKEN=<token real>
WHATSAPP_PHONE_NUMBER_ID=<phone id real>
ENABLE_REAL_NOTIFICATIONS=true

# WebAuthn
WEBAUTHN_RP_ID=school-attendance.gocode.cl
WEBAUTHN_RP_ORIGIN=https://school-attendance.gocode.cl
```

Deploy:
```bash
sudo mkdir -p /srv/prod/apps/school-attendance
sudo cp secrets/prod/.env /srv/prod/apps/school-attendance/.env
appctl pull --env prod --app school-attendance --tag 2025.01.15.1430
```

## Excepciones al Proceso Estándar

### 1. Migraciones Personalizadas

El proyecto usa un shim de npm para ejecutar migraciones:

```
npm run migrate → scripts/npm-shim.sh → make migrate → alembic upgrade head
```

Si las migraciones fallan:
```bash
docker exec -it school-attendance-<env> alembic upgrade head
```

### 2. Worker y Scheduler Separados

A diferencia de aplicaciones simples, school-attendance tiene contenedores separados para jobs:

- `school-attendance-worker-<env>`: Procesa notificaciones WhatsApp
- `school-attendance-scheduler-<env>`: Ejecuta tareas periódicas

Verificar que ambos estén corriendo:
```bash
docker ps | grep school-attendance
```

### 3. RQ Dashboard (Solo dev/qa)

El servicio `rq-dashboard` solo se levanta con profiles:
```bash
docker compose --profile dev up -d  # Incluye rq-dashboard
```

No disponible en producción.

## Build y Push

### Script Automático

```bash
cd /home/gocode/projects/school-attendance

# Tag automático (YYYY.MM.DD.HHMM)
./scripts/build_and_push.sh

# Tag específico
IMAGE_TAG=v2.0.0 ./scripts/build_and_push.sh
```

### Build Manual

```bash
docker buildx build \
  --platform linux/amd64 \
  -t moffermann/school-attendance:$(date +%Y.%m.%d.%H%M) \
  --push \
  .
```

## Flujo de Deploy Completo

### Development

```bash
# 1. Build y push
./scripts/build_and_push.sh

# 2. Deploy
appctl pull --env dev --app school-attendance

# 3. Verificar
appctl status --env dev --app school-attendance
curl https://school-attendance.dev.gocode.cl/healthz
```

### Production

```bash
# 1. Build con tag específico
IMAGE_TAG=2025.01.15.1430 ./scripts/build_and_push.sh

# 2. Preparar secrets
sudo cp secrets/prod/.env /srv/prod/apps/school-attendance/.env

# 3. Deploy con tag específico (NUNCA usar latest en prod)
appctl pull --env prod --app school-attendance --tag 2025.01.15.1430

# 4. Verificar
appctl verify --env prod --app school-attendance
```

## Checklist de Producción

- [ ] Usar tag específico, NUNCA `latest`
- [ ] `SECRET_KEY` generado con `openssl rand -hex 32`
- [ ] `DEVICE_API_KEY` generado con `openssl rand -hex 32`
- [ ] `DB_PASSWORD` seguro
- [ ] `CORS_ORIGINS` con dominio específico
- [ ] S3 real configurado (no MinIO)
- [ ] `ENABLE_REAL_NOTIFICATIONS=true` si se usan notificaciones
- [ ] `WEBAUTHN_RP_ID` y `WEBAUTHN_RP_ORIGIN` correctos
- [ ] Templates de WhatsApp aprobados en Meta Business Suite

## Monitoreo

### Logs por Servicio

```bash
# API principal
docker logs -f school-attendance-prod

# Worker (notificaciones)
docker logs -f school-attendance-worker-prod

# Scheduler (tareas periódicas)
docker logs -f school-attendance-scheduler-prod
```

### Health Checks

```bash
# Liveness (rápido)
curl https://school-attendance.gocode.cl/healthz

# Readiness (incluye DB)
curl https://school-attendance.gocode.cl/health
```

## Troubleshooting

### Notificaciones no se envían

1. Verificar `ENABLE_REAL_NOTIFICATIONS=true`
2. Verificar Redis corriendo:
   ```bash
   docker ps | grep redis
   ```
3. Verificar worker corriendo:
   ```bash
   docker logs school-attendance-worker-<env>
   ```
4. Validar config WhatsApp:
   ```bash
   docker exec school-attendance-<env> python scripts/whatsapp_setup.py --validate
   ```

### Kiosk no muestra cámara

1. Verificar `photo_opt_in` del estudiante
2. Verificar permisos del navegador
3. Inspeccionar consola del kiosk

### WebAuthn falla

1. Verificar que `WEBAUTHN_RP_ID` coincide con el dominio
2. Verificar HTTPS (WebAuthn requiere conexión segura)
3. Revisar logs del contenedor

### Base de datos no conecta

```bash
# Verificar PostgreSQL
docker logs school-attendance-postgres-<env>

# Probar conexión
docker exec school-attendance-<env> python -c "
from app.core.config import settings
print(settings.database_url)
"
```

## Backup

### Base de Datos

```bash
# Backup
docker exec school-attendance-postgres-<env> \
  pg_dump -U school_attendance school_attendance > backup_$(date +%Y%m%d).sql

# Restore
docker exec -i school-attendance-postgres-<env> \
  psql -U school_attendance school_attendance < backup.sql
```

### Fotos (S3/MinIO)

```bash
# MinIO (dev/qa)
mc mirror minio/attendance-photos ./backup/photos/

# AWS S3 (prod)
aws s3 sync s3://school-attendance-prod ./backup/photos/
```

## Referencia Rápida

```bash
# === BUILD ===
./scripts/build_and_push.sh                           # Tag automático
IMAGE_TAG=v1.0.0 ./scripts/build_and_push.sh          # Tag específico

# === DEV ===
appctl pull --env dev --app school-attendance
appctl logs --env dev --app school-attendance -f

# === QA ===
sudo cp secrets/qa/.env /srv/qa/apps/school-attendance/.env
appctl pull --env qa --app school-attendance

# === PROD ===
sudo cp secrets/prod/.env /srv/prod/apps/school-attendance/.env
appctl pull --env prod --app school-attendance --tag 2025.01.15.1430

# === MONITOREO ===
appctl status --env prod --app school-attendance
appctl verify --env prod --app school-attendance
docker logs -f school-attendance-worker-prod

# === MIGRACIONES MANUALES ===
docker exec -it school-attendance-<env> alembic upgrade head
```
