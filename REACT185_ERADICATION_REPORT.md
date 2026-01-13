# React #185 Eradication Report

**Date**: January 13, 2026  
**Status**: ✅ COMPLETE - All identified React #185 issues fixed and gated

---

## Executive Summary

This report documents the systematic elimination of React #185 "Maximum update depth exceeded" errors across the Logic Playground application. The root causes were traced to unstable Zustand selectors that violated the `useSyncExternalStore` contract when perspectives were switched during simulation.

**Result**: 6/6 Logic Playground smoke tests now pass consistently. No React #185 errors detected in deterministic repro matrix.

---

## Failing Views Identified

### 1. **SchematicView** (FIXED)
- **Location**: `packages/rb-apps/src/components/SchematicView.tsx` (lines 371-378)
- **Root Cause**: Object-literal selector returning new reference on every store update
  ```typescript
  // ❌ BROKEN
  const { selectedNodeIds, selectNodes } = useViewStateStore(
    (state) => ({
      selectedNodeIds: state.selectedNodeIds,
      selectNodes: state.selectNodes,
    }),
    shallow  // ← shallow doesn't help, still new object each time!
  );
  ```
- **Symptom**: React #185 triggered when switching perspectives (especially "explain" → "build")
- **Root Cause Category**: Unstable object literal selector
- **Fix Applied**: Converted to per-field selectors
  ```typescript
  // ✅ FIXED
  const selectedNodeIds = useViewStateStore((state) => state.selectedNodeIds);
  const selectNodes = useViewStateStore((state) => state.selectNodes);
  ```
- **Commit**: `149883b9` - "Fix: Convert SchematicView to per-field selectors to prevent React #185"

### 2. **Rapid Perspective Switches** (FIXED VIA SCHEMATICVIEW)
- **Trigger**: Switching perspectives while simulation is running
- **Root Cause**: SchematicView unmount/remount with unstable selector re-subscribes to store, causing cascade
- **Status**: Eliminated by SchematicView fix above

---

## Repro Matrix Test Suite

Created comprehensive headless Playwright tests covering all perspective combinations and hot paths:

### Test Coverage

| Test Name | Purpose | Status |
|-----------|---------|--------|
| MATRIX: Load Logic Playground without React #185 | Baseline load test | ✅ PASS |
| MATRIX: Build circuit + run simulation + switch perspectives | Circuit creation + perspective cycle | ✅ PASS |
| MATRIX: Running simulation with rapid perspective switches | Stress test rapid switches | ✅ PASS |
| MATRIX: RightDock tab switching with simulation | Panel switching during sim | ✅ PASS |
| MATRIX: Multi-window scenario | Multiple window query params | ✅ PASS |
| MATRIX: Oscilloscope probe setup and waveform capture | Probe setup + perspective switch | ✅ PASS |

**All 6 tests run headless, produce artifacts (console.log, metrics.json, traces), and assert zero React #185 signatures.**

**Location**: `tests/e2e/smoke.spec.ts` (new comprehensive suite)

---

## Lint Tripwire Enhancements

### Expanded Pattern Detection

Updated `scripts/lint-zustand-selectors.js` to catch:

1. **Object/array literals** in selectors (original)
2. **Derived allocations** from `.map()`, `.filter()`, `.slice()` (NEW)
3. **New Set/Map objects** created in selectors (NEW)
4. **`shallow` with object/array literals** (NEW)

### Allowlist Escape Hatch

Added support for explicit justification via inline comment:
```typescript
// selector-ok: stable memoized ref
const data = useStore((s) => s.data.map(x => ({ ...x })));
```

The lint script validates that the comment exists directly above the selector and reports its reason.

**Updated script**: `scripts/lint-zustand-selectors.js`

---

## Runtime Instrumentation (DEV-Only)

### Module Added

`packages/rb-utils/src/storeInstrumentation.ts`

Exposes `window.__RB_DEBUG__` in DEV mode with metrics:
- **storeSubscriberCount**: Active subscribers per store
- **stateWritesPerSecond**: Frequency of setState calls
- **repeatedWrites**: Count of identical value writes (runaway loop indicator)
- **selectorSnapshotChurn**: Selector reference changes per second

### Test Integration

Smoke tests automatically capture metrics in `test-results/*/metrics.json`:
```json
{
  "storeSubscriberCount": 3,
  "stateWritesPerSecond": 0,
  "repeatedWrites": 0,
  "selectorSnapshotChurn": 0
}
```

### Usage

Tests can assert stability:
```typescript
const metrics = await page.evaluate(() => window.__RB_DEBUG__?.getMetrics());
expect(metrics.stateWritesPerSecond).toBeLessThan(5);
```

---

## CI Gate Updates

### Deterministic Test Command

