# Deployment Guide

## Arquitectura

School Attendance se despliega como un **monolito** containerizado:

- **FastAPI Backend** - REST API (`/api/v1/*`)
- **Kiosk App** - SPA para kioscos (`/kiosk/`)
- **Teacher PWA** - App para profesores (`/teacher/`)
- **Web App** - Dashboard director/apoderados (`/app/`)

Servicios de soporte:
- **PostgreSQL** - Base de datos
- **Redis** - Cache + cola de trabajos (RQ)
- **MinIO/S3** - Almacenamiento de fotos
- **RQ Worker** - Procesamiento de jobs en background
- **Scheduler** - Tareas periódicas

## Requisitos Previos

1. **Docker** instalado y corriendo
2. **appctl** instalado en `/usr/local/bin/appctl`
3. Credenciales de Docker Hub en `~/.bashrc`:
   ```bash
   export REGISTRY_USER="tu-usuario"
   export REGISTRY_PASSWORD="tu-token"
   ```

## Estructura de Directorios

### En el proyecto (repositorio)

```
secrets/
├── dev/
│   └── .env.example   # Plantilla de referencia
├── qa/
│   └── .env.example
└── prod/
    └── .env.example
```

Los `.env.example` sirven como plantilla. Los `.env` reales están en `.gitignore`.

### En el servidor (creados por appctl)

```
/srv/<env>/
├── apps/school-attendance/
│   ├── docker-compose.yml  # Copiado del proyecto
│   └── .env                # Secrets (opcional, ver nota)
└── workspaces/school-attendance/  # Solo en dev
    └── (código sincronizado desde la imagen)
```

## Cómo Funciona appctl

### Comandos Principales

| Comando | Descripción |
|---------|-------------|
| `appctl pull` | Descarga imagen + deploy (equivale a `deploy --pull`) |
| `appctl deploy` | Deploy sin actualizar imagen |
| `appctl status` | Ver estado de contenedores |
| `appctl logs` | Ver logs (`-f` para follow) |
| `appctl verify` | Verificar health check |
| `appctl rm` | Eliminar deployment |

### Resolución de Tags

appctl resuelve el tag de la imagen así:

1. Si pasas `--tag <version>` (distinto de `latest`): usa ese tag
2. Si existe `latest` en Docker Hub: usa `latest`
3. Si no existe `latest`: consulta Docker Hub y usa el tag más reciente

```bash
# Usar tag específico (recomendado para prod)
appctl pull --env prod --app school-attendance --tag 2025.11.28.2231

# Usar latest o el más reciente automáticamente
appctl pull --env dev --app school-attendance
```

### Variables de Entorno

**Importante**: appctl NO copia automáticamente secrets desde `secrets/<env>/`.

El `docker-compose.yml` del proyecto define variables con valores por defecto:
```yaml
environment:
  DB_USER: ${DB_USER:-school_attendance}
  DB_PASSWORD: ${DB_PASSWORD:-school_attendance}
  SECRET_KEY: ${SECRET_KEY:-CHANGE-ME-IN-PRODUCTION}
```

Para sobrescribir estos defaults hay dos opciones:

#### Opción 1: Archivo .env en /srv (recomendado para prod)
```bash
# Copiar secrets al directorio de la app
sudo cp secrets/prod/.env /srv/prod/apps/school-attendance/.env
appctl pull --env prod --app school-attendance
```

#### Opción 2: Usar defaults del docker-compose (OK para dev)
En desarrollo, los defaults funcionan bien. No se necesita configuración adicional.

### Workspace en Dev

En `dev`, appctl sincroniza el código de la imagen a `/srv/dev/workspaces/school-attendance/`:

- Permite editar código en el servidor sin rebuild
- Se monta como volumen en el contenedor
- Usar `--preserve-workspace` para evitar sobrescribir cambios locales

```bash
# Preservar cambios locales en workspace
appctl pull --env dev --app school-attendance --preserve-workspace
```

## Flujo de Deployment

### Paso 1: Build y Push de Imagen

```bash
cd /home/gocode/projects/school-attendance

# Build y push con tag automático (formato: YYYY.MM.DD.HHMM)
./scripts/build_and_push.sh

# O con tag específico
IMAGE_TAG=v1.2.3 ./scripts/build_and_push.sh
```

