Eres un asistente DevOps. Toma el repo ACTUAL y entrégame todo lo necesario para ejecutarlo en Docker, listo para producción y desarrollo.

REQUISITOS GENERALES
- Detecta el stack (Node, Python, Go, Java, .NET, PHP, etc.) automáticamente.
- Crea un Dockerfile MULTI-STAGE, mínimo y reproducible (usa imágenes oficiales slim/alpine si es razonable).
- Crea .dockerignore completo (node_modules, venv, build, target, .git, etc.).
- El contenedor DEBE ejecutar como usuario NO root (uid 10001, user: app).
- El servicio debe escuchar en 0.0.0.0:8080 (y opcional 8443 si TLS interno) y exponer endpoint /healthz (200 OK).
- Variables de entorno por defecto desde ENV (no hardcodear secretos). Soportar LOG_LEVEL, PORT=8080.
- Graceful shutdown (manejar SIGTERM/SIGINT) y logs por stdout/err (sin archivos locales).
- HEALTHCHECK en Dockerfile a GET http://localhost:8080/healthz (reintentos y timeout sensatos).
- Si el framework no trae /healthz, agrega un handler mínimo (sin romper el enrutamiento actual).
- Si hay build (Node/Go/Java/.NET), usa multi-stage: etapa build y etapa runtime minimal.
- Si hay migra/bundle (ej. Python: pip install -r requirements.txt; Node: npm ci && npm run build), hazlo en la etapa build.
- Si aplica (Node), usa `npm ci` en vez de `npm install` y copia solo `package*.json` antes del resto.
- No publiques puertos del host; sólo EXPOSE 8080.
- Incluye un README.md (sección Docker) con: build local, run local, healthcheck, y cómo configurar variables.

ENTREGABLES
1) Dockerfile final (multi-stage) seguro y pequeño.
2) .dockerignore completo.
3) Código/patch mínimo para /healthz (SI FALTA) y explicación de cómo quedó cableado.
4) Script de build y push:
   - Archivo `scripts/build_and_push.sh` que reciba:
     - REGISTRY_USER (obligatorio), IMAGE_NAME (Por defecto se debe utilizar el nombre del proyecto), IMAGE_TAG (default: auto con fecha yyyy.mm.dd.hhmm).
   - Pasos: docker login si no hay token ya, docker buildx build --platform linux/amd64 -t $REGISTRY_USER/$IMAGE_NAME:$IMAGE_TAG . && docker push.
   - Validar que compila y corre `docker run --rm -p 8080:8080 ...` y responde /healthz.
5) README.md (sección Docker): comandos de build/push y variables.

CONVENCIONES
- Usuario del contenedor: app (uid 10001), home /home/app, WORKDIR /app.
- La app debe arrancar con `PORT=8080`.
- Healthcheck Dockerfile: `HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1` (usa curl/wget según base).
- No uses root; ajusta permisos/chown.
- Si es Python, usa `python:3.x-slim`, `venv` en build stage y copia site-packages a runtime minimal (o pip install --no-cache-dir en runtime si queda chico).
- Si es Node, runtime `node:20-alpine` (si aplica) y `npm run start`.
- Si es Go, usa `golang:1.xx` build + `gcr.io/distroless/base-debian12` o `alpine` en runtime.
- Si es Java, build con Maven/Gradle y runtime con `eclipse-temurin:21-jre-jammy` (o similar).
- Si es .NET, SDK + aspnet runtime.

AL FINAL devuelve:
- Dockerfile completo
- .dockerignore
- Archivos añadidos para /healthz (si aplicó)
- scripts/build_and_push.sh con chmod +x (muestra el contenido)
- README.md (sección Docker) con ejemplos:
  - build: `REGISTRY_USER=<tu_user> IMAGE_NAME=<miapp> ./scripts/build_and_push.sh`
  - run local: `docker run --rm -p 8080:8080 <user>/<miapp>:<tag>`
  - health: `curl http://127.0.0.1:8080/healthz`