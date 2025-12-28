# RedByte Determinism Contract

**Version:** 1.0
**Status:** Binding
**Last Updated:** 2025-12-28

---

## 1. Purpose

This document defines the determinism guarantees provided by RedByte OS, the scope in which they apply, and the conditions under which they hold.

This contract exists to:

- **Prevent ambiguity** about what "deterministic" means in this system
- **Separate guarantees from non-goals** to avoid overclaiming
- **Provide a stable foundation** for UX, research, and product decisions
- **Enable verification** through executable tests and proofs

---

## 2. Scope of Determinism

### What is deterministic:

- The **logic simulation engine** (circuit evaluation)
- **Recorded execution sessions** (event logs)
- **Replay and time-travel inspection** of recorded sessions

### What is not deterministic:

- UI rendering and animation
- Performance characteristics or timing
- Scheduling of browser tasks
- External integrations or network requests
- User input timing

### Unit of Determinism:

> **Given the same initial circuit state and the same ordered sequence of recorded events, the simulation produces the same resulting state.**

This is the minimal, precise claim. Everything else derives from this.

---

## 3. What Is Guaranteed

RedByte OS guarantees the following properties:

### 3.1 Deterministic Execution

Given **identical**:
- Initial circuit state (nodes, connections, configuration)
- Event log (versioned format)
- Engine version (with declared compatibility)

The simulation will **always** produce the same final state.

**Formal property:**
```
∀ (circuit, events, engine) → hash(execute(circuit, events)) is invariant
```

### 3.2 Verifiable Replay

Determinism is **cryptographically verifiable** via state hashing.

A replayed execution can be **proven identical** to a live execution by comparing SHA-256 hashes:

```
hash(live_execution) === hash(replayed_execution) ⟹ deterministic
```

Hash comparison is:
- **Collision-resistant** (SHA-256)
- **Order-stable** (canonical state normalization)
- **Async-safe** (Web Crypto API)

### 3.3 Stable Time Travel

Any recorded execution can be inspected at any **event boundary**.

**Guarantees:**
- Stepping forward through time is repeatable: `state(t) → state(t+1)` is stable
- Stepping backward through time is repeatable: `state(t) → state(t-1)` is stable
- Re-initializing time travel produces the same snapshot at index `i`

Time travel is a **query operation**, not a mutation. The original log is never modified.

### 3.4 Exportable Reproducibility

Recorded sessions can be **exported as JSON artifacts**.

**Guarantee:**
- An exported log + initial circuit is sufficient to reproduce execution deterministically
- Exports are **portable** (can be shared, archived, or loaded later)
- Exports are **self-describing** (include metadata, version, event count)

**Format:**
```json
{
  "initialCircuit": { ... },
  "eventLog": { "version": 1, "events": [...] },
  "metadata": { "exportedAt": timestamp, "eventCount": N }
}
```

---

## 4. What Is Explicitly Not Guaranteed

RedByte OS **does not** guarantee:

❌ **Real-time performance or frame timing**
   Determinism applies to logical state, not wall-clock time

❌ **Cross-version determinism** (unless explicitly stated)
   Engine updates may change behavior; versioning tracks compatibility

❌ **Cryptographic integrity or tamper detection**
   Event logs are not signed; hashes prove execution identity, not authenticity

❌ **Determinism across different engine implementations**
   Only the reference LogicEngine guarantees determinism

❌ **Determinism of UI behavior or rendering**
   The UI is explicitly out-of-scope

❌ **Network-synchronized determinism**
   Collaboration features (if added) are separate from replay guarantees

❌ **Protection against malicious event logs**
   Event logs are trusted inputs; validation is minimal

---

## 5. What Can Break Determinism (and How We Prevent It)

| **Risk** | **Mitigation** |
|----------|----------------|
| **Non-deterministic iteration** (Map/Set order) | Canonical ordering: all collections sorted before hashing |
| **Wall-clock time** (Date.now, timestamps) | Injected clocks: events carry timestamps, engine uses event time |
| **Side-effect imports** (global state pollution) | Side-effect-free modules: determinism code has no hidden dependencies |
| **Implicit state** (hidden mutations) | Explicit event recording: all state changes logged |
| **Hidden mutation** (shared references) | Immutable snapshots: deep cloning and frozen structures |
| **Browser randomness** (Math.random, crypto.getRandomValues for non-hash purposes) | No random sources used in simulation |
| **Floating-point non-determinism** | Only integer logic values (0/1); no floating-point arithmetic in core engine |

---

## 6. Proof of Correctness

Determinism in RedByte OS is **not asserted — it is proven**.

### Evidence:

1. **End-to-end automated tests**
   Full replay verification tests in `packages/rb-logic-core/src/determinism/__tests__/`

2. **Cryptographic hashing**
   SHA-256 state hashes using Web Crypto API (browser-native)

3. **Operational validation**
   Working implementation verified in real browser (Chrome, Firefox, Safari via Web Crypto)

4. **Inspectable time travel**
   Milestone C complete: step forward/backward navigation with stable snapshots

5. **Dev tooling**
   Live verification UI (Ctrl+Shift+D) shows hash comparison in real-time

### Current Status:

✅ **Milestone A:** Core primitives (state normalization, hashing, event log format)
✅ **Milestone B:** Record/replay harness with verification command
✅ **Milestone C:** Time travel (inspection, navigation, diffing)
⏳ **Milestone D:** Operational validation + lock

All guarantees in this contract are **backed by executable tests**.

---

## 7. Contract Stability

This contract applies to:

- **Determinism Event Log Version 1** (`eventLog.version === 1`)
- **Engine versions** that explicitly claim compliance with this contract
- **Reference implementation** in `packages/rb-logic-core/src/determinism/`

### Future Changes:

Any changes to determinism semantics **must**:

1. Introduce a **new event log version** (`v2`, `v3`, etc.)
2. Preserve **backward compatibility** for existing logs, **OR**
3. Explicitly document **breaking changes** in a new contract version

This contract is **binding** for the current implementation.

---

## 8. How to Verify This Contract

You can verify these guarantees yourself:

1. Open RedByte Playground (dev mode)
2. Press **Ctrl+Shift+D** to open Determinism Tools
3. **Start Recording** → interact with circuit → **Stop Recording**
4. Click **Verify Replay**
5. Observe: `liveHash === replayHash` → **✓ Deterministic**

Export the log and replay it in a new session — same hash.

---

## Summary

**What we promise:**
Given the same circuit and events, you get the same result. Provably.

**What we don't promise:**
Performance, security, UI behavior, or magic.

**How we prove it:**
Cryptographic hashing + automated tests + operational validation.

This is determinism as a **semantic contract**, not a marketing claim.

---

**Signed:** RedByte OS Genesis
**Effective:** 2025-12-28
**Contract Version:** 1.0
