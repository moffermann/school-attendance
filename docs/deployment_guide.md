# Deployment Guide - Guía General de Despliegue con appctl

Este documento describe la arquitectura y el proceso de despliegue estándar para aplicaciones en el servidor gocode usando `appctl`.

## Arquitectura General

### Estructura de Ambientes

El servidor soporta tres ambientes aislados:

| Ambiente | Directorio Base | Red Docker | Dominio |
|----------|-----------------|------------|---------|
| dev | `/srv/dev/` | `net-dev` | `<app>.dev.gocode.cl` |
| qa | `/srv/qa/` | `net-qa` | `<app>.qa.gocode.cl` |
| prod | `/srv/prod/` | `net-prod` | `<app>.gocode.cl` |

> **Nota:** El dominio de producción NO incluye el sufijo de ambiente (ej: `mi-app.gocode.cl` en lugar de `mi-app.prod.gocode.cl`).

### Diagrama de Red

```
Internet → nginx (443/SSL)
              ↓
    ┌─────────┼─────────┐
    ↓         ↓         ↓
 net-dev   net-qa   net-prod
    ↓         ↓         ↓
 app-dev   app-qa   app-prod
```

Un contenedor nginx centralizado actúa como proxy reverso, conectado a todas las redes Docker, ruteando el tráfico según el dominio.

## Requisitos Previos

### 1. appctl instalado

```bash
# Verificar instalación
which appctl  # Debe mostrar /usr/local/bin/appctl
```

### 2. Docker configurado

```bash
# Verificar Docker
docker --version
docker compose version
```

### 3. Credenciales de Docker Hub

En `~/.bashrc` o `~/.profile`:
```bash
export REGISTRY_USER="tu-usuario"
export REGISTRY_PASSWORD="tu-token"
```

### 4. Redes Docker creadas

```bash
# Crear redes si no existen
docker network create net-dev
docker network create net-qa
docker network create net-prod
```

> **IMPORTANTE:** Las redes usan **guión** (`net-dev`), no guión bajo (`net_dev`). La convención antigua con guión bajo está obsoleta.

## Estructura de Directorios

### En el Proyecto (Repositorio)

```
mi-proyecto/
├── docker-compose.yml       # OBLIGATORIO: Configuración de servicios
├── nginx/                   # OPCIONAL: Configuración nginx personalizada
│   ├── dev.conf
│   ├── qa.conf
│   └── prod.conf
├── secrets/                 # OPCIONAL: Templates de variables
│   ├── dev/
│   │   └── .env.example
│   ├── qa/
│   │   └── .env.example
│   └── prod/
│       └── .env.example
└── scripts/
    └── appctl-postdeploy.sh # OPCIONAL: Hook post-deploy
```

### En el Servidor (creados por appctl)

```
/srv/<env>/
├── apps/<mi-app>/
│   ├── docker-compose.yml  # Copiado del proyecto
│   └── .env                # Secrets (copiados manualmente)
└── workspaces/<mi-app>/    # Solo en dev: código sincronizado

/srv/nginx/
├── conf.d/
│   ├── 50-<mi-app>.dev.gocode.cl-ssl.conf
│   ├── 50-<mi-app>.qa.gocode.cl-ssl.conf
│   └── 50-<mi-app>.gocode.cl-ssl.conf  # prod (sin sufijo)
└── .git/                   # Control de versiones de configs
```

## Requisitos del docker-compose.yml

### Requisitos Obligatorios

1. **Servicio principal con el nombre de la app:**
   ```yaml
   services:
     mi-app:  # Debe coincidir con --app
       container_name: ${APP_NAME:-mi-app}-${APP_ENV:-dev}
       image: ${REGISTRY_USER:-usuario}/mi-app:${IMAGE_TAG:-latest}
   ```

2. **Red externa configurada:**
   ```yaml
   networks:
     app_net:
       external: true
       name: ${DOCKER_NETWORK:-net-dev}
   ```

3. **Healthcheck definido:**
   ```yaml
   healthcheck:
     test: ["CMD", "wget", "-qO-", "http://127.0.0.1:8080/healthz"]
     interval: 30s
     timeout: 3s
     retries: 3
   ```

4. **Endpoint `/healthz` implementado** en el puerto 8080.

### Ejemplo Mínimo

