#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# School Attendance - Build, Push & Deploy Script
# =============================================================================
# Usage:
#   ./scripts/build_and_push.sh              # Build, push y deploy a dev
#   ./scripts/build_and_push.sh --no-deploy  # Solo build y push
#   IMAGE_TAG=v1.0.0 ./scripts/build_and_push.sh  # Tag específico
#
# Variables de entorno requeridas:
#   REGISTRY_USER     - Usuario de Docker Hub (requerido)
#   REGISTRY_PASSWORD - Token de Docker Hub (opcional, para login automático)
# =============================================================================

IMAGE_NAME="${IMAGE_NAME:-school-attendance}"
IMAGE_TAG="${IMAGE_TAG:-$(date +%Y.%m.%d.%H%M)}"
DEPLOY_ENV="${DEPLOY_ENV:-dev}"
SKIP_DEPLOY=false

# Parsear argumentos
for arg in "$@"; do
  case $arg in
    --no-deploy)
      SKIP_DEPLOY=true
      shift
      ;;
    --env=*)
      DEPLOY_ENV="${arg#*=}"
      shift
      ;;
  esac
done

# Validaciones
if [[ -z "${REGISTRY_USER:-}" ]]; then
  echo "ERROR: REGISTRY_USER es obligatorio" >&2
  echo "Configura en ~/.bashrc: export REGISTRY_USER=\"tu-usuario\"" >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "ERROR: Docker no está disponible o el daemon no está corriendo" >&2
  exit 1
fi

# Login en Docker Hub (si hay password)
if [[ -n "${REGISTRY_PASSWORD:-}" ]]; then
  echo "Autenticando en Docker Hub..."
  echo "${REGISTRY_PASSWORD}" | docker login -u "${REGISTRY_USER}" --password-stdin
fi

FULL_IMAGE="${REGISTRY_USER}/${IMAGE_NAME}:${IMAGE_TAG}"
LATEST_IMAGE="${REGISTRY_USER}/${IMAGE_NAME}:latest"

echo "=============================================="
echo "Build & Push: ${IMAGE_NAME}"
echo "Tag: ${IMAGE_TAG}"
echo "Registry: ${REGISTRY_USER}"
echo "=============================================="

# Build
echo ""
echo "[1/4] Construyendo imagen..."
docker buildx build --platform linux/amd64 -t "${FULL_IMAGE}" -t "${LATEST_IMAGE}" --push .

echo ""
echo "[2/4] Imagen subida exitosamente"
echo "  - ${FULL_IMAGE}"
echo "  - ${LATEST_IMAGE}"

# Validación local
echo ""
echo "[3/4] Validando contenedor local..."
cid=$(docker run -d --rm -p 18080:8080 "${FULL_IMAGE}")
cleanup() {
  docker rm -f "${cid}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Esperar a que el contenedor esté listo
for i in {1..30}; do
  if curl -fsS "http://127.0.0.1:18080/healthz" >/dev/null 2>&1; then
    echo "  OK: /healthz responde correctamente"
    break
  fi
  if [[ $i -eq 30 ]]; then
    echo "ERROR: El contenedor no respondió en tiempo" >&2
    docker logs "${cid}"
    exit 1
  fi
  sleep 1
done

# Limpiar contenedor de prueba
cleanup
trap - EXIT

# Deploy con appctl
if [[ "${SKIP_DEPLOY}" == "false" ]]; then
  echo ""
  echo "[4/4] Desplegando a ${DEPLOY_ENV} con appctl..."

  if ! command -v appctl &>/dev/null; then
    echo "WARN: appctl no está instalado, saltando deploy" >&2
    echo "Instala appctl o ejecuta manualmente:"
    echo "  appctl pull --env ${DEPLOY_ENV} --app ${IMAGE_NAME} --tag ${IMAGE_TAG}"
  else
    appctl pull --env "${DEPLOY_ENV}" --app "${IMAGE_NAME}" --tag "${IMAGE_TAG}" --timeout 600

    echo ""
    echo "Verificando deploy..."
    appctl verify --env "${DEPLOY_ENV}" --app "${IMAGE_NAME}" || true
  fi
else
  echo ""
  echo "[4/4] Deploy omitido (--no-deploy)"
fi

echo ""
echo "=============================================="
echo "Completado exitosamente"
echo "  Imagen: ${FULL_IMAGE}"
if [[ "${SKIP_DEPLOY}" == "false" ]]; then
  echo "  Deploy: ${DEPLOY_ENV}"
fi
echo "=============================================="
