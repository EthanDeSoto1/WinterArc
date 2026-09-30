#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

file="${1:-}"
if [ -z "$file" ] || [ ! -f "$file" ]; then
  echo "Usage: bash scripts/restore.sh backups/<file>.db"
  exit 1
fi
file="$(realpath "$file")"

if [ -n "$(docker compose ps --status running -q app)" ]; then
  bash scripts/backup.sh before-restore
fi

mkdir -p backups/photos
photos="$(realpath backups/photos)"

docker compose stop app
docker compose run --rm --no-deps -T -v "$file:/restore.db:ro" -v "$photos:/restore-photos:ro" app \
  sh -c 'cp /restore.db /data/winter-arc.db && rm -f /data/winter-arc.db-wal /data/winter-arc.db-shm && mkdir -p /data/photos && cp -rn /restore-photos/. /data/photos/'
docker compose start app

echo "Restored $file. Check that it shows (healthy) in about 10 seconds:"
docker compose ps
