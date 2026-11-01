# RedByte Deployment — Canonical Path

This is the ONE canonical deployment document for RedByte. Older deployment
write-ups (`RELEASE.md`, `PRODUCTION_READINESS.md`, `docs/V1_DEPLOYMENT_SUMMARY.md`,
`scripts/README-deploy.md`, `docs/archive/DEPLOYMENT_*.md`) are historical records
and must not be followed for current deploys.

## Overview

RedByte deploys as a single static artifact to **Cloudflare Pages**
(project `redbyte-ui-genesis`, custom domain `redbyteapps.dev`) via GitHub
Actions using `cloudflare/wrangler-action@v3` and `wrangler pages deploy dist`.
The archived `cloudflare/pages-action@v1` path is retired.

| Path | Content |
|------|---------|
| `/` | Root stub that redirects to `/start.html` (Cloudflare `_redirects` sends `/ -> /start.html 302`) |
| `/start.html` | Public doorway page (copied from `public/start.html`) |
| `/os/` | The RedByte IDE (built from `apps/playground`) |
| `/os/version.json` | `{ sha, builtAt }` — full commit SHA, written at build time |
| `/build.json` | Short (7-char) SHA + build timestamp + env |

## Build

```bash
corepack pnpm build:unified
```

`scripts/unified-build.mjs` pre-builds workspace packages, builds the
playground IDE, merges everything into `dist/` (`scripts/merge-dist.mjs`), and
verifies the artifact (`scripts/verify-dist.mjs`). The commit SHA enters the
artifact through `GIT_SHA` (CI sets `GIT_SHA=${{ github.sha }}` and
`VITE_APP_ENV=production`).

## CI workflows

| Workflow | Trigger | Role |
|----------|---------|------|
| `.github/workflows/pr-fast-checks.yml` | every pull request | Lean gate: typecheck, CSS audit, doc validation, encoding, start-page contract, build/deploy contract, unified build + dist artifact |
| `.github/workflows/pr-truth-gates.yml` | PRs into `main`, pushes to `main` | Full Classroom Truth Gates aggregate (~90+ min browser matrix) |
| `.github/workflows/deploy-cloudflare.yml` | push to `main`, `product/**`, `claude/**`; manual dispatch | Build + deploy + verify |
| `.github/workflows/nightly.yml` | cron | Heavy nightly suites |

## Deploy behavior

- **push to `main`** → production deploy (`--branch=main`) → https://redbyteapps.dev
- **push to `product/**` or `claude/**`** → preview deploy (`--branch=<ref>`) →
  unique `*.pages.dev` URL plus a branch-alias URL
  (e.g. `https://product-redbyte-workbench-v3.redbyte-ui-genesis.pages.dev`)
- **workflow_dispatch** → deploys the selected ref (production only for `main`)

Every deploy then:

1. polls `<deployed base>/os/version.json` until `sha` equals the triggering
   commit (18 × 10 s), and fails the run on mismatch;
2. runs an HTTP smoke against the deployed base: `/`, `/start.html`
   (doorway copy), `/os/` (`REDBYTE_OS_IDE` marker), and one hashed
   `/os/assets/*.js` chunk.

If the Cloudflare credentials are missing, the run reports an explicit
**SKIPPED — credentials unavailable** job. It never reports a deploy that did
not happen.

## Secrets

Stored as GitHub Actions repository secrets — never in the repo:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Workflows only presence-check these values; they are never echoed.

## Production release rules

Production (`main`) deploys only through the release path:

1. Product branch green on its exact head (fast checks + relevant gates).
2. Preview deploy of the exact candidate SHA verified (`/os/version.json`).
3. PR into `main` green through Classroom Truth Gates.
4. Merge decision by the owner; the resulting push to `main` deploys production.
5. Post-deploy verification: `https://redbyteapps.dev/os/version.json` must
   equal the release SHA; smoke against `/`, `/start.html`, `/os/`.

Manual smoke against a deployed environment:

```bash
TARGET_URL=https://redbyteapps.dev COMMIT_SHA=<sha> node scripts/verify-deploy.mjs
```

## Cloudflare project notes

- Pages project: `redbyte-ui-genesis`; production domain `redbyteapps.dev`.
- The Cloudflare GitHub App also produces git-integration branch previews
  (visible as PR comments). The GitHub Actions direct-upload path above is the
  verified deployment authority; treat bot previews as convenience links.
- `wrangler.toml` carries the Pages project name and output dir for local
  `wrangler pages` use; Pages build config in the dashboard is not used by the
  Actions path.
