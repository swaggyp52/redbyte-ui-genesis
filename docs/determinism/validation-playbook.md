# Operational Validation Playbook

> **Purpose:** Validate deterministic execution under real user interaction patterns

## Validation Environment

- **Build Type:** Development (`import.meta.env.DEV === true`)
- **Access:** Ctrl+Shift+D (Cmd+Shift+D on Mac) to open Determinism Panel
- **Browser:** Chrome/Edge recommended (DevTools open for console monitoring)

## Test Session 1: Basic Record → Verify → Time Travel

### A. Panel Access
- [ ] Open http://localhost:5173/
- [ ] Open Logic Playground (auto-launch or via Launcher)
- [ ] Press `Ctrl+Shift+D` to open Determinism Panel
- [ ] Verify panel title: "Determinism Tools (Dev)"
- [ ] **Evidence:** Screenshot of open panel

### B. Start Recording
- [ ] Click "Start Recording" button
- [ ] Verify recording indicator appears (red pulsing dot + "Recording..." text)
- [ ] Verify "Stop Recording" button is enabled
- [ ] **Evidence:** Screenshot showing recording indicator

### C. Generate Events

**Circuit Load Event:**
- [ ] Click "Examples" → Select "Half Adder" or "4-bit Counter"
- [ ] Observe circuit loads in canvas
- [ ] **Expected:** `circuit_loaded` event recorded

**Input Toggle Events:**
- [ ] Click 2-3 input switches in the loaded circuit
- [ ] Observe switch states change visually
- [ ] **Expected:** `input_toggled` event per toggle

**Simulation Tick Events (Manual):**
- [ ] Click "Step" button 5-10 times
- [ ] Observe tick counter increment
- [ ] **Expected:** `simulation_tick` event per step

**Simulation Tick Events (Continuous):**
- [ ] Click "Run" button
- [ ] Wait ~2 seconds (observe animation)
- [ ] Click "Pause" button
- [ ] **Expected:** Many `simulation_tick` events (typically 20-100 depending on Hz)

### D. Stop & Verify
- [ ] Click "Stop Recording" button
- [ ] Verify recording indicator disappears
- [ ] Verify "Verify Replay" button is enabled
- [ ] Verify "Export Log" button is enabled
- [ ] **Evidence:** Screenshot showing enabled buttons

**Verification:**
- [ ] Click "Verify Replay" button
- [ ] Wait for verification to complete (~1-5 seconds depending on event count)
- [ ] Observe "Verification Result" section appears
- [ ] **Critical Check:** Status shows "✓ Deterministic" in green
- [ ] Verify Live Hash and Replay Hash are displayed (first 12 characters)
- [ ] **Critical Check:** Hash prefixes match visually
- [ ] **Evidence:** Screenshot showing verification result with hashes

**Success Criteria:**
- ✅ Status: "✓ Deterministic"
- ✅ Live Hash prefix === Replay Hash prefix
- ✅ Both hashes are SHA-256 format (64 hex characters, shown truncated)

**Failure Indicators:**
- ❌ Status: "✗ Diverged"
- ❌ Hash prefixes differ
- ❌ Console errors during verification

### E. Export Log
- [ ] Click "Export Log" button
- [ ] Verify browser downloads file: `determinism-log-{timestamp}.json`
- [ ] Open downloaded file in text editor
- [ ] Verify JSON structure contains:
  - `initialCircuit` object with `nodes` and `connections` arrays
  - `eventLog` object with `version: "1"` and `events` array
  - `metadata` object with `exportedAt` timestamp and `eventCount` number
- [ ] **Evidence:** Save exported JSON file for attachment

**Sample Structure:**
```json
{
  "initialCircuit": {
    "nodes": [...],
    "connections": [...]
  },
  "eventLog": {
    "version": "1",
    "events": [
      { "type": "circuit_loaded", ... },
      { "type": "input_toggled", ... },
      { "type": "simulation_tick", ... }
    ]
  },
  "metadata": {
    "exportedAt": 1735426789123,
    "eventCount": 47
  }
}
```

### F. Time Travel Navigation
- [ ] Click "Initialize" button (Time Travel section)
- [ ] Verify event counter appears: "Event 1 of N"
- [ ] Verify "Step Back" button is disabled (at start)
- [ ] Verify "Step Forward" button is enabled

**Forward Navigation:**
- [ ] Click "Step Forward →" button repeatedly
- [ ] Verify counter increments: "Event 2 of N", "Event 3 of N", etc.
- [ ] Continue until reaching final event: "Event N of N"
- [ ] Verify "Step Forward" button becomes disabled at end
- [ ] **Evidence:** Screenshot showing mid-navigation (e.g., Event 5 of 47)
- [ ] **Evidence:** Screenshot showing final event with disabled forward button

**Backward Navigation:**
- [ ] Click "← Step Back" button repeatedly
- [ ] Verify counter decrements: "Event N-1 of N", "Event N-2 of N", etc.
- [ ] Continue until reaching first event: "Event 1 of N"
- [ ] Verify "Step Back" button becomes disabled at start
- [ ] **Evidence:** Screenshot showing backward navigation

**Boundary Crossing:**
Manually step through and observe different event types:
- [ ] Circuit loaded boundary (typically Event 1)
- [ ] First input toggle
- [ ] First simulation tick
- [ ] Multiple simulation ticks in sequence

### G. Reset
- [ ] Click "Reset" button
- [ ] Verify verification result section clears
- [ ] Verify time travel state resets (counter disappears)
- [ ] **Evidence:** Screenshot showing cleared state

