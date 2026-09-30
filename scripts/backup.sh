#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

prefix="${1:-winter-arc}"
name="$prefix-$(date +%Y-%m-%d-%H%M%S).db"
keep=14

mkdir -p backups
chmod 700 backups

docker compose exec -T app node -e '
const Database = require("better-sqlite3");
const db = new Database("/data/winter-arc.db");
db.backup("/tmp/backup.db").then(() => {
  db.close();
  const copy = new Database("/tmp/backup.db", { readonly: true });
  const result = copy.pragma("integrity_check", { simple: true });
  copy.close();
  if (result !== "ok") {
    console.error("Integrity check failed: " + result);
    process.exit(1);
  }
});
'

docker compose cp app:/tmp/backup.db "backups/$name"
docker compose exec -T app rm -f /tmp/backup.db /tmp/backup.db-wal /tmp/backup.db-shm
chmod 600 "backups/$name"

mkdir -p backups/photos
chmod 700 backups/photos
if docker compose exec -T app test -d /data/photos; then
  docker compose cp app:/data/photos/. backups/photos/
  find backups/photos -type f -exec chmod 600 {} +
fi

ls -1t backups/winter-arc-*.db 2>/dev/null | tail -n +$((keep + 1)) | xargs -r rm --

echo "$(date '+%Y-%m-%d %H:%M:%S') saved backups/$name and backups/photos ($(find backups/photos -type f | wc -l) photos)"
