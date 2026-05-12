# RedByte UI Hierarchy Merge

**Date:** 2026-05-12  
**Branch:** `main`  
**Feature branch:** `origin/product/redbyte-ui-hierarchy-2`  
**Feature commit:** `c96a120c94fa4810570cbecd670a99930a873557`  
**Attribution:** Connor Angiel

## Preflight

| Item | Result |
|---|---|
| Current branch | `main` |
| Working tree before merge | Clean |
| `origin/main` before merge | `f26869d16672cfc328265b8bc76383389be0d18b` |
| `origin/product/redbyte-ui-hierarchy-2` | `c96a120c94fa4810570cbecd670a99930a873557` |
| Safety branch | `backup/pre-redbyte-ui-hierarchy-merge` |

## Validation Plan

- Install dependencies with `pnpm install --frozen-lockfile`.
- Run `pnpm start:smoke`.
- Run the full ECE141 browser gate stack, including the existing art-direction gate and the Sprint 7 hierarchy gate.
- Run the lab-starter load gate.
- Run the focused UI surface Vitest suite.
- Run documentation, encoding, whitespace, and full workspace typecheck checks.

## Known Typecheck Failure

Full workspace `pnpm typecheck` is expected to remain red before the next sprint in the known `@redbyte/rb-lab-engine` / pulled `rb-logic-core` schema, stale fixture, and package-boundary drift. This merge task must not perform typecheck cleanup unless a new UI-specific type error appears.

## Known Remaining UI Polish

Sprint 7 reported no remaining P1/P2 UI hierarchy issues. Remaining UI work is P3 polish only:

- Design screenshot framing / density.
- Export right-dock clipping.

## Merge Result

`origin/product/redbyte-ui-hierarchy-2` merged into `main` with merge commit `e0271c16`.

The merge completed without conflicts and preserved:

- `package.json` gate script for `pnpm -s ide:gate:ece141-ui-hierarchy`.
- `tests/e2e/ece141-ui-hierarchy.spec.ts`.
- Surface hierarchy changes in Project, Design, Verify, Hardware, Export, and Import.
- `SurfaceLayoutPrimitives` / `IdePrimitives` hierarchy support.
- `packages/rb-apps/src/apps/ide/ide-polish-pass.css`.
- `docs/release/course-edition/23-redbyte-ui-hierarchy-2.md`.
- `AI_STATE.md` and validation-log updates from the feature branch.

## Validation Results

| Command | Result | Notes |
|---|---|---|
| `pnpm install --frozen-lockfile` | Passed | Lockfile already up to date. |
| `pnpm start:smoke` | Passed | Served `http://127.0.0.1:5197/` with HTTP 200. |
| `pnpm -s ide:gate:ece141-starter-verify-export` | Passed | 1 Playwright test passed. |
| `pnpm -s ide:gate:ece141-product-immersion` | Passed | 4 Playwright tests passed. |
| `pnpm -s ide:gate:ece141-counter-clock-export` | Passed | 2 Playwright tests passed. |
| `pnpm -s ide:gate:ece141-map-pins-recovery` | Passed on rerun | First attempt failed before test execution because two Playwright web servers were started in parallel on port 4173; sequential rerun passed 1 test. |
| `pnpm -s ide:gate:ece141-counter-compare-pass` | Passed | 1 Playwright test passed. |
| `pnpm -s ide:gate:ece141-project-persistence` | Passed | 1 Playwright test passed. |
| `pnpm -s ide:gate:ece141-import-export-recovery` | Passed | 1 Playwright test passed. |
| `pnpm -s ide:gate:ece141-vivado-artifacts` | Passed | 1 Playwright test passed. |
| `pnpm -s ide:gate:ece141-ui-art-direction` | Passed | 2 Playwright tests passed. |
| `pnpm -s ide:gate:ece141-ui-hierarchy` | Passed | 2 Playwright tests passed. |
| `pnpm -s ui:lab-starter-load-gate` | Passed | 8 Vitest tests passed. |
| Focused Sprint 7 surface Vitest suite | Passed | 65 passed, 1 skipped. |
| `pnpm rb:doc:validate` | Passed before closeout docs | 36 passed, 0 failed. |
| `pnpm rb:encoding:check` | Passed before closeout docs | No mojibake markers found. |
| `git diff --check` | Passed before closeout docs | No whitespace errors. |
| `pnpm typecheck` | Failed as expected | Known `@redbyte/rb-lab-engine` / pulled `rb-logic-core` schema, stale fixture, and package-boundary drift; no new UI-specific type errors appeared. |

## Marcus/RPI/HQ/Local-Agent Scan

The post-merge grep still finds historical `AI_STATE.md` notes, `.gitignore` ignore patterns, archive/artifact files, lockfile substrings, and tests that assert HQ absence. The merge did not reintroduce active Marcus/RPI/HQ/local-agent IDE surfaces, active RedByte scripts, tracked `.redbyte/agent` files, or RPI session artifacts.

## Known Failures

Full workspace `pnpm typecheck` remains red in `@redbyte/rb-lab-engine` and pulled `rb-logic-core` sources. The next sprint should address this directly.

## Closeout

Remaining UI work is P3 polish only:

- Design screenshot framing / density.
- Export right-dock clipping.

Next recommended sprint: full workspace `pnpm typecheck` drift cleanup.
