# PHASE 0: Evidence Pipeline - COMPLETE

**Status:** ✅ COMPLETE
**Date:** January 13, 2025
**Commit:** 200a312d

## Objective

Establish a deterministic evidence pipeline for Logic Playground that:
1. Provides app readiness signals (not timing hacks)
2. Captures failure evidence (traces, screenshots, DOM snapshots)
3. Supports robust regression test automation

## Changes Implemented

### 0.1: Readiness Signal

**Files:**
- [packages/rb-apps/src/apps/LogicPlaygroundApp.tsx](packages/rb-apps/src/apps/LogicPlaygroundApp.tsx#L459-L474)

**Implementation:**
```typescript
// After TopCommandBar + RightDock + main view mount:
useEffect(() => {
  const rootEl = document.querySelector('[data-testid="logic-playground-root"]');
  const topBarEl = document.querySelector('[data-testid="top-command-bar"]');
  const rightDockEl = document.querySelector('[data-testid="right-dock"]');
  
  if (rootEl && topBarEl && rightDockEl) {
    rootEl.setAttribute('data-ready', 'true');
    window.dispatchEvent(new Event('rb:logic-playground-ready'));
  }
}, []);
```

**Why:** Eliminates arbitrary `waitForTimeout(1500)` that can cause flakes and false negatives.

### 0.2: Enhanced Playwright Helpers

**Files:**
- [tests/e2e/view-window-matrix.spec.ts](tests/e2e/view-window-matrix.spec.ts#L119-L140)

**Enhancements:**
1. `waitForReadySignal(page, timeoutMs)` — deterministic readiness waiter
2. `saveArtifacts()` now captures:
   - console.log + errors.log (as before)
   - metrics.json (debug counters)
   - **ui-snapshot.html** (DOM outerHTML on failure) ← NEW
   - trace.zip + screenshot.png (auto-captured by Playwright config)

**Why:** When tests fail, we now have the actual DOM state, not just console logs.

### 0.3: Robust Test Selectors

**Files:**
- [packages/rb-apps/src/components/TopCommandBar.tsx](packages/rb-apps/src/components/TopCommandBar.tsx#L92)
- [packages/rb-apps/src/components/RightDock.tsx](packages/rb-apps/src/components/RightDock.tsx#L340)

**Added data-testid attributes:**
```typescript
<div data-testid="top-command-bar">     // TopCommandBar
<div data-testid="right-dock">          // RightDock
<div data-testid="logic-playground-root"> // Root (already existed)
```

**Why:** Emoji text in RightDock tabs renders differently across browsers. data-testid is stable.

## Regression Tests Updated

All 3 ISSUE regression tests now:
1. Use `waitForReadySignal()` instead of `await page.waitForTimeout(1500)`
2. Pass `page` to `saveArtifacts()` for DOM snapshot capture
3. Expect no console errors or React #185 signatures

```
✅ [ISSUE-A] Quad View perspective without React #185
✅ [ISSUE-B] RightDock controls are clickable
✅ [ISSUE-C] CPU example loads without stack overflow
```

## Validation Outputs

### Build (pnpm build)
```
✅ No TypeScript errors
✅ packages/rb-apps build: ✓ built in 8.84s
✅ packages/rb-shell build: ✓ built in 9.39s
✅ apps/playground build: ✓ built in 5.43s
```

### Unit Tests (pnpm test)
```
Test Files  72 passed | 4 skipped (76)
Tests       705 passed | 41 skipped (746)
Duration    17.26s
✅ 0 failures
```

### Regression Tests (pnpm test:smoke:ce --grep "ISSUE-")
```
Running 3 tests using 1 worker
[1/3] [ISSUE-A] Quad View perspective without React #185          ✅ PASS
[2/3] [ISSUE-B] RightDock controls are clickable                  ✅ PASS (4/4 tabs clicked)
[3/3] [ISSUE-C] CPU example loads without stack overflow          ✅ PASS

3 passed (21.8s)
```

## Key Artifacts

When tests run, you'll now find in test-results/:
- `console.log` — All console messages (last 1000 lines)
- `errors.log` — Only errors/React #185 signatures
- `metrics.json` — Store instrumentation data
- **`ui-snapshot.html`** — Full DOM tree on failure
- `trace.zip` — Playwright browser trace (auto-captured on failure)
- Screenshots (auto-captured by Playwright)

## Next Steps

### PHASE 1: Repro Tests → Real Failures
- Verify tests FAIL on real student errors (not just false positives)
- Ensure selectors handle CE mode vs normal mode
- Stress-test example loading (especially CPU example)

### PHASE 2: Root Cause Fixes
- Fix Quad view React #185 (store writes on mount)
- Fix CPU example stack overflow (iterative traversal)
- Fix RightDock click targets (hit box sizing)

### PHASE 3: CI Gates
- Add `lint:selectors` to block unstable patterns
- Gate all PRs on:
  - pnpm test
  - pnpm build
  - pnpm test:smoke:ci (deterministic smoke tests only)

## References

- **AI_STATE.md:** Updated with Phase 0 completion
- **Ticket:** "Make RedByte classroom-grade for freshmen"
- **Non-negotiable rules:**
  1. ✅ All claims backed by terminal output
  2. ✅ No timing hacks (readiness signals implemented)
  3. ✅ Tests properly instrumented for failure capture
  4. ✅ Headless + reproducible automation

---

**Phase 0 Status:** READY FOR PHASE 1
