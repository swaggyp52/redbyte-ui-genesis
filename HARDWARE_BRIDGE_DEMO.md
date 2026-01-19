# Hardware Bridge MVP - Demo Walkthrough for Professor

**Status:** ✅ READY FOR DEMONSTRATION  
**Bridge Version:** 1.0.0  
**Endpoints:** 7 MVP contract endpoints on `127.0.0.1:3002/api/v1`  
**UI App:** Running on `http://localhost:5173`

---

## Pre-Demo Setup (Run These Once)

### 1. Start the Hardware Bridge MVP

Open PowerShell in the repo root and run:

```powershell
node tools/desktop-bridge-mvp.js
```

Expected output:
```
[Bridge MVP] Listening on http://127.0.0.1:3002
[Bridge MVP] API v1 endpoints ready:
  GET    /api/v1/health
  GET    /api/v1/devices
  POST   /api/v1/session/open
  POST   /api/v1/session/close
  GET    /api/v1/session/:id/io
  POST   /api/v1/session/:id/test/run
  GET    /api/v1/evidence/:runId
```

### 2. Start the Dev Server

In another PowerShell, from the repo root:

```powershell
pnpm dev
```

Expected output:
```
VITE v7.2.6 ready in XXX ms
```

### 3. Open the UI

Navigate to: **http://localhost:5173**

---

## Demo Sequence

### **Scene 1: Bridge Offline State** (~1 minute)

**Goal:** Show that UI gracefully handles offline bridge.

**Steps:**

1. **Stop the bridge process** (PowerShell where bridge is running):
   - Press `Ctrl+C` to stop the bridge
   - Wait 5 seconds for health check to timeout

2. **Observe Hardware tab**:
   - Navigate to the **Hardware** tab in the UI (if not already there)
   - **Expected:** See "Bridge Status: OFFLINE" message or similar indicator
   - **Expected:** No crash, no console errors, UI remains responsive
   - **Note:** All buttons/fields should be disabled or show "Not available" states

3. **Check console** (F12 → Console tab):
   - Should see retry/reconnect attempts
   - Should NOT see any `TypeError: Cannot read property 'size' of undefined` errors
   - Should NOT see unhandled promise rejections

**Talking Point:**
> "Notice the UI gracefully degrades when the bridge is unavailable. There are no crashes, no undefined errors—the contract ensures safe defaults."

---

### **Scene 2: Bridge Online + Device Discovery** (~2 minutes)

**Goal:** Show device enumeration and connection establishment.

**Steps:**

1. **Start the bridge** (from earlier PowerShell or new one):
   ```powershell
   node tools/desktop-bridge-mvp.js
   ```

2. **Refresh the UI tab** (Ctrl+R or click refresh):
   - Watch the Hardware tab for status changes
   - **Expected within 3 seconds:** "Bridge Status: ONLINE"
   - **Expected:** A device entry appears with:
     - Device ID: `mock-0`
     - Board Model: `FPGA-DevKit-v1`
     - Board Family: `Artix-7`
     - Serial: `ABC123`
     - Status: "Available"

3. **Expand the device entry** (if UI has expand/collapse):
   - **Expected to see:**
     - Capabilities:
       - `canReadInputs: true`
       - `canReadOutputs: true`
       - `maxPollHz: 50`
       - Named signals: `["SW0", "SW1", "BTN0", "LED0", "LED1"]`

**Talking Point:**
> "The bridge discovers available devices immediately. Our contract guarantees structured capability metadata—no surprises in what hardware can do."

---

### **Scene 3: Session Open + I/O Snapshot** (~2 minutes)

**Goal:** Demonstrate live I/O observation from mock hardware.

**Steps:**

1. **Click "Open Session"** (or equivalent button for the device):
   - Button should change to "Session Active" or similar
   - **Expected:** UI shows:
     - Session ID (unique identifier)
     - Input signals:
       - `SW0: 1` (or 0, depending on counter state)
       - `SW1: 0`
       - `BTN0: 0`
     - Output signals:
       - `LED0: <mirrors SW0>`
       - `LED1: <SW1 XOR BTN0>`

2. **Observe deterministic behavior**:
   - Close and reopen session
   - **Expected:** Values **advance deterministically** (not random)
   - **Expected pattern:** SW0 increments every poll, LED0 always mirrors SW0
   - **This demonstrates:** No randomness, repeatable demo behavior

3. **Check latency/polling**:
   - UI should update every ~200ms (10 Hz polling rate, adjustable in code)
   - Timestamp field updates smoothly without flickering

**Talking Point:**
> "Notice the I/O is deterministic, not random. The SW0 input increments steadily, and LED0 mirrors it exactly. This makes the demo reproducible for the exam—no luck involved."

---

### **Scene 4: Test Vector Runner** (~3 minutes)

**Goal:** Demonstrate test automation and pass/fail evaluation.

**Steps:**

1. **Locate the test vector panel** in the Hardware tab:
   - Should show a test editor or pre-loaded test vectors
   - Example test vectors might be pre-configured like:
     ```
     Test 1: SW0=1 -> LED0 should be 1
     Test 2: SW1=1, BTN0=0 -> LED1 should be 1
     Test 3: SW1=1, BTN0=1 -> LED1 should be 0
     ```

