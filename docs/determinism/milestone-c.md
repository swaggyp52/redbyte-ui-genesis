# Milestone C: Inspectable Time Travel

**Status:** Complete
**Completed:** 2025-12-28
**Contract Reference:** [CONTRACT.md](./CONTRACT.md)

---

## 1. Purpose

Milestone C adds **time travel inspection** - the ability to navigate through recorded execution history and inspect state at any event boundary.

Without this milestone, determinism would be:
- **Opaque** (can verify equality but not inspect differences)
- **Non-navigable** (can replay from start but not step through)
- **Developer-only** (no UI for non-technical users)

This milestone exists to provide the **inspection capabilities** required by CONTRACT §3.3 (Stable Time Travel) and to make determinism **accessible** via UI.

---

## 2. Scope

### What was added:

- **State inspector** - Query circuit state at any event index
- **Navigation primitives** - Step forward/backward through time
- **State diffing** - Compare snapshots and identify changes
- **Dev panel UI** - Browser-accessible determinism tools (Ctrl+Shift+D)

### What was explicitly NOT added:

- State mutation during time travel (read-only inspection only)
- Branching timelines or alternate histories
- User-facing product features (dev tools only)
- Performance optimization (correctness over speed)

Per CONTRACT §4, this milestone does **not** guarantee:
- Real-time navigation performance
- UI polish or production-readiness
- Time travel across network boundaries

---

## 3. Capabilities Introduced

### 3.1 State Inspector (`inspector.ts`)

**Capability:** Query circuit state at any event boundary in a recorded session.

**API:**
```typescript
interface CircuitStateSnapshot {
  circuit: Circuit;
  eventIndex: number;
  totalEvents: number;
  timestamp: number;
}

getStateAtIndex(
  initialCircuit: Circuit,
  eventLog: EventLogV1,
  index: number,
  options?: { engineFactory?: EngineFactory }
): CircuitStateSnapshot
```

**Execution Model:**
1. Replay from beginning up to (and including) event at `index`
2. Capture full circuit state + metadata
3. Return immutable snapshot

**Key Properties:**
- **Deterministic:** Same index always returns same snapshot
- **Idempotent:** Multiple calls with same index produce identical results
- **Boundary-aligned:** Snapshots capture state after event execution

**Maps to Contract:** §3.3 (Stable Time Travel)

---

### 3.2 Navigation Primitives (`navigation.ts`)

**Capability:** Step forward and backward through event history.

**API:**
```typescript
stepForward(
  initialCircuit: Circuit,
  eventLog: EventLogV1,
  currentSnapshot: CircuitStateSnapshot,
  options?: { engineFactory?: EngineFactory }
): CircuitStateSnapshot | null

stepBackward(
  initialCircuit: Circuit,
  eventLog: EventLogV1,
  currentSnapshot: CircuitStateSnapshot,
  options?: { engineFactory?: EngineFactory }
): CircuitStateSnapshot | null

canStepForward(snapshot: CircuitStateSnapshot): boolean
canStepBackward(snapshot: CircuitStateSnapshot): boolean
```

**Navigation Guarantees:**
- `stepForward()` moves to next event boundary (returns null if at end)
- `stepBackward()` moves to previous event boundary (returns null if at start)
- Navigation is **stable**: stepping forward then backward returns to same snapshot
- `canStep*()` predicates prevent out-of-bounds navigation

**Maps to Contract:** §3.3 (Stable Time Travel)

---

### 3.3 State Diffing (`diff.ts`)

**Capability:** Compare two snapshots and identify precise changes.

**API:**
```typescript
interface StateDiff {
  nodeChanges: NodeStateChange[];
  signalChanges: SignalChange[];
  nodesAdded: NodeAdded[];
  nodesRemoved: NodeRemoved[];
  connectionsChanged: ConnectionChange[];
}

diffState(
  before: CircuitStateSnapshot,
  after: CircuitStateSnapshot
): StateDiff
```

**Diff Types:**
- **NodeStateChange:** Node state property modified
- **SignalChange:** Port signal value changed
- **NodeAdded/Removed:** Topology modifications
- **ConnectionChange:** Wiring modifications

**Use Cases:**
- Debugging: "What changed between these two steps?"
- Visualization: Highlight active/changed components
- Education: Show cause-and-effect relationships

**Maps to Contract:** Supporting capability (not explicitly guaranteed)

---

### 3.4 Dev Panel UI (`DeterminismPanel.tsx`, `useDeterminismRecorder.ts`)

**Capability:** Browser-accessible UI for recording, verification, and time travel.

**Access:** Press **Ctrl+Shift+D** (or Cmd+Shift+D on Mac)

**Features:**

**Recording Controls:**
- Start/Stop recording sessions
- Visual feedback (red dot + "Recording..." indicator)

