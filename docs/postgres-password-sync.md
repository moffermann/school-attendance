# PostgreSQL Password Synchronization Issue

## Problem Description

When using PostgreSQL with Docker and persistent volumes, there's a common issue where changing the `POSTGRES_PASSWORD` environment variable doesn't update the actual database user password.

### Root Cause

The official PostgreSQL Docker image only reads `POSTGRES_PASSWORD` during the **initial database creation** (when the data volume is empty). On subsequent container starts with an existing volume:

1. PostgreSQL detects existing data in `/var/lib/postgresql/data`
2. Skips the initialization phase entirely
3. Ignores `POSTGRES_PASSWORD` environment variable
4. Uses the password stored in the existing database

### Symptoms

```
asyncpg.exceptions.InvalidPasswordError: password authentication failed for user "myuser"
```

This happens even though:
- The `.env` file has the correct password
- The container shows the correct `POSTGRES_PASSWORD` in `docker inspect`
- The password worked before (with a different volume or first-time setup)

### Common Scenarios

1. **Changing passwords**: Update `.env` with new password, recreate containers
2. **Multi-environment deployments**: Same volume used with different `.env` files
3. **Container recreation**: `docker compose down && docker compose up` with password change
4. **Disaster recovery**: Restoring a volume backup to a new environment

## Solution

### Wrapper Entrypoint Script

We use a wrapper script that intercepts the PostgreSQL startup and synchronizes the password before the main entrypoint runs.

**File: `scripts/postgres-entrypoint-wrapper.sh`**

```bash
#!/bin/bash
set -e

PGDATA="${PGDATA:-/var/lib/postgresql/data}"

sync_password() {
    echo "==> [password-sync] Detected existing data directory"
    echo "==> [password-sync] Synchronizing password with POSTGRES_PASSWORD..."

    # Start PostgreSQL temporarily with local-only connections
    pg_ctl -D "$PGDATA" -o "-c listen_addresses=''" -w start

    # Update the password
    psql -U "$POSTGRES_USER" -d "${POSTGRES_DB:-$POSTGRES_USER}" -c \
        "ALTER USER \"$POSTGRES_USER\" WITH PASSWORD '$POSTGRES_PASSWORD';" \
        > /dev/null 2>&1

    # Stop PostgreSQL gracefully
    pg_ctl -D "$PGDATA" -m fast -w stop

    echo "==> [password-sync] Password synchronized successfully"
}

# Check if data directory already has an initialized database
if [ -f "$PGDATA/PG_VERSION" ]; then
    sync_password
else
    echo "==> [password-sync] Fresh volume detected, skipping password sync"
fi

# Execute the original PostgreSQL entrypoint
exec docker-entrypoint.sh "$@"
```

### Docker Compose Configuration

```yaml
services:
  postgres:
    image: postgres:15
    entrypoint: ["/usr/local/bin/postgres-entrypoint-wrapper.sh"]
    command: ["postgres"]
    environment:
      POSTGRES_USER: ${DB_USER:-myuser}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-mypassword}
      POSTGRES_DB: ${DB_NAME:-mydb}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/postgres-entrypoint-wrapper.sh:/usr/local/bin/postgres-entrypoint-wrapper.sh:ro
```

### How It Works

1. Container starts with custom entrypoint
2. Script checks if `PG_VERSION` file exists (indicates existing database)
3. If existing database:
   - Starts PostgreSQL in local-only mode (no network connections)
   - Executes `ALTER USER` to update password
   - Stops PostgreSQL gracefully
4. Passes control to original `docker-entrypoint.sh`
5. PostgreSQL starts normally with synchronized password

### Advantages

- **Transparent**: No changes to application code
- **Safe**: Password sync happens before any network connections
- **Idempotent**: Safe to run on every container start
- **Backwards compatible**: Works with fresh volumes too

## Alternative Solutions

### Manual Password Reset

If you can't use the wrapper, reset manually:

```bash
# Connect to postgres container
docker exec -it <postgres-container> psql -U postgres

# Update the password
ALTER USER myuser WITH PASSWORD 'new-password';
```

### Volume Recreation

Nuclear option - loses all data:

```bash
docker compose down -v  # Removes volumes
docker compose up -d    # Fresh start
```

### pg_hba.conf Modification

Less secure - allows trust authentication:

```yaml
postgres:
  command: >
    -c password_encryption=md5
```

## Applying to Other Projects

To use this solution in other projects:

1. Copy `scripts/postgres-entrypoint-wrapper.sh` to your project
2. Make it executable: `chmod +x scripts/postgres-entrypoint-wrapper.sh`
3. Update your `docker-compose.yml` with:
   - Custom entrypoint
   - Volume mount for the wrapper script
4. Rebuild/recreate containers

## Troubleshooting

### Script Not Executable

```
exec: postgres-entrypoint-wrapper.sh: Permission denied
```

Fix: `chmod +x scripts/postgres-entrypoint-wrapper.sh`

### Password Still Not Working

Check if the script ran:
```bash
docker logs <postgres-container> 2>&1 | grep password-sync
```

Should show:
```
==> [password-sync] Detected existing data directory
==> [password-sync] Synchronizing password with POSTGRES_PASSWORD...
==> [password-sync] Password synchronized successfully
```

### pg_ctl Not Found

Ensure you're using the official PostgreSQL image. Alpine variants may have different paths.

## References

- [PostgreSQL Docker Hub - Environment Variables](https://hub.docker.com/_/postgres)
- [GitHub Issue: POSTGRES_PASSWORD ignored on existing volume](https://github.com/docker-library/postgres/issues/203)
- [Docker PostgreSQL initialization scripts](https://hub.docker.com/_/postgres#initialization-scripts)