2. **Click "Run Test"**:
   - Bridge executes the test vectors
   - **Expected output within 1 second:**
     ```
     Summary:
       Total: 3
       Passed: 2
       Failed: 1
       Overall: FAIL (or "Failed" status)
     
     Details:
       Test 1: PASS (observed SW0=1 → LED0=1 ✓)
       Test 2: PASS (observed SW1=1, BTN0=0 → LED1=1 ✓)
       Test 3: FAIL (observed SW1=1, BTN0=1 → LED1=1, expected LED1=0 ✗)
     ```

3. **Observe evidence storage**:
   - UI should show:
     - Run ID: unique identifier
     - Timestamp: when test ran
     - Hash: payload fingerprint
     - Signature: mock signature (not cryptographically real, but structure present)

**Talking Point:**
> "The test runner evaluates logic on the fly. The mock hardware implements combinatorial logic: LED1 = SW1 XOR BTN0. Watch as we run vectors and see which pass and which fail based on that logic. This is how we'd validate real hardware designs."

---

### **Scene 5: Contract Stability Demo** (~1 minute)

**Goal:** Show that API contract never violates safety guarantees.

**Steps:**

1. **Close the session** (click button):
   - **Expected:** Session closes gracefully
   - UI should show "No active session" or disabled state

2. **Stop the bridge**:
   - PowerShell: Press `Ctrl+C`

3. **Watch the UI react**:
   - Status changes to "OFFLINE"
   - I/O display clears to safe defaults: `inputs: {}`, `outputs: {}`
   - No crashes, no undefined errors
   - Console remains clean

4. **Restart the bridge**:
   ```powershell
   node tools/desktop-bridge-mvp.js
   ```

5. **Refresh UI**:
   - UI reconnects automatically (or click "Reconnect")
   - State recovers to "ONLINE" + device list

**Talking Point:**
> "The contract is resilient. Stop the bridge, the UI gracefully goes offline. Restart the bridge, the UI reconnects. No error states that crash the student exam interface. That's demo-stable."

---

## Validation Commands (For Manual Testing)

If you want to test the bridge directly without the UI, use these curl commands:

### Health check:
```powershell
curl.exe -sS http://127.0.0.1:3002/api/v1/health | ConvertFrom-Json
```

Expected:
```json
{
  "ok": true,
  "version": "1.0.0",
  "uptimeSec": 42,
  "build": "dev"
}
```

### List devices:
```powershell
curl.exe -sS http://127.0.0.1:3002/api/v1/devices | ConvertFrom-Json | Format-Table -AutoSize
```

Expected: One device `mock-0` with capabilities.

### Open session:
```powershell
$open = curl.exe -sS -X POST -H "Content-Type: application/json" -d '{"deviceId":"mock-0"}' http://127.0.0.1:3002/api/v1/session/open
$session = $open | ConvertFrom-Json
$session.sessionId
```

Expected: `sess-<timestamp>-<randomStr>`

### Get I/O:
```powershell
$sid = $session.sessionId
curl.exe -sS "http://127.0.0.1:3002/api/v1/session/$sid/io" | ConvertFrom-Json
```

Expected:
```json
{
  "timestamp": "2026-01-19T...",
  "inputs": { "SW0": 1, "SW1": 0, "BTN0": 0 },
  "outputs": { "LED0": 1, "LED1": 0 }
}
```

### Run test vectors:
```powershell
curl.exe -sS -X POST -H "Content-Type: application/json" `
  -d '{"testId":"demo","vectors":[{"inputs":{"SW0":1},"expectedOutputs":{"LED0":1}}]}' `
  "http://127.0.0.1:3002/api/v1/session/$sid/test/run" | ConvertFrom-Json
```

Expected: Test summary with pass/fail counts.

---

## Key Guarantees (For Exam Context)

✅ **Never undefined**: UI always receives safe defaults when bridge offline  
✅ **Deterministic I/O**: Same hardware state → same outputs every time (reproducible)  
✅ **Contract-safe**: All 7 endpoints follow strict response schema  
✅ **No random values**: Mock logic uses counters and XOR, not RNG  
✅ **Graceful offline**: Bridge disconnect doesn't crash the interface  
✅ **Session-tracked**: All I/O and test runs tied to session IDs for auditing  

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| UI shows "Bridge offline" but bridge is running | Check bridge listening on `127.0.0.1:3002` via `curl` |
| Console shows `TypeError: ... undefined` | Browser cache issue; hard refresh `Ctrl+Shift+R` |
| Test vectors show all FAIL | Verify SW/BTN/LED signal names match; check `generateDeterministicIO()` in bridge code |
| Bridge crashes immediately | Check port 3002 not in use: `netstat -ano \| findstr 3002` |

---

## Files Referenced

- **Bridge Code**: [tools/desktop-bridge-mvp.js](tools/desktop-bridge-mvp.js)
- **Client Code**: [packages/rb-apps/src/services/hardwareClient.ts](packages/rb-apps/src/services/hardwareClient.ts)
- **UI App**: [apps/playground/src](apps/playground/src)

---

**Demo Estimated Duration:** 10–15 minutes  
**Target Audience:** Exam proctor / course instructor  
**Success Criteria:** UI remains stable offline, recovers online, tests run deterministically  
