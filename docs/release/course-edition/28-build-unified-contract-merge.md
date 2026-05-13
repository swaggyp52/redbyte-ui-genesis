# Build Unified Contract Merge

**Date:** 2026-05-12
**Attribution:** Connor Angiel

## Goal

Merge `release/build-unified-contract-cleanup-1` into `main`, validate the RedByte release/product gate stack, and push `origin/main`.

## Preflight

| Item | Result |
|---|---|
| Starting `origin/main` | `b83524526ea92dfdd776c92ac4a3addd06e5a146` |
| Feature branch | `origin/release/build-unified-contract-cleanup-1` |
| Feature commit | `e43020489340d5fd7721601a56fe94b5b02a70c0` |
| Current branch after preflight | `main` |
| Working tree status before merge | Clean |
| Safety branch | `backup/pre-build-unified-contract-merge` |

## Deploy Route Contract

| Route | Intended behavior |
|---|---|
| `/` | Redirects to `/start.html`; root `index.html` also falls back to `/start.html`. |
| `/start.html` | Static public RedByte course entry. |
| `/os/` | Direct RedByte IDE route. |
| `/os` | Normalizes to `/os/`. |
| Root `/os/` redirect | Not allowed; retained only as historical OS-era behavior. |

## Validation Plan

- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm build:unified`
- `pnpm start:smoke`
- Full ECE141 browser gate stack.
- `pnpm -s ui:lab-starter-load-gate`
- `pnpm -s rb:build:contract:test`
- `pnpm -s rb:site:start:test`
- `node scripts/verify-dist-manifest.mjs`
- `pnpm rb:doc:validate`
- `pnpm rb:encoding:check`
- `git diff --check`

## Merge Result

`origin/release/build-unified-contract-cleanup-1` merged into `main` with merge commit `f40b3b7c`.

No conflicts occurred. The merge preserved:

- `scripts/merge-dist.mjs` root public-start fallback and `dist/start.html` copy behavior,
- `scripts/verify-dist.mjs` current root redirect verification,
- `scripts/verify-dist-manifest.mjs` root `start.html` and `REDBYTE_PUBLIC_ROOT` marker checks,
- `scripts/verify-deploy.mjs` public-start deploy smoke behavior,
- `package.json` `rb:build:contract:test`,
- `scripts/rb-build-deploy-contract.test.mjs`,
- `scripts/rb-public-start-page.test.mjs` no-root-`/os/` assertion,
- `docs/product/RED_BYTE_PUBLIC_START_PATH.md`,
- `docs/product/V1_RELEASE_READINESS_CHECKLIST.md`,
- `docs/release/course-edition/27-build-unified-contract-cleanup.md`,
- validation-log and `AI_STATE.md` updates from the feature branch.

## Validation Results

| Command | Result | Notes |
|---|---|---|
| `pnpm install --frozen-lockfile` | Passed | Lockfile was up to date. |
| `pnpm typecheck` | Passed | Full workspace typecheck passed on merged `main`. |
| `pnpm build:unified` | Passed | Unified build produced root `dist/start.html`, `/os/` IDE artifact, `/os/version.json`, current redirects, and current headers. |
| `pnpm start:smoke` | Passed | Served `http://127.0.0.1:5197/` with HTTP 200. |
| Full ECE141 browser gate stack | Passed | Starter Verify/Export, product immersion, counter clock/export, map-pins recovery, counter compare, project persistence, import/export recovery, Vivado artifacts, UI art-direction, and UI hierarchy gates passed sequentially. |
| `pnpm -s ui:lab-starter-load-gate` | Passed | 8 starter-loading tests passed. |
| `pnpm -s rb:build:contract:test` | Passed | Current `/ -> /start.html` contract accepted; stale root `/os/` redirect rejected. |
| `pnpm -s rb:site:start:test` | Passed | Public start page and source redirects matched the current route contract. |
| `node scripts/verify-dist-manifest.mjs` | Passed | Root `start.html`, root and `/os/` markers, redirects, headers, and `/os/assets` were present. |
| `pnpm rb:doc:validate` | Passed before closeout docs | 36 passed, 0 failed. |
| `pnpm rb:encoding:check` | Passed before closeout docs | No mojibake markers found. |
| `git diff --check` | Passed before closeout docs | No whitespace errors. |
| `pnpm rb:doc:validate` | Passed after closeout docs | 36 passed, 0 failed. |
| `pnpm rb:encoding:check` | Passed after closeout docs | No mojibake markers found. |
| `git diff --check` | Passed after closeout docs | No whitespace errors. |

## Closeout

Full workspace `pnpm typecheck` passes on merged `main`.

`pnpm build:unified` passes on merged `main`.

Final route/deploy contract:

- `/` redirects to `/start.html`.
- root `index.html` fallback points to `/start.html`.
- `/start.html` is the public RedByte course entry.
- `/os/` remains the direct IDE route.
- root must not redirect directly to `/os/`.

Remaining blockers:

- No known `pnpm typecheck` or `pnpm build:unified` blocker remains.
- Windows course setup scripts are the next release-readiness sprint.

Remote sync:

- `git push origin main` delivered `bdca2984` to GitHub `main`.
- GitHub reported a bypassed required `Classroom Truth Gates` status check expectation during push; this remains release-process debt until the remote required check runs normally.
- This is source delivery to GitHub `main`, not a verified live/student deploy unless the deploy pipeline ships that commit.
