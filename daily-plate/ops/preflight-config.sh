#!/usr/bin/env bash
# Read-only configuration check for a Pi install. Never writes, never guesses.
#   ops/preflight-config.sh [ops/.env]        (dry-run by nature; exit 1 on any failure)
set -uo pipefail
ENV_FILE="${1:-$(dirname "$0")/.env}"
fail=0
ok()   { echo "OK    $1"; }
bad()  { echo "FAIL  $1"; fail=1; }
warn() { echo "WARN  $1"; }
[ -f "$ENV_FILE" ] || { bad "env file not found: $ENV_FILE (copy ops/.env.example)"; exit 1; }
set -a; . "$ENV_FILE"; set +a
for v in DP_VERSION DP_DATA_DIR DP_TS_STATE_DIR DP_RP_ID TS_AUTHKEY; do
  [ -n "${!v:-}" ] && ok "$v is set" || bad "$v is empty"
done
case "${DP_RP_ID:-}" in
  *EXAMPLE*|localhost|"") bad "DP_RP_ID must be the final app hostname (passkeys are bound to it)";;
  *.ts.net) ok "DP_RP_ID looks like a tailnet hostname: $DP_RP_ID";;
  *) warn "DP_RP_ID is not a *.ts.net name; make sure it is the final public origin";;
esac
[ "${TS_AUTHKEY:-}" != "tskey-auth-REPLACE-ME" ] && ok "TS_AUTHKEY is not the placeholder" || bad "TS_AUTHKEY is the placeholder"
for d in "${DP_DATA_DIR:-}" "${DP_TS_STATE_DIR:-}"; do
  [ -z "$d" ] && continue
  if [ -d "$d" ]; then
    [ -w "$d" ] && ok "$d exists and is writable" || bad "$d exists but is not writable by $(id -un)"
    perm=$(stat -c %a "$d" 2>/dev/null || echo "?"); [ "$perm" = "700" ] && ok "$d mode 700" || warn "$d mode $perm (recommended 700)"
    df -P "$d" | awk 'NR==2 {print "      free on volume: " $4 " KB"}'
  else
    warn "$d does not exist yet (create it with mode 700 before starting)"
  fi
done
[ "${TS_SERVE_FILE:-serve.json}" = "serve.json" ] && ok "stage mode: private (serve.json)" || warn "stage mode: PUBLIC funnel config selected (${TS_SERVE_FILE}) — requires explicit approval"
[ -n "${DP_USDA_API_KEY:-}" ] && ok "USDA key present (online search enabled)" || warn "DP_USDA_API_KEY empty: online search will report not-configured; saved foods still work"
[ "${DP_PROVIDER_CONTACT:-unconfigured}" != "unconfigured" ] && ok "provider contact set" || warn "DP_PROVIDER_CONTACT unset (used in the provider User-Agent)"
[ -z "${DP_PROVIDER_STUB_DIR:-}" ] && ok "no provider stub configured" || bad "DP_PROVIDER_STUB_DIR must not be set in production"
command -v docker >/dev/null && ok "docker present: $(docker --version 2>/dev/null)" || bad "docker not found"
docker compose version >/dev/null 2>&1 && ok "docker compose present" || bad "docker compose not found"
[ "$(uname -m)" = "aarch64" ] && ok "host is arm64; image must be linux/arm64" || warn "host arch $(uname -m); build the image for it"
echo "preflight-config: $([ $fail -eq 0 ] && echo PASS || echo FAIL) (read-only; nothing was changed)"
exit $fail
