# FPGA Vector Test Runner - Full Pipeline Working

**Status**: ✅ PRODUCTION READY  
**Commit**: `2d9b0908` (fix: replay discovers NDJSON events via capsule pointer + TICK semantics doc)  
**Date**: 2026-01-16

---

## What Was Fixed (The Real Blocker)

### Problem
Vector runner produced two files:
- `vector-run-<ts>.json` (proof capsule)
- `vector-events-<ts>.ndjson` (events file)

But `proof-replay.js` failed with:
```
[REPLAY] ERROR: No events found in proof
```

**Root Cause**: Replay expected `capsule.events` array inline, but vector runner stored events in separate NDJSON file with no pointer.

### Solution (One Clean Contract Change)

**Added explicit events pointer to capsule**:
```json
{
  "session_id": "vector-run-2026-01-16T02-44-10",
  "board_id": "basys3",
  "events": {
    "format": "ndjson",
    "path": "C:\\lab\\redbyte-ui\\ops\\proof\\vector-events-2026-01-16T02-44-10.ndjson",
    "sha256": "90a9f62dcc3b127e...",
    "count": 6
  }
}
```

**Updated `proof-replay.js` to support new format**:
1. If `capsule.events.path` exists → load NDJSON from that path
2. Verify hash if `capsule.events.sha256` present
3. Keep backward compatibility: if `capsule.events` is array → use inline (legacy)
4. Add machine-parsable summary: `[REPLAY] events=<N> verdict=<PASS|FAIL> out=<path>`

---

## Test Results (All DUT Modes Pass)

| DUT Mode    | Vectors | Vector Verdict | Replay Verdict | Events |
|-------------|---------|----------------|----------------|--------|
| passthrough | 5       | ✅ PASS        | ✅ PASS        | 6      |
| invert      | 4       | ✅ PASS        | ✅ PASS        | 5      |
| xor         | 5       | ✅ PASS        | ✅ PASS        | 6      |
| counter     | 4       | ✅ PASS        | ✅ PASS        | 5      |

**Total**: 18 vectors, 18 PASS, 22 events replayed deterministically.

### Example Output (End-to-End)

```bash
$ pnpm --filter @redbyte/fpga-bridge test:vectors -- --board basys3 --vectors packages/rb-fpga-bridge/examples/test-basic.json --dut passthrough

[VECTOR RUNNER] Starting...
[VECTOR RUN] board=basys3 vectors=5 pass=5 fail=0
[PROOF] capsule=C:\lab\redbyte-ui\ops\proof/vector-run-2026-01-16T02-44-10.json
[REPORT] report=C:\lab\redbyte-ui\ops\proof/vector-run-2026-01-16T02-44-10-report.txt
[EVENTS] events=C:\lab\redbyte-ui\ops\proof/vector-events-2026-01-16T02-44-10.ndjson
[RUN] task=vectors board=basys3 dut=passthrough vectors=5 verdict=PASS capsule=C:\lab\redbyte-ui\ops\proof/vector-run-2026-01-16T02-44-10.json

[REPLAY] Starting proof replay...
[REPLAY] repoRoot: C:\lab\redbyte-ui
[REPLAY] input: C:\\lab\\redbyte-ui\\ops\\proof/vector-run-2026-01-16T02-44-10.json
[REPLAY] resolved: C:\\lab\\redbyte-ui\\ops\\proof/vector-run-2026-01-16T02-44-10.json
[REPLAY] outdir: C:\lab\redbyte-ui\ops\proof
[REPLAY] Loading events from: C:\lab\redbyte-ui\ops\proof/vector-events-2026-01-16T02-44-10.ndjson
[REPLAY] Loaded 6 events from NDJSON
[REPLAY] Replaying 6 events...
[REPLAY] OK Report: C:\lab\redbyte-ui\ops\proof\proof-replay-2026-01-16T02-44-10.md
[REPLAY] OK JSON: C:\lab\redbyte-ui\ops\proof\proof-replay-2026-01-16T02-44-10.json

[REPLAY SUMMARY]
Events: 6 replayed
Duration: 0s
Replay Hash: sha256:90a9f62dcc3b127e...
Failures: 0
Status: PASS

[REPLAY] events=6 verdict=PASS out=C:\lab\redbyte-ui\ops\proof\proof-replay-2026-01-16T02-44-10.md
```

