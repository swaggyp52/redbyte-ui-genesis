#!/usr/bin/env bash
# Consistent SQLite snapshot through the app's own backup command (online backup API),
# verified, then pruned to 7 daily + 4 weekly. Run from cron on the Pi, e.g.
#   17 3 * * *   /srv/daily-plate/ops/backup.sh daily
#   23 4 * * 0   /srv/daily-plate/ops/backup.sh weekly
set -euo pipefail
LABEL="${1:-daily}"
cd "$(dirname "$0")"
docker compose --env-file .env exec -T app node dist/cli.js backup --label "$LABEL" --dir /data/backups
