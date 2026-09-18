#!/usr/bin/env bash
# Restores the newest snapshot into a scratch directory inside the volume and verifies it.
# The live database is never touched.
set -euo pipefail
cd "$(dirname "$0")"
LATEST=$(docker compose --env-file .env exec -T app sh -c 'ls -1 /data/backups/daily-plate-*.db | sort | tail -1')
echo "checking $LATEST"
docker compose --env-file .env exec -T app node dist/cli.js restore-check "$LATEST" --scratch /data/restore-scratch