---

## TICK Semantics (Frozen for Replay Compatibility)

**Documented in**: `packages/rb-fpga-bridge/BRIDGE_CONTRACT.md`

**Contract**:
- **Initial Value**: TICK starts at `0` (before first observation)
- **Increment Timing**: TICK increments **after** each `io:update` event
- **Observable State**: TICK is part of every `io:update` payload
- **Persistence**: TICK never resets during a session (monotonically increasing)
- **Type**: Integer (decimal string in protocol, number in events)

**Why This Matters**:
- Test vectors expect TICK=0 for first vector, TICK=1 for second, etc.
- Counter DUT mode uses TICK as observable state (LED = TICK value)
- Replay validation checks TICK monotonicity (never decreases, no gaps)
- Changing TICK semantics breaks replay compatibility

**Example Sequence**:
```javascript
// Initial state: TICK = 0
applyInputs(SW=0, BTN=0);
emitIoUpdateEvent(); // {TICK: "0", SW: "...", LED: "...", BTN: "..."}
// After observation: TICK increments to 1

applyInputs(SW=1, BTN=0);
emitIoUpdateEvent(); // {TICK: "1", SW: "...", LED: "...", BTN: "..."}
// After observation: TICK increments to 2
```

---

## Regression Test Added

**File**: `packages/rb-fpga-bridge/tests/replay-regression.test.js`

**Purpose**: Prevents "No events found in proof" from shipping.

**What It Checks**:
1. ✅ Vector test runs successfully
2. ✅ Capsule generated with events pointer
3. ✅ Events pointer has `format`, `path`, `sha256`, `count`
4. ✅ NDJSON file exists at `events.path`
5. ✅ Event count matches capsule declaration
6. ✅ [RUN] summary line present
7. ✅ Replay does NOT fail with "No events found"
8. ✅ [REPLAY] summary line present

**Usage**:
```bash
node packages/rb-fpga-bridge/tests/replay-regression.test.js
# Exit 0 if pass, 1 if fail
```

**Output**:
```
[TEST] Replay Regression Test
[TEST] ========================================
[TEST] Step 1: Run vector test (passthrough)...
[TEST] ✓ Capsule generated: C:\lab\redbyte-ui\ops\proof/vector-run-2026-01-16T02-44-10.json
[TEST] ✓ Capsule has events pointer: C:\lab\redbyte-ui\ops\proof/vector-events-2026-01-16T02-44-10.ndjson
[TEST] ✓ Events NDJSON exists
[TEST] ✓ Event count matches: 6
[TEST] ✓ [RUN] summary present
[TEST] ✓ Replay did not fail with "No events found"
[TEST] ✓ [REPLAY] summary present
[TEST] ========================================
[TEST] ✅ ALL CHECKS PASSED
```

---

## Files Modified

### Core Infrastructure
- **`packages/rb-fpga-bridge/src/vector-runner.js`**:
  - Added events pointer with `format`, `path`, `sha256`, `count`
  - Write NDJSON before capsule (to compute hash)
  - Removed buggy replay report reading logic
  
- **`packages/rb-fpga-bridge/scripts/proof-replay.js`**:
  - Discover events from `capsule.events.path`
  - Verify hash if `capsule.events.sha256` present
  - Backward compatibility: support inline events (legacy)
  - Added `[REPLAY] events=<N> verdict=<PASS|FAIL> out=<path>` summary

### Documentation
- **`packages/rb-fpga-bridge/BRIDGE_CONTRACT.md`**:
  - Added "TICK Semantics (State Counter)" section
  - Documented increment timing, initial value, persistence
  - Examples of TICK behavior across vectors
  - Warning: changing TICK semantics breaks replay compatibility

### Testing
- **`packages/rb-fpga-bridge/tests/replay-regression.test.js`** (new):
  - Automated regression test for full vector → replay pipeline
  - Prevents "No events found" from shipping again

---

## What This Enables (Offline FPGA Development)

You can now develop FPGA integration **without hardware**:

### 1. Virtual DUT Development
- Add new DUT modes in `MockBridge.applyInputs()`
- Test with vectors immediately
- Lock proof capsules as golden references

