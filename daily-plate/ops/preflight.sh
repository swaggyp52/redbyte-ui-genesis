#!/usr/bin/env bash
# Before a release: free disk, memory, backup age, image architecture, neighbours' health.
set -uo pipefail
cd "$(dirname "$0")"
echo "== disk";   df -h "${DP_DATA_DIR:-/srv/daily-plate/data}" 2>/dev/null || df -h /
echo "== memory"; free -m
echo "== arch";   uname -m; docker version --format '{{.Server.Arch}}' 2>/dev/null
echo "== newest backup"
ls -lt "${DP_DATA_DIR:-/srv/daily-plate/data}/backups" 2>/dev/null | head -3
echo "== other containers (must be unchanged after the release)"
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
echo "== host tailscale serve/funnel (capture before and diff after)"
tailscale serve status 2>/dev/null || echo "tailscale CLI not on host or not permitted"
tailscale funnel status 2>/dev/null || true
