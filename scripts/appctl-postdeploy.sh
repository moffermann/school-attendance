#!/bin/bash
# appctl-postdeploy.sh - Hook executed after appctl deploy
#
# This script is called by appctl after a successful deployment.
# Arguments:
#   $1 - APP name (e.g., "school-attendance")
#   $2 - ENV (dev, qa, prod)
#
# It seeds demo data for non-production environments.

set -euo pipefail

APP="${1:-}"
ENV="${2:-}"

echo "== Post-deploy hook for ${APP} in ${ENV} =="

# Only seed data in dev/qa, NEVER in prod
if [[ "${ENV}" == "prod" ]]; then
    echo "Skipping seed in production environment"
    exit 0
fi

CONTAINER_NAME="${APP}-${ENV}"

echo "Checking if container ${CONTAINER_NAME} is ready..."

# Wait for container to be healthy (max 60 seconds)
MAX_WAIT=60
WAITED=0
while [[ ${WAITED} -lt ${MAX_WAIT} ]]; do
    HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "${CONTAINER_NAME}" 2>/dev/null || echo "unknown")
    if [[ "${HEALTH}" == "healthy" ]]; then
        echo "Container is healthy"
        break
    fi
    echo "Waiting for container health... (${HEALTH})"
    sleep 5
    WAITED=$((WAITED + 5))
done

if [[ ${WAITED} -ge ${MAX_WAIT} ]]; then
    echo "WARNING: Container did not become healthy in ${MAX_WAIT}s, attempting seed anyway..."
fi

echo "Running tenant seed for ${ENV}..."

# Execute seed script inside the container
# The script will use APP_ENV from the container's environment
docker exec "${CONTAINER_NAME}" python scripts/seed_tenant.py --env "${ENV}"

SEED_EXIT=$?

if [[ ${SEED_EXIT} -eq 0 ]]; then
    echo "== Post-deploy hook completed successfully =="
else
    echo "WARNING: Seed script exited with code ${SEED_EXIT}"
    # Don't fail the deploy if seed fails - it might already be seeded
    exit 0
fi
