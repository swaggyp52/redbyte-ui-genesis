# Windows Course Scripts Merge

**Date:** 2026-05-12
**Attribution:** Connor Angiel

## Goal

Merge `release/windows-course-scripts-1` into `main`, validate the RedByte release/product gate stack, and push `origin/main`.

## Preflight

| Item | Result |
|---|---|
| Starting `origin/main` | `5e13981d8a4242a53314647578420e5bbebf60ec` |
| Feature branch | `origin/release/windows-course-scripts-1` |
| Feature commit | `7c8156fdc78f615e02f6af2f98e7792da4ccd5ec` |
| Current branch after preflight | `main` |
| Working tree status before merge | Local untracked `.redbyte/` generated course output present; source tree otherwise clean. |
| Safety branch | `backup/pre-windows-course-scripts-merge` |

## Scripts Being Merged

- `scripts/course/windows/common.ps1`
- `scripts/course/windows/setup.ps1`
- `scripts/course/windows/launch.ps1`
- `scripts/course/windows/doctor.ps1`
- `scripts/course/windows/update.ps1`
- `scripts/course/windows/reset.ps1`
- root `setup.ps1`
- root `launch.ps1`
- root `doctor.ps1`
- `scripts/rb-course-scripts.test.mjs`
- `pnpm -s rb:course-scripts:test`
- `docs/course/windows-quickstart.md`
- `docs/release/course-edition/29-windows-course-scripts.md`

## Known Manual Checks From Feature Branch

- `setup.ps1 -SkipInstall` passed.
- `doctor.ps1` passed with advisory WARNs for missing Vivado/Basys3.
- `launch.ps1 -SmokeTest -NoOpen` passed.
- Default background launch passed, then generated server process tree was cleaned up.
- `reset.ps1 -DryRun` passed and removed nothing.

## Validation Plan

- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm build:unified`
- `pnpm start:smoke`
- `pnpm -s rb:course-scripts:test`
- Full ECE141 browser gate stack.
- `pnpm -s ui:lab-starter-load-gate`
- Manual Windows script checks:
  - `./setup.ps1 -SkipInstall`
  - `./doctor.ps1`
  - `./launch.ps1 -SmokeTest -NoOpen`
  - `./reset.ps1 -DryRun`
- `pnpm rb:doc:validate`
- `pnpm rb:encoding:check`
- `git diff --check`

## Merge Result

`origin/release/windows-course-scripts-1` merged into `main` with merge commit `277e0f12`.

No conflicts occurred. The merge preserved:

- `scripts/course/windows/**`
- root `setup.ps1`, `launch.ps1`, and `doctor.ps1` wrappers
- `scripts/rb-course-scripts.test.mjs`
- `package.json` `rb:course-scripts:test`
- `docs/course/windows-quickstart.md`
- `docs/release/course-edition/29-windows-course-scripts.md`
- `docs/product/V1_RELEASE_READINESS_CHECKLIST.md`
- validation-log and `AI_STATE.md` updates from the feature branch.

## Validation Results

| Command | Result | Notes |
|---|---|---|
| `pnpm install --frozen-lockfile` | Passed | Lockfile was up to date. |
| `pnpm typecheck` | Passed | Full workspace typecheck passed on merged `main`. |
| `pnpm build:unified` | Passed | Unified build and dist verification passed with `/ -> /start.html` and `/os/` as the direct IDE route. |
| `pnpm start:smoke` | Passed | Launcher served `http://127.0.0.1:5197/` with HTTP 200. |
| `pnpm -s rb:course-scripts:test` | Passed | Static Windows course-script contract passed. |
| Full ECE141 browser gate stack | Passed | Starter Verify/Export, product immersion, counter clock/export, map-pins recovery, counter compare, project persistence, import/export recovery, Vivado artifacts, UI art-direction, and UI hierarchy gates passed sequentially. |
| `pnpm -s ui:lab-starter-load-gate` | Passed | 8 starter-load tests passed. |
| `pnpm rb:doc:validate` | Passed before closeout docs | 36 passed, 0 failed. |
| `pnpm rb:encoding:check` | Passed before closeout docs | No mojibake markers found. |
| `git diff --check` | Passed before closeout docs | No whitespace errors. |

## Manual Script Checks

| Command | Result | Notes |
|---|---|---|
| `powershell -NoProfile -ExecutionPolicy Bypass -File ./setup.ps1 -SkipInstall` | Passed | Node, pnpm, and no-Vivado normal-launch boundary reported correctly. |
| `powershell -NoProfile -ExecutionPolicy Bypass -File ./doctor.ps1` | Passed with warnings | Core checks and startup smoke passed; Vivado and Basys3 were advisory WARNs because they were not detected. |
| `powershell -NoProfile -ExecutionPolicy Bypass -File ./launch.ps1 -SmokeTest -NoOpen` | Passed | Served `http://127.0.0.1:5173/` with HTTP 200. |
| `powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/course/windows/reset.ps1 -DryRun` | Passed | Dry-run listed allowlisted generated/cache targets and removed nothing. |

Note: the feature branch intentionally added root wrappers for `setup.ps1`, `launch.ps1`, and `doctor.ps1` only. The reset dry-run check used the real reset script path rather than adding a new root wrapper during this merge-only task.

## Closeout

Full workspace `pnpm typecheck` passes on merged `main`.

`pnpm build:unified` passes on merged `main`.

Final remaining blockers:

- The scripts need a fresh clone / fresh Windows profile rehearsal.
- Student Quick Start and Professor Quick Start still need to be written.
- Professor-facing RC1 package has not been assembled in this task.

Next recommended sprint: Student Quick Start and Professor Quick Start.
