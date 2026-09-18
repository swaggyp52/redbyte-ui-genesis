#!/usr/bin/env bash
# Extracts a source archive into an unrelated temporary directory and proves it
# stands alone: fresh install, verify, build, real server smoke. Fails loudly.
#   ops/cleanroom-test.sh <archive.tar.gz>
set -euo pipefail
ARCHIVE="${1:?archive path}"
TMP=$(mktemp -d "${TMPDIR:-/tmp}/dp-cleanroom-XXXXXX")
LOG="$TMP/cleanroom.log"
cleanup() { if [ "${KEEP:-0}" = "1" ] || [ "$1" != "0" ]; then echo "kept $TMP (log: $LOG)"; else rm -rf "$TMP"; fi; }
trap 'cleanup $?' EXIT
tar -xzf "$ARCHIVE" -C "$TMP"
cd "$TMP/daily-plate"
test -f pnpm-lock.yaml && test -f pnpm-workspace.yaml && test -f .nvmrc && test -f .npmrc || { echo "archive missing workspace files"; exit 1; }
! find . -name node_modules -o -name dist -o -name '*.db' | grep -q . || { echo "archive contains build debris"; exit 1; }
echo "== install (frozen lockfile, no parent workspace)"
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 corepack pnpm install --frozen-lockfile >"$LOG" 2>&1 || { tail -30 "$LOG"; exit 1; }
echo "== verify"
corepack pnpm verify >>"$LOG" 2>&1 || { tail -40 "$LOG"; exit 1; }
grep -E "Tests +[0-9]+ passed" "$LOG"
echo "== server smoke from the extracted tree"
PORT=18899
DP_DATA_DIR="$TMP/data" DP_PORT=$PORT DP_ORIGINS=http://localhost:$PORT DP_WEB_DIST="$TMP/daily-plate/apps/web/dist" DP_LOG_LEVEL=error node apps/server/dist/main.js &
PID=$!
for i in $(seq 1 30); do curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1 && break; sleep 0.5; done
curl -fsS "http://127.0.0.1:$PORT/healthz" | grep -q '"ok":true'
curl -fsS "http://127.0.0.1:$PORT/" | grep -q '<title>Daily Plate</title>'
test "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/api/v1/bootstrap")" = "401"
kill $PID
echo "cleanroom: PASS (extracted to $TMP, removed on exit)"
