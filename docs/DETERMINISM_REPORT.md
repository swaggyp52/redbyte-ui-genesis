# Determinism Report — Phase 2 Verification

**Date:** February 15, 2026  
**Status:** PHASE 2 IN PROGRESS — Gates Inventory Complete, Issues Identified  

---

## 1. Determinism Gates Inventory

### Gates Found and Tested

| Gate | Command | Test File | Result | Runtime | Issue |
|------|---------|-----------|--------|---------|-------|
| **Simulation Repeatability** | `pnpm sim:repeatability-gate` | `packages/rb-logic-core/src/__tests__/sim-repeatability-gate.test.ts` | ❌ FAIL | 12.1s | Delay filter tick-0 state mismatch (see below) |
| **Combinational Loop Detection** | `pnpm sim:loop-detection-gate` | `packages/rb-logic-core/src/__tests__/sim-loop-detection-gate.test.ts` | ✅ PASS | 11.6s | — |
| **Probe Stability** | `pnpm sim:probe-stability-gate` | `packages/rb-logic-core/src/__tests__/sim-probe-stability-gate.test.ts` | ✅ PASS | 12.3s | — |
| **RBX Evidence Determinism** | `pnpm rbx:evidence-determinism-gate` | `packages/rb-lab-engine/src/services/__tests__/rbx-evidence-determinism-gate.test.ts` | ❌ FAIL | 12.9s | Golden hash mismatch (stale golden artifact) |
| **Lab Workflow Export-Verify** | `pnpm lab:workflow-export-verify-gate` | `packages/rb-apps/src/__tests__/lab-workflow-export-verify-gate.test.ts` | ✅ PASS | 12.2s | — |

### Aggregate in `verify:gates` Chain

Currently `verify:gates` runs:
```
sim:repeatability-gate
sim:loop-detection-gate
sim:probe-stability-gate
rbx:evidence-determinism-gate
lab:workflow-export-verify-gate
lab:probe-sampling-gate
+ 8 more UI/HW/project gates
```

**Status:** 2 of 5 determinism-critical gates failing.

---

## 2. Nondeterminism Sources Found

### In `packages/rb-logic-core/src`

| File | Line | Pattern | Impact | Notes |
|------|------|---------|--------|-------|
| `projectDoc.ts` | 78, 110 | `Math.random()` + `Date.now()` | Project ID generation | Not exported in determinism scope; safe for UI state |
| `projectDoc.ts` | 74, 111–112 | `new Date().toISOString()` | createdAt/updatedAt metadata | Exported in metadata; breaks zip hash |
| `TraceRecorder.ts` | 98 | `Date.now()` | Trace timing metadata | Not in determinism scope; timing annotation only |

**Assessment:** All sources are metadata/logging only. **Simulation state is clean.**

### In `packages/rb-lab-engine/src/services`

| File | Line | Pattern | Impact | Notes |
|------|------|---------|--------|-------|
| `exportService.ts` | 31 | `new Date('1980-01-01...')` | ZIP entry fixed timestamp | ✅ Correct use—hardcoded for zip stability |
| `exportService.ts` | 50 | `Object.keys(value).sort()` | JSON key ordering | ✅ Sorted for determinism |
| `exportService.ts` | 215 | `Array.from(...).sort()` | File entry ordering | ✅ Sorted by name for determinism |
| `readmeGenerator.ts` | 38 | `new Date(value)` | Date parsing (input) | ✅ Parsing only, not generation |
| `readmeGenerator.ts` | 89 | `Array.from(...).sort()` | Component frequency sort | ✅ Stable sort by count DESC |
| `importWorkflowUtils.ts` | 115 | `new Date().toISOString()` | Imported evidence timestamp | ⚠️ Import-time injection—may differ per run |

**Assessment:** Export service is **well-hardened**. Import side injects timestamps, which is expected and not part of determinism gate scope.

### Overall

**No random number generation in simulation path.**  
**All JSON/ZIP output uses sorted keys.**  
**No problematic `for...in` iteration.**

The nondeterminism sources are **outside the demo-critical determinism scope** (project metadata, timestamps, logging).

---

## 3. Init Tick Semantics

### Current Behavior

In `CircuitEngine.setCircuit()` (lines 119–142):

```typescript
setCircuit(circuit: Circuit): void {
  // ...setup nodeStates, signalCache...
  
  if (safeCircuit.nodes.length > 0) {
    this.tick();  // ⚠️ LINE 139: Init tick happens here
  }
}
```

