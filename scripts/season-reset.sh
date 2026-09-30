#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ "${1:-}" != "--yes" ]; then
  echo "This deletes every goal, check-off, Board post, photo, reaction and comment."
  echo "Accounts, settings and friendships are kept. A backup is taken first."
  echo "Run it with --yes to go ahead: bash scripts/season-reset.sh --yes"
  exit 1
fi

bash scripts/backup.sh before-season-reset

docker compose exec -T app node -e '
const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");
const db = new Database("/data/winter-arc.db");
db.pragma("foreign_keys = ON");
const counts = db.transaction(() => {
  const goals = db.prepare("DELETE FROM goals").run().changes;
  const completions = db.prepare("DELETE FROM completions").run().changes;
  const posts = db.prepare("DELETE FROM posts").run().changes;
  db.prepare("DELETE FROM sent_notifications").run();
  db.prepare("UPDATE users SET board_seen_post_id = 0, created_at = strftime(?, ?)").run("%Y-%m-%dT%H:%M:%fZ", "now");
  return { goals, completions, posts };
})();
let photos = 0;
const photoDir = "/data/photos";
if (fs.existsSync(photoDir)) {
  for (const file of fs.readdirSync(photoDir)) {
    fs.rmSync(path.join(photoDir, file), { force: true });
    photos++;
  }
}
db.close();
console.log("Deleted " + counts.goals + " goals, " + counts.posts + " posts and " + photos + " photos.");
'

docker compose restart app
echo "$(date '+%Y-%m-%d %H:%M:%S') season reset done"
