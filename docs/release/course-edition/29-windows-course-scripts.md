# Windows Course Scripts

**Date:** 2026-05-12
**Attribution:** Connor Angiel

## Goal

Create student-safe and professor-safe Windows scripts for setting up, launching, diagnosing, updating, and resetting RedByte for ECE141 course use.

## Preflight

| Item | Result |
|---|---|
| Branch | `release/windows-course-scripts-1` |
| Base commit | `5e13981d8a4242a53314647578420e5bbebf60ec` |
| Working tree before edits | Clean |
| Scope | Add Windows course scripts, static/script tests, concise quickstart, and release-readiness notes. |
| Out of scope | UI polish, core product behavior, install manuals, MarcusRPI work, Vivado artifact logic, and E0/E1/E2/E3 semantic changes. |

## Assumptions

- Students may run from a Git clone or an extracted ZIP.
- Normal RedByte app launch must not require Vivado, Basys3, admin rights, or board access.
- Vivado and Basys3 checks are advisory unless the professor is doing hardware-specific validation.
- The repo uses pnpm only; scripts must not run `npm install`.
- Current public/deploy route truth is `/ -> /start.html`, with `/os/` as the direct IDE route.

## Scripts To Create

| Script | Purpose |
|---|---|
| `scripts/course/windows/setup.ps1` | Verify tools and install workspace dependencies with `pnpm install --frozen-lockfile`. |
| `scripts/course/windows/launch.ps1` | Start RedByte for normal course use and print the local URL. |
| `scripts/course/windows/doctor.ps1` | Diagnose Node, pnpm, dependency, product script, smoke, route, optional Git, optional Vivado, and optional Basys3 status. |
| `scripts/course/windows/update.ps1` | Safely update a Git clone or explain ZIP replacement. |
| `scripts/course/windows/reset.ps1` | Safely clear local generated/cache artifacts without deleting source or student exports by default. |
| Root wrappers | Short `setup.ps1`, `launch.ps1`, and `doctor.ps1` wrappers for common course use. |

## Validation Plan