**Verification Controls:**
- Verify Replay button (runs verifyReplay())
- Displays live hash, replay hash, and ✓/✗ status
- Export Log button (downloads JSON)
- Reset button (clears session)

**Time Travel Controls:**
- Initialize button (prepare time travel from verified log)
- Step Back / Step Forward buttons
- Event counter: "Event X of Y"
- Buttons disabled when navigation not possible

**Design Principles:**
- **Dev-only:** Not exposed to end users
- **Minimal:** No styling beyond functional clarity
- **Presentational:** All logic in `useDeterminismRecorder` hook
- **Debuggable:** All state changes logged to console

**Maps to Contract:** §6 (Proof of Correctness - operational validation)

---

## 4. How This Supports the Determinism Contract

### Contract §3.3 (Stable Time Travel)
- **Implemented by:** `getStateAtIndex()`, `stepForward()`, `stepBackward()`
- **Proof:** Navigation tests verify stability

### Contract §6 (Proof of Correctness)
- **Provided by:** Dev panel UI makes verification interactive and observable
- **Evidence:** Live hash comparison visible in browser

### Contract §8 (How to Verify)
- **Enabled by:** Step-by-step verification instructions reference dev panel

---

## 5. Proof / Verification

### Tests:
Located in `packages/rb-logic-core/src/determinism/__tests__/`

**Inspector Tests:**
- `getStateAtIndex(i)` returns consistent snapshot
- Snapshot metadata (eventIndex, totalEvents) is correct
- Out-of-bounds indices handled gracefully

**Navigation Tests:**
- Forward then backward returns to same state
- `canStepForward/Backward` predicates are accurate
- Navigation at boundaries (start/end) returns null

**Diff Tests:**
- Empty diff when comparing identical snapshots
- Node state changes detected correctly
- Signal changes detected correctly

**Integration Tests:**
- Full time travel session (initialize → step forward 10x → step backward 10x → verify same state)

### Code Artifacts:
- `packages/rb-logic-core/src/determinism/inspector.ts` (89 lines)
- `packages/rb-logic-core/src/determinism/navigation.ts` (134 lines)
- `packages/rb-logic-core/src/determinism/diff.ts` (156 lines)
- `packages/rb-shell/src/dev/DeterminismPanel.tsx` (262 lines)
- `packages/rb-shell/src/dev/useDeterminismRecorder.ts` (192 lines)

### Manual Verification:

**Step 1: Open dev panel**
```
1. Open Logic Playground
2. Press Ctrl+Shift+D
3. Observe dev panel opens
```

**Step 2: Record and verify**
```
1. Click "Start Recording"
2. Interact with circuit (toggle inputs, run simulation)
3. Click "Stop Recording"
4. Click "Verify Replay"
5. Observe: "✓ Deterministic"
```

**Step 3: Time travel**
```
1. Click "Initialize" (after verification)
2. Observe: "Event 1 of N"
3. Click "Step Forward" repeatedly
4. Observe event counter increments
5. Click "Step Back" repeatedly
6. Observe event counter decrements
```

---

## 6. Known Limitations

Per CONTRACT §4, this milestone explicitly does **not** provide:

❌ **Real-time performance**
- Stepping through large event logs may be slow
- No caching or optimization implemented

❌ **Production UI**
- Dev panel styling is minimal
- No error recovery or user guidance
- Dev-mode only (not accessible to end users)

❌ **State mutation**
- Time travel is read-only
- Cannot edit state or branch timelines

❌ **Advanced diffing**
- Diff is structural only (no semantic analysis)
- No visualization of diffs (text output only)

❌ **Persistence**
- Time travel state not saved
- Must re-initialize after page refresh

---

## Summary

Milestone C makes determinism **inspectable and navigable**:
- State can be queried at any event boundary
- Navigation is stable and repeatable
- Diffs reveal precise changes between snapshots
- Dev panel provides interactive verification

This milestone is **complete** and **proven operational**.

The dev panel is the **proof of correctness** referenced in CONTRACT §6.

---

**References:**
- [Determinism Contract](./CONTRACT.md)
- [Milestone A: Core Primitives](./milestone-a.md)
- [Milestone B: Record/Replay Harness](./milestone-b.md)
- [Implementation: `packages/rb-logic-core/src/determinism/inspector.ts`](../../packages/rb-logic-core/src/determinism/inspector.ts)
- [Implementation: `packages/rb-logic-core/src/determinism/navigation.ts`](../../packages/rb-logic-core/src/determinism/navigation.ts)
- [Implementation: `packages/rb-logic-core/src/determinism/diff.ts`](../../packages/rb-logic-core/src/determinism/diff.ts)
- [Implementation: `packages/rb-shell/src/dev/DeterminismPanel.tsx`](../../packages/rb-shell/src/dev/DeterminismPanel.tsx)
