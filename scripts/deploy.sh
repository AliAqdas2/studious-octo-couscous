#!/usr/bin/env bash
# Run on the server (or via SSH) from the app directory.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  echo "Missing .env — copy your production env file here first."
  exit 1
fi

echo "[deploy] Building mangia-crm..."
docker compose up -d --build --remove-orphans

echo "[deploy] Status:"
docker compose ps

echo "[deploy] Recent logs:"
docker compose logs --tail=40 app
