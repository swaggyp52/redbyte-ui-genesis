# Runtime Stabilization Sprint 1

Date: 2026-05-11
Branch: `chore/course-edition-repo-triage`
Scope: Logic Gates starter -> Verify Compare -> Export ready-to-build

## Hardening Ticket

| Field | Entry |
| --- | --- |
| Surface | Project, Design, Verify, Export, shared `CircuitStore` |
| Student workflow | Load Logic Gates starter, run Verify Compare, confirm Export is ready-to-build |
| Problem statement | The browser console reports `[CircuitStore] Circuit mutation called but engines not connected!` while a normal starter workflow is loading. The warning copy implies simulation propagation is broken even though Verify Compare and Export readiness use runtime authority and still succeed. |
| Evidence | `.redbyte/course-edition/runtime-sprint-1/logic-gates-repro.json`; `.redbyte/course-edition/runtime-sprint-1/logic-gates-export-ready.png` |
| Severity | P2 for student/professor trust while using dev/browser gates; not observed as a P0/P1 workflow failure in this path. |
| Course boundary | E0/export-readiness only. No Vivado build, board programming, or physical board observation was tested or claimed. |

## CircuitStore Warning Reproduction

Command context:

`pnpm --filter @redbyte/playground exec vite --host 127.0.0.1 --port 5198 --strictPort`

The dev server was already running on `http://127.0.0.1:5198` under a Node/Vite process from the previous audit environment. I used Playwright Chromium as development tooling and opened:

`http://127.0.0.1:5198/?mode=project`

Steps:

1. Open Project.
2. Dismiss onboarding if present.
3. Click `ide-project-landing-example-logic-gates`.
4. Confirm Design surface is visible.
5. Click `mode-button-verify`.
6. Select `Compare checks`.
7. Click `Run`.
8. Confirm `PASS` and `12/12 match`.
9. Click `mode-button-export`.
10. Confirm `Export Ready to Build` and `Vivado package ready to build`.

Actual behavior:

- Workflow completed.
- Verify Compare passed with `PASS` and `12/12 match`.
- Export reached `Export Ready to Build` / `Vivado package ready to build`.
- No page errors or request failures were captured.
- One console warning was captured.

Exact warning:

```text
[CircuitStore] Circuit mutation called but engines not connected!
  - engine: X MISSING
  - tickEngine: X MISSING
Circuit mutations will not propagate to simulation. Call setEngine() and setTickEngine() during app initialization.
```

Source reported by Playwright:

`packages/rb-apps/src/stores/circuitStore.ts` through Vite `@fs/.../circuitStore.ts`, reported at line 150 in the browser source map. The authored source warning is in `updateCircuit`.

Risk classification:

Harmless but trust-noisy for this workflow. The warning is emitted while projecting canonical `projectRuntime` circuit state into the editor store cache before `DesignSurface` has mounted and registered its local engines. The observed Verify Compare and Export readiness state were not affected. The warning copy is still risky because it overstates a failure for a normal starter-loading path.

## Root Cause Questions

1. What component or store emits the warning?

`useCircuitStore.updateCircuit` in `packages/rb-apps/src/stores/circuitStore.ts`.

2. What does "engine not connected" mean in this codebase?

The editor cache has no connected `CircuitEngine` or `TickEngine`. Those engines are registered by `DesignSurface` through `setEngine(tickEngine.getEngine())` and `setTickEngine(tickEngine)`.

3. Is the engine expected to be missing during startup?

Yes for runtime-to-editor projection before the Design surface effect runs. The IDE shell projects `projectRuntime` into `circuitStore` from `IdeApp` with `projectRuntimeCircuitToEditorStore(circuit)`, and that projection can occur before `DesignSurface` registers its editor-local engines.

4. Is the warning emitted before initialization completes?

Yes. The warning fires during starter load as the shell moves from Project to Design and syncs runtime authority into the editor store cache.

5. Is it repeated because of React lifecycle/render behavior?

The focused Logic Gates path produced one warning. The previous audit saw repeated warnings while loading multiple starters, which is consistent with the same projection path running once per runtime circuit load.

6. Is it repeated because a store subscription is firing too often?

No evidence found. The warning is tied to `updateCircuit` calls with missing engines, not an observed subscription storm.

7. Does it indicate Verify/Export is using stale or incomplete circuit state?

No evidence for this workflow. `docs/IDE_SYSTEM_MAP.md` identifies `projectRuntime.ts` as runtime-authoritative, and `IdeApp` comments state the shell does not re-read `useCircuitStore` for canonical truth. Verify and Export reached current pass/export-ready states from runtime authority.

8. Is student-visible behavior affected?

Not in the UI state observed. It affects developer/browser trust because the console suggests simulation propagation is broken during a valid workflow.

9. Is export artifact generation affected?

No effect was observed. Export readiness and artifact count were available after Compare PASS in the previous audit, and this sprint reproduced the ready-to-build state. This sprint did not claim Vivado E1/E2/E3 evidence.

