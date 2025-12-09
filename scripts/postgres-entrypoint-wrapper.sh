#!/bin/bash
# postgres-entrypoint-wrapper.sh
#
# Wrapper script for PostgreSQL Docker entrypoint that ensures the database
# user password is synchronized with the POSTGRES_PASSWORD environment variable.
#
# PROBLEM:
# PostgreSQL Docker image only sets the user password from POSTGRES_PASSWORD
# during the FIRST initialization (when the data volume is empty). If you later
# change the password in your .env file and recreate the container, the old
# password persists in the volume, causing authentication failures.
#
# SOLUTION:
# This wrapper detects if the data directory already exists and, if so,
# temporarily starts PostgreSQL to update the password before the main
# entrypoint runs.
#
# USAGE:
# In docker-compose.yml:
#   postgres:
#     image: postgres:15
#     entrypoint: ["/usr/local/bin/postgres-entrypoint-wrapper.sh"]
#     command: ["postgres"]
#     volumes:
#       - ./scripts/postgres-entrypoint-wrapper.sh:/usr/local/bin/postgres-entrypoint-wrapper.sh:ro
#
# See docs/postgres-password-sync.md for full documentation.

set -e

PGDATA="${PGDATA:-/var/lib/postgresql/data}"

sync_password() {
    echo "==> [password-sync] Detected existing data directory"
    echo "==> [password-sync] Synchronizing password with POSTGRES_PASSWORD..."

    # Start PostgreSQL temporarily with local-only connections
    # Use gosu because pg_ctl cannot run as root
    gosu postgres pg_ctl -D "$PGDATA" -o "-c listen_addresses=''" -w start

    # Update the password
    gosu postgres psql -U "$POSTGRES_USER" -d "${POSTGRES_DB:-$POSTGRES_USER}" -c \
        "ALTER USER \"$POSTGRES_USER\" WITH PASSWORD '$POSTGRES_PASSWORD';" \
        > /dev/null 2>&1

    # Stop PostgreSQL gracefully
    gosu postgres pg_ctl -D "$PGDATA" -m fast -w stop

    echo "==> [password-sync] Password synchronized successfully"
}

# Check if data directory already has an initialized database
if [ -f "$PGDATA/PG_VERSION" ]; then
    # Volume exists with data - need to sync password
    sync_password
else
    echo "==> [password-sync] Fresh volume detected, skipping password sync"
fi

# Execute the original PostgreSQL entrypoint
exec docker-entrypoint.sh "$@"
