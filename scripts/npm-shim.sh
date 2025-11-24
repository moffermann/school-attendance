#!/bin/sh
# Minimal npm shim to support `npm run migrate` without installing Node.

set -e

if [ "$1" = "run" ] && [ "$2" = "migrate" ]; then
  shift 2

  # Espera a que la base de datos esté disponible antes de migrar.
  if python - <<'PY'
import asyncio
import sys
from urllib.parse import urlsplit

import asyncpg

from app.core.config import settings

MAX_ATTEMPTS = 8
SLEEP_SECONDS = 2


def normalize_dsn(url: str) -> str:
    # asyncpg acepta "postgresql://" y "postgres://"
    parsed = urlsplit(url)
    scheme = parsed.scheme
    if scheme in ("postgresql+asyncpg", "postgres+asyncpg"):
        scheme = "postgresql"
    elif scheme in ("postgresql", "postgres"):
        pass
    elif scheme.startswith("sqlite"):
        return url  # no-probe for sqlite
    else:
        raise ValueError(f"esquema de DATABASE_URL no soportado: {parsed.scheme}")

    rebuilt = parsed._replace(scheme=scheme).geturl()
    return rebuilt


async def wait_for_db(url: str) -> None:
    dsn = normalize_dsn(url)
    if dsn.startswith("sqlite"):
        return
    last_exc: Exception | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            conn = await asyncpg.connect(dsn=dsn, timeout=5)
        except Exception as exc:  # broad: we want to retry on any connection issue
            last_exc = exc
            await asyncio.sleep(SLEEP_SECONDS)
            continue
        else:
            await conn.close()
            return
    raise RuntimeError(f"No se pudo conectar a la base de datos después de {MAX_ATTEMPTS} intentos: {last_exc}")


async def main() -> None:
    url = settings.database_url
    if not url:
        print("npm shim: DATABASE_URL no está definido.", file=sys.stderr)
        sys.exit(1)
    await wait_for_db(url)


try:
    asyncio.run(main())
except Exception as exc:
    print(f"npm shim: DB no accesible después de reintentos ({exc}); omitiendo migraciones.", file=sys.stderr)
    sys.exit(99)
PY
  then
    :
  else
    status=$?
    if [ "$status" -eq 99 ]; then
      exit 0
    fi
    exit "$status"
  fi

  exec make migrate "$@"
fi

echo "npm shim: unsupported command. Only \`npm run migrate\` is available." >&2
exit 1