- Red-first static contract: `pnpm -s rb:course-scripts:test`
- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm build:unified`
- `pnpm start:smoke`
- Full ECE141 product/browser gate stack.
- `pnpm rb:doc:validate`
- `pnpm rb:encoding:check`
- `git diff --check`
- Manual Windows checks for `doctor.ps1`, `setup.ps1`, `launch.ps1`, and non-destructive reset dry-run.

## Existing Script Inventory

| Script | Purpose | Student-safe? | Professor-safe? | Windows-safe? | Keep/Wrap/Replace | Notes |
|---|---|---|---|---|---|---|
| `Start-RedByte.ps1` | General local launcher for dev/production/smoke paths. | Partial | Yes | Yes | Wrap | Good shared launcher, but it is developer-worded and blocks in the foreground for normal launch. |
| `run.bat` | Batch wrapper for `Start-RedByte.ps1`. | Partial | Yes | Yes | Keep | Useful for double-click launch, but not a full setup/doctor/update/reset contract. |
| `scripts/bootstrap.ps1` | Fresh-machine bootstrap with download/install/build/launch behavior. | No | Partial | Yes | Do not wrap | Too broad for this sprint; installs tools/downloads source and includes stale bridge/OS assumptions. |
| `public/bootstrap.ps1` | Public bootstrap that installs Git/Node/pnpm, clones, installs, and starts dev server. | No | Partial | Yes | Do not wrap | Stale and too broad for course-safe local repo scripts. |
| `scripts/doctor.ps1` | FPGA/bridge/hardware doctor. | No | Partial | Yes | Keep separate | Requires/penalizes Vivado, USB, COM, and bridge checks, so it is not a normal app-launch doctor. |
| `scripts/verify-install.ps1` | Checks `pnpm install` bin warnings. | Partial | Yes | Yes | Keep | Narrow install verification only. |
| `scripts/classroom-rc.ps1` | Build and preview classroom app. | Partial | Yes | Yes | Keep | Useful RC path but not student setup/update/reset. |
| `scripts/classroom-smoke.ps1` | Build and run classroom smoke test. | No | Yes | Yes | Keep | Test-oriented. |
| `scripts/classroom-package.ps1` | Build classroom RC package. | No | Yes | Yes | Keep | Professor/packaging-oriented, not normal student setup. |

## Windows Course Script Contract

| Script | Contract |
|---|---|
| `setup.ps1` | Check PowerShell, Node `>=20.19.0`, Corepack/pnpm `>=10.24.0`, run `pnpm install --frozen-lockfile`, avoid Vivado/board requirements, and print the next launch command. |
| `launch.ps1` | Start RedByte without admin rights, print the URL, support an explicit port, write logs under ignored local output, and avoid long validation by default. |
| `doctor.ps1` | Produce PASS/WARN/FAIL output for Node, pnpm, dependencies, package scripts, `start:smoke`, route/start-page contract, optional Git, optional Vivado, and optional Basys3 hints. |
| `update.ps1` | For Git clones, refuse dirty updates unless explicitly allowed, fetch/pull `origin/main`, then reinstall. For ZIP distributions, explain manual replacement. |
| `reset.ps1` | Default to dry-run, clear only allowlisted generated/cache artifacts, protect source and student project exports, and require explicit confirmation for destructive cleanup. |

## Implementation Notes

- Added shared PowerShell helpers in `scripts/course/windows/common.ps1` for repo-root detection, PASS/WARN/FAIL output, Node/pnpm checks, pnpm invocation, log path creation, port detection, and HTTP readiness waits.
- Added `scripts/course/windows/setup.ps1` to check PowerShell, Node `>=20.19.0`, Corepack/pnpm `>=10.24.0`, run `pnpm install --frozen-lockfile`, and explicitly state that Vivado is not required for normal launch.
- Added `scripts/course/windows/launch.ps1` as the student-facing launcher wrapper around `Start-RedByte.ps1`. It checks tools, refuses to run before dependencies are installed, finds an alternate port if needed, writes logs under `.redbyte/course/logs`, supports `-SmokeTest`, and records a `taskkill /PID ... /T /F` stop command for default background launches.
- Added `scripts/course/windows/doctor.ps1` with PASS/WARN/FAIL checks for Node, pnpm, Git, dependency install state, required package scripts, `pnpm -s rb:site:start:test`, `pnpm start:smoke`, optional Vivado, and optional Basys3 hints.
- Added `scripts/course/windows/update.ps1` for fast-forward-only `origin/main` updates when the repo is a Git clone, with a ZIP-distribution explanation when `.git` is absent.
- Added `scripts/course/windows/reset.ps1` with dry-run-by-default cleanup of allowlisted generated/cache paths. It requires `-ConfirmReset` for actual removal and blocks possible student project export folders.
- Added short root wrappers: `setup.ps1`, `launch.ps1`, and `doctor.ps1`.
- Added `docs/course/windows-quickstart.md` as a concise script usage note, not a full student/professor manual.
- Added `pnpm -s rb:course-scripts:test` and `scripts/rb-course-scripts.test.mjs` to statically verify script presence, safety constraints, route/script references, root wrappers, `.redbyte/course/` ignore coverage, and quickstart E0/E1/E2/E3 wording.

## Validation Results

| Command | Result | Notes |
|---|---|---|
| `pnpm -s rb:course-scripts:test` | Failed before implementation | Red test failed because `scripts/course/windows/common.ps1` and the required course scripts did not exist. |
| `pnpm -s rb:course-scripts:test` | Passed after implementation | Static course-script contract passed. |
| `powershell -NoProfile -ExecutionPolicy Bypass -File ./setup.ps1 -SkipInstall` | Passed | Root wrapper forwarded `-SkipInstall`; Node, pnpm, and no-Vivado launch boundary were reported correctly. |
| `powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/course/windows/reset.ps1 -DryRun` | Passed | Dry-run listed allowlisted generated/cache targets and removed nothing. |
| `powershell -NoProfile -ExecutionPolicy Bypass -File ./launch.ps1 -SmokeTest -NoOpen -Port 5198` | Passed | Smoke launch selected the next available port when `5198` was occupied and served HTTP 200. |
| `powershell -NoProfile -ExecutionPolicy Bypass -File ./doctor.ps1` | Passed with warnings | Node, pnpm, Git, package scripts, route contract, and startup smoke passed; Vivado and Basys3 were advisory WARNs because they were not detected in this environment. |
| `powershell -NoProfile -ExecutionPolicy Bypass -File ./launch.ps1 -NoOpen -Port 5196` | Passed | Background launch wrote logs and `launch-latest.json`; generated server process tree was stopped after the manual check. |
| `pnpm install --frozen-lockfile` | Passed | Lockfile was up to date. |
| `pnpm typecheck` | Passed | Full workspace typecheck stayed green. |
| `pnpm build:unified` | Passed | Unified build and dist verification stayed green with `/ -> /start.html` and `/os/` direct IDE route. |
| `pnpm start:smoke` | Failed before rerun | Timed out after the manual background-launch check left a Vite child process around the smoke port. |
| `pnpm start:smoke` | Passed after cleanup | After stopping the leftover repo dev-server child processes, startup smoke served `http://127.0.0.1:5197/` with HTTP 200. |
| Full ECE141 browser gate stack | Passed with one rerun | Starter Verify/Export, product immersion, counter clock/export, map-pins recovery, counter compare, project persistence, import/export recovery, Vivado artifacts, UI art-direction, UI hierarchy, and starter load gates passed. The first UI hierarchy run hit a blank initial Project boot and passed on immediate rerun. |
| `pnpm -s ui:lab-starter-load-gate` | Passed | 8 starter-load tests passed. |

## Limitations

- Scripts assume the repo is already present on disk. They do not yet provide a one-command fresh-machine download/install flow.
- `doctor.ps1` reports Vivado and Basys3 as warnings by default. Hardware-required validation can opt into stricter professor checks later.
- Default `launch.ps1` runs RedByte in the background for student convenience; users should use the printed `taskkill /PID ... /T /F` command or `-Foreground` when they want terminal-bound lifecycle control.
- ZIP update behavior is advisory only: `update.ps1` explains safe replacement but does not download or unpack a new ZIP.

## Next Sprint

After this branch is merged, write Student Quick Start and Professor Quick Start, then run a fresh clone / fresh Windows machine simulation.
