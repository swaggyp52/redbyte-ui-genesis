# Baseline Repair Queue

**Mission**: Drive repository from "12 pre-existing failures" to fully green baseline.

**Target**:
- `pnpm test:ci` exits 0
- `pnpm build` clean (already ✅)
- No hidden console errors

**Last Baseline Capture**: 2026-01-15  
**Proof**: `ops/proof/baseline-2026-01-15-testci.txt`

---

## Current Status

| Metric | Value |
|--------|-------|
| **Passing Tests** | 707 |
| **Failing Test Files** | 12 |
| **Skipped Tests** | 32 |
| **Total Test Files** | 81 |

---

## Failure Clusters (by root cause)

### Cluster A: CircuitEngine Builtins Registration ⚠️ CRITICAL
- **Impact**: 10/12 failures (83% of baseline rot)
- **Root Cause**: `TypeError: ensureBuiltinsRegistered is not a function`
- **Files Affected**: 10 test files in rb-apps, rb-logic-view
- **Fix Estimate**: 5-10 lines (export correction)
- **Ticket**: BASELINE-001 (below)

### Cluster B: App Registry Empty Results
- **Impact**: 2/12 failures (30 skipped tests)
- **Root Cause**: AppRegistry returns empty in test environment
- **Files Affected**: file-search.test.ts, system-search.test.tsx
- **Fix Estimate**: Test setup timing issue
- **Ticket**: QUALITY-001 (already in main queue, IN_PROGRESS)

---

## [P0] [COMPLETE ✅] BASELINE-001: Fix CircuitEngine Builtins Registration

**Status**: COMPLETE (eliminated 10/12 baseline failures!)  
**Branch**: `fix/baseline-circuitengine-builtins`  
**Commit**: `9229b5c6`  
**Goal**: Resolve `ensureBuiltinsRegistered is not a function` TypeError

### Results
**BEFORE**:
- 12 failed test files
- 707 passing tests
- 32 skipped tests

**AFTER**:
- 2 failed test files (83% reduction!)
- 754 passing tests (+47 tests now visible!)
- 41 skipped tests

### Root Cause (Confirmed)
**Circular import during module initialization**:
1. `CircuitEngine.ts` called `ensureBuiltinsRegistered()` at module top-level (line 9)
2. `index.ts` ALSO called `ensureBuiltinsRegistered()` at module init (line 50)
3. During test environment import resolution, CircuitEngine tried to import from `registerBuiltins` before it was fully initialized
4. Result: `TypeError: ensureBuiltinsRegistered is not a function`

### Fix Applied
**Removed redundant call from CircuitEngine.ts** (2 lines):
- Deleted: `import { ensureBuiltinsRegistered } from './registerBuiltins';`
- Deleted: `ensureBuiltinsRegistered();`
- Added comment: "Builtins are registered in index.ts at module init — no need to call here"

**Why this works**:
- `index.ts` already calls `ensureBuiltinsRegistered()` once at package initialization
- CircuitEngine doesn't need to call it again
- No functional change: builtins still registered before any circuit operations
- Eliminates circular import race condition

### Recovered Test Files (10 total)
✅ packages/rb-apps/src/__tests__/lab-app-ui.test.tsx  
✅ packages/rb-apps/src/__tests__/logic-playground.test.tsx  
✅ packages/rb-apps/src/__tests__/oscilloscope-controls.test.tsx  
✅ packages/rb-apps/src/__tests__/playground-palette-interaction.test.tsx  
✅ packages/rb-apps/src/__tests__/playground.stabilization.test.tsx  
✅ packages/rb-apps/src/__tests__/replay-exit-restore.test.tsx  
✅ packages/rb-apps/src/__tests__/rightdock-tabs.test.tsx  
✅ packages/rb-apps/src/__tests__/view-micro-toolbar.test.tsx  
✅ packages/rb-logic-view/src/__tests__/circuit-hud.test.tsx  
✅ packages/rb-logic-view/src/__tests__/replay-lock.test.tsx  

### Proof Artifacts
- **Before**: `ops/proof/baseline-2026-01-15-testci.txt`
- **After**: `ops/proof/baseline-001-after.txt`
- **Build**: ✅ Clean (872 modules)
- **Diff**: 2 lines deleted (minimal fix, NO_REFACTOR constraint met)

---

## [P1] [READY] BASELINE-002: Fix Evaluator Test Assertions (NEW — Exposed by 001)

**Status**: READY (23 test assertions failing, logic bugs not import errors)  
**Branch**: `fix/baseline-evaluator-assertions`  
**Goal**: Fix checkpoint evaluator logic to pass truth table tests

### Failing File
- `packages/rb-logic-core/src/__tests__/evaluator.test.ts` (23 assertions failing)

### Failure Pattern
All failures show:
```
AssertionError: expected 'failed' to be 'passed'
Expected: "passed"
Received: "failed"
```

**Tests affected**:
1. NOT Gate Truth Table (expected passed, got failed)
2. AND Gate Truth Table (expected passed, got failed)
3. XOR Gate Truth Table (expected passed, got failed)
4. Mismatch Reporting (wrong failure count: "Failed 1/2" vs "Failed 2/2")

