# PHASE 1 LOCK REPORT

**Status**: 🔒 **LOCKED WITH CONDITIONS** ✅

Schemas updated per your directives:
1. ✅ Added `seq` to all events (deterministic ordering)
2. ✅ Added `signature` (HMAC-based, non-forgeable proof)
3. ✅ Defined Phase 2 scope (UART subset)

---

## Schema Changes Summary

### fpga-events.schema.json
**Added to all events:**
- `seq` (required, integer): Monotonically increasing event number
- Invariant: Events **ordered by seq** for replay (timestamp is informational)

**Modified proof-capsule event:**
- Changed from `hash` (SHA256 checksum) to `signature` (HMAC-SHA256)
- `signature` is authoritative, `hash` optional/deprecated

### proof-capsule.schema.json
**Changed hashing model:**
```
OLD: hash = SHA256(events + salt)
     Problem: student can edit events + recompute hash with new salt

NEW: signature = HMAC-SHA256(canonical_JSON(events), BRIDGE_SECRET)
     Benefit: student cannot forge without server secret
```

**New required fields:**
- `signature` (string, pattern `^hmac-sha256:[a-f0-9]{64}$`)
- `signature_alg` (enum, default "hmac-sha256")

**Events array now includes:**
- `seq` field (required, for strict ordering)

**Semantic invariant:**
```
To verify proof:
  computed_sig = HMAC_SHA256(canonical_JSON(proof.events), BRIDGE_SECRET)
  if (computed_sig == proof.signature) ✅ proof is authentic
  else ❌ proof was tampered with or forged
```

**Bridge behavior:**
- Bridge holds `BRIDGE_SECRET` (never exported in proof)
- Proof file contains only `signature` (hash output, not secret)
- Instructor/verifier tool uses bridge API to validate proofs

---

## Examples

### Example 1: Device Connected Event
```json
{
  "type": "device:connected",
  "seq": 0,
  "timestamp": 1705356000000,
  "device": {
    "id": "simulator-default",
    "board": "Basys3",
    "backend": "simulator",
    "port": "sim://default",
    "serialNumber": null,
    "contract": {
      "protocol": "UART",
      "baudrate": 115200,
      "format": "RB1",
      "io": {
        "inputs": {
          "SW": {"count": 16, "type": "switch"},
          "BTN": {"count": 5, "type": "button"}
        },
        "outputs": {
          "LED": {"count": 16, "type": "led"}
        }
      }
    }
  }
}
```

### Example 2: I/O Update Event
```json
{
  "type": "io:update",
  "seq": 1,
  "timestamp": 1705356000100,
  "source": "device",
  "changes": {
    "SW": "0000000000000001",
    "LED": "0000000000000001"
  },
  "tick": 0
}
```

### Example 3: Another I/O Update (delta)
```json
{
  "type": "io:update",
  "seq": 2,
  "timestamp": 1705356000200,
  "source": "device",
  "changes": {
    "SW": "0000000000000011",
    "LED": "0000000000000011"
  },
  "tick": 1
}
```

### Example 4: Proof Capsule Event (on WebSocket)
```json
{
  "type": "proof:capsule",
  "seq": 3,
  "timestamp": 1705356001000,
  "session_id": "sess-2026-01-15-abc123",
  "signature": "hmac-sha256:a1b2c3d4e5f6....[64 hex chars]",
  "device_snapshot": {
    "id": "simulator-default",
    "board": "Basys3",
    "backend": "simulator"
  },
  "event_count": 3,
  "start_time": 1705356000000,
  "end_time": 1705356001000,
  "duration_ms": 1000,
  "bundle_url": "/api/proof/sess-2026-01-15-abc123.json"
}
```

### Example 5: Complete Proof Capsule File
```json
{
  "session_id": "sess-2026-01-15-abc123",
  "device": {
    "id": "simulator-default",
    "board": "Basys3",
    "backend": "simulator",
    "port": "sim://default",
    "serialNumber": null,
    "contract": {
      "protocol": "UART",
      "baudrate": 115200,
      "format": "RB1",
      "io": {
        "inputs": {
          "SW": {"count": 16, "type": "switch"},
          "BTN": {"count": 5, "type": "button"}
        },
        "outputs": {
          "LED": {"count": 16, "type": "led"}
        }
      }
    }
  },
  "created_at": 1705356001000,
  "start_time": 1705356000000,
  "end_time": 1705356001000,
  "duration_ms": 1000,
  "event_count": 3,
  "events": [
    {
      "type": "device:connected",
      "seq": 0,
      "timestamp": 1705356000000,
      "device": {...}
    },
    {
      "type": "io:update",
      "seq": 1,
      "timestamp": 1705356000100,
      "source": "device",
      "changes": {
        "SW": "0000000000000001",
        "LED": "0000000000000001"
      },
      "tick": 0
    },
    {
      "type": "io:update",
      "seq": 2,
      "timestamp": 1705356000200,
      "source": "device",
      "changes": {
        "SW": "0000000000000011",
        "LED": "0000000000000011"
      },
      "tick": 1
    }
  ],
  "signature": "hmac-sha256:a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
  "signature_alg": "hmac-sha256",
  "user": {
    "name": "Alice Student",
    "email": "alice@university.edu",
    "student_id": "2026001"
  },
  "lab_context": {
    "lab_name": "Lab 1: Switch-to-LED Mirror",
    "lab_id": "digital-logic-101-lab-1",
    "instructor": "Prof. Bob",
    "due_date": "2026-01-20"
  },
  "metadata": {
    "design_name": "led_mirror",
    "design_version": "1.0",
    "notes": "Student followed Vivado steps exactly"
  }
}
```

