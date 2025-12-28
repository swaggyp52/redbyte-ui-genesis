# Milestone B: Record/Replay Harness

**Status:** Complete
**Completed:** 2025-12-28
**Contract Reference:** [CONTRACT.md](./CONTRACT.md)

---

## 1. Purpose

Milestone B implements the **record and replay infrastructure** that operationalizes the primitives from Milestone A.

Without this milestone, determinism would be:
- **Theoretical** (primitives exist but unused)
- **Unvalidated** (no proof that replay works)
- **Inaccessible** (no way to capture or reproduce execution)

This milestone exists to provide the **operational mechanisms** required by CONTRACT §3.2 (Verifiable Replay) and §3.4 (Exportable Reproducibility).

---

## 2. Scope

### What was added:

- **Recorder** - Live event capture during execution
- **Replay runner** - Deterministic execution from event log
- **Verification command** - Cryptographic proof of replay correctness
- **Export functionality** - JSON serialization of sessions

### What was explicitly NOT added:

- Time travel navigation (see Milestone C)
- Dev panel UI (see Milestone C)
- User-facing features (future work)
- Network or collaboration support (CONTRACT §4)

Per CONTRACT §4, this milestone does **not** guarantee:
- Real-time performance
- Secure storage or transmission of logs
- Cross-version replay (event log v1 only)

---

## 3. Capabilities Introduced

### 3.1 Recorder (`recorder.ts`)

**Capability:** Capture execution as an append-only event log during live interaction.

**API:**
```typescript
interface Recorder {
  recordCircuitLoaded(circuit: Circuit): void;
  recordInputToggled(nodeId: string, portName: string, value: number): void;
  recordSimulationTick(dt: number, tickIndex: number): void;
  recordNodeStateModified(nodeId: string, state: Record<string, any>): void;

  isRecording(): boolean;
  stop(): void;
  getLog(): EventLogV1;
}

createRecorder(): Recorder
```

**Design Properties:**
- **Minimal instrumentation:** Only records observable actions, not internal state
- **Append-only:** Events are immutable once created
- **Timestamped:** Uses injected clock (Date.now by default)
- **Side-effect free:** Recording does not affect simulation

**Maps to Contract:** §3 (foundation for all guarantees)

---

### 3.2 Replay Runner (`replay.ts`)

**Capability:** Execute an event log deterministically from initial circuit state.

**API:**
```typescript
interface ReplayResult {
  circuit: Circuit;
  engine: unknown;  // Opaque engine instance
}

interface EngineFactory {
  (circuit: Circuit): { tick(dt: number, tickIndex: number): void; signals: Map<...> };
}

runReplay(eventLog: EventLogV1, engineFactory: EngineFactory): ReplayResult
```

**Execution Model:**
1. Start with `circuit_loaded` event (initial state)
2. Apply each subsequent event in order:
   - `input_toggled` → update node state + set signal
   - `simulation_tick` → call engine.tick()
   - `node_state_modified` → update node state
3. Return final circuit + engine

**Key Invariant:**
> Replay is **pure** - same log always produces same result (CONTRACT §3.1)

**Maps to Contract:** §3.2 (Verifiable Replay), §3.3 (Stable Time Travel foundation)

---

### 3.3 Verification Command (`verifyReplay.ts`)

**Capability:** Cryptographically prove that replay is deterministic.

**API:**
```typescript
interface VerifyReplayResult {
  liveHash: string;    // Hash of live execution final state
  replayHash: string;  // Hash of replayed execution final state
  equal: boolean;      // liveHash === replayHash
}

verifyReplay(
  initialCircuit: Circuit,
  eventLog: EventLogV1,
  options?: { engineFactory?: EngineFactory }
): Promise<VerifyReplayResult>
```

**Verification Process:**
1. **Live path:** Apply events imperatively to fresh engine (simulates original execution)
2. **Replay path:** Use `runReplay()` to reconstruct state
3. **Hash both:** Compute SHA-256 of final circuit state
4. **Compare:** `equal = (liveHash === replayHash)`

**Why two paths:**
- Live path simulates how events were originally created
- Replay path uses the "official" replay runner
- If hashes match → replay is faithful to live execution

**Maps to Contract:** §3.2 (Verifiable Replay)

---

### 3.4 Export Functionality (`useDeterminismRecorder.ts`)

**Capability:** Serialize recording session as portable JSON artifact.

