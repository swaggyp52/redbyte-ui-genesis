# build:unified Deploy Contract Cleanup

**Date:** 2026-05-12
**Attribution:** Connor Angiel

## Goal

Make `pnpm build:unified` pass by aligning the unified build verification contract with the current RedByte Course Edition public entry.

## Product Hardening Ticket

| Field | Value |
|---|---|
| Title | `build:unified` rejects the current public start redirect contract |
| Surface | Public deploy / Cloudflare Pages build artifact |
| Journey segment | Open public RedByte entry -> open IDE -> run ECE141 workflow |
| Mode | Release validation |
| Environment | Windows local workspace, Node `>=20.19.0`, pnpm `10.24.0` |
| Observed behavior | `pnpm build:unified` completed package build, playground build, and artifact merge, then `scripts/verify-dist.mjs` failed because it still required the root `_redirects` rule to send `/` to `/os/`. |
| Expected behavior | `pnpm build:unified` validates the current public route contract without restoring old OS-era root behavior. |
| Why this matters | `build:unified` is a release gate and Cloudflare deploy build input; a red gate undermines course handoff credibility even when product gates pass. |
| Severity | P1 release blocker |
| Truth sources | `AI_STATE.md`, `docs/product/RED_BYTE_PUBLIC_START_PATH.md`, `docs/contracts/RedByte_Product_Contract.md`, `docs/manuals/RedByte_Product_Manual.md`, `docs/IDE_SYSTEM_MAP.md` |
| Acceptance proof | `pnpm build:unified`, `pnpm typecheck`, full ECE141 product gate stack, public-start contract test, docs/encoding/diff checks |

## Preflight

| Item | Result |
|---|---|
| Base branch | `main` |
| Base commit | `b83524526ea92dfdd776c92ac4a3addd06e5a146` |
| Working branch | `release/build-unified-contract-cleanup-1` |
| Working tree before changes | Clean |
| Known prior blocker | `pnpm build:unified` `/os/` redirect contract drift |

## Build Failure Inventory

| Step | Output | Pass/Fail | Source file/script | Contract expectation | Fix candidate |
|---|---|---|---|---|---|
| Workspace package prebuild | `rb-apps`, `rb-theme`, `rb-icons`, `rb-utils`, `rb-primitives`, `rb-logic-core`, `rb-instruments`, and `rb-lab-engine` prebuild attempts completed or were skipped when no package build existed. | Pass | `scripts/unified-build.mjs` | Prebuild workspace packages before app build. | No change. |
| Playground production build | Vite built `apps/playground/dist` with `/os/` asset base. | Pass | `apps/playground/vite.config.ts` | IDE remains deployable at `/os/`. | No change. |
| Dist merge | `scripts/merge-dist.mjs` produced `dist/`, copied playground output to `dist/os`, wrote `dist/os/version.json`, and copied root `_redirects` / `_headers`. | Pass with stale root fallback | `scripts/merge-dist.mjs` | Root public entry should lead to `/start.html`; `/os/` remains direct IDE entry. | Copy `public/start.html` to root `dist/start.html`; make root fallback point to `/start.html`. |
| Dist redirect verification | `scripts/verify-dist.mjs` failed at `dist/_redirects contains root redirect to /os/`. | Fail before fix | `scripts/verify-dist.mjs` | Root redirect must be `/ -> /start.html`, not `/ -> /os/`. | Update verifier to require `/start.html` and reject root `/os/`. |
| Public start source contract | `public/_redirects` already had `/ /start.html 302`; `scripts/rb-public-start-page.test.mjs` already expected `/start.html`. | Pass | `public/_redirects`, `scripts/rb-public-start-page.test.mjs` | Source route contract is current. | Add explicit no-root-`/os/` assertion. |

## Public Deploy Contract

| Route | Intended behavior | Student-facing? | Professor-facing? | Legacy? | Test needed |
|---|---|---:|---:|---:|---|
| `/` | Redirect to `/start.html` through `_redirects`; root `index.html` also falls back to `/start.html`. | Yes | Yes | No | `pnpm rb:build:contract:test`, `pnpm build:unified` |
| `/start.html` | Static public doorway explaining RedByte, ECE141 workflow, local run commands, Vivado boundary, and E0/E1/E2/E3 honesty. | Yes | Yes | No | `pnpm rb:site:start:test`, `pnpm build:unified` |
| `/os/` | Current RedByte IDE / course workbench. | Yes | Yes | No | Full ECE141 browser gate stack |
| `/os/version.json` | Deploy SHA/build verification endpoint for Cloudflare Pages. | No | Release ops | No | `pnpm build:unified`, Cloudflare deploy verification |
| `/os` | Normalizes to `/os/`. | Yes | Yes | No | `pnpm rb:build:contract:test`, `pnpm build:unified` |
| Root `/os/` redirect | Must not be the root default. Old OS-era behavior is retained only as the IDE subpath, not as public entry. | No | No | Yes | `pnpm rb:build:contract:test` |

