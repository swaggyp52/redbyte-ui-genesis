---
type: bug
status: investigating
area: verify
priority: critical
updated: 2026-03-26
related:
  - "[[Verify Engine]]"
  - "[[Test Infrastructure]]"
---

# BUG-010 Verify Trace Run Shows Failure UX When Expected Outputs Are Present

## Symptom

A student runs in "Trace Only" mode on a custom circuit. The toolbar shows "Mode: Trace Only" but the surface simultaneously shows:

- "ASSERTIONS DIFFER" banner
- "FAILING CHECKS 7" sidebar
- "Inspect first mismatch" CTA
- Full Compare Details inspector

This contradictory state should never occur.

## Root Cause

Two independent variables encode run kind in incompatible ways.

### Variable A — `isTraceOnly` (VerifySurface.tsx:2773)

```ts
const isTraceOnly =
  lastRun !== undefined &&
  lastRunKind === 'trace' &&
  !hasResults &&      // <<< BUG: this guard breaks the guarantee
  !hasNoTrace;
```

`hasResults = runRows.length > 0` (line 1955).

### Variable B — `nextRunUsesAssertions` (VerifySurface.tsx:861)

Correctly set to `false` from `lastRun.runKind === 'trace'`. Drives "Mode: Trace Only" label.

### The failure chain

1. Student toggles to Trace Only mode (`nextRunUsesAssertions = false`)
2. Run dispatched with `runKind: 'trace'` and empty `rows: []`
3. `projectRuntime.ts:1032` — `runDeterministicVerifyFromModel` runs unconditionally, reads `vector.expected` from persisted scenario vectors (populated from a prior capture)
4. Engine produces comparison rows with failures even though `runKind: 'trace'`
5. `lastRun.runKind = 'trace'` AND `lastRun.report.rows.length > 0` AND `lastRun.status = 'fail'`
6. Back in VerifySurface: `!hasResults` is `false` → `isTraceOnly` is `false`
7. `buildVerifySessionViewModel`: falls through to `sessionStatus = 'assertions-differ'`
8. All failure UX activates: banner, sidebar, inspector, CTA
9. Simultaneously: `nextRunUsesAssertions = false` → toolbar shows "Mode: Trace Only"

### Why expected outputs persist

`vector.expected` is stored in `ProjectRuntimeState.scenarios[*].vectors`, persisted via Zustand. Toggling "Trace Only" does NOT clear expected values. There is no "clear all expected" triggered by mode toggle. Expected outputs survive circuit changes, mode changes, and page refreshes until explicitly cleared.

## Two-Layer Fix Required

### Fix 1 — UI gate (VerifySurface.tsx:2773) — smaller scope

Remove the `!hasResults` guard. Trust `runKind` directly:

```ts
// Current (buggy):
const isTraceOnly =
  lastRun !== undefined &&
  lastRunKind === 'trace' &&
  !hasResults &&
  !hasNoTrace;

// Correct:
const isTraceOnly =
  lastRun !== undefined &&
  lastRunKind === 'trace';
```

This ensures `sessionStatus` never reaches `'assertions-differ'` when the run was a trace run, regardless of row presence.

### Fix 2 — Runtime gate (projectRuntime.ts:1032) — deeper scope

When `runKind === 'trace'`, the deterministic engine should not produce comparison rows. Strip expected values before running, or skip the comparison step.

This prevents the contradictory rows from being produced in the first place.

## Priority

Fix 1 can be done first (UI gate only). Fix 2 is the more correct long-term fix but involves the runtime. Both are needed for full correctness.

## Fix Status

**Fix 1 — APPLIED** (`VerifySurface.tsx:2773`): Removed `!hasResults` guard from `isTraceOnly`. Now trusts `runKind` directly. Render suite held at 52 PASS / 9 suites / 0 red.

**Fix 2 — STILL OPEN**: Runtime gate in `projectRuntime.ts:1032`. When `runKind === 'trace'`, the deterministic engine still runs unconditionally and still produces comparison rows with failures. `lastRun.report.rows` will be non-empty on a trace run if `vector.expected` is populated. Fix 2 must strip expected values before running or skip the comparison step entirely when `runKind === 'trace'`.