### Example 6: Verification Logic (Pseudo)
```javascript
// Bridge side: when student submits proof
const crypto = require('crypto');

function verifyProof(proof, bridgeSecret) {
  // Canonical JSON: sort keys, no spaces
  const canonicalEvents = JSON.stringify(proof.events, Object.keys(proof.events).sort());
  
  // Compute expected signature
  const expectedSig = 'hmac-sha256:' + 
    crypto.createHmac('sha256', bridgeSecret)
      .update(canonicalEvents)
      .digest('hex');
  
  // Verify
  if (expectedSig === proof.signature) {
    return { valid: true, message: "Proof is authentic" };
  } else {
    return { valid: false, message: "Proof tampered or forged" };
  }
}
```

---

## Phase 2 Implementation Scope

Agents must implement these event types in the simulator + bridge:

### MUST (required for Phase 2 demo):
- ✅ `device:connected`
- ✅ `device:disconnected`
- ✅ `io:update` (the core I/O telemetry)
- ✅ `error:*` (at least `error:port_not_found`)
- ✅ `proof:capsule` (both as WS event and HTTP export)

### MAY (useful for debug, but optional):
- 🟡 `uart:rx` / `uart:tx` (proves UART pipe, helps with real hardware later)

### SKIP (Phase 3+):
- ❌ `sample:frame` (explicitly reserved for JTAG waveform capture, Phase 3+)

---

## Invariants (Golden Rules)

These must **never be violated** in Phase 2 or Phase 3:

1. **Seq is authoritative**
   - Events replayed in order of `seq`, not `timestamp`
   - `seq` starts at 0, increments by 1
   - No gaps in `seq`

2. **Signature is immutable**
   - Only computed once when proof is created
   - Bridge holds secret, never exported
   - Student cannot forge valid signature without secret

3. **Events are immutable in proof**
   - Once exported to file, events array is locked
   - Any edit invalidates signature
   - Instructor detects tampering immediately

4. **Timestamp is informational**
   - For UI display and logs only
   - Not used for ordering or determinism
   - Can have collisions (same ms multiple events)

5. **No UI state in events**
   - Events are pure hardware telemetry
   - No RedByte UI state, no screenshots
   - Bridge and UI are fully decoupled

---

## What's Locked

**These schemas are now PHASE 1 LOCKED:**
- `fpga-events.schema.json` (with seq + signature)
- `proof-capsule.schema.json` (with HMAC semantics)
- `hardware-contract.schema.json` (unchanged, already good)

**You CANNOT:**
- ❌ Change event field names
- ❌ Remove required fields
- ❌ Change signature semantics
- ❌ Redefine seq ordering

**You CAN:**
- ✅ Add optional fields (with `additionalProperties: false` override)
- ✅ Add new error subtypes (e.g., `error:connection_timeout`)
- ✅ Add new protocols in board contracts (JTAG, Ethernet)
- ✅ Add new board contracts (boards/nexys.json, etc.)

---

## Next: Phase 2 Execution

**Agents proceed with:**

1. Refactor bridge to support pluggable backends (simulator vs UART)
2. Implement Basys3 simulator:
   - Emits `device:connected` (seq=0)
   - Auto-generates `io:update` events (seq 1, 2, 3, ...)
   - Signature computed over canonical events
3. Validate all events against `fpga-events.schema.json`
4. Validate proof against `proof-capsule.schema.json`
5. Determinism test: same simulator run → same proof signature

**Deliverables (Phase 2):**
- ✅ Bridge running on localhost:4242 (HTTP) and localhost:4243 (WS)
- ✅ Simulator backend emitting signed proofs
- ✅ Example proof capsule JSON file
- ✅ Signature verification test passing
- ✅ WS stream validation test passing

**Then stop and present for review before touching UI.**

---

## Files Changed

- `packages/rb-fpga-bridge/schemas/fpga-events.schema.json` - added seq to all events, changed signature semantics
- `packages/rb-fpga-bridge/schemas/proof-capsule.schema.json` - changed from hash to HMAC signature
- `packages/rb-fpga-bridge/schemas/hardware-contract.schema.json` - no changes (locked as-is)

**Status: Ready for agent autonomous Phase 2 execution.**