**Export Format:**
```json
{
  "initialCircuit": { "nodes": [...], "connections": [...] },
  "eventLog": { "version": 1, "events": [...] },
  "metadata": {
    "exportedAt": 1766956009825,
    "eventCount": 42
  }
}
```

**Properties:**
- **Self-contained:** Includes both initial state and events
- **Portable:** Standard JSON, no binary data
- **Versioned:** Event log version tracked
- **Metadata:** Export timestamp and event count for debugging

**Use Cases:**
- Bug reports (attach reproducible log)
- Collaboration (share sessions)
- Archival (save demos for later)

**Maps to Contract:** §3.4 (Exportable Reproducibility)

---

## 4. How This Supports the Determinism Contract

### Contract §3.1 (Deterministic Execution)
- **Implemented by:** `runReplay()` guarantees same events → same result

### Contract §3.2 (Verifiable Replay)
- **Implemented by:** `verifyReplay()` provides cryptographic proof via hash comparison

### Contract §3.4 (Exportable Reproducibility)
- **Implemented by:** Export format is sufficient to reproduce execution

### Contract §5 (Risk Mitigation)
- **Addresses:**
  - Wall-clock time → recorder injects timestamps, replay uses event timestamps
  - Implicit state → all mutations logged as events
  - Side-effect imports → recorder has no external dependencies

---

## 5. Proof / Verification

### Tests:
Located in `packages/rb-logic-core/src/determinism/__tests__/`

**Recorder Tests:**
- Events are appended in order
- Timestamps are monotonic
- Recorder can be stopped and restarted
- getLog() returns immutable snapshot

**Replay Tests:**
- Same log produces same final state
- Different logs produce different states
- Replay handles all event types

**Verification Tests:**
- verifyReplay() returns equal=true for valid logs
- Hash comparison detects divergence
- Async verification completes correctly

### Code Artifacts:
- `packages/rb-logic-core/src/determinism/recorder.ts` (142 lines)
- `packages/rb-logic-core/src/determinism/replay.ts` (178 lines)
- `packages/rb-logic-core/src/determinism/verifyReplay.ts` (133 lines)
- `packages/rb-shell/src/dev/useDeterminismRecorder.ts` (192 lines - adapter)

### Manual Verification:

**Step 1: Record a session**
```typescript
const recorder = createRecorder();
recorder.recordCircuitLoaded(circuit);
// ... interact with circuit ...
recorder.stop();
const log = recorder.getLog();
```

**Step 2: Verify replay**
```typescript
const result = await verifyReplay(circuit, log);
console.log(result.equal);  // true
console.log(result.liveHash === result.replayHash);  // true
```

**Step 3: Export**
```typescript
const exportData = {
  initialCircuit: circuit,
  eventLog: log,
  metadata: { exportedAt: Date.now(), eventCount: log.events.length }
};
downloadJSON(exportData, 'session.json');
```

---

## 6. Known Limitations

Per CONTRACT §4, this milestone explicitly does **not** provide:

❌ **Real-time performance guarantees**
- Replay may be slower or faster than live execution
- No frame-rate or latency guarantees

❌ **Cryptographic integrity**
- No signing of event logs
- No tamper detection
- Hashes prove identity, not authenticity

❌ **Cross-version determinism**
- Event log v1 only
- Future engine changes may break replay

❌ **UI integration**
- All APIs are code-level only
- User-facing features in Milestone C

❌ **Collaboration features**
- No network sync
- No conflict resolution
- Single-user only

---

## Summary

Milestone B makes determinism **operational**:
- Sessions can be recorded → verified → exported
- Replay is proven deterministic via cryptographic hashing
- Event logs are portable JSON artifacts

This milestone is **complete** and **proven operational**.

All verification guarantees in CONTRACT §3.2 are now executable.

---

**References:**
- [Determinism Contract](./CONTRACT.md)
- [Milestone A: Core Primitives](./milestone-a.md)
- [Implementation: `packages/rb-logic-core/src/determinism/recorder.ts`](../../packages/rb-logic-core/src/determinism/recorder.ts)
- [Implementation: `packages/rb-logic-core/src/determinism/replay.ts`](../../packages/rb-logic-core/src/determinism/replay.ts)
- [Implementation: `packages/rb-logic-core/src/determinism/verifyReplay.ts`](../../packages/rb-logic-core/src/determinism/verifyReplay.ts)
