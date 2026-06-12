# RedByte Backbone Reconciliation Audit

Date: 2026-06-12
Repo path: `C:\Users\conno\OneDrive\Documents\RedByte FPGA`
Remote: `https://github.com/swaggyp52/redbyte-ui-genesis.git`
Branch: `main`
Audited commit: `08a324cf`

---

## Why This Reconciliation Was Needed

The correct RedByte FPGA repository was found after a previous backbone pass had accidentally run in the wrong Redstone Studio repository. The correct repo already had serious agent/docs structure, so the right action was reconciliation, not a new `.redbyte-brain/` or duplicated product truth.

The read-only audit found several stale or conflicting claims:

- `docs/ACTIVE_WORK.md` still treated `build:unified` as blocked even though later `AI_STATE.md` and `docs/release/course-edition/08-validation-log.md` entries recorded passing build/unified validation.
- `docs/ACTIVE_WORK.md` still described bench evidence work as local/uncommitted even though the repo was clean and later docs recorded it.
- `docs/product/RED_BYTE_CURRENT_TRUTH.md` still carried the stale `build:unified` caveat.
- `docs/product/RED_BYTE_WORK_QUEUE.md` did not reflect the new approved order: docs reconciliation, golden SHA investigation, browser workflow suite, Vivado/Basys3 proof restoration, then feature work.
- `CLAUDE.md` referenced the stale local path `C:\Users\conno\redbyte-ui`.
- `AGENTS.md` and `CLAUDE.md` disagreed about whether `docs/00-canon/00-08` was current startup truth.
- The gap audit still contained historical "README lies" language in places that looked like current blockers.
- Some proof docs referenced generated/local packs that are absent in a clean clone.
- The current risk state needed to name the two failing classroom golden SHA gates and the Node 24.15.0 vs `.nvmrc` Node 20.19.0 runtime mismatch.

---

## Files Reviewed

- `AGENTS.md`
- `AI_STATE.md`
- `CLAUDE.md`
- `AI_STATE.md`
- `docs/ACTIVE_WORK.md`
- `docs/DOC_INDEX.md`
- `docs/product/RED_BYTE_CURRENT_TRUTH.md`
- `docs/product/RED_BYTE_WORK_QUEUE.md`
- `docs/STUDENT_RELEASE_READINESS.md`
- `docs/release/course-edition/08-validation-log.md`
- `docs/roadmap/RedByte_Gap_Audit.md`
- `.nvmrc`
- `package.json`

---

## Files Changed

- `AGENTS.md`
- `CLAUDE.md`
- `docs/ACTIVE_WORK.md`
- `docs/DOC_INDEX.md`
- `docs/product/RED_BYTE_CURRENT_TRUTH.md`
- `docs/product/RED_BYTE_WORK_QUEUE.md`
- `docs/roadmap/RedByte_Gap_Audit.md`
- `docs/audits/2026-06-12-redbyte-backbone-reconciliation.md`

No files under `apps/`, `packages/`, `scripts/`, `api/`, `tests/`, or generated artifact folders were intentionally changed.

---

## Stale Claims Corrected

- The current clone path is `C:\Users\conno\OneDrive\Documents\RedByte FPGA`; older `C:\Users\conno\redbyte-ui` references are historical/local aliases unless explicitly selected.
- The old `build:unified` blocker is marked stale/resolved because later validation logs and `AI_STATE.md` record passing build/unified runs.
- The bench evidence classifier is no longer described as local/uncommitted current work.
- The startup hierarchy now routes agents through `AGENTS.md`, `AI_STATE.md`, `CLAUDE.md`, `docs/ACTIVE_WORK.md`, `docs/DOC_INDEX.md`, current product docs, and readiness/proof docs.
- `docs/00-canon/07` and `docs/00-canon/08` are background/aspirational only when they conflict with current docs.
- The old gap audit language about README/manual/sequential blockers is labeled historical/resolved instead of current.
- Tracked proof docs are distinguished from local/generated raw proof packs.

---

## Prior Read-Only Audit Command Results

Environment:

- `git status --short`: clean tracked worktree
- `git branch --show-current`: `main`
- `git rev-parse --short HEAD`: `08a324cf`
- `node -v`: `v24.15.0`
- `corepack pnpm -v`: `10.24.0`
- `.nvmrc`: `20.19.0`

Passed:

- `corepack pnpm install --frozen-lockfile`
- `corepack pnpm -s rb:doc:validate` (`36` passed, `0` failed)
- `corepack pnpm -s rb:encoding:check`
- direct `corepack pnpm -r --if-present run typecheck`
- `corepack pnpm -s rb:site:start:test`
- `corepack pnpm -s rb:bench:evidence:test`
- `Start-RedByte.ps1 -SmokeTest -NoOpen -SkipInstall -Port 5197`
- manual unified-build equivalent through package prebuilds, playground build, merge-dist, and verify-dist
- focused ECE141 browser gate after installing local Playwright Chromium cache
- `basys3-bundle-gate`, `verilog-determinism-gate`, and `lab-starter-load-gate` within the focused classroom Vitest sweep

Failed or limited:

- root `corepack pnpm typecheck` failed because the package script invoked bare `pnpm` and the shim was not on PATH; the direct recursive Corepack equivalent passed.
- `corepack enable pnpm` failed with EPERM writing to `C:\Program Files\nodejs\pnpx`.
- `classroom-golden-basys3-export-gate.test.ts` failed: expected `ad6a09188772061ce462ffc7a6feca620946fbb90fc77c84f77c35125fb91264`, received `b2f0e35a9ca5c3e71859c68bb5bb986fe04f6dc12da54e4c66661cb6fd7ea569`.
- `classroom-golden-basys3-alu-export-gate.test.ts` failed: expected `af6c5470f41b41a9d184bb9e39118a8e57cc53cdf86788e7b6a22a53ea63cef4`, received `9f803cf1fc957fa3c484bcbfc16ceb62ef141675b3ba81bba302ff2a2513388f`.
- Vivado proof did not run because `C:\Xilinx\Vivado\2024.2\bin\vivado.bat` was absent.

---

## Current Unresolved Risks

- Golden ZIP SHA drift needs investigation under Node 20.19.0 before any SHA update.
- The Node 24.15.0 desktop audit runtime may be related to SHA drift, but that is not proven.
- This desktop cannot make fresh Vivado/Basys3 proof claims until Vivado 2024.2 and hardware are available.
- Clean clones may lack ignored/generated proof packs; tracked proof docs remain the portable source of proof history.

---

## Post-Reconciliation Validation

- `corepack pnpm rb:doc:validate` passed: `29` passed, `0` failed.
- `corepack pnpm rb:encoding:check` passed: no mojibake markers found.
- `git diff --check` passed for tracked diffs. The command reported line-ending normalization warnings only (`LF` will be replaced by `CRLF` when Git touches the files).
- A targeted trailing-whitespace scan over the changed docs and the new audit note returned no matches. Pre-existing trailing whitespace remains in older `AI_STATE.md` history outside the new entry and was not changed in this slice.

---

## Next Approved Slice

Golden export SHA investigation under the repo-pinned runtime.

Do not implement product features or re-bless golden SHAs until the root cause is understood and the user approves the next implementation slice.

---

## Source-Scope Statement

This reconciliation is documentation/backbone only. No application source, product source, tests, scripts, API files, or generated artifacts were intentionally modified.
