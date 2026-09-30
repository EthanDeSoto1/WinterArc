#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

main() {
  local keep=10

  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    echo "Tracked files on the server were changed by hand. Commit them from the dev PC instead, then deploy again."
    git status --short --untracked-files=no
    exit 1
  fi

  bash scripts/backup.sh before-deploy
  ls -1t backups/before-deploy-*.db 2>/dev/null | tail -n +$((keep + 1)) | xargs -r rm --

  local before
  before="$(git rev-parse --short HEAD)"
  git pull --ff-only
  echo "Deploying $before -> $(git rev-parse --short HEAD)"

  docker compose up -d --build

  for attempt in $(seq 1 30); do
    if curl -fsS http://127.0.0.1:3000/api/health; then
      echo
      echo "Deployed $(git log -1 --format='%h %s')"
      return
    fi
    sleep 1
  done

  echo "The app did not answer /api/health within 30 seconds. Check: docker compose logs app"
  exit 1
}

main "$@"