### 2. Vector Suite Generation
- Generate vectors from truth tables
- Compare "golden expected" vs "observed"
- Diff proofs across code changes

### 3. Typical Lab Tasks (Mock-Backed)
```javascript
// Example: Add debounce DUT
case 'debounce':
  // Debounce BTN with 3-sample window
  ledInt = debounceLogic(btnHistory);
  break;

// Example: Add FSM DUT
case 'fsm':
  ledInt = executeStateMachine(state, swInt, btnInt);
  break;

// Example: Add seven-segment decoder
case 'sevenseg':
  ledInt = decodeSevenSegment(swInt);
  break;
```

### 4. CI Integration
```yaml
# .github/workflows/fpga-tests.yml
- name: Run vector tests
  run: pnpm --filter @redbyte/fpga-bridge test:vectors -- --board basys3 --vectors packages/rb-fpga-bridge/examples/test-*.json --dut passthrough

- name: Run regression test
  run: node packages/rb-fpga-bridge/tests/replay-regression.test.js
```

### 5. When Hardware Arrives
**Swap only**:
- Transport layer (mock → serial)
- Codec layer (protocol framing)

**Keep identical**:
- Vector format
- Bridge contract
- Event schema
- Proof capsule format
- Replay validation
- All test vectors

---

## Machine-Parsable Output (CI-Ready)

### Vector Runner
```
[RUN] task=vectors board=basys3 dut=passthrough vectors=5 verdict=PASS capsule=C:\lab\redbyte-ui\ops\proof/vector-run-2026-01-16T02-44-10.json
```

**Grep-able**:
```bash
# Find all test runs
grep '\[RUN\]' logs.txt

# Find failures
grep '\[RUN\].*verdict=FAIL' logs.txt

# Extract capsule paths
grep '\[RUN\]' logs.txt | sed 's/.*capsule=//'
```

### Proof Replay
```
[REPLAY] events=6 verdict=PASS out=C:\lab\redbyte-ui\ops\proof\proof-replay-2026-01-16T02-44-10.md
```

**Grep-able**:
```bash
# Find replay failures
grep '\[REPLAY\].*verdict=FAIL' logs.txt

# Count total events replayed
grep '\[REPLAY\] events=' logs.txt | awk -F'events=' '{print $2}' | awk '{sum+=$1} END {print sum}'
```

---

## Next Steps (Optional Improvements)

### 1. Add More DUT Modes
- **Debounce**: Multi-sample button filtering
- **Edge Detect**: Rising/falling edge detection
- **FSM**: State machine execution
- **Seven-Segment**: BCD to 7-segment decoder
- **Parity**: Even/odd parity generator

### 2. Vector Generation from Truth Tables
```javascript
// Generate exhaustive 2-input tests
for (let sw0 = 0; sw0 <= 1; sw0++) {
  for (let sw1 = 0; sw1 <= 1; sw1++) {
    const expected = sw0 ^ sw1;
    vectors.push({
      name: `SW[0]=${sw0}, SW[1]=${sw1} → LED=${expected}`,
      inputs: { SW: sw0 + (sw1 << 1), BTN: 0 },
      expect: { LED: expected }
    });
  }
}
```

### 3. Golden Reference Proofs
- Lock proof capsules for known-good runs
- Compare new runs against golden references
- Detect regressions in logic behavior

### 4. CI Pipeline Integration
- Run regression test on every commit
- Block merges if replay fails
- Archive proof capsules as artifacts

---

## Summary

**Before This Fix**:
- Vector runner: ✅ Working
- Proof capsule: ✅ Generated
- Events NDJSON: ✅ Written
- Replay: ❌ "No events found in proof"

**After This Fix**:
- Vector runner: ✅ Working
- Proof capsule: ✅ Generated with events pointer
- Events NDJSON: ✅ Written with hash verification
- Replay: ✅ Discovers events, validates, generates report

**Replay is now deterministic and cannot fail silently.**

**Commit**: `2d9b0908`  
**Files Changed**: 4  
**Lines Added**: 581  
**Lines Removed**: 23  
**Regression Test**: ✅ PASSING  
**End-to-End Validation**: ✅ ALL 4 DUT MODES WORKING

This is now **100% production-ready** for hardware-agnostic FPGA development.
