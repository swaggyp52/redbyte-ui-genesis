# OPERATIONS

## 0. Environment facts recorded so far

| Item | Build sandbox (2026-09-18) | Pi |
|---|---|---|
| CPU / OS | x86_64, Linux 6.18 (Anthropic cloud) | **BLOCKED** — inspect |
| Node / pnpm | 24.21.0 / 10.24.0 | pinned in `.nvmrc` / `package.json` |
| SQLite bundled in better-sqlite3 13.0.3 | 3.53.4 (gate ≥ 3.51.3) | same image |
| Docker | CLI 29.3.1, **no daemon** | **BLOCKED** — inspect |
| Tailscale | not present | **BLOCKED** — inspect |
| Egress | npm + nodejs.org only; USDA/OFF/GitHub releases denied | expected open |

## 1. Pi inspection checklist (run first, read-only, record here)
```bash
uname -m; cat /etc/os-release | head -2; nproc; free -m; df -h /
docker version; docker compose version; docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
tailscale version; tailscale status --json | head -50
tailscale serve status; tailscale funnel status          # capture; must be identical after release
ss -ltnp | sort                                          # existing listeners; Daily Plate must add none on host interfaces
ls -ld /srv 2>/dev/null; mount | grep -E ' / | /srv'      # pick DP_DATA_DIR on a local filesystem, not tmpfs/network
```
Record: architecture, memory headroom, free disk, Docker availability, the two serve/funnel outputs, and the chosen paths in `ops/.env`. If Docker is missing, stop and ask before installing anything.

## 1b. Read-only configuration check (run before every install or upgrade)
```bash
ops/preflight-config.sh ops/.env      # validates values, paths, permissions, stage mode; changes nothing
ops/preflight.sh                      # disk, memory, backup age, neighbours, host serve/funnel snapshot
```
`preflight-config.sh` fails on placeholder values, a non-final RP ID, an unwritable data directory, a missing Docker, or a test-only provider stub. It never creates directories or edits files.

## 1c. Cloud verification already available (GitHub Actions)
`.github/workflows/daily-plate-cloud.yml` (also kept at `ops/ci/daily-plate-cloud.yml`) runs only for `daily-plate/**` changes: x64 verify + audit + source archive, Chromium and WebKit journeys against the real server with fixture-backed providers, container smoke on x64 and on the `ubuntu-24.04-arm` hosted runner (native ARM64), and a Windows source install/unit-test smoke. What it proves and does not prove is written in `TEST_EVIDENCE.md`. WebKit is not Safari; the ARM runner is not the Pi.

## 2. Build
```bash
pnpm install --frozen-lockfile
pnpm verify                     # typecheck + unit/integration tests + builds
pnpm --filter @daily-plate/web run test:e2e
docker buildx build --platform linux/arm64 --build-arg DP_VERSION=0.1.0 -t daily-plate:0.1.0 .
docker image inspect daily-plate:0.1.0 --format '{{.Architecture}}'   # must match uname -m on the Pi
```
Transfer with `docker save | ssh pi docker load` or build on the Pi. Keep the previous tag as last-known-good.

## 3. Private staging (Serve, tailnet-only)
1. Create a Tailscale auth key for a **new** node tagged `tag:daily-plate` (reusable=false). Add the tag and a minimal ACL grant in the tailnet policy; do not widen autogroup:member.
2. `cp ops/.env.example ops/.env`; fill `DP_DATA_DIR`, `DP_TS_STATE_DIR` (both `chmod 700`, owned by the Compose user), `DP_RP_ID=daily-plate.<tailnet>.ts.net`, `TS_AUTHKEY`, `DP_USDA_API_KEY`, `DP_PROVIDER_CONTACT`, `TS_IMAGE_TAG` (pin after `docker pull`; record the digest below).
3. `ops/preflight.sh` → save output.
4. `cd ops && docker compose --env-file .env up -d` then `docker compose logs -f app` until `listening`.
5. `ops/smoke.sh https://daily-plate.<tailnet>.ts.net` from a tailnet device: expect healthz 200, CSP present, bootstrap 401, invite GET 404.
6. Create the first invite: `docker compose exec app node dist/cli.js invite --name "Mom"` → send the link privately, once. The origin printed comes from `DP_ORIGINS`; **do not enrol a passkey until the final hostname is in place** (changing RP ID later is a migration).
7. `ops/backup.sh daily` then `ops/restore-check.sh` → both must report `ok: true`.
8. Re-run `ops/preflight.sh`; diff the neighbour container list and the host `tailscale serve/funnel status` against step 3. Any difference is a release blocker.