10. Should this be fixed in initialization order, warning gating, store lifecycle, starter loading, Verify surface, Export surface, or documentation only?

Fix in warning gating at the runtime projection boundary. The projection is an intentional one-way cache sync and should not require DesignSurface engines. The normal editor mutation warning should remain for true editor mutations that expect simulation engines.

## Planned Small Fix

Add an explicit `requireEngines` option to `updateCircuit`, defaulting to true. `projectRuntimeCircuitToEditorStore` will pass `requireEngines: false` because it is a runtime-authority cache projection, not an editor mutation that needs immediate engine propagation. The existing warning remains active for normal editor mutations.

## Playwright Gate Plan

Gate name:

`ECE141 Logic Gates starter verify/export smoke`

Expected command:

`pnpm -s ide:gate:ece141-starter-verify-export`

The gate should:

- launch the IDE without Vivado or hardware,
- load `logic-gates`,
- reach Verify,
- run Compare,
- assert `PASS` and `12/12 match`,
- reach Export,
- assert ready-to-build copy,
- fail on page errors, severe console errors, or `CircuitStore` engine-not-connected warnings.

## Fix Applied

Files changed:

- `packages/rb-apps/src/stores/circuitStore.ts`
- `packages/rb-apps/src/apps/ide/circuitProjection.ts`
- `packages/rb-apps/src/apps/ide/__tests__/circuitProjection.test.ts`
- `tests/e2e/ece141-logic-gates-verify-export.spec.ts`
- `package.json`

Implementation:

- Added `requireEngines?: boolean` to `updateCircuit` options, defaulting to `true`.
- Kept the existing engine-not-connected warning active for normal editor mutations.
- Marked `projectRuntimeCircuitToEditorStore` as `requireEngines: false` because it is an intentional one-way projection from runtime authority into the editor cache.
- Added a unit assertion that the runtime-to-editor projection explicitly opts out of the editor-engine warning.
- Added the Playwright gate `ECE141 Logic Gates starter verify/export smoke`.

Regression evidence:

- RED: `pnpm -s ide:gate:ece141-starter-verify-export` failed before the fix after reaching pass/export-ready state because it captured one `CircuitStore` engine-not-connected warning.
- GREEN: the same command passed after the fix.

Final classification:

Harmless but noisy lifecycle warning for this workflow. It was not a Verify or Export state corruption bug. The warning text was stale for the runtime projection path and is now gated to true editor mutations.

## Typecheck Triage

Initial failure:

- `packages/rb-fpga-toolchain/src/verilog-validator.ts(379,7)` used `constraintResult.pinInfo?.timingConstraints > 0`, which still allowed `undefined > 0`.
- `packages/rb-fpga-toolchain` typecheck also failed on DOM globals from `packages/rb-utils/src/**` because `@redbyte/rb-utils` resolves to source through workspace paths and its public index exports browser-oriented modules.

Classification:

- `verilog-validator.ts`: A. Tiny safe fix available.
- DOM globals: B. Config/ambient types problem.

Fix:

- Changed the timing constraint score check to `(constraintResult.pinInfo?.timingConstraints ?? 0) > 0`.
- Added `DOM` to `packages/rb-fpga-toolchain/tsconfig.json` `lib` so the current `rb-utils` source export surface typechecks without changing package architecture.

Result:

- `pnpm --filter @redbyte/rb-fpga-toolchain typecheck` now passes.
- Full `pnpm typecheck` still fails later in `@redbyte/rb-lab-engine` and source it pulls from `rb-logic-core`. This is outside the sprint scope and should be a separate type-boundary cleanup task.

## Validation Summary

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm -s ide:gate:ece141-starter-verify-export` | Failed before fix | Reached workflow success, then failed on one `CircuitStore` warning. |
| `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/circuitProjection.test.ts` | Passed | 7 tests. |
| `pnpm -s ide:gate:ece141-starter-verify-export` | Passed | Logic Gates starter, Compare PASS, Export ready-to-build, no captured CircuitStore warning. |
| `pnpm --filter @redbyte/rb-fpga-toolchain typecheck` | Passed | Targeted typecheck fixed. |
| `pnpm install --frozen-lockfile` | Passed | Lockfile unchanged and current. |
| `pnpm start:smoke` | Passed | Launcher served HTTP 200 on port 5197. |
| `pnpm -s ide:gate:export-ready-contract` | Failed | Existing gate could not find ready vectors; separate stale-gate/product-flow task. |
| `pnpm typecheck` | Failed | Now fails later in `@redbyte/rb-lab-engine`/`rb-logic-core` type drift, not `@redbyte/rb-fpga-toolchain`. |
| `pnpm build:unified` | Failed | Playground build and merge completed, then dist verification failed on the known root redirect contract: `dist/_redirects contains root redirect to /os/`. |
| `git diff --check` | Passed | No whitespace errors. |
