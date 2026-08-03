#!/bin/sh
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[deploy] Applying database migrations..."
  if node dist/migrate-apply.js; then
    echo "[deploy] Migrations OK"
  else
    echo "[deploy] WARNING: migrations failed — check DATABASE_URL / schema"
  fi
fi

echo "[deploy] Starting Mangia CRM (NODE_ENV=${NODE_ENV:-production})"
exec node dist/index.js
