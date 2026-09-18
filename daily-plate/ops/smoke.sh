#!/usr/bin/env bash
# Private smoke test after deploy: health, security headers, no anonymous diary access.
set -euo pipefail
HOST="${1:?usage: smoke.sh https://daily-plate.<tailnet>.ts.net}"
echo "== healthz";  curl -sS -o /dev/null -w '%{http_code}\n' "$HOST/healthz"
echo "== headers";  curl -sS -I "$HOST/" | grep -iE 'content-security-policy|strict-transport|referrer-policy|x-content-type' || true
echo "== anonymous bootstrap must be 401"; curl -sS -o /dev/null -w '%{http_code}\n' "$HOST/api/v1/bootstrap"
echo "== invite GET must be 404";          curl -sS -o /dev/null -w '%{http_code}\n' "$HOST/api/v1/auth/invite/redeem?token=x"
echo "== app shell";  curl -sS "$HOST/" | grep -o '<title>[^<]*</title>'