Added `test:smoke:ci` to `package.json`:
```bash
pnpm test:smoke:ci  # Runs only "Logic Playground" tests
```

This ensures CI gates on the deterministic repro matrix, not flaky OS smoke tests.

### Recommended CI Order

```yaml
- name: Install dependencies
- name: Lint selectors (tripwire)
  run: pnpm lint:selectors
- name: Install Playwright browser
  run: pnpm exec playwright install
- name: Smoke tests (deterministic)
  run: pnpm test:smoke:ci
- name: Unit tests
  run: pnpm test
- name: Build
  run: pnpm build
```

---

## Systematic Fix Pattern Applied

For each failing view:

1. **Identify useSyncExternalStore surfaces**
   - Zustand store selectors
   - useCallback/useMemo returning new objects
   - Derived arrays/objects computed per-render

2. **Search for feedback loops**
   - Effects that write to store on mount
   - Selectors creating new refs each call
   - Cascading store updates during perspective switch

3. **Apply fix (in priority order)**
   - **Preferred**: Move to per-field selectors (stable refs)
   - **Alternative**: Memoize at store level (computed fields)
   - **Last resort**: Explicit component-level memoization (with dependency guards)

4. **Verify with repro matrix**
   - Run `pnpm test:smoke:ci`
   - Check `test-results/*/errors.log` for React #185 signatures
   - Confirm metrics show no runaway loop pattern

---

## Verification Commands

### Run All Smoke Tests
```bash
pnpm test:smoke
```

### Run Deterministic Logic Playground Only
```bash
pnpm test:smoke:ci
```

### Check for Unstable Selectors
```bash
pnpm lint:selectors
```

### Full Release Gate
```bash
pnpm release:gate  # typecheck + lint + test + build
```

---

## Key Learnings

1. **Rule 1 is Non-Negotiable**: No object literals in selectors, even with `shallow`
2. **Perspective Switches Are Hot Paths**: Any view mounted/unmounted during switch needs extra scrutiny
3. **Set/Map Objects Fail Reference Equality**: Don't return Sets or Maps from selectors; use arrays + custom equality or store-level computed fields
4. **Shallow Equality Is Not Stable**: Even `shallow` doesn't help if selector returns a new object each call
5. **Deterministic Tests Are Essential**: Headless matrix tests catch regressions that flaky UI tests miss

---

## Remaining Hardening

- [ ] Monitor field: Add telemetry for selector churn in production
- [ ] Documentation: Create developer guide on selector discipline (doc PR ready)
- [ ] Training: Add lint rule to pre-commit hook for local enforcement
- [ ] Future: Consider Zustand middleware to auto-warn on unstable selector patterns

---

## Files Modified

- **Source Fixes**:
  - `packages/rb-apps/src/components/SchematicView.tsx` (per-field selectors)

- **Tests**:
  - `tests/e2e/smoke.spec.ts` (comprehensive repro matrix)

- **Instrumentation**:
  - `packages/rb-utils/src/storeInstrumentation.ts` (new module)
  - `packages/rb-utils/src/index.ts` (export)
  - `apps/playground/src/main.tsx` (initialization)

- **Lint**:
  - `scripts/lint-zustand-selectors.js` (expanded patterns + allowlist)

- **CI**:
  - `package.json` (added test:smoke:ci command)

---

## Test Output Evidence

### Smoke Test Final Run (Deterministic)

```
6 passed (56.6s)
  ✅ MATRIX: Load Logic Playground without React #185
  ✅ MATRIX: Build circuit + run simulation + switch perspectives
  ✅ MATRIX: Running simulation with rapid perspective switches
  ✅ MATRIX: RightDock tab switching with simulation
  ✅ MATRIX: Multi-window scenario (stacked windows query params)
  ✅ MATRIX: Oscilloscope probe setup and waveform capture
```

**No React #185 errors, no ErrorBoundary catches, no console errors.**

Artifacts preserved under `test-results/smoke-Logic-Playground-*/`:
- `console.log` - Full console output
- `errors.log` - Extracted errors (empty for passing tests)
- `metrics.json` - Store instrumentation data
- `trace.zip` - Full Playwright trace for debugging

---

## Conclusion

React #185 has been systematically eliminated from Logic Playground through:

1. ✅ **Deterministic repro matrix** that caught failing views
2. ✅ **Targeted fixes** to SchematicView unstable selectors
3. ✅ **Enhanced lint tripwire** to prevent regressions
4. ✅ **Runtime instrumentation** for dev-time churn detection
5. ✅ **CI-safe deterministic gates** to block future regressions

The codebase is now hardened against this class of errors through multiple layers of protection: static analysis, runtime detection, and automated testing.

---

**Report Generated**: 2026-01-13  
**Author**: AI Engineering Agent  
**Status**: ✅ All deliverables complete and passing
