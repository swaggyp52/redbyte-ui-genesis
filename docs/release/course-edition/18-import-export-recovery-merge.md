# Import/Export Recovery Merge Closeout

Date: 2026-05-11

## Scope

Merge `product/import-export-recovery-1` into `main`, validate the merged RedByte product gates, and push `main` after closeout. This task did not add product features, perform repo cleanup, work on MarcusRPI, start Vivado artifact correctness, fix full workspace typecheck drift, or run `build:unified`.

## Preflight

| Item | Result |
| --- | --- |
| Starting branch | `main` |
| Working tree before validation | Clean |
| `origin/main` before merge | `b5e305d4f87ff600ef1a95a988611aba53d08b67` |
| Feature branch | `origin/product/import-export-recovery-1` |
| Feature branch commit | `2f180cdb99741468db185c1bd054e2443d5395b0` |
| Safety branch | `backup/pre-import-export-recovery-merge` |
| Merge command | `git merge --no-ff origin/product/import-export-recovery-1 -m "merge: import export recovery hardening"` |
| Merge commit | `0800a3f906c023498b211cdb926b3d3125811ce6` |

## Merge Result

The merge completed without conflicts and brought in:

- `tests/e2e/ece141-import-export-recovery.spec.ts`
- `docs/release/course-edition/17-import-export-recovery.md`
- package scripts for `pnpm -s ide:gate:ece141-project-persistence` and `pnpm -s ide:gate:ece141-import-export-recovery`
- import/export validation-log and `AI_STATE.md` updates from the feature branch

The imported behavior remains scoped to RedByte project persistence, manifest-backed ZIP import, corrupt manifest recovery, stale Verify evidence handling, and E0-only export package claims. It does not prove Vivado build, board programming, or physical board observation.

## Marcus/RPI/HQ Check

Post-merge tracked-file scan results were reviewed. Remaining hits are not active Marcus/RPI/HQ product work:

| Path | Classification | Action |
| --- | --- | --- |
| `api/server.mjs` | retained generic API server already present after repo separation | Keep |
| `artifacts/classroom-rc-v1/os/assets/*HQ*` | generated artifact filenames where `HQ` appears inside hashed filenames | Keep for separate artifact-boundary review |
| `docs/release/course-edition/12-main-sync-and-marcus-rpi-separation.md` | separation record | Keep |
| `docs/release/course-edition/13-marcus-rpi-hard-separation-and-main-sync.md` | separation record | Keep |
| `packages/rb-fpga-bridge/boards/registry.json` | board registry, not Marcus/RPI session material | Keep |

No active Marcus/HQ/local-agent package scripts, `.redbyte/agent` tracked files, RPI session artifacts, or active Marcus/RPI/HQ source surfaces reappeared from the merge.

## Validation Results

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | Passed | Lockfile current; no dependency changes. |
| `pnpm start:smoke` | Passed | Launcher served `http://127.0.0.1:5197/` with HTTP 200. |
| `pnpm -s ide:gate:ece141-starter-verify-export` | Passed | Logic Gates starter Verify -> Export gate passed. |
| `pnpm -s ide:gate:ece141-product-immersion` | Passed | Four product immersion browser workflows passed. |
| `pnpm -s ide:gate:ece141-counter-clock-export` | Passed | Counter clock/reset and E0 export wording gate passed. |
| `pnpm -s ide:gate:ece141-map-pins-recovery` | Passed | Manual Map Pins edit and starter recovery gate passed. |
| `pnpm -s ide:gate:ece141-counter-compare-pass` | Passed | Counter Compare pass and E0-only Export gate passed. |
| `pnpm -s ui:lab-starter-load-gate` | Passed | 8 starter-load tests passed. |
| `pnpm -s ide:gate:ece141-project-persistence` | Passed | Project persistence and stale evidence gate passed. |
| `pnpm -s ide:gate:ece141-import-export-recovery` | Passed | Import/export recovery gate passed. |
| Focused import/export/project-format and Verify/Hardware/Export Vitest suite | Passed | 13 files, 73 tests passed. |
| `pnpm rb:doc:validate` | Passed | 36 passed, 0 failed before closeout docs. |
| `pnpm rb:encoding:check` | Passed | No mojibake markers before closeout docs. |
| `git diff --check` | Passed | No whitespace errors before closeout docs. |
| `pnpm typecheck` | Failed | Same known pre-existing `@redbyte/rb-lab-engine` and pulled `rb-logic-core` schema/test-fixture/type-boundary drift. |

`pnpm build:unified` was not run in this task. The known `/os/` redirect contract drift remains out of scope.

## Closeout

Final `main` commit before push will include this closeout record and the validation-log/AI_STATE updates. The next recommended sprint is Vivado artifact correctness for generated VHDL/XDC/Tcl/manifest across the certified starter set, preserving E0-only claims unless separate Vivado evidence exists.
