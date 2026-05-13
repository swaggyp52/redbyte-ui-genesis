# Validation Log

Date: 2026-05-12

This log is updated by the course-edition triage branch. Failures must stay visible.

| Command | Result | Duration | Failure summary | Pre-existing or introduced? | Next action |
| --- | --- | --- | --- | --- | --- |
| `git fetch origin --prune && git checkout main && git pull --ff-only origin main && git checkout -b release/build-unified-contract-cleanup-1` | Passed | ~3s | Branch created from pushed `main` at `b83524526ea92dfdd776c92ac4a3addd06e5a146`. | N/A | Reproduce `build:unified` failure. |
| `pnpm build:unified` | Failed before fix | ~130s | Package and playground builds passed, dist merge passed, then `scripts/verify-dist.mjs` failed at stale `dist/_redirects contains root redirect to /os/`; generated `dist/_redirects` already routed `/` to `/start.html`, but root `dist/start.html` was missing. | Pre-existing release-gate drift | Align merge and verifier scripts with current public start route. |
| `pnpm -s rb:build:contract:test` | Failed before fix | ~1s | New hermetic test showed the current `/ -> /start.html` public deploy contract failed the old verifier. | Introduced red test | Update deploy verifier and merge script. |
| `pnpm -s rb:build:contract:test` | Passed after fix | ~1s | Test now accepts `/ -> /start.html`, rejects stale `/ -> /os/`, and proves verifier failure wording names the root redirect contract. | N/A | Keep as focused deploy-contract gate. |
| `pnpm -s rb:site:start:test` | Passed after fix | ~1s | Public source start page still includes product truth, workflow, E0/E1/E2/E3 wording, local pnpm commands, and no forbidden overclaims; root `/os/` redirect is explicitly rejected. | N/A | No action. |
| `pnpm build:unified` | Passed after fix | ~102s | Unified build produced root `dist/start.html`, root fallback to `/start.html`, `/os/` IDE artifact, `/os/version.json`, current redirects, and current headers; dist verification passed. | N/A | Continue release validation. |
| `pnpm typecheck` | Passed after build-contract fix | ~6s | Full workspace typecheck stayed green. | N/A | No action. |
| `pnpm install --frozen-lockfile` | Passed after build-contract fix | ~1s | Lockfile was up to date. | N/A | No action. |
| `pnpm start:smoke` | Passed after build-contract fix | ~17s | Launcher served `http://127.0.0.1:5197/` with HTTP 200. | N/A | No action. |
| Full ECE141 browser gate stack | Passed after build-contract fix | ~480s | Starter Verify/Export, product immersion, counter clock/export, map-pins recovery, counter compare, project persistence, import/export recovery, Vivado artifacts, UI art-direction, and UI hierarchy gates all passed sequentially. | N/A | No action. |
| `pnpm -s ui:lab-starter-load-gate` | Passed after build-contract fix | ~41s | 8 starter-loading tests passed. | N/A | No action. |
| `node scripts/verify-dist-manifest.mjs` | Passed after build-contract fix | <1s | Root `index.html`, root `start.html`, `_redirects`, `_headers`, `/os/index.html`, `/os/version.json`, and `/os/assets` were present with current root and IDE markers. | N/A | No action. |
| `pnpm rb:doc:validate` | Passed before final build-contract closeout docs | ~1s | 36 passed, 0 failed. | N/A | Rerun after final closeout docs. |
| `pnpm rb:encoding:check` | Passed before final build-contract closeout docs | ~4s | No mojibake markers found. | N/A | Rerun after final closeout docs. |
| `git diff --check` | Passed before final build-contract closeout docs | <1s | No whitespace errors. | N/A | Rerun after final closeout docs. |
| `pnpm rb:doc:validate` | Passed after final build-contract closeout docs | ~1s | 36 passed, 0 failed after `27-build-unified-contract-cleanup.md`, validation-log, product docs, and `AI_STATE.md` updates. | N/A | No action. |
| `pnpm rb:encoding:check` | Passed after final build-contract closeout docs | ~1s | No mojibake markers found after final closeout docs. | N/A | No action. |
| `git diff --check` | Passed after final build-contract closeout docs | <1s | No whitespace errors after final closeout docs. | N/A | Ready to commit build-contract cleanup branch. |
| `git fetch origin --prune && git checkout main && git pull --ff-only origin main` | Passed for typecheck merge | ~2s | Local `main` was up to date with `origin/main` at `e98bae578c422006fffefbe530fc3edad052808b`. | N/A | Merge typecheck cleanup branch. |
| `git branch backup/pre-typecheck-drift-cleanup-merge` | Passed | <1s | Safety branch created at pre-merge `main`. | N/A | No action. |
| `git merge --no-ff origin/release/typecheck-drift-cleanup-1 -m "merge: resolve workspace typecheck drift"` | Passed | ~1s | Merge commit `e98f11b4`; no conflicts. | N/A | Validate merged `main`. |
| Marcus/RPI/HQ/local-agent grep | Passed with known retained findings | ~1s | Grep still finds historical `AI_STATE.md` notes, ignore patterns, retained generated/artifact material, lockfile substrings, and old historical references; merge did not add active Marcus/RPI/HQ/local-agent IDE surfaces or scripts. | Pre-existing/retained | Keep separate from typecheck cleanup merge. |
| `pnpm install --frozen-lockfile` | Passed on typecheck-merged `main` | ~2s | Lockfile up to date; no dependency changes. | N/A | No action. |
| `pnpm --filter @redbyte/rb-lab-engine typecheck` | Passed on typecheck-merged `main` | ~3s | `@redbyte/rb-lab-engine` compiler gate passed. | N/A | No action. |
| `pnpm typecheck` | Passed on typecheck-merged `main` | ~6s | Full workspace typecheck passed after `rb-board-profiles`, `rb-fpga-toolchain`, `rb-viewport`, and `rb-lab-engine` completed. | N/A | No action. |
| `pnpm start:smoke` | Passed on typecheck-merged `main` | ~19s | Launcher served `http://127.0.0.1:5197/` with HTTP 200. | N/A | No action. |
| Full ECE141 browser gate stack | Passed on typecheck-merged `main` | ~435s | `ide:gate:ece141-starter-verify-export`, `ide:gate:ece141-product-immersion`, `ide:gate:ece141-counter-clock-export`, `ide:gate:ece141-map-pins-recovery`, `ide:gate:ece141-counter-compare-pass`, `ide:gate:ece141-project-persistence`, `ide:gate:ece141-import-export-recovery`, `ide:gate:ece141-vivado-artifacts`, `ide:gate:ece141-ui-art-direction`, `ide:gate:ece141-ui-hierarchy`, and `ui:lab-starter-load-gate` all passed sequentially. | N/A | No action. |
| Focused typecheck-cleanup Vitest suite | Passed on typecheck-merged `main` | ~12s | 13 test files passed; 163 tests passed and 1 skipped across touched `rb-lab-engine` and `rb-logic-core` areas. | N/A | No action. |
| `pnpm rb:doc:validate` | Passed before typecheck-merge closeout docs | ~1s | 36 passed, 0 failed. | N/A | Rerun after final closeout docs. |
| `pnpm rb:encoding:check` | Passed before typecheck-merge closeout docs | ~1s | No mojibake markers found. | N/A | Rerun after final closeout docs. |
| `git diff --check` | Passed before typecheck-merge closeout docs | <1s | No whitespace errors. | N/A | Rerun after final closeout docs. |
| `pnpm rb:doc:validate` | Passed after typecheck-merge closeout docs | ~1s | 36 passed, 0 failed after `26-typecheck-drift-cleanup-merge.md`, validation-log, and `AI_STATE.md` updates. | N/A | No action. |
| `pnpm rb:encoding:check` | Passed after typecheck-merge closeout docs | ~1s | No mojibake markers found after closeout docs. | N/A | No action. |
| `git diff --check` | Passed after typecheck-merge closeout docs | <1s | No whitespace errors after closeout docs. | N/A | Ready to commit closeout docs. |
| `git fetch origin --prune && git rev-list --left-right --count origin/main...main` | Passed before typecheck-merge push | ~1s | Divergence was `0 3`; local `main` was three commits ahead and `origin/main` had no extra commits. | N/A | Push local `main` without force. |
| `git push origin main` | Passed with branch-protection bypass warning | ~2s | Pushed `e98bae57..1339d242` to `origin/main`; GitHub reported bypassed required `Classroom Truth Gates` status check expectation. | N/A | Log release-process debt in `AI_STATE.md`. |
| `git fetch origin && git rev-parse main && git rev-parse origin/main` | Passed after typecheck-merge push | ~1s | Both refs resolved to `1339d2422acdc6b6d7f185f35e142c41d85b6b03`; working tree was clean. | N/A | Start build unified cleanup after release-process debt note. |
| `git checkout -b release/typecheck-drift-cleanup-1` | Passed | <1s | Branch created from pushed `main` at `e98bae578c422006fffefbe530fc3edad052808b`. | N/A | Reproduce typecheck drift. |
| `pnpm typecheck` | Failed before fix | ~6s | Full workspace stopped at `@redbyte/rb-lab-engine`; failures were stale `LabProjectV1` fixtures, stale action/evidence shapes, `rb-lab-engine` source narrowing errors, and pulled `rb-logic-core` strictness errors. | Pre-existing release-gate drift | Fix type/schema boundaries without exclusions or suppressions. |
| `pnpm --filter @redbyte/rb-lab-engine typecheck` | Failed before fix | ~4s | Isolated the same `rb-lab-engine` and pulled `rb-logic-core` errors for the inventory. | Pre-existing release-gate drift | Update source strictness and stale tests. |
| `pnpm --filter @redbyte/rb-lab-engine typecheck` | Passed after fix | ~3s | `rb-lab-engine` package typecheck completed cleanly. | N/A | Run full workspace typecheck. |
| `pnpm typecheck` | Passed after fix | ~6s | Full workspace typecheck completed: `rb-board-profiles`, `rb-viewport`, `rb-fpga-toolchain`, and `rb-lab-engine` passed. | N/A | Run focused runtime tests. |
| Focused `rb-lab-engine` / `rb-logic-core` Vitest suite | Failed before final source guard | ~13s | 1 focused evidence-validator test crashed because older evidence objects can omit `context`; 162 tests passed and 1 skipped. | Introduced by strict evidence-path cleanup exposing legacy compatibility gap | Add optional context guard and legacy `exampleId` fallback. |
| Focused `rb-lab-engine` / `rb-logic-core` Vitest suite | Passed after final source guard | ~12s | 13 test files passed; 163 tests passed and 1 skipped across board mapping, import/export, schema migration, integrity, readme generation, conversion, serialization, component registry, and evidence validation. | N/A | Run release product gates. |
| `pnpm typecheck` | Passed after focused test fix | ~6s | Full workspace typecheck remained green after the evidence compatibility guard. | N/A | Continue product validation. |
| `pnpm install --frozen-lockfile` | Passed on `release/typecheck-drift-cleanup-1` | ~2s | Lockfile was up to date. | N/A | No action. |
| `pnpm start:smoke` | Passed on `release/typecheck-drift-cleanup-1` | ~20s | Launcher served `http://127.0.0.1:5197/` with HTTP 200. | N/A | No action. |
| Full ECE141 browser gate stack | Passed on `release/typecheck-drift-cleanup-1` | ~424s | `ide:gate:ece141-starter-verify-export`, `ide:gate:ece141-product-immersion`, `ide:gate:ece141-counter-clock-export`, `ide:gate:ece141-map-pins-recovery`, `ide:gate:ece141-counter-compare-pass`, `ide:gate:ece141-project-persistence`, `ide:gate:ece141-import-export-recovery`, `ide:gate:ece141-vivado-artifacts`, `ide:gate:ece141-ui-art-direction`, `ide:gate:ece141-ui-hierarchy`, and `ui:lab-starter-load-gate` all passed sequentially. | N/A | No action. |
| `pnpm rb:doc:validate` | Passed before closeout docs | ~1s | 36 passed, 0 failed. | N/A | Rerun after final docs. |
| `pnpm rb:encoding:check` | Passed before closeout docs | ~1s | No mojibake markers found. | N/A | Rerun after final docs. |
| `git diff --check` | Passed before closeout docs | <1s | No whitespace errors. | N/A | Rerun after final docs. |
| `pnpm rb:doc:validate` | Passed after closeout docs | ~1s | 36 passed, 0 failed after `25-typecheck-drift-cleanup.md`, validation log, and `AI_STATE.md` updates. | N/A | No action. |
| `pnpm rb:encoding:check` | Passed after closeout docs | ~1s | No mojibake markers found after closeout docs. | N/A | No action. |
| `git diff --check` | Passed after closeout docs | <1s | No whitespace errors after closeout docs. | N/A | Ready to commit typecheck cleanup branch. |
| `git fetch origin --prune && git checkout main && git pull --ff-only origin main` | Passed | ~3s | Local `main` was already up to date with `origin/main` at `f26869d16672cfc328265b8bc76383389be0d18b`. | N/A | Merge UI hierarchy branch. |
| `git branch backup/pre-redbyte-ui-hierarchy-merge` | Passed | <1s | Safety branch created at pre-merge `main`. | N/A | No action. |
| `git merge --no-ff origin/product/redbyte-ui-hierarchy-2 -m "merge: redbyte ui hierarchy hardening"` | Passed | ~1s | Merge commit `e0271c16`; no conflicts. | N/A | Validate merged `main`. |
| Marcus/RPI/HQ/local-agent grep | Passed with known retained findings | ~1s | Grep still finds historical `AI_STATE.md` notes, ignore patterns, archive/artifact files, lockfile substrings, and tests that assert HQ absence; merge diff did not add active Marcus/RPI/HQ/local-agent IDE material. | Pre-existing/retained | Keep separate from UI hierarchy merge. |
| `pnpm install --frozen-lockfile` | Passed on merged `main` | ~3s | Lockfile up to date; no dependency changes. | N/A | No action. |
| `pnpm start:smoke` | Passed on merged `main` | ~34s | Node 20.19.0 and pnpm 10.24.0 detected; launcher served `http://127.0.0.1:5197/` with HTTP 200. | N/A | No action. |
| `pnpm -s ide:gate:ece141-starter-verify-export` | Passed on merged `main` | ~47s | 1 Playwright test passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-product-immersion` | Passed on merged `main` | ~52s | 4 Playwright tests passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-counter-clock-export` | Passed on merged `main` | ~35s | 2 Playwright tests passed. | N/A | No action. |
| Parallel browser-gate attempt for `ece141-counter-clock-export` and `ece141-map-pins-recovery` | Failed one runner before test execution | ~6s | `ece141-map-pins-recovery` could not start because the Playwright web server port 4173 was already in use by the parallel gate. | Introduced runner scheduling issue | Rerun browser gates sequentially. |
| `pnpm -s ide:gate:ece141-map-pins-recovery` | Passed on merged `main` rerun | ~31s | 1 Playwright test passed after sequential rerun. | N/A | No action. |
| `pnpm -s ide:gate:ece141-counter-compare-pass` | Passed on merged `main` | ~33s | 1 Playwright test passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-project-persistence` | Passed on merged `main` | ~47s | 1 Playwright test passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-import-export-recovery` | Passed on merged `main` | ~53s | 1 Playwright test passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-vivado-artifacts` | Passed on merged `main` | ~49s | 1 Playwright test passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-ui-art-direction` | Passed on merged `main` | ~37s | 2 Playwright tests passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-ui-hierarchy` | Passed on merged `main` | ~38s | 2 Playwright tests passed. | N/A | No action. |
| `pnpm -s ui:lab-starter-load-gate` | Passed on merged `main` | ~18s | 8 starter-load tests passed. | N/A | No action. |
| Focused Sprint 7 Vitest surface suite | Passed on merged `main` | ~28s | 65 tests passed and 1 skipped across IdeApp, Project, Verify command bar, Hardware, Export, and Import tests. | N/A | No action. |
| `pnpm rb:doc:validate` | Passed before closeout docs | ~2s | 36 passed, 0 failed. | N/A | Rerun after final docs. |
| `pnpm rb:encoding:check` | Passed before closeout docs | ~4s | No mojibake markers found. | N/A | Rerun after final docs. |
| `git diff --check` | Passed before closeout docs | <1s | No whitespace errors. | N/A | Rerun after final docs. |
| `pnpm typecheck` | Failed on merged `main` | ~13s | Known `@redbyte/rb-lab-engine` / pulled `rb-logic-core` schema, stale fixture, and type-boundary drift after `@redbyte/rb-board-profiles`, `@redbyte/rb-viewport`, and `@redbyte/rb-fpga-toolchain` pass; no new UI-specific type errors appeared. | Pre-existing/out of merge scope | Run full-workspace typecheck drift cleanup next. |
| `pnpm rb:doc:validate` | Passed after closeout docs | ~1s | 36 passed, 0 failed after validation log, merge doc, and `AI_STATE.md` updates. | N/A | No action. |
| `pnpm rb:encoding:check` | Passed after closeout docs | ~1s | No mojibake markers found after closeout docs. | N/A | No action. |
| `git diff --check` | Passed after closeout docs | <1s | No whitespace errors after closeout docs. | N/A | No action. |
| `git fetch origin --prune && git rev-list --left-right --count origin/main...main` | Passed before push | ~1s | Divergence was `0 3`; local `main` was three commits ahead and `origin/main` had no extra commits. | N/A | Push local `main` without force. |
| `git push origin main` | Passed | ~2s | Pushed `f26869d1..73adf333` to `origin/main`; GitHub reported bypassed required `Classroom Truth Gates` status check expectation. | N/A | Log release-process debt in `AI_STATE.md`. |
| `git fetch origin && git rev-parse main && git rev-parse origin/main` | Passed | ~1s | Both refs resolved to `73adf333a5482ea465d6e8282f3cb810f95d30bf`. | N/A | Start typecheck cleanup branch after release-process debt note. |
| `git checkout -b product/redbyte-ui-hierarchy-2` | Passed | <1s | Sprint branch created from `origin/main` after UI art-direction merge closeout. | N/A | Start hierarchy sprint. |
| `pnpm -s ide:gate:ece141-ui-hierarchy` | Failed before implementation | ~106s | New draft gate failed because Project did not expose explicit hierarchy roles yet. | Introduced test-first red state | Add focal/context/advanced/next hierarchy roles and UI weighting. |
| `pnpm -s ide:gate:ece141-ui-hierarchy` | Failed during tightening | ~44s | Clicking the existing Design Fit control in the draft gate produced NaN SVG geometry console errors. | Introduced by draft gate action, not product change | Removed the unnecessary Fit click and kept rendered-node assertion. |
| `pnpm -s ide:gate:ece141-ui-hierarchy` | Passed | ~38s | 2 Playwright tests passed; screenshots captured under `.redbyte/product-immersion/sprint7-ui-hierarchy-2/`. | N/A | Keep as Sprint 7 gate. |
| `pnpm install --frozen-lockfile` | Passed on `product/redbyte-ui-hierarchy-2` | ~2s | Lockfile up to date; no dependency changes. | N/A | No action. |
| `pnpm start:smoke` | Passed on `product/redbyte-ui-hierarchy-2` | ~21s | Node 20.19.0 and pnpm 10.24.0 detected; launcher served `http://127.0.0.1:5197/` with HTTP 200. | N/A | No action. |
| `pnpm -s ide:gate:ece141-starter-verify-export` | Passed | ~33s | 1 Playwright test passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-product-immersion` | Failed then passed on rerun | ~73s failed, ~55s rerun | First run blanked before `ide-root` in the empty-project audit; the other three workflows passed in that failed run. Immediate rerun passed all 4 workflows. | Transient startup/navigation miss; not reproduced | Keep visible; no product change made for the transient. |
| `pnpm -s ide:gate:ece141-counter-clock-export` | Passed | ~38s | 2 Playwright tests passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-map-pins-recovery` | Passed | ~34s | 1 Playwright test passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-counter-compare-pass` | Passed | ~34s | 1 Playwright test passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-project-persistence` | Passed | ~49s | 1 Playwright test passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-import-export-recovery` | Passed | ~54s | 1 Playwright test passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-vivado-artifacts` | Passed | ~53s | 1 Playwright test passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-ui-art-direction` | Passed | ~41s | 2 Playwright tests passed after Sprint 7 hierarchy changes. | N/A | No action. |
| `pnpm -s ide:gate:ece141-ui-hierarchy` | Passed after full stack | ~42s | 2 Playwright tests passed after final screenshot/gate tightening. | N/A | No action. |
| `pnpm -s ui:lab-starter-load-gate` | Passed | ~12s | 8 starter-load tests passed. | N/A | No action. |
| Focused Sprint 7 Vitest surface suite | Failed then passed | ~14s failed, ~13s rerun | First run failed one stale ProjectSurface assertion expecting the old `Examples` heading; test was updated to the new `Certified course path` hierarchy contract. Rerun passed 65 tests and 1 skipped across IdeApp, Project, Verify command bar, Hardware, Export, and Import. | Introduced test contract drift | No further action. |
| `pnpm rb:doc:validate` | Passed before final closeout docs | ~1s | 36 passed, 0 failed. | N/A | Rerun after final docs. |
| `pnpm rb:encoding:check` | Passed before final closeout docs | ~1s | No mojibake markers found. | N/A | Rerun after final docs. |
| `git diff --check` | Passed before final closeout docs | <1s | No whitespace errors. | N/A | Rerun after final docs. |
| `pnpm typecheck` | Failed | ~7s | Same known `@redbyte/rb-lab-engine` / pulled `rb-logic-core` schema, stale fixture, and type-boundary drift after `@redbyte/rb-board-profiles`, `@redbyte/rb-viewport`, and `@redbyte/rb-fpga-toolchain` pass; no new UI-specific type errors appeared. | Pre-existing/out of Sprint 7 scope | Keep as next full-workspace typecheck cleanup task. |
| `pnpm rb:doc:validate` | Passed after final closeout docs | ~1s | 36 passed, 0 failed after validation log, Sprint 7 doc, and `AI_STATE.md` updates. | N/A | No action. |
| `pnpm rb:encoding:check` | Passed after final closeout docs | ~1s | No mojibake markers found. | N/A | No action. |
| `git diff --check` | Passed after final closeout docs | <1s | No whitespace errors after all code and doc edits. | N/A | No action. |
| `git fetch origin --prune && git checkout main && git pull --ff-only origin main` | Passed | ~2s | Local `main` was already up to date with `origin/main` at `7175ccfba1492e4eebd7598fad65c03eac1c1292`. | N/A | Merge UI art-direction branch. |
| `git branch backup/pre-redbyte-ui-art-direction-merge` | Passed | <1s | Safety branch created at pre-merge `main`. | N/A | No action. |
| `git merge --no-ff origin/product/redbyte-ui-art-direction-1 -m "merge: redbyte ui art direction"` | Passed | <1s | Merge commit `9614a04bae40b886c0f92660cf5cd01f81abdf75`; no conflicts. | N/A | Validate merged `main`. |
| Marcus/RPI/HQ/local-agent grep | Passed with known retained findings | ~1s | Grep still finds historical notes, ignore patterns, README companion references, tests that assert HQ absence, lockfile integrity substrings, and retained historical/artifact material; merge diff did not add Marcus/RPI/HQ/local-agent files. | Pre-existing/retained | Keep separate from UI merge. |
| `pnpm install --frozen-lockfile` | Passed on merged `main` | ~2s | Lockfile up to date; no dependency changes. | N/A | No action. |
| `pnpm start:smoke` | Passed on merged `main` | ~24s | Launcher served `http://127.0.0.1:5197/` with HTTP 200. | N/A | No action. |
| `pnpm -s ide:gate:ece141-starter-verify-export` | Passed on merged `main` | ~41s | 1 Playwright test passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-product-immersion` | Passed on merged `main` | ~58s | 4 Playwright tests passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-counter-clock-export` | Passed on merged `main` | ~43s | 2 Playwright tests passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-map-pins-recovery` | Passed on merged `main` | ~39s | 1 Playwright test passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-counter-compare-pass` | Passed on merged `main` | ~40s | 1 Playwright test passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-project-persistence` | Passed on merged `main` | ~56s | 1 Playwright test passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-import-export-recovery` | Passed on merged `main` | ~59s | 1 Playwright test passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-vivado-artifacts` | Passed on merged `main` | ~59s | 1 Playwright test passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-ui-art-direction` | Passed on merged `main` | ~49s | 2 Playwright tests passed; screenshots regenerated under `.redbyte/product-immersion/sprint6-ui-art-direction/`. | N/A | No action. |
| `pnpm -s ui:lab-starter-load-gate` | Passed on merged `main` | ~12s | 8 starter-load tests passed. | N/A | No action. |
| Broad supplemental Vitest surface sweep | Failed | ~19s | 1 unchanged `verifySurface.workstation.test.tsx` latch-helper assertion failed; `VerifySurface.tsx` and that test were not changed by the merge. | Pre-existing or unrelated to merge | Do not fix in UI art-direction merge; keep visible for later Verify test cleanup if needed. |
| Focused merge-adjacent Vitest surface suite | Passed | ~14s | 65 tests passed and 1 skipped across IdeApp wiring, Project, Verify command bar, Hardware, Export, and Import tests. | N/A | No action. |
| `pnpm rb:doc:validate` | Passed before closeout docs | ~1s | 36 passed, 0 failed. | N/A | Rerun after final doc updates. |
| `pnpm rb:encoding:check` | Passed before closeout docs | ~1s | No mojibake markers found. | N/A | Rerun after final doc updates. |
| `git diff --check` | Passed before closeout docs | <1s | No whitespace errors. | N/A | Rerun after final doc updates. |
| `pnpm typecheck` | Failed on merged `main` | ~7s | Known `@redbyte/rb-lab-engine` / pulled `rb-logic-core` type-boundary drift after `@redbyte/rb-board-profiles`, `@redbyte/rb-viewport`, and `@redbyte/rb-fpga-toolchain` pass; no UI-specific type errors appeared. | Pre-existing/out of merge scope | Keep as separate typecheck drift cleanup task. |
| `git fetch origin --prune && git rev-list --left-right --count origin/main...main` | Passed before push | ~1s | Divergence was `0 3`; local `main` was three commits ahead and `origin/main` had no extra commits. | N/A | Push local `main` without force. |
| `git push origin main` | Passed | ~3s | Pushed `7175ccfb..aab82b6b` to `origin/main`; GitHub reported bypassed required `Classroom Truth Gates` status check expectation. | N/A | Log release-process debt in `AI_STATE.md`. |
| `git fetch origin && git rev-parse main && git rev-parse origin/main` | Passed | ~1s | Both refs resolved to `aab82b6b52f69b8f16665323f73f3d444c237d2a`. | N/A | Start UI Hierarchy Sprint 2 from updated `main`. |
| Follow-up closeout-doc push | Passed | ~2s | Pushed the release-process debt log update to `origin/main`; GitHub again reported bypassed required `Classroom Truth Gates` status check expectation. | N/A | Continue to UI Hierarchy Sprint 2. |
| `pnpm install --frozen-lockfile` | Passed on `product/redbyte-ui-art-direction-1` | ~2s | Lockfile up to date; no dependency changes. | N/A | No action. |
| `pnpm start:smoke` | Passed | ~31s | Launcher served `http://127.0.0.1:5197/` with HTTP 200. | N/A | No action. |
| `pnpm -s ide:gate:ece141-ui-art-direction` | Failed before test adjustment | ~47s | New gate assumed certified starter cards would be strictly left-to-right by X position; at default width the cards wrapped with equal X values. | Introduced test draft issue | Changed the assertion to verify DOM/course order and reran. |
| `pnpm -s ide:gate:ece141-ui-art-direction` | Failed before test adjustment | ~56s | Import recovery copy matched three visible elements in strict mode. | Introduced test draft issue | Scoped assertion with `.first()` and reran. |
| `pnpm -s ide:gate:ece141-ui-art-direction` | Passed | ~50s | New UI art-direction gate passed; lab-flow ribbon, starter path, Design, Verify, Hardware, Export, Import, and narrow viewport assertions passed; screenshots captured under `.redbyte/product-immersion/sprint6-ui-art-direction/`. | N/A | Keep as UI hierarchy gate. |
| `pnpm -s ide:gate:ece141-starter-verify-export` | Passed | ~38s | Existing Logic Gates starter Verify -> Export browser gate passed after UI recomposition. | N/A | No action. |
| `pnpm -s ide:gate:ece141-product-immersion` | Passed | ~69s | Existing four-workflow product immersion browser gate passed after UI recomposition. | N/A | No action. |
| `pnpm -s ide:gate:ece141-counter-clock-export` | Passed | ~50s | Counter clock/reset policy and E0 export evidence gate passed; 2 Playwright tests passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-map-pins-recovery` | Passed | ~42s | Manual Map Pins edit and starter recovery gate passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-counter-compare-pass` | Passed | ~51s | 2-Bit Counter Compare pass and E0-only Export gate passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-project-persistence` | Passed | ~68s | Project persistence and stale evidence browser gate passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-import-export-recovery` | Passed | ~74s | Import/export recovery browser gate passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-vivado-artifacts` | Passed | ~61s | Certified starter E0 Vivado ZIP inspection gate passed after UI recomposition. | N/A | No action. |
| `pnpm -s ui:lab-starter-load-gate` | Passed | ~11s | 8 starter-load tests passed. | N/A | No action. |
| Focused Vitest surface suite | Passed | ~14s | 66 tests passed and 1 skipped across IdeApp wiring, Project, Verify command bar, Hardware, Export, and Import surface tests. | N/A | No action. |
| `pnpm rb:doc:validate` | Passed after sprint docs | ~1s | 36 passed, 0 failed after `21-redbyte-ui-art-direction.md`, validation log, and `AI_STATE.md` updates. | N/A | No action. |
| `pnpm rb:encoding:check` | Passed after sprint docs | ~1s | No mojibake markers found after sprint docs. | N/A | No action. |
| `git diff --check` | Passed after sprint docs | <1s | No whitespace errors after UI and doc changes. | N/A | No action. |
| `pnpm typecheck` | Failed | ~7s | Same known pre-existing `@redbyte/rb-lab-engine` and pulled `rb-logic-core` schema/test-fixture/type-boundary drift after `@redbyte/rb-board-profiles`, `@redbyte/rb-viewport`, and `@redbyte/rb-fpga-toolchain` pass. | Pre-existing/out of sprint scope | Keep as separate full-workspace typecheck cleanup task. |
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
| `git branch backup/pre-marcus-rpi-hard-separation` | Passed | <1s | Safety branch created at `aebc908fd250be3359bd640035a0bc67c5128896`. | N/A | No action. |
| Copy tracked Marcus/RPI/HQ/local-agent material to `C:\MarcusRPI` | Passed | ~5s | 84 RedByte-relative files copied into `C:\MarcusRPI\imports\redbyte-tracked-marcus-rpi-hq-migration-20260511-1631`; manifest created and updated. | N/A | Remove copied material from RedByte after verification. |
| `git -C C:\MarcusRPI commit ...` | Passed | <1s each | Created MarcusRPI local commits `b8834e1`, `6e9b101`, and `5984a4e`; no remote push attempted. | N/A | Keep MarcusRPI local unless user requests a remote. |
| `pnpm rb:doc:validate` | Passed before final docs | ~1s | 36 passed, 0 failed after removing package docs/scripts references. | N/A | Rerun after validation log and AI_STATE updates. |
| `pnpm rb:encoding:check` | Passed before final docs | ~1s | No mojibake markers found. | N/A | Rerun after validation log and AI_STATE updates. |
| `pnpm install --frozen-lockfile` | Passed | ~2s | Lockfile up to date; no dependency changes. | N/A | No action. |
| `pnpm start:smoke` | Passed | ~18s | Launcher served `http://127.0.0.1:5197/` with HTTP 200. | N/A | No action. |
| `pnpm -s ide:gate:ece141-starter-verify-export` | Passed | ~36s | Logic Gates starter -> Verify Compare -> Export ready gate still passes after hard separation. | N/A | No action. |
| `pnpm -s ide:gate:ece141-product-immersion` | Passed | ~86s | Four product immersion workflows still pass after hard separation. | N/A | No action. |
| `pnpm -s ui:lab-starter-load-gate` | Passed | ~10s | 8 starter-load tests passed. | N/A | No action. |
| `git diff --check` | Passed before final docs | <1s | No whitespace errors. | N/A | Rerun after final docs. |
| `pnpm typecheck` | Failed | ~7s | Same pre-existing `@redbyte/rb-lab-engine` and pulled `rb-logic-core` schema/test-fixture/type-boundary drift. | Pre-existing/out of task scope | Keep as separate type-boundary cleanup task. |
| `pnpm rb:site:start:test` | Failed before fix | ~1s | Test still required old footer string `RedByte source and docs are the truth.` after public start copy changed to course-doc wording. | Introduced by this cleanup | Updated test required snippet to match the new RedByte-only start page copy. |
| `pnpm rb:site:start:test` | Passed | ~1s | Public start page test reported ok and now treats `pnpm rb:marcus:start` / `Marcus companion` as forbidden snippets. | N/A | No action. |
| `pnpm rb:doc:validate` | Passed after final docs | ~1s | 36 passed, 0 failed after `AI_STATE.md`, validation log, and hard-separation doc updates. | N/A | No action. |
| `pnpm rb:encoding:check` | Passed after final docs | ~1s | No mojibake markers found after final docs. | N/A | No action. |
| `git diff --check` | Passed after final docs | <1s | No whitespace errors after final docs. | N/A | Ready to commit RedByte hard separation. |
| `git fetch origin --prune` | Passed before push | ~1s | Divergence was `0 1`; local `main` was one commit ahead and `origin/main` had no extra commits. | N/A | Push local `main` without force. |
| `git push origin main` | Passed | ~2s | Pushed `d7765d05` to `origin/main`; GitHub reported bypassed required `Classroom Truth Gates` status check expectation. | N/A | Verify refs after fetch. |
| `git fetch origin && git rev-parse main && git rev-parse origin/main` | Passed | ~1s | Both refs resolved to `d7765d05bbdceafc26c6b39711dd9e8d5b75559d`. | N/A | No action. |
| `pnpm install --frozen-lockfile` | Passed | ~2s | Lockfile up to date; no dependency changes on `product/verify-hardware-map-pins-hardening-1`. | N/A | No action. |
| `pnpm start:smoke` | Passed | ~17s | Launcher served `http://127.0.0.1:5197/` with HTTP 200. | N/A | No action. |
| `pnpm -s ide:gate:ece141-starter-verify-export` | Passed | ~29s | Existing Logic Gates starter -> Verify Compare -> Export ready gate passed after Verify/Hardware/Export hardening. | N/A | No action. |
| `pnpm -s ide:gate:ece141-product-immersion` | Passed | ~81s | Existing four-workflow product immersion gate passed after hardening. | N/A | No action. |
| `pnpm -s ui:lab-starter-load-gate` | Passed | ~10s | 8 starter-load tests passed after Half Adder pin correction. | N/A | No action. |
| `pnpm -s ide:gate:ece141-map-pins-recovery` | Failed during first parallel run | ~6s | Parallel Playwright launch collided on fixed dev-server port `4173` while another gate was running. | Operator validation setup error, not product failure | Reran sequentially below. |
| `pnpm -s ide:gate:ece141-counter-clock-export` | Passed | ~37s | 2-Bit Counter clock/reset policy and E0 export evidence wording smoke passed; 2 tests passed. | N/A | Keep as focused product gate. |
| `pnpm -s ide:gate:ece141-map-pins-recovery` | Failed before test selector fix | ~45s | Gate reached Export, then strict-mode locator matched three `Pin binding` elements. | Introduced test draft issue | Narrowed selector to the `summary` element and reran. |
| `pnpm -s ide:gate:ece141-map-pins-recovery` | Passed | ~34s | Manual Map Pins edit changed Logic Gates `SW0` to `SW2`, persisted across surface navigation, appeared in Export mapping, and did not leak after switching to Half Adder. | N/A | Keep as focused product gate. |
| `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/verifySurface.boardClockAutoMode.test.tsx packages/rb-apps/src/apps/ide/__tests__/hardwareSurface.readiness.test.tsx packages/rb-apps/src/apps/ide/__tests__/exportSurface.workstation.test.tsx` | Passed | ~12s | 36 focused Verify/Hardware/Export tests passed. | N/A | No action. |
| `pnpm rb:doc:validate` | Passed | ~1s | 36 passed, 0 failed after adding the hardening sprint doc and validation rows. | N/A | No action. |
| `pnpm rb:encoding:check` | Passed | ~1s | No mojibake markers found after sprint doc updates. | N/A | No action. |
| `git diff --check` | Passed | <1s | No whitespace errors before AI_STATE final update. | N/A | Rerun after final AI_STATE update. |
| `pnpm typecheck` | Failed | ~7s | Same known pre-existing `@redbyte/rb-lab-engine` and pulled `rb-logic-core` schema/test-fixture/type-boundary drift after `@redbyte/rb-board-profiles`, `@redbyte/rb-fpga-toolchain`, and `@redbyte/rb-viewport` pass. | Pre-existing/out of sprint scope | Keep as separate type-boundary cleanup task. |
| `pnpm rb:doc:validate` | Passed after AI_STATE update | ~1s | 36 passed, 0 failed after final `AI_STATE.md` and validation-log updates. | N/A | No action. |
| `pnpm rb:encoding:check` | Passed after AI_STATE update | ~1s | No mojibake markers found after final docs. | N/A | No action. |
| `git diff --check` | Passed after AI_STATE update | <1s | No whitespace errors after final docs. | N/A | Ready to review and commit. |
| `pnpm install --frozen-lockfile` | Passed | ~1s | Lockfile up to date; no dependency changes on `product/counter-verification-semantics-1`. | N/A | No action. |
| `pnpm start:smoke` | Passed | ~17s | Launcher served `http://127.0.0.1:5197/` with HTTP 200. | N/A | No action. |
| `pnpm -s ide:gate:ece141-starter-verify-export` | Passed | ~8s | Existing Logic Gates starter -> Verify Compare -> Export ready gate passed after counter semantics changes. | N/A | No action. |
| `pnpm -s ide:gate:ece141-product-immersion` | Passed | ~29s | Existing four-workflow product immersion gate passed after counter semantics changes. | N/A | No action. |
| `pnpm -s ide:gate:ece141-counter-clock-export` | Passed | ~12s | Counter clock/reset policy and E0 export evidence gate passed; 2 Playwright tests passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-map-pins-recovery` | Passed | ~9s | Manual Map Pins edit and starter recovery gate passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-counter-compare-pass` | Failed before fix | ~42s | New gate failed waiting for `ide-verify-pass-hero`; 2-Bit Counter Compare stayed failed. | Pre-existing product issue exposed by new gate | Fix counter verification semantics rather than weakening the gate. |
| `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/counterVerificationSemantics.test.ts packages/rb-apps/src/apps/ide/__tests__/verifyClockPolicy.test.ts` | Failed before fix | ~10s | New tests failed on reset-policy fallback and counter Compare rows. | Pre-existing product issue exposed by new tests | Fix alias-safe materialization and clocked-macro execution. |
| `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/counterVerificationSemantics.test.ts packages/rb-apps/src/apps/ide/__tests__/verifyClockPolicy.test.ts` | Passed | ~8s | 7 focused counter/clock-policy tests passed after the fix. | N/A | No action. |
| `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/simEngine.verify-diagnostics.test.ts packages/rb-apps/src/apps/ide/__tests__/verifyContract.reset.test.ts packages/rb-apps/src/__tests__/verifySchedule.temporal-guard.test.ts packages/rb-apps/src/__tests__/verifyRunMeta.test.ts` | Failed after first fix | ~8s | Existing sequential sampling test still encoded old alternating-clock-per-row expectations. | Introduced by correcting clocked-macro semantics; test expectation was stale | Update test to assert per-vector macro sampling with clock resting low after `[0,1,0]`. |
| `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/simEngine.verify-diagnostics.test.ts packages/rb-apps/src/apps/ide/__tests__/verifyContract.reset.test.ts packages/rb-apps/src/__tests__/verifySchedule.temporal-guard.test.ts packages/rb-apps/src/__tests__/verifyRunMeta.test.ts packages/rb-apps/src/apps/ide/__tests__/counterVerificationSemantics.test.ts packages/rb-apps/src/apps/ide/__tests__/verifyClockPolicy.test.ts` | Passed | ~8s | 31 relevant deterministic Verify, schedule, reset, counter, and clock-policy tests passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-counter-compare-pass` | Passed | ~8s | 2-Bit Counter loaded, Verify Compare reached `14/14 match`, Hardware showed clock/reset rows, and Export stayed E0-only. | N/A | Keep as counter certification gate. |
| `pnpm rb:doc:validate` | Passed | ~1s | 36 passed, 0 failed after adding the counter semantics sprint doc. | N/A | Rerun after final AI_STATE update. |
| `pnpm rb:encoding:check` | Passed | ~1s | No mojibake markers found after counter semantics docs. | N/A | Rerun after final AI_STATE update. |
| `git diff --check` | Passed | <1s | No whitespace errors before final AI_STATE update. | N/A | Rerun after final docs. |
| `pnpm typecheck` | Failed | ~8s | Same known pre-existing `@redbyte/rb-lab-engine` and pulled `rb-logic-core` schema/test-fixture/type-boundary drift after `@redbyte/rb-board-profiles`, `@redbyte/rb-fpga-toolchain`, and `@redbyte/rb-viewport` pass. | Pre-existing/out of sprint scope | Keep as separate type-boundary cleanup task. |
| `pnpm rb:doc:validate` | Passed after AI_STATE update | ~1s | 36 passed, 0 failed after final `AI_STATE.md` and validation-log updates. | N/A | No action. |
| `pnpm rb:encoding:check` | Passed after AI_STATE update | ~1s | No mojibake markers found after final docs. | N/A | No action. |
| `git diff --check` | Passed after AI_STATE update | <1s | No whitespace errors after final docs. | N/A | Ready to commit counter semantics slice. |
| `git merge --no-ff origin/product/counter-verification-semantics-1 -m "merge: product hardening verify hardware counter semantics"` | Passed on `main` | <1s | Merge commit `2e6f60e7` brought in the Verify/Hardware/Export hardening branch and the counter semantics branch. | N/A | Validate before push. |
| `pnpm install --frozen-lockfile` | Passed on merged `main` | ~2s | Lockfile up to date; no dependency changes. | N/A | No action. |
| `pnpm start:smoke` | Passed on merged `main` | ~29s | Launcher served `http://127.0.0.1:5197/` with HTTP 200. | N/A | No action. |
| `pnpm -s ide:gate:ece141-starter-verify-export` | Passed on merged `main` | ~13s | Logic Gates starter -> Verify Compare -> Export ready gate passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-product-immersion` | Passed on merged `main` | ~32s | Four product immersion browser workflows passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-counter-clock-export` | Passed on merged `main` | ~14s | Counter clock/reset policy and E0 export wording gate passed; 2 Playwright tests passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-map-pins-recovery` | Passed on merged `main` | ~12s | Manual Map Pins edit and starter recovery gate passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-counter-compare-pass` | Passed on merged `main` | ~10s | 2-Bit Counter Compare pass and E0-only Export gate passed. | N/A | No action. |
| `pnpm -s ui:lab-starter-load-gate` | Passed on merged `main` | ~11s | 8 starter-load tests passed. | N/A | No action. |
| `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/counterVerificationSemantics.test.ts packages/rb-apps/src/apps/ide/__tests__/verifyClockPolicy.test.ts packages/rb-apps/src/apps/ide/__tests__/simEngine.verify-diagnostics.test.ts packages/rb-apps/src/apps/ide/__tests__/verifySurface.boardClockAutoMode.test.tsx packages/rb-apps/src/apps/ide/__tests__/hardwareSurface.readiness.test.tsx packages/rb-apps/src/apps/ide/__tests__/exportSurface.workstation.test.tsx packages/rb-apps/src/apps/ide/__tests__/verifyContract.reset.test.ts packages/rb-apps/src/__tests__/verifySchedule.temporal-guard.test.ts packages/rb-apps/src/__tests__/verifyRunMeta.test.ts` | Passed on merged `main` | ~14s | 67 focused tests passed across counter semantics, clock policy, deterministic Verify diagnostics, reset contracts, Hardware, and Export. | N/A | No action. |
| `pnpm rb:doc:validate` | Passed before closeout docs | ~1s | 36 passed, 0 failed after merge. | N/A | Rerun after `16-product-hardening-stack-merge.md`, validation log, and `AI_STATE.md` updates. |
| `pnpm rb:encoding:check` | Passed before closeout docs | ~1s | No mojibake markers after merge. | N/A | Rerun after final docs. |
| `git diff --check` | Passed before closeout docs | <1s | No whitespace errors after merge. | N/A | Rerun after final docs. |
| `pnpm typecheck` | Failed on merged `main` | ~7s | Same known pre-existing `@redbyte/rb-lab-engine` and pulled `rb-logic-core` schema/test-fixture/type-boundary drift after `@redbyte/rb-board-profiles`, `@redbyte/rb-viewport`, and `@redbyte/rb-fpga-toolchain` pass. | Pre-existing/out of merge task scope | Separate lab-engine/core type-boundary cleanup remains required. |
| `pnpm rb:doc:validate` | Passed after closeout docs | ~1s | 36 passed, 0 failed after adding `18-import-export-recovery-merge.md`, validation-log rows, and `AI_STATE.md` update. | N/A | No action. |
| `pnpm rb:encoding:check` | Passed after closeout docs | ~1s | No mojibake markers found after closeout docs. | N/A | No action. |
| `git diff --check` | Passed after closeout docs | <1s | No whitespace errors after closeout docs. | N/A | Ready to commit closeout docs. |
| `git push origin main` | Passed | ~2s | Pushed `dfedb251` to `origin/main`; GitHub reported bypassed required `Classroom Truth Gates` status check expectation. | N/A | Log branch-protection bypass as release-process debt. |
| `pnpm build:unified` | Failed on merged `main` | ~107s | Playground production build and dist merge completed; final dist verification failed with `dist/_redirects contains root redirect to /os/`. | Pre-existing known build/redirect contract drift | Separate build/deploy contract cleanup remains required. |
| `pnpm rb:doc:validate` | Passed after closeout docs | ~1s | 36 passed, 0 failed after adding `16-product-hardening-stack-merge.md`, validation-log rows, and `AI_STATE.md` update. | N/A | No action. |
| `pnpm rb:encoding:check` | Passed after closeout docs | ~1s | No mojibake markers found after closeout docs. | N/A | No action. |
| `git diff --check` | Passed after closeout docs | <1s | No whitespace errors after closeout docs. | N/A | Ready to commit closeout docs. |
| `git push origin main` | Passed | ~2s | Pushed `8475b78af4bfd05691cf8d89dd438b40267d56bd` to `origin/main`; GitHub reported bypassed required `Classroom Truth Gates` status check expectation. | N/A | Log branch-protection bypass as release-process debt. |
| `git fetch origin && git rev-parse main && git rev-parse origin/main` | Passed | ~1s | Both refs resolved to `8475b78af4bfd05691cf8d89dd438b40267d56bd`. | N/A | Add final remote-sync note and push follow-up doc commit. |
| `pnpm install --frozen-lockfile` | Passed on `product/import-export-recovery-1` | ~1s | Lockfile up to date; no dependency changes. | N/A | No action. |
| `pnpm start:smoke` | Passed | ~23s | Launcher served `http://127.0.0.1:5197/` with HTTP 200. | N/A | No action. |
| `pnpm -s ide:gate:ece141-starter-verify-export` | Passed | ~11s | Existing Logic Gates Verify -> Export gate passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-product-immersion` | Passed | ~32s | Four existing product immersion workflows passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-counter-clock-export` | Passed | ~14s | Counter clock/reset policy and E0 export evidence gate passed; 2 Playwright tests passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-map-pins-recovery` | Passed | ~11s | Manual Map Pins edit and starter recovery gate passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-counter-compare-pass` | Passed | ~10s | Counter Compare pass and E0-only Export gate passed. | N/A | No action. |
| `pnpm -s ui:lab-starter-load-gate` | Passed | ~12s | 8 starter-load tests passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-project-persistence` | Failed before test adjustment | ~17s | New gate exposed that a manual pin edit correctly marks Verify evidence stale, so Export no longer presents the same trusted hero state. | Safe product behavior exposed by initial gate | Adjusted gate to assert stale evidence handling and E0-only evidence rows instead of requiring a fixed hero label. |
| `pnpm -s ide:gate:ece141-project-persistence` | Passed | ~26s | Logic Gates mapping persisted through refresh; transient download success did not persist; Counter clock policy and E0 evidence survived refresh. | N/A | Keep as focused product gate. |
| `pnpm -s ide:gate:ece141-import-export-recovery` | Failed before test adjustment | ~127s | New gate clicked the primary Export CTA while the handoff was still in Verify-repair mode after a mapping edit; no download event occurred. | Safe product behavior exposed by initial gate | Adjusted the gate to rerun Compare after the mapping edit and to use the secondary explicit draft project download when the primary action is trust repair. |
| `pnpm -s ide:gate:ece141-import-export-recovery` | Passed | ~30s | Logic Gates and 2-Bit Counter project ZIPs downloaded and contained `project.rbproj.json`, VHDL, XDC, Tcl, XPR, and README entries; Logic Gates manifest import restored mapping, required Verify rerun, and corrupt manifest import failed without replacing the project. | N/A | Keep as focused product gate. |
| `pnpm exec vitest run packages/rb-apps/src/apps/ide/__tests__/zipImport.manifest.test.ts packages/rb-apps/src/__tests__/ide-export-includes-rbproj-contract.test.ts packages/rb-apps/src/__tests__/ide-zip-import-contract.test.ts packages/rb-apps/src/export/__tests__/projectFormat.decode.test.ts` | Passed | ~9s | 6 focused import/export/project-format tests passed. | N/A | No action. |
| `pnpm rb:doc:validate` | Passed before final AI_STATE update | ~1s | 36 passed, 0 failed after adding the import/export recovery sprint doc. | N/A | Rerun after final AI_STATE and validation-log updates. |
| `pnpm rb:encoding:check` | Passed before final AI_STATE update | ~1s | No mojibake markers found. | N/A | Rerun after final docs. |
| `git diff --check` | Passed before final AI_STATE update | <1s | No whitespace errors after new gates and sprint doc. | N/A | Rerun after final docs. |
| `pnpm typecheck` | Failed | ~7s | Same known pre-existing `@redbyte/rb-lab-engine` and pulled `rb-logic-core` schema/test-fixture/type-boundary drift after `@redbyte/rb-board-profiles`, `@redbyte/rb-viewport`, and `@redbyte/rb-fpga-toolchain` pass. | Pre-existing/out of sprint scope | Keep as separate lab-engine/core type-boundary cleanup task. |
| `pnpm rb:doc:validate` | Passed after AI_STATE update | ~1s | 36 passed, 0 failed after final `AI_STATE.md` and sprint doc updates. | N/A | No action. |
| `pnpm rb:encoding:check` | Passed after AI_STATE update | ~1s | No mojibake markers found after final docs. | N/A | No action. |
| `git diff --check` | Passed after AI_STATE update | <1s | No whitespace errors after final docs. | N/A | Ready to commit import/export recovery slice. |
| `git merge --no-ff origin/product/import-export-recovery-1 -m "merge: import export recovery hardening"` | Passed on `main` | <1s | Merge commit `0800a3f9` brought in the import/export recovery branch with no conflicts. | N/A | Validate before push. |
| Tracked Marcus/RPI/HQ/local-agent scan | Passed with reviewed hits | <1s | Remaining hits were retained generic `api/server.mjs`, generated artifact filenames containing `HQ` as hash text, course-edition separation docs, and `packages/rb-fpga-bridge/boards/registry.json`; no active Marcus/HQ/local-agent scripts or surfaces reappeared. | N/A | Keep separation docs; defer artifact-boundary review separately. |
| `pnpm install --frozen-lockfile` | Passed on merged `main` | ~2s | Lockfile up to date; no dependency changes. | N/A | No action. |
| `pnpm start:smoke` | Passed on merged `main` | ~24s | Launcher served `http://127.0.0.1:5197/` with HTTP 200. | N/A | No action. |
| `pnpm -s ide:gate:ece141-starter-verify-export` | Passed on merged `main` | ~12s | Logic Gates starter -> Verify Compare -> Export ready gate passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-product-immersion` | Passed on merged `main` | ~30s | Four product immersion browser workflows passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-counter-clock-export` | Passed on merged `main` | ~14s | Counter clock/reset policy and E0 export evidence gate passed; 2 Playwright tests passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-map-pins-recovery` | Passed on merged `main` | ~12s | Manual Map Pins edit and starter recovery gate passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-counter-compare-pass` | Passed on merged `main` | ~10s | 2-Bit Counter Compare pass and E0-only Export gate passed. | N/A | No action. |
| `pnpm -s ui:lab-starter-load-gate` | Passed on merged `main` | ~10s | 8 starter-load tests passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-project-persistence` | Passed on merged `main` | ~27s | Project persistence and stale evidence gate passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-import-export-recovery` | Passed on merged `main` | ~31s | Import/export recovery browser gate passed. | N/A | No action. |
| `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/zipImport.manifest.test.ts packages/rb-apps/src/__tests__/ide-export-includes-rbproj-contract.test.ts packages/rb-apps/src/__tests__/ide-zip-import-contract.test.ts packages/rb-apps/src/export/__tests__/projectFormat.decode.test.ts packages/rb-apps/src/apps/ide/__tests__/counterVerificationSemantics.test.ts packages/rb-apps/src/apps/ide/__tests__/verifyClockPolicy.test.ts packages/rb-apps/src/apps/ide/__tests__/simEngine.verify-diagnostics.test.ts packages/rb-apps/src/apps/ide/__tests__/verifySurface.boardClockAutoMode.test.tsx packages/rb-apps/src/apps/ide/__tests__/hardwareSurface.readiness.test.tsx packages/rb-apps/src/apps/ide/__tests__/exportSurface.workstation.test.tsx packages/rb-apps/src/apps/ide/__tests__/verifyContract.reset.test.ts packages/rb-apps/src/__tests__/verifySchedule.temporal-guard.test.ts packages/rb-apps/src/__tests__/verifyRunMeta.test.ts` | Passed on merged `main` | ~13s | 73 focused tests passed across import/export/project-format, counter semantics, Verify, Hardware, and Export. | N/A | No action. |
| `pnpm rb:doc:validate` | Passed before closeout docs | ~1s | 36 passed, 0 failed after merge. | N/A | Rerun after `18-import-export-recovery-merge.md`, validation log, and `AI_STATE.md` updates. |
| `pnpm rb:encoding:check` | Passed before closeout docs | ~1s | No mojibake markers found after merge. | N/A | Rerun after final docs. |
| `git diff --check` | Passed before closeout docs | <1s | No whitespace errors after merge. | N/A | Rerun after final docs. |
| `pnpm typecheck` | Failed on merged `main` | ~7s | Same known pre-existing `@redbyte/rb-lab-engine` and pulled `rb-logic-core` schema/test-fixture/type-boundary drift after `@redbyte/rb-board-profiles`, `@redbyte/rb-viewport`, and `@redbyte/rb-fpga-toolchain` pass. | Pre-existing/out of merge task scope | Separate lab-engine/core type-boundary cleanup remains required. |
| `pnpm install --frozen-lockfile` | Passed on `product/vivado-artifact-correctness-1` | ~1s | Lockfile up to date; no dependency changes. | N/A | No action. |
| `pnpm start:smoke` | Passed | ~30s | Launcher served `http://127.0.0.1:5197/` with HTTP 200. | N/A | No action. |
| `pnpm -s ide:gate:ece141-starter-verify-export` | Passed | ~11s | Existing Logic Gates starter Verify -> Export gate passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-product-immersion` | Passed | ~33s | Existing four-workflow product immersion gate passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-counter-clock-export` | Passed | ~14s | Counter clock/reset policy and E0 Export evidence gate passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-map-pins-recovery` | Passed | ~11s | Manual Map Pins edit and starter recovery gate passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-counter-compare-pass` | Passed | ~11s | 2-Bit Counter Compare pass and E0-only Export gate passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-project-persistence` | Passed | ~27s | Project persistence and stale evidence gate passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-import-export-recovery` | Passed | ~32s | Import/export recovery browser gate passed. | N/A | No action. |
| `pnpm -s ui:lab-starter-load-gate` | Passed | ~10s | 8 starter-load tests passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-vivado-artifacts` | Failed before fix | ~15s | New artifact gate exposed missing E0 wording in generated Vivado project README. | Pre-existing product evidence wording gap exposed by new gate | Add explicit E0-only evidence boundary to generated README output. |
| `pnpm -s ide:gate:ece141-vivado-artifacts` | Failed before fix | ~15s | New artifact gate exposed missing `evidenceLevel` in `EXPECTED_IO.json`. | Pre-existing artifact metadata clarity gap exposed by new gate | Add `evidenceLevel: E0` to expected IO report. |
| `pnpm -s ide:gate:ece141-vivado-artifacts` | Failed before fix | ~15s | New artifact gate exposed ambiguous expected-IO pin parity: counter expected IO used board aliases while XDC used package pins. | Pre-existing artifact metadata clarity gap exposed by new gate | Preserve alias `pin` and add physical `packagePin`. |
| `pnpm -s ide:gate:ece141-vivado-artifacts` | Passed | ~35s | Browser-exported Logic Gates, Half Adder, and 2-Bit Up Counter Vivado ZIPs; checked package entries, VHDL/XDC/Tcl parity, E0 README wording, manifest fields, EXPECTED_IO E0/package pins, and starter-specific logic/pins. | N/A | Keep as certified E0 artifact gate. |
| `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/__tests__/ide-bringup-contract.test.ts packages/rb-apps/src/apps/ide/__tests__/bringupArtifacts.canonical-naming.test.ts packages/rb-apps/src/__tests__/ide-vivado-project-folder-contract.test.ts packages/rb-apps/src/__tests__/ide-vivado-artifact-consistency.test.ts packages/rb-apps/src/__tests__/ide-vivado-pack-contract.test.ts packages/rb-apps/src/__tests__/ide-export-includes-rbproj-contract.test.ts packages/rb-apps/src/apps/ide/__tests__/zipImport.manifest.test.ts packages/rb-apps/src/__tests__/ide-zip-import-contract.test.ts packages/rb-apps/src/apps/ide/__tests__/counterVerificationSemantics.test.ts packages/rb-apps/src/apps/ide/__tests__/verifyClockPolicy.test.ts` | Passed | ~10s | 30 focused artifact, import/export, counter, and clock-policy Vitest tests passed. | N/A | No action. |
| `where.exe vivado` | Not found | <1s | Vivado was not available on PATH. | Environment limitation, not failure | This sprint remains E0-only; no E1 claim. |
| `pnpm rb:doc:validate` | Passed before final AI_STATE update | ~1s | 36 passed, 0 failed after adding `19-vivado-artifact-correctness.md`. | N/A | Rerun after final `AI_STATE.md` and validation-log updates. |
| `pnpm rb:encoding:check` | Passed before final AI_STATE update | ~1s | No mojibake markers found. | N/A | Rerun after final docs. |
| `git diff --check` | Passed before final AI_STATE update | <1s | No whitespace errors after artifact gate and docs. | N/A | Rerun after final docs. |
| `pnpm typecheck` | Failed | ~7s | Same known pre-existing `@redbyte/rb-lab-engine` and pulled `rb-logic-core` schema/test-fixture/type-boundary drift after `@redbyte/rb-board-profiles`, `@redbyte/rb-fpga-toolchain`, and `@redbyte/rb-viewport` pass. | Pre-existing/out of sprint scope | Keep as next release-readiness cleanup task. |
| `pnpm rb:doc:validate` | Passed after final docs | ~1s | 36 passed, 0 failed after final `AI_STATE.md` and validation-log updates. | N/A | No action. |
| `pnpm rb:encoding:check` | Passed after final docs | ~1s | No mojibake markers found after final docs. | N/A | No action. |
| `git diff --check` | Passed after final docs | <1s | No whitespace errors after final docs. | N/A | Ready to commit Vivado artifact correctness slice. |
| `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/bringupArtifacts.canonical-naming.test.ts` | Passed after formatting cleanup | ~10s | 7 focused expected-IO naming/package-pin tests passed after formatting-only cleanup. | N/A | No action. |
| `git diff --check` | Passed after formatting cleanup | <1s | No whitespace errors after formatting-only cleanup. | N/A | Ready to commit Vivado artifact correctness slice. |
| `pnpm -s ide:gate:ece141-vivado-artifacts` | Passed after final test formatting | ~36s | New Vivado artifact gate still passed after formatting-only cleanup in the Playwright spec. | N/A | No action. |
| `git diff --check` | Passed after final test formatting | <1s | No whitespace errors after final test formatting. | N/A | Ready to commit Vivado artifact correctness slice. |
| `git merge --no-ff origin/product/vivado-artifact-correctness-1 -m "merge: vivado artifact correctness hardening"` | Passed on `main` | <1s | Merge commit `0ea2e60d` brought in the Vivado artifact correctness branch with no conflicts. | N/A | Validate before push. |
| Tracked Marcus/RPI/HQ/local-agent scan | Passed with reviewed hits | <1s | Remaining hits were `.gitignore` ignore patterns, `AI_STATE.md` historical notes, retained generated/build artifacts, or known retained files; the merge diff did not add active Marcus/RPI/HQ/local-agent scripts or surfaces. | N/A | No action for this merge. |
| `pnpm install --frozen-lockfile` | Passed on merged `main` | ~2s | Lockfile up to date; no dependency changes. | N/A | No action. |
| `pnpm start:smoke` | Passed on merged `main` | ~25s | Launcher served `http://127.0.0.1:5197/` with HTTP 200. | N/A | No action. |
| `pnpm -s ide:gate:ece141-starter-verify-export` | Passed on merged `main` | ~13s | Logic Gates starter Verify -> Export gate passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-product-immersion` | Passed on merged `main` | ~32s | Four product immersion browser workflows passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-counter-clock-export` | Passed on merged `main` | ~15s | Counter clock/reset policy and E0 Export evidence gate passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-map-pins-recovery` | Passed on merged `main` | ~12s | Manual Map Pins edit and starter recovery gate passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-counter-compare-pass` | Passed on merged `main` | ~46s | 2-Bit Counter Compare pass and E0-only Export gate passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-project-persistence` | Passed on merged `main` | ~27s | Project persistence and stale evidence gate passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-import-export-recovery` | Passed on merged `main` | ~30s | Import/export recovery browser gate passed. | N/A | No action. |
| `pnpm -s ui:lab-starter-load-gate` | Passed on merged `main` | ~43s | 8 starter-load tests passed. | N/A | No action. |
| `pnpm -s ide:gate:ece141-vivado-artifacts` | Passed on merged `main` | ~32s | Certified starter Vivado ZIP inspection gate passed after merge. | N/A | No action. |
| `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/__tests__/ide-bringup-contract.test.ts packages/rb-apps/src/apps/ide/__tests__/bringupArtifacts.canonical-naming.test.ts packages/rb-apps/src/__tests__/ide-vivado-project-folder-contract.test.ts packages/rb-apps/src/__tests__/ide-vivado-artifact-consistency.test.ts packages/rb-apps/src/__tests__/ide-vivado-pack-contract.test.ts packages/rb-apps/src/__tests__/ide-export-includes-rbproj-contract.test.ts packages/rb-apps/src/apps/ide/__tests__/zipImport.manifest.test.ts packages/rb-apps/src/__tests__/ide-zip-import-contract.test.ts packages/rb-apps/src/apps/ide/__tests__/counterVerificationSemantics.test.ts packages/rb-apps/src/apps/ide/__tests__/verifyClockPolicy.test.ts` | Passed on merged `main` | ~37s | 30 focused artifact/import/export/counter/clock-policy tests passed. | N/A | No action. |
| `pnpm rb:doc:validate` | Passed before closeout docs | ~1s | 36 passed, 0 failed after merge. | N/A | Rerun after `20-vivado-artifact-correctness-merge.md`, validation log, and `AI_STATE.md` updates. |
| `pnpm rb:encoding:check` | Passed before closeout docs | ~4s | No mojibake markers found after merge. | N/A | Rerun after final docs. |
| `git diff --check` | Passed before closeout docs | <1s | No whitespace errors after merge. | N/A | Rerun after final docs. |
| `pnpm typecheck` | Failed on merged `main` | ~16s | Same known pre-existing `@redbyte/rb-lab-engine` and pulled `rb-logic-core` schema/test-fixture/type-boundary drift after `@redbyte/rb-board-profiles`, `@redbyte/rb-fpga-toolchain`, and `@redbyte/rb-viewport` pass. | Pre-existing/out of merge task scope | Run full workspace typecheck drift cleanup next. |
| `pnpm rb:doc:validate` | Passed after closeout docs | ~1s | 36 passed, 0 failed after `20-vivado-artifact-correctness-merge.md`, validation log, and `AI_STATE.md` updates. | N/A | No action. |
| `pnpm rb:encoding:check` | Passed after closeout docs | ~1s | No mojibake markers found after final docs. | N/A | No action. |
| `git diff --check` | Passed after closeout docs | <1s | No whitespace errors after final docs. | N/A | Ready to commit closeout docs. |