```yaml
services:
  mi-app:
    container_name: ${APP_NAME:-mi-app}-${APP_ENV:-dev}
    image: ${REGISTRY_USER:-moffermann}/mi-app:${IMAGE_TAG:-latest}
    environment:
      APP_ENV: ${APP_ENV:-development}
      PORT: 8080
    healthcheck:
      test: ["CMD-SHELL", "curl -fsS http://127.0.0.1:8080/healthz"]
      interval: 30s
      timeout: 3s
      retries: 3
    networks:
      - app_net

networks:
  app_net:
    external: true
    name: ${DOCKER_NETWORK:-net-dev}
```

### Variables de Sustitución Automática

appctl sustituye estas variables en el `docker-compose.yml`:

| Placeholder | Se reemplaza por |
|-------------|------------------|
| `<ENV>` | Valor de `--env` (dev, qa, prod) |
| `<APP>` | Valor de `--app` |
| `<TAG>` | Tag de la imagen resuelto |

## Comandos de appctl

### Comandos Principales

| Comando | Descripción |
|---------|-------------|
| `appctl pull` | Descarga imagen + deploy (equivale a `deploy --pull`) |
| `appctl deploy` | Deploy sin actualizar imagen |
| `appctl status` | Ver estado de contenedores |
| `appctl logs` | Ver logs (`-f` para follow) |
| `appctl verify` | Verificar health check |
| `appctl validate` | Validar docker-compose sin hacer deploy |
| `appctl rm` | Eliminar deployment |

### Sintaxis

```bash
appctl <comando> --env <dev|qa|prod> --app <nombre> [opciones]
```

### Opciones

| Opción | Descripción |
|--------|-------------|
| `--tag <version>` | Tag específico de la imagen |
| `--image <repo/image>` | Imagen alternativa (default: moffermann/<app>) |
| `--preserve-workspace` | No sobrescribir workspace en dev |
| `--verbose` o `-v` | Mostrar información detallada |
| `-f` | (solo logs) Seguir logs en tiempo real |

## Flujo de Deployment

### 1. Build y Push de Imagen

```bash
# Con tag automático (YYYY.MM.DD.HHMM)
./scripts/build_and_push.sh

# Con tag específico
IMAGE_TAG=v1.2.3 ./scripts/build_and_push.sh
```

### 2. Deploy

```bash
# Development (usa defaults)
appctl pull --env dev --app mi-app

# QA/Production (con secrets)
sudo cp secrets/prod/.env /srv/prod/apps/mi-app/.env
appctl pull --env prod --app mi-app --tag 2025.01.15.1430
```

### ¿Qué hace `appctl pull`?

1. Crea directorios en `/srv/<env>/apps/<app>/`
2. Resuelve el tag de la imagen:
   - Si `--tag` especificado (y != `latest`): usa ese tag
   - Si existe `latest` en registry: usa `latest`
   - Si no: consulta Docker Hub y usa el más reciente
3. Descarga la imagen de Docker Hub
4. (Solo dev) Sincroniza workspace a `/srv/dev/workspaces/<app>/`
5. Copia `docker-compose.yml` del proyecto
6. Valida el compose
7. Ejecuta `docker compose up -d --force-recreate`
8. Ejecuta migraciones: `npm run migrate`
9. Sincroniza configuración nginx
10. Verifica health en `http://<app>:8080/healthz`
11. (Opcional) Ejecuta `scripts/appctl-postdeploy.sh` si existe

## Configuración de Nginx

### Comportamiento Automático

1. Si existe `nginx/<env>.conf` en el proyecto → se usa esa configuración
2. Si no existe → appctl genera una desde template

En ambos casos, el archivo se copia a `/srv/nginx/conf.d/` y nginx se recarga.

### Template por Defecto

