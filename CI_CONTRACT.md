# CI Contract

This file defines which checks are allowed to block PRs, which checks run nightly, and how deployment truth is verified.

## PR Gates (required)

Workflow: `.github/workflows/pr-truth-gates.yml`

Required commands:

- `pnpm -s verify:gates:classroom`
- `pnpm -s build:unified`

Policy:

- PR checks must remain fast and deterministic.
- Legacy, flaky, or long-running suites do not run on PR by default.
- Branch protection on `main` requires only `Classroom Truth Gates`.

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

## Deploy Gate (main)

Workflow: `.github/workflows/deploy-cloudflare.yml`

Required behavior:

- Build and upload unified `dist/`
- Deploy root + `/os`
- Verify deployed commit truth by checking `https://redbyteapps.dev/os/version.json`
- Fail workflow if deployed `sha` does not match triggering `GITHUB_SHA`

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
