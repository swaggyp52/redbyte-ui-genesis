# RedByte Clock and Custom Sequential Hardening Report

Date: 2026-06-27
Owner: Connor Angiel
Surface: Design, Verify, Hardware Map Pins, Export
Severity: P1 until disproven
Status: Partial local repair. Full explicit custom Clock sequential support remains not certified.

## 1 Executive Verdict

Option B applies. The current architecture does not yet support a first-class custom explicit Clock component flow from Design through Verify Compare and Export with board-ready semantics. The Sim Clock palette entry is already removed, so students cannot create the requested explicit Clock component from a blank design through normal UI. Imported or legacy `role:"sim"` Clock projects still existed, and browser proof showed they were incorrectly promoted to `CLK100MHZ` / `W5` auto board-clock Verify.

The local repair prevents that false promotion. A sim-only Clock row is now detected as an imported explicit Clock component, defaults to manual/import-only Verify guidance, and no longer inherits board-clock alias, package pin, frequency, or auto clock-lane materialization.

## 2 Reproduction Summary

Evidence artifacts are local under `.redbyte/clock-hardening/2026-06-27/`:

- `clock-hardening-browser-proof.json`
- `live-palette-clock-search.png`
- `local-palette-clock-search.png`
- `live-explicit-clock-dff-verify.png`
- `local-explicit-clock-dff-verify.png`
- `live-explicit-clock-tff-verify.png`
- `local-explicit-clock-tff-verify.png`
- `live-explicit-clock-hardware.png`
- `local-explicit-clock-hardware.png`
- `live-explicit-clock-export.png`
- `local-explicit-clock-export.png`
- `local-after-sim-clock-honesty.json`
- `local-after-sim-clock-honesty.png`

Exact setup commands used for the local proof path:

```powershell
$env:PATH = "$PWD\.redbyte\tools\node-v20.19.0;$env:PATH"
node -v
corepack pnpm --filter @redbyte/playground exec vite --host 127.0.0.1 --port 4173 --strictPort
```

Exact browser proof command:

```powershell
$env:PATH = "$PWD\.redbyte\tools\node-v20.19.0;$env:PATH"
node '.redbyte\clock-hardening\2026-06-27\clock-hardening-browser-proof.mjs'
```

Key observations:

- Deployed and local build metadata matched commit `0abe87af980ee673e1ab90720ea64d32469e4c87`.
- Palette search for `clock` showed the `CLK100MHZ` board resource, not a Sim Clock component.
- Imported `role:"sim"` DFF/TFF fixtures displayed `Detected clock: CLK - CLK100MHZ - W5 - 100 MHz` and `Mode: Auto board clock`.
- Compare did not repair to PASS because the injected `clk` lane did not drive the actual sim Clock oscillator.
- Export blocked hardware package generation for the imported sim Clock project with missing `clk` mapping, so Export did not silently produce a trusted hardware bundle.

After the local repair, `local-after-sim-clock-honesty.json` showed `boardClockSourceVisible: false`, `Detected clock: CLK`, `Mode: Manual pulses`, import-only warning copy, runtime `sourceType: "explicit-clock-component"`, `autoRunEnabled: false`, and no browser console/page problems.

## 3 Root Cause

`detectVerifyClockPolicy` checked board-looking IO rows before checking whether the row was backed by a `role:"sim"` Clock node. Project IO synchronization can create or preserve a clock row that looks like `CLK100MHZ` / `W5` even when the source node is a sim-only Clock primitive.

That false board-clock policy caused `materializeVectorsForClockPolicy` to inject an alternating `clk` input lane. The deterministic engine did not treat that lane as the internal sim Clock component driver, so the visible Verify policy and waveform semantics diverged.

## 4 Fixed / Not Fixed

Fixed locally:

- Sim-only Clock-backed rows are excluded from board-clock, manual-row, and inferred-row policy detection.
- `findExplicitClockComponent` now requires explicit `config.role === "sim"` instead of treating missing-role legacy Clock nodes as sim-only.
- Imported sim Clock projects now default to `sourceType: "explicit-clock-component"`, `overrideMode: "manual-pulses"`, `autoRunEnabled: false`.
- VerifySurface no longer renders board-clock source chrome for fields backed by sim-only Clock nodes.
- VerifySurface copy now says Sim Clock components are import-only instead of saying auto mode generates the board clock.

Not fixed:

- Normal Design UI still has no Sim Clock palette path.
- Full explicit Clock component oscillator semantics are not implemented in deterministic Verify.
- Intentional FAIL -> repair PASS for imported explicit Clock sequential projects is not certified.
- Export remains board-resource-first for trusted hardware; sim-only Clock projects must be replaced with `CLK100MHZ` before board-ready export trust.

## 5 Tests Added

Added or extended:

- `packages/rb-apps/src/apps/ide/__tests__/verifyClockPolicy.test.ts`
- `packages/rb-apps/src/apps/ide/__tests__/projectRuntime.boardClockAuto.test.ts`
- `packages/rb-apps/src/apps/ide/__tests__/verifySurface.boardClockAutoMode.test.tsx`

Initial red command:

```powershell
$env:PATH = "$PWD\.redbyte\tools\node-v20.19.0;$env:PATH"
node -v
corepack pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/verifyClockPolicy.test.ts packages/rb-apps/src/apps/ide/__tests__/projectRuntime.boardClockAuto.test.ts packages/rb-apps/src/apps/ide/__tests__/verifySurface.boardClockAutoMode.test.tsx
```

Initial result: expected red. The new policy and UI tests failed because the sim-only Clock row was still classified as `board-clock`; two pre-existing board-clock runtime expectations in `projectRuntime.boardClockAuto.test.ts` also failed under the focused command.

Post-repair focused command:

```powershell
$env:PATH = "$PWD\.redbyte\tools\node-v20.19.0;$env:PATH"
node -v
corepack pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/verifyClockPolicy.test.ts packages/rb-apps/src/apps/ide/__tests__/verifySurface.boardClockAutoMode.test.tsx packages/rb-apps/src/apps/ide/__tests__/projectRuntime.boardClockAuto.test.ts -t "verifyClockPolicy|VerifySurface board clock auto mode|keeps imported sim-only Clock components"
```

Post-repair result: passed, `11` tests passed and `3` were skipped by the name filter.

Post-repair browser proof command:

```powershell
$env:PATH = "$PWD\.redbyte\tools\node-v20.19.0;$env:PATH"
node .redbyte/clock-hardening/2026-06-27/local-after-sim-clock-honesty.mjs
```

Post-repair browser result: passed. The local Verify surface no longer showed board-clock source chrome for the imported sim Clock fixture and the runtime clock policy was `explicit-clock-component` / manual.

## 6 Export Integrity

Export is blocked for the imported sim Clock proof fixture, which is the correct safety outcome for this partial repair. The UI reported missing mapping for `clk`, and generated hardware files were blocked except for the project snapshot. This avoids silently certifying a sim-only oscillator as a Basys3 hardware clock.

The remaining confusing point is that the Export readiness gate can still show clock-domain language that looks board-ready while the package is blocked. That is a follow-up clarity ticket, not a silent export corruption finding.

## 7 Remaining Product Risks

- Students importing older projects can still encounter sim-only Clock components that cannot complete a trusted Verify/Export flow until they replace the clock source.
- The deterministic sim engine accepts a clock policy argument but does not yet implement explicit component oscillator control for Verify.
- Current docs and starter flows must stay clear that `CLK100MHZ` board resource is the certified board-ready sequential path.
- Existing board-clock runtime expectations in `projectRuntime.boardClockAuto.test.ts` failed under the broad focused command and should be audited separately before using that file as a full closeout gate.

## 8 Student Impact

The repair reduces harm by removing a false success path. A student should no longer see an imported sim-only Clock described as the Basys3 100 MHz board clock. The product now points them toward the safe path: replace the imported Clock component with the `CLK100MHZ` board resource for auto Verify and Export trust.

The product still does not support the requested custom explicit Clock flow as a normal student path. That remains a product gap, not an E0-certified workflow.

## 9 Next Implementation Tickets

1. Implement explicit Clock component Verify semantics or remove the remaining unsupported controls entirely. Acceptance: imported `role:"sim"` DFF and TFF fixtures can Observe, Compare PASS, intentional FAIL, and repair PASS without board-clock labels.
2. Add an import migration affordance that converts sim-only Clock components to `CLK100MHZ` board resources when the project is intended for Basys3 hardware.
3. Harden Export clock-domain readiness copy so blocked sim Clock projects never display board-ready clock-domain language.
4. Audit and repair the two existing board-clock runtime expectations in `projectRuntime.boardClockAuto.test.ts`, preserving current board-clock truth before broad aggregation.
5. Add browser gate coverage for imported sim-only Clock honesty once the local proof script is promoted from `.redbyte/` evidence into the regular gate suite.
