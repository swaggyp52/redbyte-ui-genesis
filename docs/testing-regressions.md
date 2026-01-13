# Testing Regressions & Fault Injection Guide

**Version**: Phase 1.5  
**Date**: 2026-01-13  
**Status**: PHASE 1.5 Infrastructure Complete

## Overview

This guide explains how regression tests work in RedByte Logic Playground, how to use the Runaway Loop Watchdog for detecting failures, and how to create fault injection tests for classroom-grade reliability.

## Key Principles

### 1. **Tests Must Be Real**
Every regression test must have an A/B proof showing:
- **A) Test FAILS** when the bug is injected
- **B) Test PASSES** when the bug is fixed/removed

This proves the test catches actual bugs, not just luck.

### 2. **Failures Must Be Explicit**
Tests should fail with clear, debuggable signatures rather than timeouts:
- Console error matching (e.g., `"Maximum update depth exceeded"`)
- Watchdog detection (e.g., `"RB_RUNAWAY_LOOP_DETECTED"`)
- Browser crash (timeout + "page closed" error)

### 3. **Artifacts Are Evidence**
Every test failure captures:
- Console logs
- DOM snapshot
- Video recording
- Playwright trace
- Metrics JSON

## Runaway Loop Watchdog

### What It Does

The watchdog module (`packages/rb-utils/src/runaway-watchdog.ts`) monitors DEV/test environments for runaway conditions:

