# CI Contract

This file defines which checks are allowed to block PRs, which checks run nightly, and how deployment truth is verified.

## PR Gates (required)

Fast lane — every pull request. Workflow: `.github/workflows/pr-fast-checks.yml`

- `pnpm -s typecheck`
- `pnpm -s css:audit:ide`
- `pnpm -s rb:doc:validate`
- `pnpm -s rb:encoding:check`
- `pnpm -s rb:site:start:test`
- `pnpm -s rb:build:contract:test`
- `pnpm -s ci:no-solution:lab4`
- `pnpm -s rc:e1:golden-basys3-export-gate` + `pnpm -s rc:e1:golden-basys3-alu-export-gate`
- `pnpm -s build:unified` (+ dist artifact upload)

Full lane — pull requests into `main` and pushes to `main`.
Workflow: `.github/workflows/pr-truth-gates.yml`

- `pnpm -s classroom:gate` aggregate (browser matrix, ~90+ min)

Policy:

- The fast lane must remain fast and deterministic on every PR.
- The expensive classroom aggregate is reserved for the release path into `main`.
- Branch protection on `main` requires `Classroom Truth Gates`.

## Nightly / Manual Gates (non-PR)

Workflow: `.github/workflows/nightly.yml`

Consolidated jobs include:

- quality parity + unified dist verification
- cloudflare parity build
- zip install smoke
- fpga proof
- phase4 deterministic gates
- p1d smoke
- manual-only perf soak and fpga ui smoke

No other workflows run on `pull_request`.

## Deploy Gate

Workflow: `.github/workflows/deploy-cloudflare.yml`
(modern path: `cloudflare/wrangler-action@v3` + `wrangler pages deploy dist
--project-name=redbyte-ui-genesis`; the archived `cloudflare/pages-action@v1`
is retired)

Required behavior:

- Build unified `dist/` (`pnpm build:unified` with `GIT_SHA` + `VITE_APP_ENV=production`)
- push to `main` → production deploy (`--branch=main`) → `https://redbyteapps.dev`
- push to `product/**` or `claude/**` → preview deploy (`--branch=<ref>`) → `*.pages.dev`
- Verify deployed commit truth by polling `<deployed base>/os/version.json`
- Fail the workflow if deployed `sha` does not match the triggering `GITHUB_SHA`
- Run an HTTP smoke against the deployed base (`/`, `/start.html`, `/os/`, one hashed asset)
- Missing Cloudflare credentials → explicit `SKIPPED - credentials unavailable` job,
  never a green job pretending it deployed

## Quarantine Policy

Quarantine is applied at CI workflow scope by keeping heavy/legacy suites out of PR-required paths.

If a test suite is flaky or obsolete:

- Keep it in nightly/manual workflows only, or
- Move tests under explicit legacy buckets (for future targeted exclusion), without blocking PR truth gates.

## Runtime Pinning

PR and deploy workflows must pin:

- Node `20.19.0`
- pnpm `10.24.0`

## Terminal Operations

Useful commands:

- PR truth locally: `pnpm -s verify:gates:classroom && pnpm -s build:unified`
- Preclass ritual: `pnpm -s redbyte:preclass`
- Cloudflare cache purge: `pnpm -s cloudflare:purge`

Environment for purge:

- `CF_API_TOKEN`
- `CF_ZONE_ID`
