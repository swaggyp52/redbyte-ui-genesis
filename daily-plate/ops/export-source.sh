#!/usr/bin/env bash
# Source-only archive of daily-plate/ at the current commit: tracked files only
# (dotfiles, lockfile, workspace config, source, docs, scripts, assets), no
# node_modules, dist, data, .env, or test results. Produces checksums.
#   ops/export-source.sh <out-dir>
set -euo pipefail
OUT="${1:?output directory}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HERE"
if [ -n "$(git status --porcelain -- .)" ]; then echo "warning: uncommitted changes in daily-plate/ are NOT included (git archive uses HEAD)"; fi
COMMIT=$(git rev-parse HEAD)
SHORT=$(git rev-parse --short HEAD)
PREFIX=$(git rev-parse --show-prefix)   # e.g. daily-plate/ when nested in a parent repo
mkdir -p "$OUT"
NAME="daily-plate-src-$SHORT.tar.gz"
git archive --format=tar.gz --prefix=daily-plate/ -o "$OUT/$NAME" HEAD:"${PREFIX%/}"
( cd "$OUT" && sha256sum "$NAME" > "$NAME.sha256" )
cat > "$OUT/MANIFEST.txt" <<MANIFEST
archive: $NAME
commit: $COMMIT
created: $(date -u +%Y-%m-%dT%H:%M:%SZ)
node: $(node -v 2>/dev/null || echo n/a)
files: $(tar -tzf "$OUT/$NAME" | wc -l)
excluded: node_modules, dist, data, .env*, test-results, anything untracked
MANIFEST
echo "$OUT/$NAME"
cat "$OUT/$NAME.sha256"
