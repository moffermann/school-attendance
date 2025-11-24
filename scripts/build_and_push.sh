#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="${IMAGE_NAME:-school-attendance}"
IMAGE_TAG="${IMAGE_TAG:-$(date +%Y.%m.%d.%H%M)}"

if [[ -z "${REGISTRY_USER:-}" ]]; then
  echo "REGISTRY_USER es obligatorio" >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker no está disponible o el daemon no está corriendo" >&2
  exit 1
fi

if [[ -n "${REGISTRY_PASSWORD:-}" ]]; then
  echo "${REGISTRY_PASSWORD}" | docker login -u "${REGISTRY_USER}" --password-stdin
fi

FULL_IMAGE="${REGISTRY_USER}/${IMAGE_NAME}:${IMAGE_TAG}"
echo "Construyendo ${FULL_IMAGE}..."
docker buildx build --platform linux/amd64 -t "${FULL_IMAGE}" .

echo "Pushing ${FULL_IMAGE}..."
docker push "${FULL_IMAGE}"

echo "Validando contenedor local..."
cid=$(docker run -d -p 8080:8080 "${FULL_IMAGE}")
trap 'docker rm -f ${cid} >/dev/null 2>&1 || true' EXIT
sleep 5
curl -fsS "http://127.0.0.1:8080/healthz" >/dev/null
echo "OK: /healthz responde"