```nginx
server {
  listen 443 ssl;
  http2 on;
  server_name <app>.<env>.gocode.cl;  # En prod: <app>.gocode.cl

  ssl_certificate     /etc/letsencrypt/live/<env>.gocode.cl/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/<env>.gocode.cl/privkey.pem;

  location / {
    resolver 127.0.0.11 valid=30s;
    set $upstream <app>-<env>:8080;

    proxy_pass http://$upstream;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

> **Nota sobre `resolver`:** El uso de `resolver 127.0.0.11` con variable `$upstream` permite que nginx resuelva DNS dinámicamente. Sin esto, nginx cachea la IP del contenedor al iniciar, causando errores 502 si el contenedor se reinicia.

### Personalización

Para agregar WebSocket, timeouts, headers adicionales, etc.:

1. El archivo `nginx/<env>.conf` se genera automáticamente en el primer deploy
2. Modifícalo según necesites
3. Haz commit del cambio
4. En el próximo deploy, appctl usará tu versión personalizada

## Workspace en Dev

En ambiente `dev`, appctl sincroniza el código de la imagen a `/srv/dev/workspaces/<app>/`:

- Permite editar código en el servidor sin rebuild
- Se monta como volumen en el contenedor
- Útil para desarrollo y debugging

```bash
# Preservar cambios locales en workspace
appctl pull --env dev --app mi-app --preserve-workspace
```

## Variables de Entorno

### Mecanismo de Configuración

El `docker-compose.yml` define variables con defaults:

```yaml
environment:
  DB_USER: ${DB_USER:-mi_app}
  SECRET_KEY: ${SECRET_KEY:-CHANGE-ME}
```

Para sobrescribir:

**Opción 1: Archivo .env (recomendado para prod)**
```bash
sudo cp secrets/prod/.env /srv/prod/apps/mi-app/.env
appctl pull --env prod --app mi-app
```

**Opción 2: Defaults del compose (OK para dev)**

En desarrollo, los defaults funcionan bien.

## Migraciones

Las migraciones se ejecutan automáticamente durante el deploy:

```
npm run migrate → scripts/npm-shim.sh → make migrate → alembic upgrade head
```

Para ejecutar manualmente:
```bash
docker exec -it mi-app-dev alembic upgrade head
```

## Health Checks

### Endpoints Recomendados

- `/healthz` - Liveness probe (rápido, sin dependencias)
- `/health` - Readiness probe (incluye DB, Redis, etc.)

### Verificación Manual

```bash
# Via appctl
appctl verify --env dev --app mi-app

# Via curl
curl http://localhost:8080/healthz

# Desde la red Docker
docker run --rm --network net-dev curlimages/curl:8.10.1 \
  http://mi-app:8080/healthz
```

## Hook Post-Deploy

Si existe `scripts/appctl-postdeploy.sh` (ejecutable), se ejecuta después del deploy:

```bash
#!/bin/bash
# scripts/appctl-postdeploy.sh
APP="$1"
ENV="$2"

echo "Post-deploy hook para ${APP} en ${ENV}"
# Comandos adicionales...
```

## Troubleshooting

### La imagen no se descarga

```bash
# Verificar login
echo $REGISTRY_PASSWORD | docker login -u $REGISTRY_USER --password-stdin

# Verificar tags disponibles
curl -s "https://hub.docker.com/v2/repositories/usuario/mi-app/tags?page_size=10" | jq '.results[].name'
```

### Health check falla

```bash
# Verificar contenedor corriendo
docker ps | grep mi-app

# Probar health manualmente
curl -v http://localhost:8080/healthz

# Ver logs
docker logs mi-app-dev --tail 50
```

### Variables de entorno no se aplican

```bash
# Verificar .env existe
ls -la /srv/<env>/apps/mi-app/.env

# Ver variables en contenedor
docker exec mi-app-dev env | grep -E "DB_|SECRET"

# Recrear contenedores
cd /srv/<env>/apps/mi-app
docker compose down && docker compose up -d
```

### Nginx no rutea correctamente

```bash
# Verificar configuración
cat /srv/nginx/conf.d/50-mi-app.dev.gocode.cl-ssl.conf

# Probar sintaxis nginx
docker exec nginx-nginx-1 nginx -t

# Recargar nginx
docker exec nginx-nginx-1 nginx -s reload
```

## Referencia Rápida

```bash
# === DEPLOY ===
appctl pull --env dev --app mi-app                          # Dev
appctl pull --env qa --app mi-app                           # QA
appctl pull --env prod --app mi-app --tag 2025.01.15.1430  # Prod

# === MONITOREO ===
appctl status --env dev --app mi-app
appctl logs --env dev --app mi-app -f
appctl verify --env dev --app mi-app

# === VALIDACIÓN ===
appctl validate --env dev --app mi-app

# === LIMPIEZA ===
appctl rm --env dev --app mi-app
```