El script:
1. Hace login en Docker Hub (usa `$REGISTRY_USER` y `$REGISTRY_PASSWORD`)
2. Construye la imagen con `docker buildx` (linux/amd64)
3. La sube a `moffermann/school-attendance:<tag>`
4. Valida que responda en `/healthz`

### Paso 2: Deploy con appctl

```bash
# Development (usa defaults, sin secrets adicionales)
appctl pull --env dev --app school-attendance

# QA/Production (con secrets)
sudo cp secrets/prod/.env /srv/prod/apps/school-attendance/.env
appctl pull --env prod --app school-attendance --tag 2025.11.28.2231
```

### ¿Qué hace `appctl pull`?

1. Crea directorios en `/srv/<env>/apps/school-attendance/`
2. Resuelve el tag de la imagen (ver sección anterior)
3. Descarga la imagen de Docker Hub
4. (Solo dev) Sincroniza workspace a `/srv/dev/workspaces/`
5. Copia `docker-compose.yml` del proyecto
6. Ejecuta `docker compose up -d`
7. Ejecuta migraciones: `npm run migrate` → `alembic upgrade head`
8. Verifica health en `http://school-attendance:8080/healthz`
9. (Opcional) Ejecuta hook `scripts/appctl-postdeploy.sh` si existe

## Configuración por Ambiente

### Development (dev)

```bash
# Deploy simple (usa defaults)
appctl pull --env dev --app school-attendance

# Ver estado
appctl status --env dev --app school-attendance
```

**URLs:**
- API Docs: http://localhost:8080/api/docs
- Kiosk: http://localhost:8080/kiosk/
- Teacher PWA: http://localhost:8080/teacher/
- Web App: http://localhost:8080/app/
- MinIO Console: http://localhost:9001
- RQ Dashboard: http://localhost:9181 (si está habilitado)

**Credenciales por defecto:**
- DB: `school_attendance` / `school_attendance`
- MinIO: `dev-access` / `dev-secret`

### QA

```bash
# Preparar secrets
cp secrets/qa/.env.example secrets/qa/.env
# Editar con valores de QA

# Copiar al servidor
sudo mkdir -p /srv/qa/apps/school-attendance
sudo cp secrets/qa/.env /srv/qa/apps/school-attendance/.env

# Deploy
appctl pull --env qa --app school-attendance
```

### Production (prod)

```bash
# Preparar secrets (¡usar valores seguros!)
cp secrets/prod/.env.example secrets/prod/.env

# Generar keys seguras:
openssl rand -hex 32  # Para SECRET_KEY
openssl rand -hex 32  # Para DEVICE_API_KEY

# Editar secrets/prod/.env con valores reales

# Copiar al servidor
sudo mkdir -p /srv/prod/apps/school-attendance
sudo cp secrets/prod/.env /srv/prod/apps/school-attendance/.env

# Deploy con tag específico (¡importante!)
appctl pull --env prod --app school-attendance --tag 2025.11.28.2231
```

**Checklist de producción:**
- [ ] Usar tag específico, nunca `latest`
- [ ] `SECRET_KEY` y `DEVICE_API_KEY` generados con `openssl rand -hex 32`
- [ ] `DB_PASSWORD` seguro
- [ ] `ENABLE_REAL_NOTIFICATIONS=true` si se usan notificaciones
- [ ] `CORS_ORIGINS` con dominios específicos
- [ ] S3 real configurado (no MinIO)

## Variables de Entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `APP_ENV` | Ambiente | `development` |
| `DB_USER` | Usuario PostgreSQL | `school_attendance` |
| `DB_PASSWORD` | Password PostgreSQL | `school_attendance` |
| `DB_NAME` | Nombre de la DB | `school_attendance` |
| `SECRET_KEY` | Key para JWT | `CHANGE-ME-IN-PRODUCTION` |
| `DEVICE_API_KEY` | Key para kioscos | `CHANGE-ME-IN-PRODUCTION` |
| `S3_ENDPOINT` | URL de S3/MinIO | `http://minio:9000` |
| `S3_BUCKET` | Bucket de fotos | `attendance-photos` |
| `S3_ACCESS_KEY` | Access key | `dev-access` |
| `S3_SECRET_KEY` | Secret key | `dev-secret` |
| `WHATSAPP_ACCESS_TOKEN` | Token WhatsApp | `dummy` |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone ID WhatsApp | `dummy` |
| `ENABLE_REAL_NOTIFICATIONS` | Enviar notificaciones | `false` |
| `CORS_ORIGINS` | Orígenes permitidos | (vacío = todos) |

