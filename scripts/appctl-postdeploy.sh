#!/bin/bash
# appctl-postdeploy.sh - Hook executed after appctl deploy
#
# This script is called by appctl from INSIDE the container after deployment.
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

echo "Running tenant seed for ${ENV}..."

# Execute seed script directly (we're already inside the container)
python scripts/seed_tenant.py --env "${ENV}"

SEED_EXIT=$?

if [[ ${SEED_EXIT} -eq 0 ]]; then
    echo "Seed completed successfully"
else
    echo "WARNING: Seed script exited with code ${SEED_EXIT}"
    # Don't fail the deploy if seed fails - it might already be seeded
    exit 0
fi
