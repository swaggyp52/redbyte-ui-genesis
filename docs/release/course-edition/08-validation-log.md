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
| `pnpm -s ide:gate:ece141-starter-verify-export` | Failed before fix | ~98s | Initial new Playwright gate hit a selector issue because a hidden command-bar `12/12 match` badge matched first. | Introduced by first test draft | Adjust assertion to use visible pass hero plus command-bar evidence text content. |
| `pnpm -s ide:gate:ece141-starter-verify-export` | Failed before fix | ~37s | Workflow reached PASS/export-ready, then failed on one `[CircuitStore] Circuit mutation called but engines not connected!` warning. | Pre-existing product warning; intentionally caught by new gate | Gate runtime projection warning without hiding normal editor mutation warnings. |
| `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/circuitProjection.test.ts` | Passed | ~11s | 7 tests passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-starter-verify-export` | Passed | ~29s | Logic Gates starter loaded; Verify Compare reached PASS; `ide-vcb-evidence` reported `12/12 match`; Export reached ready-to-build; no `CircuitStore` warning captured. | N/A | Keep as focused ECE141 browser gate. |
| `pnpm typecheck` | Failed after targeted fix | ~6s | `@redbyte/rb-fpga-toolchain` passed, then workspace typecheck failed in `@redbyte/rb-lab-engine` and pulled `rb-logic-core` sources on schema/type drift and stale test fixture shapes. | Pre-existing/out of sprint scope | Create a separate lab-engine/type-boundary cleanup task. |
| `pnpm --filter @redbyte/rb-fpga-toolchain typecheck` | Passed | ~3s | Targeted package now typechecks. | N/A | No action. |
| `pnpm install --frozen-lockfile` | Passed | ~2s | Lockfile is up to date; no dependency changes. | N/A | No action. |
| `pnpm start:smoke` | Passed | ~18s | Launcher served `http://127.0.0.1:5197/` with HTTP 200. | N/A | No action. |
| `pnpm -s ide:gate:export-ready-contract` | Failed | ~7s | Existing gate reported `verify had neither a visible generate-basics action nor an existing ready-vector state`. | Pre-existing/stale gate or flow mismatch; not introduced by CircuitStore fix | Track as separate export-ready contract gate maintenance task. |
| `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/circuitProjection.test.ts` | Passed | ~10s | 7 tests passed after final changes. | N/A | No action. |
| `pnpm -s ide:gate:ece141-starter-verify-export` | Passed | ~29s | Final focused browser gate passed. | N/A | No action. |
| `pnpm --filter @redbyte/rb-fpga-toolchain typecheck` | Passed | ~3s | Final targeted typecheck passed. | N/A | No action. |
| `pnpm build:unified` | Failed | ~145s | Playground build and merge completed; dist verification failed with `dist/_redirects contains root redirect to /os/`. | Pre-existing known build/redirect contract drift; previous AI_STATE already noted root redirect mismatch | Track separately from starter workflow stabilization. |
| `git diff --check` | Passed | <1s | No whitespace errors. | N/A | No action. |
| `pnpm -s ide:gate:ece141-starter-verify-export` | Passed before cleanup | ~26s | Baseline Logic Gates starter Verify -> Export gate passed before package-boundary cleanup. | N/A | Keep as course workflow guard. |
| `git diff --check` | Passed before cleanup | <1s | Baseline diff whitespace check passed before package-boundary cleanup. | N/A | No action. |
| `pnpm install --frozen-lockfile` | Passed | ~2s | Lockfile is up to date; no dependency changes. | N/A | No action. |
| `pnpm start:smoke` | Passed | ~15s | Launcher served `http://127.0.0.1:5197/` with HTTP 200. | N/A | No action. |
| `pnpm -s ide:gate:ece141-starter-verify-export` | Passed | ~26s | Focused ECE141 starter Verify -> Export Playwright gate still passes after env/generated-output untracking. | N/A | No action. |
| `pnpm rb:doc:validate` | Passed | ~1s | 36 passed, 0 failed. | N/A | No action. |
| `pnpm rb:encoding:check` | Passed | ~1s | No mojibake markers found. | N/A | No action. |
| `pnpm typecheck` | Failed | ~6s | `@redbyte/rb-fpga-toolchain` passed; workspace still fails in `@redbyte/rb-lab-engine` and pulled `rb-logic-core` sources on stale schema/test fixture/type-boundary drift. | Pre-existing/out of sprint scope | Keep as next type-boundary cleanup task; this sprint changed no product TS/TSX code. |
| `git diff --check` | Passed | <1s | No whitespace errors after package-boundary cleanup. | N/A | No action. |
| `git status --short --branch` | Passed | <1s | Starting product-immersion state was `chore/course-edition-repo-triage` with untracked `.redbyte/pi-session-room/`. | Pre-existing local material | Leave unrelated untracked session material untouched. |
| `git branch --show-current` | Passed | <1s | Reported `chore/course-edition-repo-triage`. | N/A | No action. |
| `git log --oneline -n 10` | Passed | <1s | Latest commit was `095f5f28 chore: clean course edition package boundary`. | N/A | No action. |
| `pnpm install --frozen-lockfile` | Passed | ~2s | Lockfile was up to date; no dependency changes. | N/A | No action. |
| `pnpm start:smoke` | Passed | ~13s | Launcher served `http://127.0.0.1:5197/` with HTTP 200. | N/A | No action. |
| `pnpm -s ide:gate:ece141-starter-verify-export` | Passed | ~28s | Existing Logic Gates starter -> Verify Compare -> Export ready gate passed after product changes. | N/A | Keep as required course workflow guard. |
| `pnpm -s ide:gate:ece141-product-immersion` | Failed before fix | ~4m | Draft gate exposed product issues: Half Adder was not first-screen reachable, then Half Adder Verify passed but Export blocked at `4/8 mapped` because starter `ioRows` labels did not match boundary labels. | Pre-existing product issue exposed by new gate | Course landing path and Half Adder mapping labels were fixed locally. |
| `pnpm -s ide:gate:ece141-product-immersion` | Passed | ~80s | Four Playwright workflows passed: empty/six-surface loop, Logic Gates Verify/Export, Half Adder Verify/Export/evidence rows, Counter/FSM sequential boundary audit. | N/A | Keep as product immersion gate. |
| `pnpm exec vitest run packages/rb-apps/src/__tests__/ideApp.labday-wiring.test.tsx packages/rb-apps/src/__tests__/projectSurface.continuity.test.tsx` | Failed | ~1s | No test files found because the command used stale paths. | Operator command error during sprint, not product failure | Corrected to the actual test paths below. |
| `pnpm exec vitest run packages/rb-apps/src/apps/ide/__tests__/examplesCatalog.learningPath.test.ts packages/rb-apps/src/apps/ide/__tests__/ideApp.labday-wiring.test.tsx` | Passed | ~17s | 22 tests passed and 1 skipped after updating landing-card expectations from Signal Tour to current course starters. | N/A | No action. |
| `pnpm -s ui:lab-starter-load-gate` | Passed | ~10s | 8 lab starter load tests passed after Half Adder mapping label fix. | N/A | No action. |
| `pnpm typecheck` | Failed | ~6s | `@redbyte/rb-board-profiles`, `@redbyte/rb-viewport`, and `@redbyte/rb-fpga-toolchain` passed; workspace still fails in `@redbyte/rb-lab-engine` and pulled `rb-logic-core` sources on stale schema/test fixture/type-boundary drift. | Pre-existing/out of sprint scope | Separate lab-engine/core type-boundary cleanup remains required. |
| `git diff --check` | Passed | <1s | No whitespace errors after product immersion docs, tests, and UI/starter fixes. | N/A | No action. |
| `git status --short` | Passed | <1s | Before separation cleanup, only `.redbyte/pi-session-room/` was untracked. | Pre-existing local spillover | Copy to `C:\MarcusRPI` before removing RedByte copy. |
| `git status --ignored --short` | Passed with findings | ~4s | Many ignored local/generated outputs were present; relevant `.redbyte` ignored outputs included agent runs, course-edition, product-immersion, session, and work folders. | Pre-existing local outputs | Leave ignored local outputs untouched. |
| `git branch --show-current` | Passed | <1s | Reported `chore/course-edition-repo-triage`. | N/A | No action. |
| `git log --oneline -n 12` | Passed | <1s | Latest commit was `f4f22919 ux: harden ece141 starter workflows`. | N/A | No action. |
| `git remote -v` | Passed | <1s | `origin` points at `git@github.com:swaggyp52/redbyte-ui-genesis.git`. | N/A | Remote sync remains subject to `AI_STATE.md` remote-operation policy. |
| `git branch backup/pre-main-sync-2026-05-11` | Passed | <1s | Safety branch created at `f4f22919`. | N/A | No action. |
| Copy `.redbyte/pi-session-room/**` to `C:\MarcusRPI` | Passed | <1s | 9 files copied to `C:\MarcusRPI\imports\redbyte-spillover-20260511-1538\.redbyte\pi-session-room\`; `server.mjs` verified before RedByte source removal. | N/A | Commit MarcusRPI import locally after RedByte cleanup. |
| `pnpm install --frozen-lockfile` | Passed | ~2s | Lockfile up to date; no dependency changes. | N/A | No action. |
| `pnpm start:smoke` | Passed | ~15s | Launcher served `http://127.0.0.1:5197/` with HTTP 200. | N/A | No action. |
| `pnpm -s ide:gate:ece141-starter-verify-export` | Passed | ~31s | Logic Gates starter -> Verify Compare -> Export ready gate passed after spillover removal and ignore updates. | N/A | No action. |
| `pnpm -s ide:gate:ece141-product-immersion` | Passed | ~89s | Four Playwright product immersion workflows passed after spillover removal and ignore updates. | N/A | No action. |
| `pnpm -s ui:lab-starter-load-gate` | Passed | ~10s | 8 starter-load tests passed. | N/A | No action. |
| `pnpm rb:doc:validate` | Passed | ~1s | 36 passed, 0 failed. | N/A | Rerun after final doc updates. |
| `pnpm rb:encoding:check` | Passed | ~1s | No mojibake markers found. | N/A | No action. |
| `pnpm typecheck` | Failed | ~7s | `@redbyte/rb-board-profiles`, `@redbyte/rb-viewport`, and `@redbyte/rb-fpga-toolchain` passed; workspace still fails in `@redbyte/rb-lab-engine` and pulled `rb-logic-core` on stale schema/test fixture/type-boundary drift. | Pre-existing/out of task scope | Keep as separate type-boundary cleanup task. |
| `git diff --check` | Passed | <1s | No whitespace errors after separation cleanup. | N/A | No action. |
| `pnpm rb:doc:validate` | Passed after final doc updates | ~1s | 36 passed, 0 failed after `AI_STATE.md`, `08-validation-log.md`, and `12-main-sync-and-marcus-rpi-separation.md` updates. | N/A | No action. |
| `pnpm rb:encoding:check` | Passed after final doc updates | ~1s | No mojibake markers found. | N/A | No action. |
| `git diff --check` | Passed after final doc updates | <1s | No whitespace errors. | N/A | Ready to commit RedByte separation slice. |
| `git checkout main` | Passed | <1s | Switched to local `main`, which was already 1 commit ahead of the local `origin/main` ref. | Existing local main state | Remote pull was not run because `AI_STATE.md` says remote operations are disallowed in this environment. |
| `git merge --no-ff chore/course-edition-repo-triage -m "merge: course edition product readiness work"` | Passed | <1s | Local `main` received the course-edition audit, stabilization, package-boundary, product immersion, and Marcus/RPI spillover separation commits. | N/A | Validate local main before any remote sync decision. |
| `pnpm install --frozen-lockfile` | Passed on local main | ~2s | Lockfile up to date; no dependency changes. | N/A | No action. |
| `pnpm start:smoke` | Passed on local main | ~16s | Launcher served `http://127.0.0.1:5197/` with HTTP 200. | N/A | No action. |
| `pnpm -s ide:gate:ece141-starter-verify-export` | Passed on local main | ~28s | Logic Gates starter -> Verify Compare -> Export ready gate passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-product-immersion` | Passed on local main | ~80s | Four product immersion workflows passed. | N/A | No action. |
| `pnpm -s ui:lab-starter-load-gate` | Passed on local main | ~10s | 8 starter-load tests passed. | N/A | No action. |
| `pnpm rb:doc:validate` | Passed on local main | ~1s | 36 passed, 0 failed. | N/A | Rerun after final post-merge doc updates. |
| `pnpm rb:encoding:check` | Passed on local main | ~1s | No mojibake markers found. | N/A | No action. |
| `git diff --check` | Passed on local main | <1s | No whitespace errors. | N/A | No action. |
| `pnpm typecheck` | Failed on local main | ~7s | Same pre-existing `@redbyte/rb-lab-engine` and pulled `rb-logic-core` type-boundary drift after `@redbyte/rb-board-profiles`, `@redbyte/rb-viewport`, and `@redbyte/rb-fpga-toolchain` pass. | Pre-existing/out of task scope | Do not fix in repo separation task. |