Answers:

1. Root `/` should send course-facing users to `/start.html`.
2. `/os/` should still exist as the direct IDE route.
3. `/os/` remains the primary product app route after the public start page.
4. `/start.html` is the public start page and must exist in root `dist/`.
5. The student/professor link can open `/start.html` for context or `/os/` for direct IDE entry.
6. Cloudflare Pages serves `dist/`, with root `_redirects`, root `start.html`, and the IDE under `/os/`.
7. The manual site is separate from this app build.
8. Playground remains the shipped IDE app under `/os/`.
9. Old OS-era root behavior is archived as history; it must not be the root default.
10. `docs/product/RED_BYTE_PUBLIC_START_PATH.md`, `public/_redirects`, `scripts/rb-public-start-page.test.mjs`, `scripts/rb-build-deploy-contract.test.mjs`, and `scripts/verify-dist.mjs` encode the current truth.

## Fix Strategy

Strategy A/B blend: keep `/os/` as the IDE route, but make the root deploy contract match the current public RedByte course product.

Implemented:

- Added `pnpm rb:build:contract:test`.
- Added a hermetic verifier test proving the current `/ -> /start.html` contract passes and stale `/ -> /os/` fails.
- Updated `scripts/merge-dist.mjs` to write a root public-start fallback, copy `public/start.html` to `dist/start.html`, and copy `favicon.svg`.
- Updated `scripts/verify-dist.mjs` to require `dist/start.html`, require `/ -> /start.html`, reject root `/os/`, and verify the public start page includes IDE and E0/E1/E2/E3 truth.
- Updated `scripts/verify-dist-manifest.mjs` for root `start.html` and the `REDBYTE_PUBLIC_ROOT` marker.
- Updated `scripts/rb-public-start-page.test.mjs` to explicitly reject a root `/os/` redirect.
- Updated `scripts/verify-deploy.mjs` so deployed root verification looks for the public start page, not stale marketing/OS-era copy.
- Updated `docs/product/RED_BYTE_PUBLIC_START_PATH.md` with the root `dist/start.html` and build-contract validation expectations.
- Updated `docs/product/V1_RELEASE_READINESS_CHECKLIST.md` so `build:unified` root dist verification is no longer listed as a known blocker after validation.

## Validation Results

| Command | Result | Notes |
|---|---|---|
| `pnpm build:unified` | Failed before fix | Playground build and dist merge passed; final `scripts/verify-dist.mjs` failed on stale root `/os/` redirect expectation. |
| `pnpm -s rb:build:contract:test` | Failed before fix | New red test showed the current `/ -> /start.html` deploy contract did not pass the old verifier. |
| `pnpm -s rb:build:contract:test` | Passed after fix | Hermetic fixture accepts `/ -> /start.html` and rejects stale `/ -> /os/`. |
| `pnpm -s rb:site:start:test` | Passed after fix | Source public start page and root redirects preserve the current start contract. |
| `pnpm build:unified` | Passed after fix | Unified build produced root `dist/start.html`, `/os/` IDE artifact, and valid redirects/headers. |
| `pnpm typecheck` | Passed | Full workspace typecheck remained green. |
| `pnpm install --frozen-lockfile` | Passed | Lockfile already up to date. |
| `pnpm start:smoke` | Passed | Served `http://127.0.0.1:5197/` with HTTP 200. |
| Full ECE141 browser gate stack | Passed | Starter Verify/Export, product immersion, counter clock/export, map-pins recovery, counter compare, project persistence, import/export recovery, Vivado artifacts, UI art-direction, and UI hierarchy gates all passed sequentially. |
| `pnpm -s ui:lab-starter-load-gate` | Passed | 8 starter-loading tests passed. |
| `node scripts/verify-dist-manifest.mjs` | Passed | Root `index.html`, root `start.html`, redirects, headers, `/os/index.html`, `/os/version.json`, and `/os/assets` were present with current markers. |
| `pnpm rb:doc:validate` | Passed before final closeout docs | 36 passed, 0 failed. |
| `pnpm rb:encoding:check` | Passed before final closeout docs | No mojibake markers found. |
| `git diff --check` | Passed before final closeout docs | No whitespace errors. |
| `pnpm rb:doc:validate` | Passed after final closeout docs | 36 passed, 0 failed. |
| `pnpm rb:encoding:check` | Passed after final closeout docs | No mojibake markers found. |
| `git diff --check` | Passed after final closeout docs | No whitespace errors. |

## Remaining Blockers

No remaining known blocker for `pnpm build:unified`.

Remaining release work:

- Windows course setup / launch / doctor scripts.
- Student and professor quick starts after setup scripts are real.
- Professor-facing RC package sprint after setup and docs are aligned.

## Next Recommended Sprint

Windows course setup scripts: `setup.ps1`, `launch.ps1`, `doctor.ps1`, `update.ps1`, and `reset.ps1`.
