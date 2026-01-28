# Virtual Lab Reliability Walkthrough

## What Changed

- Added strict graph/timeline validation and repair helpers with canonical hashing.
- Hardened the lab store with a formal playback state machine, deterministic recovery, and reconstruction metrics.
- Updated capsule import/export to include capsuleHash + seed, enforce version/hash, and gate unverified data in read-only replay.
- Implemented a vitest fuzz suite with property checks, mode switching, stress runs, and repair coverage.

## How To Verify

1. Run the fuzz suite:
   ```sh
   pnpm exec vitest run packages/rb-logic-3d/src/lab-model/__tests__/fuzz.test.ts
   ```

2. Manual integrity flow:
   - Open Virtual Lab.
   - Place parts, wire, and run simulation for a few ticks.
   - Export capsule and re-import it (verified capsule should load in live mode).
   - Edit the JSON to corrupt the hash and re-import:
     - Expect an Integrity Warning and read-only replay mode.

3. Recovery behavior:
   - Inject invalid data (NaN pose) via dev tools or fuzz.
   - Expect automatic recovery to last good snapshot and INTEGRITY_RECOVERY event in the timeline.

## Expected Outcome

- No replay drift after scrubbing or mode switching.
- Integrity warnings display without crashing.
- Fuzz suite completes with zero recoveries.

## Student Readiness Sweep (SR_00) â€” 2026-01-28

### Commands

```
pnpm -w lint
> redbyte-ui-genesis@1.0.0 lint C:\Users\conno\redbyte-ui
> pnpm -r --if-present run lint

Scope: 28 of 29 workspace projects
```

```
pnpm -w test:audit
ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "test:audit" not found
Did you mean "pnpm test:ci"?
```

```
pnpm -w exec vitest run packages/rb-logic-3d/src/lab-model/__tests__/fuzz.test.ts \
  packages/rb-logic-3d/src/lab-model/__tests__/netlist.test.ts \
  packages/rb-logic-3d/src/lab-model/__tests__/probe-samples.test.ts \
  packages/rb-shell/src/__tests__/window-snap-preview.test.tsx \
  packages/rb-primitives/src/__tests__/toast-dismiss.test.tsx \
  packages/rb-apps/src/__tests__/instrument-dock.test.tsx

Result: 6 test files passed, 15 tests passed.
Notes: "[HardwareClient] Bridge unavailable, entering offline mode" logged during tests.
```

```
pnpm -w build
Result: build completed successfully.
Notes: Vite reporter warning about AppRegistry dynamic + static import (existing).
```

### Student Readiness Checklist (Manual)

1. [ ] Boot OS, open Settings, toggle theme/density/reduce motion.
2. [ ] Open Virtual Lab, place Arduino + breadboard + LED + resistor.
3. [ ] Wire D13 -> resistor -> LED -> GND. Start sim. Confirm LED blinks.
4. [ ] Open Instruments: Net Inspector select net, Probe shows value, Scope shows transitions.
5. [ ] Switch to Replay, scrub, verify same blink pattern.
6. [ ] Export capsule, clear bench, open capsule from Files â€œOpen With Virtual Labâ€.
7. [ ] Verify hash matches and replay works.
8. [ ] Open Logic Playground and confirm it still loads and does not spam console.