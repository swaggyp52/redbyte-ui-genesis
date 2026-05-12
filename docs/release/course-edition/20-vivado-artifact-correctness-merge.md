# Vivado Artifact Correctness Merge

Date: 2026-05-11

## Merge Scope

| Item | Value |
| --- | --- |
| Current branch before merge | `product/vivado-artifact-correctness-1` |
| Merge target | `main` |
| Origin main before merge | `b5e60b4cbb9d5f9aecb5d1339f56dee65c619a75` |
| Feature branch | `origin/product/vivado-artifact-correctness-1` |
| Feature commit | `4bced3133dd85dc1870411954ba928fdcf0d3ff2` |
| Safety branch | `backup/pre-vivado-artifact-correctness-merge` |
| Merge commit | `0ea2e60d` |

The merge brought the Vivado artifact correctness sprint into `main` with no conflicts.

## Evidence Boundary

This merge proves E0 export-package correctness only.

It does not prove:

- E1 Vivado build or bitstream evidence.
- E2 board programming evidence.
- E3 observed physical board behavior.

The generated package README and `EXPECTED_IO.json` now carry explicit E0 wording or metadata. No claim was added for Vivado build, board programming, or observed behavior.

## Merged Changes

- Added `pnpm -s ide:gate:ece141-vivado-artifacts`.
- Added `tests/e2e/ece141-vivado-artifacts.spec.ts`.
- Added browser ZIP inspection for Logic Gates, Half Adder, and 2-Bit Up Counter.
- Added E0-only evidence wording to generated Vivado README outputs.
- Added `evidenceLevel: "E0"` to `EXPECTED_IO.json`.
- Added physical `packagePin` to `EXPECTED_IO.json` signals while preserving `pin`.
- Added `docs/release/course-edition/19-vivado-artifact-correctness.md`.
- Updated artifact-focused Vitest coverage.

## Post-Merge Sanity

| Check | Result | Notes |
| --- | --- | --- |
| `git status --short` | Passed | Clean immediately after merge. |
| Marcus/RPI/HQ/local-agent scan | Passed with reviewed historical hits | Merge diff did not add active Marcus/RPI/HQ/local-agent scripts or surfaces. Existing hits are `.gitignore`, `AI_STATE.md` historical notes, retained generated/build artifacts, or already-known retained files outside this merge. |
| Branch diff scope | Passed | Merge touched only Vivado artifact sprint files: docs, package script, Playwright gate, bring-up metadata, Vivado README builders, and focused tests. |

## Validation Results

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | Passed | Lockfile up to date. |
| `pnpm start:smoke` | Passed | Served `http://127.0.0.1:5197/` with HTTP 200. |
| `pnpm -s ide:gate:ece141-starter-verify-export` | Passed | Logic Gates Verify to Export smoke passed. |
| `pnpm -s ide:gate:ece141-product-immersion` | Passed | Four browser workflows passed. |
| `pnpm -s ide:gate:ece141-counter-clock-export` | Passed | Counter clock/export evidence gate passed. |
| `pnpm -s ide:gate:ece141-map-pins-recovery` | Passed | Manual Map Pins and starter recovery gate passed. |
| `pnpm -s ide:gate:ece141-counter-compare-pass` | Passed | Counter Compare pass and E0 Export gate passed. |
| `pnpm -s ide:gate:ece141-project-persistence` | Passed | Persistence and stale evidence gate passed. |
| `pnpm -s ide:gate:ece141-import-export-recovery` | Passed | Import/export recovery gate passed. |
| `pnpm -s ui:lab-starter-load-gate` | Passed | 8 starter-load tests passed. |
| `pnpm -s ide:gate:ece141-vivado-artifacts` | Passed | Certified starter Vivado ZIP inspection gate passed. |
| Focused Vitest suite | Passed | 30 artifact/import/export/counter/clock-policy tests passed. |
| `pnpm rb:doc:validate` | Passed before and after closeout docs | 36 passed, 0 failed. |
| `pnpm rb:encoding:check` | Passed before and after closeout docs | No mojibake markers found. |
| `git diff --check` | Passed before and after closeout docs | No whitespace errors. |
| `pnpm typecheck` | Failed | Same known pre-existing `@redbyte/rb-lab-engine` and pulled `rb-logic-core` type-boundary drift. |

## Known Failures

`pnpm typecheck` remains red in `@redbyte/rb-lab-engine` and pulled `rb-logic-core` source. Representative error groups include stale lab-engine fixtures and schema shapes, missing schema import paths, stale `CircuitConnection` fixture fields, lab action envelope drift, and rb-logic-core component registry/simulation model type narrowing issues.

`pnpm build:unified` was not run in this task. The known `/os/` redirect contract drift remains separate release-process debt.

## Final State Before Push

Closeout docs were updated after validation and will be committed separately from the merge commit before pushing `main`.

Next recommended sprint: full workspace `pnpm typecheck` drift cleanup.
