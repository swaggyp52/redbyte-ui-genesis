#!/usr/bin/env bash
# Boots the built image the way the Pi will run it (non-root, read-only, /data volume),
# then proves: healthcheck, real SQLite engine version, create → restart → recover,
# backup via the online backup API, scratch restore. Exits non-zero on any failure.
set -euo pipefail
IMAGE="${1:?image tag}"
NAME="dp-smoke-$$"
VOL="dp-smoke-vol-$$"
PORT=18787
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; docker volume rm "$VOL" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker volume create "$VOL" >/dev/null
run() {
  docker run -d --name "$NAME" --read-only --tmpfs /tmp -v "$VOL:/data" -p 127.0.0.1:$PORT:8787 \
    -e DP_HOST=0.0.0.0 -e DP_ORIGINS=http://localhost:$PORT -e DP_RP_ID=localhost -e DP_SECURE_COOKIES=false -e DP_LOG_LEVEL=warn "$IMAGE" >/dev/null
  for i in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1; then return 0; fi; sleep 1
  done
  echo "server did not become healthy"; docker logs "$NAME"; exit 1
}
run
echo "== identity"; docker exec "$NAME" node dist/cli.js version | tee /tmp/dp-version.json
grep -q '"sqlite": "3.5[1-9]\|"sqlite": "3.[6-9]' /tmp/dp-version.json || { echo "sqlite below 3.51"; exit 1; }
echo "== runs as non-root"; test "$(docker exec "$NAME" id -u)" != "0"
echo "== create a user and an entry through the API"
INVITE=$(docker exec "$NAME" node dist/cli.js invite --name Smoke | sed -n 's/.*#invite=//p')
CJ=$(mktemp)
curl -fsS -c "$CJ" -H 'x-daily-plate: 1' -H 'content-type: application/json' -X POST "http://127.0.0.1:$PORT/api/v1/auth/invite/redeem" -d "{\"token\":\"$INVITE\",\"timeZone\":\"UTC\"}" >/dev/null
MID=$(cat /proc/sys/kernel/random/uuid)
curl -fsS -b "$CJ" -H 'x-daily-plate: 1' -H 'content-type: application/json' -X POST "http://127.0.0.1:$PORT/api/v1/mutations" -d "{\"mutations\":[{\"schemaVersion\":1,\"mutationId\":\"$MID\",\"clientTime\":\"2026-01-01T00:00:00.000Z\",\"payload\":{\"type\":\"food.upsert\",\"food\":{\"id\":\"smoke-food-0001\",\"name\":\"Smoke shake\",\"aliases\":[],\"pin\":null,\"suggestEligible\":true,\"tags\":[],\"hidden\":false},\"version\":{\"id\":\"smoke-food-0001-v1\",\"name\":\"Smoke shake\",\"preparation\":\"as-sold\",\"basis\":{\"kind\":\"serving\",\"servingText\":\"1 bottle\"},\"nutrients\":{\"protein\":{\"status\":\"reported\",\"amount\":\"30\"},\"carbs\":{\"status\":\"reported\",\"amount\":\"15\"},\"fat\":{\"status\":\"unknown\"},\"fiber\":{\"status\":\"reported\",\"amount\":\"5\"},\"sugar\":{\"status\":\"unknown\"},\"calories\":{\"status\":\"unknown\"}},\"portions\":[],\"provenance\":{\"provider\":\"user\",\"fetchedAt\":\"2026-01-01T00:00:00.000Z\",\"normalizationVersion\":\"user-1\"}}}}]}" | grep -q '"committed"'
MID2=$(cat /proc/sys/kernel/random/uuid)
curl -fsS -b "$CJ" -H 'x-daily-plate: 1' -H 'content-type: application/json' -X POST "http://127.0.0.1:$PORT/api/v1/mutations" -d "{\"mutations\":[{\"schemaVersion\":1,\"mutationId\":\"$MID2\",\"clientTime\":\"2026-01-01T00:00:00.000Z\",\"payload\":{\"type\":\"diary.add\",\"entry\":{\"id\":\"smoke-entry-0001\",\"localDate\":\"2026-01-01\",\"timeZone\":\"UTC\",\"occurredAt\":\"2026-01-01T12:00:00.000Z\",\"mealSlot\":\"lunch\",\"kind\":\"food\",\"foodVersionId\":\"smoke-food-0001-v1\",\"quantity\":{\"amount\":\"1.5\",\"unit\":{\"kind\":\"serving\"}}}}}]}" | grep -q '"committed"'
echo "== restart the container and recover"
docker restart "$NAME" >/dev/null
for i in $(seq 1 30); do curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1 && break; sleep 1; done
curl -fsS -b "$CJ" "http://127.0.0.1:$PORT/api/v1/days/2026-01-01" | grep -q '"amount":"45"' || { echo "entry not recovered after restart"; exit 1; }
echo "== backup via online backup API, verify, scratch restore"
docker exec "$NAME" node dist/cli.js backup --dir /data/backups | grep -q '"ok": true'
LATEST=$(docker exec "$NAME" sh -c 'ls -1 /data/backups/daily-plate-*.db | tail -1')
docker exec "$NAME" node dist/cli.js restore-check "$LATEST" --scratch /tmp/restore | grep -q '"ok": true'
echo "== anonymous access refused"; test "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$PORT/api/v1/bootstrap)" = "401"
echo "container smoke: PASS"
