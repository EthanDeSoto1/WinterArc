#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ $# -ne 1 ]; then
  echo "Usage: bash scripts/reset-password.sh <username>"
  exit 1
fi

docker compose exec -T -e RESET_USERNAME="$1" app node -e '
const crypto = require("node:crypto");
const bcrypt = require("bcrypt");
const Database = require("better-sqlite3");
const db = new Database("/data/winter-arc.db");
db.pragma("foreign_keys = ON");
const username = process.env.RESET_USERNAME.trim().replace(/^@/, "").toLowerCase();
const user = db.prepare("SELECT id, username FROM users WHERE username = ?").get(username);
if (!user) {
  console.error("No one has the username " + username);
  process.exit(1);
}
const password = crypto.randomBytes(9).toString("base64url");
const hash = bcrypt.hashSync(password, 12);
db.transaction(() => {
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, user.id);
  db.prepare("DELETE FROM sessions WHERE json_extract(data, ?) = ?").run("$.userId", user.id);
  db.prepare("DELETE FROM push_subscriptions WHERE user_id = ?").run(user.id);
})();
console.log("Reset the password for @" + user.username + " and signed them out everywhere.");
console.log("Temporary password: " + password);
console.log("Ask them to log in with it and change it in Account > Password.");
'