---

## Test Session 2: Edge Cases

### A. No Circuit Open
- [ ] Close Logic Playground window (leave OS running)
- [ ] Open Determinism Panel (Ctrl+Shift+D)
- [ ] Click "Start Recording" button
- [ ] Verify alert appears: "No active circuit found. Open Logic Playground first."
- [ ] **Evidence:** Screenshot showing alert message

### B. Verify Without Recording
- [ ] Ensure no recording is active (panel shows clean state)
- [ ] Observe "Verify Replay" button state
- [ ] **Expected:** Button is disabled OR clicking shows helpful message
- [ ] **Evidence:** Screenshot showing disabled button

### C. Long Run (Stress Test)
- [ ] Open Logic Playground
- [ ] Click "Start Recording"
- [ ] Load any circuit (e.g., 4-bit Counter)
- [ ] Click "Run" button
- [ ] Wait 5-10 seconds (allow many ticks to accumulate)
- [ ] Click "Pause" button
- [ ] Click "Stop Recording"
- [ ] Click "Verify Replay"
- [ ] **Critical Check:** Verification must still show "✓ Deterministic"
- [ ] Click "Export Log"
- [ ] Open exported JSON and check `metadata.eventCount`
- [ ] **Expected:** Event count should be 100+ events
- [ ] **Evidence:** Screenshot showing deterministic verification with high event count

---

## Evidence Pack Checklist

When reporting validation results, include:

### Pass/Fail Summary
```
✅ Session 1: Basic Record → Verify → Time Travel - PASSED
✅ Session 2: Edge Cases - PASSED
✅ All verification results: Deterministic
✅ All exported logs: Valid JSON structure
✅ Time travel navigation: Smooth across all boundaries
```

### Artifacts
- [ ] Screenshot: Determinism Panel open
- [ ] Screenshot: Recording indicator active
- [ ] Screenshot: Verification result (hashes + deterministic status)
- [ ] Screenshot: Time travel mid-navigation
- [ ] Screenshot: Time travel at final event
- [ ] Exported JSON: `determinism-log-{timestamp}.json`
- [ ] Console log: Any warnings or errors (copy/paste)

---

## Failure Reporting Template

If any validation step fails, use this exact format:

```
❌ FAILURE DETECTED

Step: [e.g., 1D - Verify Replay]
Observed Behavior: [e.g., Status shows "✗ Diverged"]
Expected Behavior: [e.g., Status should show "✓ Deterministic"]

Hashes:
  Live Hash:   abc123def456...
  Replay Hash: xyz789ghi012...
  Match: NO

Event Details:
  Event Count: 47
  Event Types: circuit_loaded (1), input_toggled (3), simulation_tick (43)

Session Actions:
  - Loaded: Half Adder
  - Toggles: 3 switches
  - Steps: 8 manual
  - Run: ~3 seconds continuous

Console Errors:
[paste any console errors here]

Exported Log: determinism-log-1735426789123.json (attached)
Screenshots: panel-recording.png, verification-failed.png (attached)
```

---

## Automated Structure Validation (Optional)

After exporting JSON, run this quick check:

```bash
node -e "
const fs = require('fs');
const path = process.argv[1];
const json = JSON.parse(fs.readFileSync(path, 'utf8'));

console.log('Top-level keys:', Object.keys(json));
console.log('Event count:', json.eventLog?.events?.length);
console.log('Has initialCircuit:', !!json.initialCircuit);
console.log('Has eventLog:', !!json.eventLog);
console.log('Has metadata:', !!json.metadata);

const eventTypes = {};
json.eventLog?.events?.forEach(e => {
  eventTypes[e.type] = (eventTypes[e.type] || 0) + 1;
});
console.log('Event type breakdown:', eventTypes);
" ./determinism-log-TIMESTAMP.json
```

**Expected Output:**
```
Top-level keys: [ 'initialCircuit', 'eventLog', 'metadata' ]
Event count: 47
Has initialCircuit: true
Has eventLog: true
Has metadata: true
Event type breakdown: { circuit_loaded: 1, input_toggled: 3, simulation_tick: 43 }
```

---

## Success Criteria Summary

| Criterion | Validation Method | Pass Condition |
|-----------|-------------------|----------------|
| Recording captures events | Visual indicator + counter | Red dot shows, counter increments |
| Deterministic verification | Hash comparison | "✓ Deterministic" + matching hash prefixes |
| Export integrity | JSON structure check | Valid structure with all required fields |
| Time travel navigation | Counter + button states | Smooth increment/decrement, correct enable/disable |
| Edge case handling | Alert messages | Appropriate user feedback for invalid states |
| Stress test (long run) | High event count verification | 100+ events still deterministic |

---

## Next Steps After Validation

### If All Tests Pass ✅
1. Report: "Operational Validation PASSED"
2. Proceed to Lock & Publish documentation
3. Update milestone status to "Validated"

### If Any Test Fails ❌
1. Export the log immediately
2. Create deterministic reproduction test using exported JSON
3. Add test case to `packages/rb-logic-core/src/determinism/__tests__/`
4. Fix underlying issue
5. Re-run validation

---

## Validation History

| Date | Operator | Result | Event Count | Notes |
|------|----------|--------|-------------|-------|
| [PENDING] | [TBD] | [TBD] | [TBD] | Initial operational validation |

---

**Last Updated:** 2025-12-28
**Milestone:** D - Operational Determinism
**Status:** Awaiting validation results