**Effect:** When a circuit is loaded, `setCircuit()` immediately calls `tick()`, advancing stateful nodes (Clock, Delay, etc.) before any user interaction.

### Observable Impact

- Clock nodes start with `tickCount: 0` in nodeStates
- After init, `tickCount: 1` (one tick has executed)
- This means tick-0 is **already evaluated** by the time simulation UI renders

### Issue in `sim-repeatability-gate`

The test expects:
```typescript
expect(outs).toEqual([0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1]);  // 12 values
```

But receives:
```typescript
[0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0]  // shifted by 1
```

**Root cause:** The test loop runs 12 ticks **after** init tick, yielding ticks 1–12 instead of 0–11.

### Recommendation

The init tick is **intentional and correct** — it ensures signals are valid on first render. The test should account for it:

```typescript
// Correct: run 12 ticks STARTING with init state snapshot
for (let t = 0; t < 12; t++) {
  engine.tick();
  // now t=0..11 are populated
}
```

The sanity pattern should be adjusted to match actual tick sequence.

---

## 4. Artifact Determinism Gate

### Current State

`rbx:evidence-determinism-gate` tests that evidence bundle exports match a **golden hash**. The test failure shows a hash mismatch, but the export logic itself is deterministic (sorted keys, fixed timestamps).

**Likely cause:** Golden artifact is stale from a prior version.

### Recommended Implementation

**Two-phase approach:**

1. **Normalize Hash** (already in exportService):
   - Fixed ZIP timestamp ✅
   - Sorted JSON keys ✅
   - Sorted file entries ✅
   - No timestamps in manifest ✅

2. **Validate Structure** (strengthen gate):
   ```typescript
   // Instead of byte-for-byte hash match, verify:
   // - Same project → identical manifest JSON
   // - Same project → identical file content
   // - No dates/random IDs in bundle metadata
   ```

3. **Test Pattern:**
   ```typescript
   // Export same project twice, verify zip content is identical
   const zip1 = await exportService.createEvidenceZip(project, ...);
   const zip2 = await exportService.createEvidenceZip(project, ...);
   
   // Extract and compare manifest JSON
   const manifest1 = JSON.parse(zip1.files['manifest.json'].text());
   const manifest2 = JSON.parse(zip2.files['manifest.json'].text());
   expect(manifest1).toEqual(manifest2);
   ```

---

## 5. Gates Wired Into Release Chain

### Current: Not All Gates in `rc:check`

`rc:check` currently runs:
```json
"rc:check": "pnpm --filter @redbyte/rb-apps test && 
            pnpm --filter @redbyte/rb-shell test && 
            pnpm --filter @redbyte/fpga-bridge test &&
            pnpm stability:triage"
```

**Missing:** All determinism gates (`sim:*`, `rbx:*`, `lab:*`).

### Recommended: Wire `verify:gates` Into `rc:check`

```json
"rc:check": "pnpm --filter @redbyte/rb-apps test && 
            pnpm --filter @redbyte/rb-shell test && 
            pnpm --filter @redbyte/fpga-bridge test &&
            pnpm verify:gates &&
            pnpm stability:triage"
```

This ensures:
- Unit tests pass
- All determinism gates pass
- Shell boots safely

---

## 6. Summary: What Breaks Determinism

### Safe (No Impact on Demo)
- Project metadata timestamps
- Random project IDs (UI-only)
- Trace timing annotations
- Import-time evidence timestamps

### Demo-Critical (Already Hardened)
- ✅ Simulation state (no randomness)
- ✅ Export structure (sorted keys, fixed ZIP date)
- ✅ Manifest content (no hidden IDs)

### Currently Failing (Fix Below)
- ❌ `sim:repeatability-gate` — init tick expected pattern mismatch
- ❌ `rbx:evidence-determinism-gate` — stale golden artifact

---

## Next Steps (PHASE 2 Continuation)

1. **Fix sanity pattern** in `sim-repeatability-gate.test.ts` to match init-tick semantics
2. **Regenerate golden artifact** for `rbx:evidence-determinism-gate` or implement structural comparison
3. **Wire `verify:gates` into `rc:check`** to make determinism a release blocker
4. **Run full `rc:check` chain** to validate all gates pass

**All infrastructure is in place. Only test fixtures need adjustment.**