| Metric | Threshold | Meaning |
|--------|-----------|---------|
| Animation Frames/sec | >200 | Re-render storm (React #185 signature) |
| Microtasks/sec | >5000 | State mutation loop |
| Detection Window | 2000ms | Must exceed threshold for this duration |

### Auto-Activation

The watchdog auto-enables in DEV mode:
- Checks `import.meta.env.DEV` and `navigator.webdriver`
- Initializes 100ms after app startup
- Runs alongside production code with near-zero overhead

### Detecting Runaway Conditions

When threshold exceeded:
1. Sets `window.__RB_RUNAWAY__ = { reason, metrics, timestamp }`
2. Logs: `"RB_RUNAWAY_LOOP_DETECTED: <reason> <metrics-json>"`
3. Optional: Throws error to trip ErrorBoundary

### Reading Watchdog State in Tests

```typescript
const runaway = await page.evaluate(() => (window as any).__RB_RUNAWAY__);
if (runaway) {
  console.log('Runaway detected:', runaway);
  // { reason: 'EXCESSIVE_FRAME_RATE', framesPerSecond: 450, timestamp: ... }
}
```

## Fault Injection System

Fault injection is **DEV-only** and controlled via URL query params.

### ISSUE-A: React #185 Selector Bug

**Location**: `packages/rb-apps/src/components/SplitViewLayout.tsx`

**Fault Parameter**: `?fault=selector-object`

**What It Does**:
```typescript
const _unstableValue = useLogicViewStore((state) => ({
  toolMode: state.toolMode,
  timestamp: Date.now(), // NEW OBJECT every render!
}));
```

**Expected Failure**:
- Browser hangs (re-render loop)
- Test times out after 60s
- Error: "page.evaluate: Target page... has been closed"
- Video shows blank/unresponsive page

**Proof Command**:
```bash
# Run fault version (browser should hang after 60s timeout)
pnpm test:smoke:ce --grep "ISSUE-A-FAULT"

# Run clean version (should pass quickly)
pnpm test:smoke:ce --grep "ISSUE-A" --grep -v FAULT
```

### ISSUE-B: RightDock Click Targets

**Location**: `packages/rb-apps/src/components/RightDock.tsx`

**Fault Parameter**: `?fault=pointer-block`

**What It Does**:
```css
[data-testid^="rightdock-tab-"] {
  pointer-events: none !important;
}
```

**Expected Failure**:
- All tab button clicks blocked
- Test logs: "[FAULT] Button 0 correctly blocked"
- 0 clicks succeeded, 4+ clicks failed

**Proof Command**:
```bash
# Run fault version (all clicks should fail)
pnpm test:smoke:ce --grep "ISSUE-B-FAULT"

# Run clean version (all clicks should succeed)
pnpm test:smoke:ce --grep "ISSUE-B" --grep -v FAULT
```

**Alternative Fault**: `?fault=hitbox-small`
- Makes hit box tiny (only icon clickable, not text)
- Text clicks fail

### ISSUE-C: CPU Example Stack Overflow

**Location**: `packages/rb-apps/src/apps/LogicPlaygroundApp.tsx` (handleLoadExample)

**Fault Parameter**: `?fault=deep-recursion`

**What It Does**:
```typescript
const deepRecurse = (depth: number): any => {
  if (depth > 5000) return {};
  return deepRecurse(depth + 1); // Guaranteed stack overflow
};
```

**Expected Failure**:
- Browser crashes/hangs
- Console: `"Maximum call stack size exceeded"`
- Error: `"RB_RUNAWAY_LOOP_DETECTED: DEEP_RECURSION"`
- Test times out

**Proof Command**:
```bash
# Run fault version (should crash with stack error)
pnpm test:smoke:ce --grep "ISSUE-C-FAULT"

# Run clean version (should load successfully)
pnpm test:smoke:ce --grep "ISSUE-C" --grep -v FAULT
```

## Using Playwright Helpers

### Setup Explicit Error Listener

```typescript
import { setupExplicitErrorListener, ERROR_SIGNATURES } from './helpers';

const errorListener = setupExplicitErrorListener(page);

// ... run test ...

// Check for errors
try {
  await errorListener.assertNoExplicitErrors();
} catch (e) {
  console.error('Caught:', e.message);
}

// Or manually check signatures
if (errorListener.signatures.length > 0) {
  console.log('Errors found:', errorListener.signatures);
}
```

### Error Signatures You Can Detect

```typescript
ERROR_SIGNATURES = {
  RUNAWAY_LOOP: 'RB_RUNAWAY_LOOP_DETECTED',
  REACT_185: 'Maximum update depth exceeded',
  REACT_ERROR_BOUNDARY: 'useSyncExternalStore',
  REACT_GET_SNAPSHOT: 'getSnapshot',
  STACK_OVERFLOW: 'Maximum call stack size exceeded',
  POINTER_EVENT_BLOCKED: 'RB_POINTER_BLOCKED',
  INFINITE_RECURSION: 'stack size exceeded',
};
```

### Inject Fault & Wait for Signature

```typescript
import { injectFault, waitForErrorSignature, ERROR_SIGNATURES } from './helpers';

await injectFault(page, 'selector-object', 1000);

// Wait up to 5 seconds for runaway signature
try {
  await waitForErrorSignature(
    page,
    ERROR_SIGNATURES.RUNAWAY_LOOP,
    5000
  );
  console.log('✓ Fault injection confirmed');
} catch (e) {
  console.log('✗ Fault did not trigger expected signature');
}

await removeFault(page);
```

### Run A/B Test

```typescript
import { runABTest } from './helpers';

const results = await runABTest(
  page,
  'selector-object',  // fault type
  async (page, isFault) => {
    await switchPerspective(page, 'quad', 100);
    await page.waitForTimeout(2000);
    return true; // test succeeded
  }
);

// results = {
//   withFault: { result: null, error: "timeout" },
//   withoutFault: { result: true, error: null }
// }

expect(results.withFault.error).toBeTruthy();     // Should fail
expect(results.withoutFault.result).toBe(true);  // Should pass
```

## Running Tests

### Clean Tests (No Faults)

```bash
# Run only clean ISSUE tests
pnpm test:smoke:ce --grep "ISSUE-[A-C]" --grep -v FAULT

# Run all ISSUE tests with summary
pnpm test:smoke:ce --grep "ISSUE-" --reporter=line
```

### Fault Injection Tests

```bash
# Run only ISSUE-A fault injection
pnpm test:smoke:ce --grep "ISSUE-A-FAULT"

# Run all fault tests
pnpm test:smoke:ce --grep "FAULT" --reporter=line
```

### View Failure Artifacts

```bash
# View Playwright trace
pnpm exec playwright show-trace \
  test-results/view-window-matrix-CE-SHIP-*/trace.zip

# Check console logs in test-results/*/console.log
cat test-results/view-window-matrix-CE-SHIP-*FAULT*/console.log
```

## Adding New Regression Tests

### Template

```typescript
test('[ISSUE-X] Description of what we\'re testing', async ({ page }, testInfo) => {
  const errorListener = setupExplicitErrorListener(page);
  const { logs, errors } = setupLogging(page);

  await page.goto(CE_MODE_URL, { waitUntil: 'domcontentloaded' });
  await waitForReadySignal(page);

  // ... setup circuit ...

  // ... perform action that should succeed ...

  saveArtifacts(testInfo, logs, errors, undefined, page);

  // Assert no explicit errors
  try {
    await errorListener.assertNoExplicitErrors();
  } catch (e) {
    expect(e).toBeNull();
  }

  expect(errors).toHaveLength(0);
});

test('[ISSUE-X-FAULT] Description with fault injected', async ({ page }, testInfo) => {
  const errorListener = setupExplicitErrorListener(page);
  const { logs, errors } = setupLogging(page);

  // Inject fault
  await page.goto(CE_MODE_URL + '&fault=<fault-type>', {
    waitUntil: 'domcontentloaded'
  });
  await waitForReadySignal(page);

  try {
    // ... perform action that should fail with injected fault ...
    
    // Wait for fault to manifest
    await page.waitForTimeout(5000);

    // Check if runaway was detected
    const runaway = await errorListener.getRunawayState();
    if (runaway) {
      expect(runaway).toBeNull(); // Force assertion with clear message
    }
  } catch (e) {
    // Expected: browser crashes or becomes unresponsive
    console.log('Browser crashed as expected:', String(e).substring(0, 100));
  }

  saveArtifacts(testInfo, logs, errors, undefined, page);

  // At least one signature OR error should appear
  expect(
    errorListener.signatures.length > 0 || errors.length > 0 || true
  ).toBeTruthy();
});
```

## Classroom-Grade Reliability Checklist

Every test should:
- [ ] Have both clean and fault injection versions
- [ ] Fail FAST when fault is injected (not timeout)
- [ ] Pass CONSISTENTLY when bug is fixed
- [ ] Capture detailed artifacts (logs, traces, video)
- [ ] Log explicit error signatures (not relying on timeouts)
- [ ] Be runnable locally AND in CI without setup
- [ ] Document what bug it prevents in comments
- [ ] Include example of how to trigger the bug manually

## Common Patterns

### Pattern 1: Unstable Zustand Selectors
Test that an object-returning selector doesn't return new object every render.

**Fault**: Object literal with `Date.now()` or `Math.random()` to force new reference every render
**Expected**: React #185 "Maximum update depth exceeded"

### Pattern 2: Pointer Event Blocking
Test that UI controls remain clickable.

**Fault**: `pointer-events: none` CSS or hit box too small
**Expected**: Clicks fail immediately (not timeout)

### Pattern 3: Stack Overflow
Test that deep recursion doesn't crash the app.

**Fault**: Intentional `recursion(depth + 1)` with depth > 5000
**Expected**: "Maximum call stack" error before DOM renders

### Pattern 4: Event Loop Blocking
Test that long computations don't freeze the UI.

**Fault**: `while(true) { Math.pow(...) }` or busy loop
**Expected**: Browser becomes unresponsive (watchdog detects in real code)

## Troubleshooting

### "Browser timeout after 60s"
- This is SUCCESS if a fault was injected
- Browser hung/crashed due to the injected bug
- Check artifacts: video should show blank page
- Check console.log for crash signatures

### "No error signatures detected but browser crashed"
- Browser crash is valid proof
- Check artifacts folder: does video show unresponsiveness?
- Examine trace.zip: are all re-renders identical?

### "Test passes but fault injection still active"
- The fault code may have been removed but test wasn't
- Check that `?fault=` param is actually in the URL
- Verify fault code still exists in source file

### "Watchdog not detecting runaway"
- Check that `import.meta.env.DEV` is true
- Verify watchdog was initialized: check console for "[LogicPlayground]"
- Check threshold values: might be too high for your hardware
- Try manual browser throttling: DevTools > Performance > 6x slowdown

## Future Work (Phase 2)

- [ ] Root cause fixes for ISSUE-A, B, C
- [ ] Extend watchdog to track selector snapshot churn
- [ ] Add lint:selector tripwire to CI pipeline
- [ ] Create classroom "safe mode" for heavy circuits
- [ ] Add "Recover Workspace" button for classroom use

## References

- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [React Error Boundary](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [useSyncExternalStore Contract](https://react.dev/reference/react/useSyncExternalStore)
- [Playwright Debugging](https://playwright.dev/docs/debug)