Resource check: `docker stats --no-stream daily-plate-app daily-plate-tailscale` during a logging session; budget ≤ 350 MB combined, idle CPU < 1%.

## 4. Public exposure (separate approval)
Only after §3 passes and the owner approves exposing **this node alone**: set `TS_SERVE_FILE=serve.funnel.json` in `ops/.env`, `docker compose up -d tailscale`, verify `tailscale funnel status` **inside the sidecar** (`docker compose exec tailscale tailscale funnel status`) shows only this node, and confirm the host's own `tailscale funnel status` is unchanged. Test from a phone with Wi-Fi and Tailscale off: app loads, bootstrap without a cookie is 401.

## 5. Backups
- Cron on the Pi: `17 3 * * * /srv/daily-plate/ops/backup.sh daily` and `23 4 * * 0 /srv/daily-plate/ops/backup.sh weekly`.
- Snapshots use SQLite's online backup API (never a file copy while the WAL is live), are verified (`integrity_check`, schema, counts) and pruned to 7 daily + 4 weekly; pre-migration snapshots are kept.
- `HARDWARE_FAILURE_BACKUP=UNPROTECTED` until an owner-approved independent destination exists (USB drive or another local device). Maximum data-loss exposure with the schedule above: up to 24 h of entries if the disk dies, plus whatever is still in a phone's outbox.

## 6. Upgrade and rollback
1. `ops/preflight.sh`; `ops/backup.sh premigration`.
2. Load the new image tag; update `DP_VERSION` in `ops/.env`; `docker compose up -d app`.
3. Migrations are additive and run at startup; the app refuses to start if the bundled SQLite is below 3.51.3.
4. `ops/smoke.sh`; open the app on a phone that still has the old version: the "update ready" banner appears, tapping it reloads, queued entries replay.
5. Rollback: set `DP_VERSION` back to the last-known-good tag and `docker compose up -d app`. Never restore a pre-deploy database over new entries; use `restore-check` to inspect first.

## 6b. Portable handoff
```bash
ops/export-source.sh <out-dir>          # git archive of daily-plate/ at HEAD + sha256 + MANIFEST (no secrets, data, node_modules, dist)
ops/cleanroom-test.sh <archive.tar.gz>  # extracts into a temp dir, frozen install, verify, build, real server smoke
```
The archive is what to move to the desktop project folder or a fresh repository. better-sqlite3 loads the prebuilt Node-API binary for the machine it is installed on (no C++ toolchain needed; `pnpm-workspace.yaml` keeps pnpm from compiling it); still, never copy an x86 `node_modules` to the Pi, install there.

## 7. Operator CLI (inside the container)
```
node dist/cli.js version                 # app, node, arch, sqlite, schema
node dist/cli.js invite [--name X] [--recover <userId>]
node dist/cli.js users | sessions <userId> | revoke <userId> | passkeys <userId>
node dist/cli.js backup [--label daily|weekly|premigration] [--dir /data/backups]
node dist/cli.js verify-backup <file> | restore-check <file> [--scratch <dir>]
node dist/benchmark/run.js --mode live   # explicit, rate-bounded catalog coverage run (needs DP_USDA_API_KEY; not automated)
```
Test-only (refused under NODE_ENV=production): `node dist/dev/seed.js --profile week|months` builds a synthetic account; `DP_PROVIDER_STUB_DIR=<fixtures>` answers providers from fixtures.

## 8. Recovery card (for the owner)
- Lost phone: `revoke <userId>`, then `invite --recover <userId>` and send the new link; she redeems it and re-adds Face ID unlock.
- Forgotten/failed unlock: same recovery invite path.
- Pi replaced: restore the newest verified snapshot into `DP_DATA_DIR`, start the stack with the **same hostname** (RP ID) so passkeys keep working.

## 9. Pinned image digests (fill during staging)
- `tailscale/tailscale:<tag>` — digest: _pending_
- `node:24.21.0-bookworm-slim` — digest: _pending_
