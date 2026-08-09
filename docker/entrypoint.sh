#!/bin/sh
set -e

STORAGE_DIR="${STORAGE_DIR:-/app/data/uploads}"
mkdir -p "$STORAGE_DIR"
echo "[deploy] Storage dir ready: $STORAGE_DIR"

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[deploy] Applying database migrations..."
  if node dist/migrate-apply.js; then
    echo "[deploy] Migrations OK"
  else
    echo "[deploy] WARNING: migrations failed — check DATABASE_URL / schema"
  fi
else
  echo "[deploy] RUN_MIGRATIONS=false — skipping migrations"
fi

if [ "${RUN_SEED:-true}" = "true" ]; then
  echo "[deploy] Seeding default admin (if missing)..."
  echo "[deploy] SEED_ADMIN_EMAIL=${SEED_ADMIN_EMAIL:-admin@mangia.com}"
  if [ -n "${SEED_ADMIN_PASSWORD:-}" ]; then
    echo "[deploy] SEED_ADMIN_PASSWORD=[set]"
  else
    echo "[deploy] SEED_ADMIN_PASSWORD=[default: changeme]"
  fi
  if node dist/seed.js; then
    echo "[deploy] Seed OK"
  else
    echo "[deploy] WARNING: seed failed — admin may be missing. Check logs above, DATABASE_URL, and SEED_ADMIN_* in .env"
  fi
else
  echo "[deploy] RUN_SEED=false — skipping seed"
fi

echo "[deploy] Starting Mangia CRM (NODE_ENV=${NODE_ENV:-production})"
exec node dist/index.js
