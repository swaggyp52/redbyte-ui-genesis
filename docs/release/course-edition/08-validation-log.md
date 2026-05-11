# Validation Log

Date: 2026-05-11

This log is updated by the course-edition triage branch. Failures must stay visible.

| Command | Result | Duration | Failure summary | Pre-existing or introduced? | Next action |
| --- | --- | --- | --- | --- | --- |
| `git status --short --branch` | Passed | <1s | Starting state had `main...origin/main [ahead 1]` plus untracked `.redbyte/pi-session-room/`. | Pre-existing | Keep untracked session material untouched. |
| `git log --oneline -n 10` | Passed | <1s | None. | N/A | Recorded top commit in preflight. |
| `node --version` | Passed | <1s | None; reported `v20.19.0`. | N/A | Meets package engine. |
| `npm --version` | Passed | <1s | None; observed only. | N/A | Do not use npm install. |
| `pnpm --version` | Passed | <1s | None; reported `10.24.0`. | N/A | Use pnpm. |
| `pnpm install --frozen-lockfile` | Passed | ~3s | None. | N/A | Dependencies are installed and lockfile is current. |
| `pnpm start:smoke` | Passed | ~24s | None; launcher returned HTTP 200. | N/A | Launcher smoke is available for future validation. |
| Playwright six-surface browser audit | Passed with findings | ~33s | No console/page/network failures. | N/A | Browser loop established. |
| Playwright starter workflow audit | Passed with findings | ~88s | 11 repeated `CircuitStore` engine-not-connected console warnings during starter loading. | Unknown/pre-existing likely | Classify/fix in later stabilization task. |
| Playwright Logic Gates Compare to Export audit | Passed with findings | ~12s | 2 repeated `CircuitStore` warnings; Verify Compare PASS and Export ready-to-build were observed through in-app navigation. | Unknown/pre-existing likely | Add targeted browser gate later. |
| `pnpm rb:doc:validate` | Passed | ~1s | 36 passed, 0 failed. | N/A | No action. |
| `pnpm rb:encoding:check` | Passed | ~1s | No mojibake markers found. | N/A | No action. |
| `git diff --check` | Passed | <1s | No whitespace errors. | N/A | No action. |
| `pnpm start:smoke` | Passed | ~27s | Launcher returned HTTP 200 at `http://127.0.0.1:5197/`. | N/A | No action. |
| `pnpm --filter @redbyte/playground build` | Passed | ~9s | Vite build completed and wrote `apps/playground/dist/build.json`. | N/A | Build output is ignored; do not stage. |
| `pnpm test -- packages/rb-apps/src/apps/ide/__tests__/startupMode.test.ts` | Passed | ~48s | 6 tests passed. Vite CJS API deprecation warning printed. | N/A | No action. |
| `pnpm rb:site:start:test` | Passed | ~1s | Public start page test reported ok. | N/A | No action. |
| `pnpm lint:product` | Passed with no-op output | ~2s | No projects matched `@redbyte/manual-site`; no selected packages had a `lint` script. Exit code 0. | Pre-existing script/package mismatch | Decide whether lint filters need cleanup in a later task. |
| `pnpm typecheck` | Failed | ~11s | `@redbyte/rb-fpga-toolchain` failed on `src/verilog-validator.ts` possibly undefined timing constraints and many DOM globals (`window`, `document`, `requestAnimationFrame`) leaking through `../rb-utils/src/**` without DOM libs. | Pre-existing likely; this branch only changes docs and `.gitignore` | Track as separate typecheck/package-boundary task. |