Ver `secrets/<env>/.env.example` para la lista completa.

## Migraciones

Las migraciones se ejecutan automáticamente durante el deploy.

El flujo es: `npm run migrate` → `scripts/npm-shim.sh` → `make migrate` → `alembic upgrade head`

Para ejecutar manualmente:
```bash
# Dentro del contenedor
docker exec -it school-attendance-<env> alembic upgrade head

# O usando make
docker exec -it school-attendance-<env> make migrate
```

## Monitoreo

### Health Checks

```bash
# Liveness (rápido)
curl http://localhost:8080/healthz

# Readiness (incluye DB)
curl http://localhost:8080/health

# Verificar via appctl
appctl verify --env dev --app school-attendance
```

### Logs

```bash
# Via appctl
appctl logs --env dev --app school-attendance
appctl logs --env dev --app school-attendance -f  # follow

# Directo con docker
docker logs -f school-attendance-dev
docker logs -f school-attendance-worker-dev
docker logs -f school-attendance-scheduler-dev
```

### Estado de Contenedores

```bash
appctl status --env dev --app school-attendance

# O directo
docker ps | grep school-attendance
```

## Troubleshooting

### La imagen no se descarga

```bash
# Verificar login en Docker Hub
echo $REGISTRY_PASSWORD | docker login -u $REGISTRY_USER --password-stdin

# Verificar que la imagen existe
docker pull moffermann/school-attendance:latest

# Ver tags disponibles
curl -s "https://hub.docker.com/v2/repositories/moffermann/school-attendance/tags?page_size=10" | jq '.results[].name'
```

### Migraciones fallan

```bash
# Ver logs del contenedor
docker logs school-attendance-<env>

# Verificar conectividad a PostgreSQL
docker exec school-attendance-<env> python -c "
from app.core.config import settings
print(settings.database_url)
"

# Ejecutar migraciones manualmente
docker exec -it school-attendance-<env> alembic upgrade head
```

### Health check falla

```bash
# Verificar que el contenedor está corriendo
docker ps | grep school-attendance

# Probar health manualmente
curl -v http://localhost:8080/healthz

# Ver logs de error
docker logs school-attendance-<env> --tail 50

# Verificar desde la red Docker
docker run --rm --network net-dev curlimages/curl:8.10.1 \
  http://school-attendance:8080/healthz
```

### Variables de entorno no se aplican

```bash
# Verificar que .env existe en el servidor
ls -la /srv/<env>/apps/school-attendance/.env

# Ver variables dentro del contenedor
docker exec school-attendance-<env> env | grep -E "DB_|SECRET|S3_"

# Recrear contenedores para aplicar cambios
cd /srv/<env>/apps/school-attendance
docker compose down && docker compose up -d
```

### Notificaciones no se envían

1. Verificar `ENABLE_REAL_NOTIFICATIONS=true`
2. Verificar que Redis está corriendo: `docker ps | grep redis`
3. Verificar logs del worker:
   ```bash
   docker logs school-attendance-worker-<env>
   ```
4. Validar config de WhatsApp:
   ```bash
   docker exec school-attendance-<env> python scripts/whatsapp_setup.py --validate
   ```

## Backup

### Base de Datos

```bash
# Backup
docker exec school-attendance-postgres-<env> \
  pg_dump -U school_attendance school_attendance > backup.sql

# Restore
docker exec -i school-attendance-postgres-<env> \
  psql -U school_attendance school_attendance < backup.sql
```

### Fotos (MinIO/S3)

```bash
# MinIO
mc mirror minio/attendance-photos ./backup/photos/

# AWS S3
aws s3 sync s3://your-bucket ./backup/photos/
```

## Referencia Rápida

```bash
# === BUILD ===
./scripts/build_and_push.sh                    # Tag automático
IMAGE_TAG=v1.0.0 ./scripts/build_and_push.sh   # Tag específico

# === DEV ===
appctl pull --env dev --app school-attendance
appctl logs --env dev --app school-attendance -f
appctl status --env dev --app school-attendance

# === PROD ===
sudo cp secrets/prod/.env /srv/prod/apps/school-attendance/.env
appctl pull --env prod --app school-attendance --tag 2025.11.28.2231

# === UTILS ===
appctl verify --env dev --app school-attendance
appctl rm --env dev --app school-attendance
docker exec -it school-attendance-dev alembic upgrade head
```
