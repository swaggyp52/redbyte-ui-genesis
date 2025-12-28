# Milestone A: Core Primitives

**Status:** Complete
**Completed:** 2025-12-28
**Contract Reference:** [CONTRACT.md](./CONTRACT.md)

---

## 1. Purpose

Milestone A establishes the **foundational primitives** required for deterministic execution.

Without these primitives, determinism would be:
- **Unverifiable** (no hashing mechanism)
- **Non-portable** (no canonical serialization)
- **Non-reproducible** (no event log format)

This milestone exists to provide the **mathematical and structural basis** for all guarantees in the Determinism Contract (§3).

---

## 2. Scope

### What was added:

- **State normalization** - Canonical ordering of circuit state
- **Deterministic hashing** - Browser-safe SHA-256 via Web Crypto API
- **Event log format** - Versioned, append-only event representation
- **Type definitions** - Formal interfaces for circuits, events, and state

### What was explicitly NOT added:

- Recording infrastructure (see Milestone B)
- Replay execution (see Milestone B)
- Time travel navigation (see Milestone C)
- UI integration (see Milestone C)

Per CONTRACT §4, this milestone does **not** guarantee:
- Performance characteristics
- Cross-version compatibility (event log v1 only)
- Security or tamper detection

---

## 3. Capabilities Introduced

### 3.1 State Normalization (`stateHash.ts`)

**Capability:** Convert arbitrary circuit state into a canonical, deterministic representation.

**Why this matters:**
- JavaScript Map/Set iteration order is non-deterministic
- Object key ordering varies across runtimes
- Without normalization, identical circuits produce different hashes

**Implementation:**
```typescript
normalizeCircuitState(circuit: Circuit) → NormalizedCircuitState
```

**Guarantees:**
- All nodes sorted by ID
- All connections sorted by stable key
- All config/state objects converted to sorted key-value pairs
- Recursive normalization for nested objects

**Maps to Contract:** §5 (Risk: Non-deterministic iteration)

---

### 3.2 Deterministic Hashing (`stateHash.ts`)

**Capability:** Compute a cryptographically-strong hash of circuit state.

**Why this matters:**
- Enables verification that two executions are identical
- Provides compact representation of entire state
- Allows offline comparison of exported logs

**Implementation:**
```typescript
hashCircuitState(circuit: Circuit) → Promise<string>  // SHA-256 hex
```

**Key Design Decisions:**
- **Browser-safe:** Uses Web Crypto API (not Node.js crypto)
- **Async:** Required by Web Crypto API spec
- **SHA-256:** Collision-resistant, widely supported
- **Hex encoding:** Human-readable, portable

**Maps to Contract:** §3.2 (Verifiable Replay)

---

### 3.3 Event Log Format (`eventLog.ts`)

**Capability:** Versioned, structured representation of execution history.

**Format:**
```typescript
interface EventLogV1 {
  version: 1;
  events: Event[];
}

type Event =
  | { type: 'circuit_loaded'; timestamp: number; circuit: Circuit }
  | { type: 'input_toggled'; timestamp: number; nodeId: string; portName: string; value: number }
  | { type: 'simulation_tick'; timestamp: number; dt: number; tickIndex: number }
  | { type: 'node_state_modified'; timestamp: number; nodeId: string; state: Record<string, any> }
```

**Design Properties:**
- **Versioned:** `version: 1` enables future evolution
- **Append-only:** Events never modified after creation
- **Timestamped:** Each event carries creation time
- **Self-describing:** Event types are explicit, not inferred
- **Minimal:** Only records user actions and simulation steps

**Maps to Contract:** §3.4 (Exportable Reproducibility)

---

### 3.4 Type Definitions (`types.ts`, `stateHash.ts`)

**Capability:** Formal TypeScript interfaces for all determinism primitives.

**Key Types:**
```typescript
// Normalized representations
interface NormalizedCircuitState
interface NormalizedRuntimeState
interface CircuitRuntimeState

// Event log
interface EventLogV1
type Event = ...

// Verification
interface VerifyReplayResult
```

**Why this matters:**
- Type safety prevents accidental non-determinism
- Explicit interfaces make contracts machine-checkable
- Enables IDE support and autocomplete

---

## 4. How This Supports the Determinism Contract

### Contract §3.1 (Deterministic Execution)
- **Enabled by:** Normalized state ensures identical circuits serialize identically

### Contract §3.2 (Verifiable Replay)
- **Enabled by:** SHA-256 hashing provides cryptographic proof of equivalence

### Contract §3.4 (Exportable Reproducibility)
- **Enabled by:** EventLogV1 format is serializable, versionable, portable

### Contract §5 (Risk Mitigation)
- **Addresses:**
  - Non-deterministic iteration → canonical ordering
  - Wall-clock time → timestamped events (injected, not read)
  - Hidden mutation → immutable snapshots via normalization

---

## 5. Proof / Verification

### Tests:
Located in `packages/rb-logic-core/src/determinism/__tests__/`

**State Normalization Tests:**
- Identical circuits produce identical normalized state
- Map/Set iteration order does not affect normalization
- Nested objects are recursively normalized

**Hashing Tests:**
- Same circuit always produces same hash
- Different circuits produce different hashes
- Hash is stable across async calls

**Event Log Tests:**
- Event format is JSON-serializable
- Events preserve all necessary information
- Version field is present and correct

### Code Artifacts:
- `packages/rb-logic-core/src/determinism/stateHash.ts` (185 lines)
- `packages/rb-logic-core/src/determinism/eventLog.ts` (87 lines)
- `packages/rb-logic-core/src/determinism/types.ts` (type definitions)

### Manual Verification:
```typescript
import { hashCircuitState, normalizeCircuitState } from '@redbyte/rb-logic-core/determinism';

const circuit = { nodes: [...], connections: [...] };
const hash1 = await hashCircuitState(circuit);
const hash2 = await hashCircuitState(circuit);

console.assert(hash1 === hash2, 'Hashing is deterministic');
```

---

## 6. Known Limitations

Per CONTRACT §4, this milestone explicitly does **not** provide:

❌ **Cross-version determinism**
- Event log format is v1 only
- Future versions may change normalization or hashing

❌ **Cryptographic integrity**
- Hashes prove identity, not authenticity
- No signing or tamper detection

❌ **Performance guarantees**
- Normalization is O(n log n) due to sorting
- Hashing is async and requires Web Crypto API

❌ **Node.js compatibility**
- Uses Web Crypto API (browser-only)
- Node.js requires different crypto implementation

---

## Summary

Milestone A provides the **mathematical foundation** for determinism:
- States can be normalized → compared → hashed
- Events can be logged → versioned → serialized
- Types are explicit → machine-checkable → safe

This milestone is **complete** and **proven operational**.

All subsequent milestones build on these primitives.

---

**References:**
- [Determinism Contract](./CONTRACT.md)
- [Implementation: `packages/rb-logic-core/src/determinism/stateHash.ts`](../../packages/rb-logic-core/src/determinism/stateHash.ts)
- [Implementation: `packages/rb-logic-core/src/determinism/eventLog.ts`](../../packages/rb-logic-core/src/determinism/eventLog.ts)
