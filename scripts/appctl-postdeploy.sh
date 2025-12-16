#!/bin/bash
# appctl-postdeploy.sh - Hook executed after appctl deploy
#
# This script is called by appctl from INSIDE the container after deployment.
# Arguments:
#   $1 - APP name (e.g., "school-attendance")
#   $2 - ENV (dev, qa, prod, staging, development, production)
#
# It seeds demo data for environments based on configuration.
# Production seeding requires SEED_DEMO_IN_PROD=true environment variable.

set -euo pipefail

APP="${1:-}"
ENV="${2:-}"

echo "== Post-deploy hook for ${APP} in ${ENV} =="

# Map environment names to seed script values
case "${ENV}" in
    "development") SEED_ENV="dev" ;;
    "staging"|"qa") SEED_ENV="qa" ;;
    "production"|"prod") SEED_ENV="prod" ;;
    "local") SEED_ENV="local" ;;
    *) SEED_ENV="${ENV}" ;;
esac

echo "Mapped ENV '${ENV}' -> SEED_ENV '${SEED_ENV}'"

# Handle production seeding with explicit confirmation
if [[ "${SEED_ENV}" == "prod" ]]; then
    if [[ "${SEED_DEMO_IN_PROD:-false}" != "true" ]]; then
        echo "Skipping seed in production (set SEED_DEMO_IN_PROD=true to enable)"
        exit 0
    fi
    echo "WARNING: Seeding demo data in PRODUCTION environment"
fi

echo "Running tenant seed for ${SEED_ENV}..."

# Execute seed script with mapped environment
python scripts/seed_tenant.py --env "${SEED_ENV}"

SEED_EXIT=$?

if [[ ${SEED_EXIT} -eq 0 ]]; then
    echo "Seed completed successfully"
else
    echo "WARNING: Seed script exited with code ${SEED_EXIT}"
    # Don't fail the deploy if seed fails - it might already be seeded
    exit 0
fi