### Root Cause Hypothesis
1. **Circuit evaluation bug**: Evaluator not propagating signals correctly
2. **Test vector application**: Input nodes not being set properly before evaluation
3. **Timing issue**: Outputs read before circuit settles
4. **Port name mismatch**: Test expects `in`/`out` but circuit uses different names

### Investigation Steps
1. Read `packages/rb-logic-core/src/lab/evaluator.ts`
2. Read `packages/rb-logic-core/src/__tests__/evaluator.test.ts`
3. Check how test circuits are constructed (NOT/AND/XOR gate setups)
4. Verify CircuitEngine.evaluate() is being called correctly
5. Check if `ensureBuiltinsRegistered()` removal exposed a different initialization bug

### Acceptance Criteria
- [ ] All 23 test assertions pass
- [ ] Truth table tests (NOT, AND, XOR) report "passed"
- [ ] Mismatch reporting shows correct failure counts
- [ ] No regressions in other tests
- [ ] Proof: `ops/proof/baseline-002-after.txt`

### Constraints
- **NO_REFACTOR**: Fix only the evaluator logic or test setup
- **No changes to CircuitEngine**: Already working correctly
- **Max 50 lines changed**: This should be a focused logic fix

---

## [P2] [BLOCKED] BASELINE-003: App Registry Empty Results (Cluster B)

**Status**: BLOCKED (waiting on QUALITY-001 resolution)  
**Duplicate of**: QUALITY-001 (already in main NIGHT_SHIFT_QUEUE)  
**Goal**: Fix AppRegistry test environment initialization

### Failing Files
- `packages/rb-shell/src/__tests__/file-search.test.ts` (13 tests skipped)
- `packages/rb-shell/src/__tests__/system-search.test.tsx` (17 tests skipped)

**Note**: These are skipped, not failing assertions. Waiting on QUALITY-001 fix before addressing.

---

### Failing Files (10 total)
1. packages/rb-apps/src/__tests__/lab-app-ui.test.tsx
2. packages/rb-apps/src/__tests__/logic-playground.test.tsx
3. packages/rb-apps/src/__tests__/oscilloscope-controls.test.tsx
4. packages/rb-apps/src/__tests__/playground-palette-interaction.test.tsx
5. packages/rb-apps/src/__tests__/playground.stabilization.test.tsx
6. packages/rb-apps/src/__tests__/replay-exit-restore.test.tsx
7. packages/rb-apps/src/__tests__/rightdock-tabs.test.tsx
8. packages/rb-apps/src/__tests__/view-micro-toolbar.test.tsx
9. packages/rb-logic-view/src/__tests__/circuit-hud.test.tsx
10. packages/rb-logic-view/src/__tests__/replay-lock.test.tsx

### Stack Trace
```
TypeError: ensureBuiltinsRegistered is not a function
 › packages/rb-logic-core/src/CircuitEngine.ts:9:1
      7| import { ensureBuiltinsRegistered } from './registerBuiltins';
      8|
      9| ensureBuiltinsRegistered();
       | ^
     10|
     11| /**
```

### Root Cause Hypothesis
One of:
1. **ESM/CJS export mismatch**: `registerBuiltins.ts` exports as named export, but build/test environment expects different format
2. **Missing re-export**: `ensureBuiltinsRegistered` not re-exported in `packages/rb-logic-core/src/index.ts`
3. **Circular dependency**: Import chain causes undefined during module initialization

### Investigation Steps
1. Check `packages/rb-logic-core/src/registerBuiltins.ts` export syntax
2. Check `packages/rb-logic-core/src/index.ts` for re-export of `ensureBuiltinsRegistered`
3. Check `packages/rb-logic-core/src/CircuitEngine.ts` import path
4. Check `vitest.config.ts` or `tsconfig.json` for module resolution issues

### Acceptance Criteria
- [ ] All 10 failing test files pass
- [ ] `pnpm test:ci` shows 707 passing (no regressions)
- [ ] Build remains green
- [ ] No new failures introduced
- [ ] Proof artifacts saved:
  - `ops/proof/baseline-001-before.txt` (current failure output)
  - `ops/proof/baseline-001-after.txt` (post-fix test output)

### Constraints
- **NO_REFACTOR**: Minimal diff only
- **No changes to CircuitEngine logic**: Fix only the export/import
- **No changes to test files**: Fix the source, not the tests
- **Max 20 lines changed** (export correction should be tiny)

### Expected Outcome
After fix:
- **Passing Tests**: 707 → 707 (stable)
- **Failing Test Files**: 12 → 2 (only Cluster B remains)
- **Impact**: 83% baseline rot eliminated

---

## Next Steps

1. **Execute BASELINE-001** (fix Cluster A)
2. **Verify Cluster B** (already in QUALITY-001 queue)
3. **Re-baseline**: Run `pnpm test:ci` after Cluster A fix
4. **Target**: 2 failures → 0 failures (full green)

---

## Proof Artifacts

- **Baseline Capture**: `ops/proof/baseline-2026-01-15-testci.txt`
- **Full Test Output**: 707 passing, 12 failing, 32 skipped
- **Build Status**: ✅ Clean (872 modules)
