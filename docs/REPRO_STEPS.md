# RedByte OS Genesis — Failure Reproduction Steps

## FAILURE 1: Evidence ZIP import fails in Submission Inspector

### Summary
`exportEvidenceCapsule()` creates `.rb-lab.zip` files, but the Submission Inspector has no ZIP parser. It only accepts flat JSON files.

### Reproduction
1. `pnpm dev`
2. Open **Virtual Lab** → Select **Lab 0: Hardware Proof** → Click **Start Lab**
3. Click **Record** (or use Arm → Record flow)
4. Toggle some inputs, wait a few seconds
5. Click **Stop**
6. Click **Export Capsule** → file `lab0_hardware_proof-YYYY-MM-DDTHH-mm-ss.rb-lab.zip` downloads
7. Open **Submission Inspector** app
8. Try to import the `.rb-lab.zip` file
9. **EXPECTED**: Inspector shows capsule data, checks, PASS/FAIL verdict
10. **ACTUAL**: Inspector cannot parse ZIP format. Only accepts `.json` files. No error shown — just nothing happens, or a parse error appears in console.

### Root Cause
- `SubmissionInspectorApp.tsx` import handler expects JSON, not ZIP
- No JSZip or equivalent dependency exists
- `evidenceExport.ts` creates ZIP via blob, but no corresponding `loadEvidenceZip()` function exists

### Files
- `packages/rb-apps/src/apps/SubmissionInspectorApp.tsx` (import handler)
- `packages/rb-apps/src/utils/evidenceExport.ts` (export function)

---

## FAILURE 2: Bridge offline state doesn't recover

### Summary
After 3 failed connection attempts (6 seconds total), HardwareClient enters permanent `offline` state. No periodic retry. Requires page reload.

### Reproduction
1. `pnpm dev` (do NOT start bridge agent)
2. Open **Virtual Lab** or any app that boots HardwareSessionStore
3. Observe console: `[HardwareClient] Connection failed (attempt 1/3)`, then 2/3, then 3/3
4. After ~6s, state becomes `offline` with message "Hardware bridge offline (expected in demo mode)"
5. Now start bridge: `pnpm run bridge:dev`
6. **EXPECTED**: UI reconnects automatically within 30-60s
7. **ACTUAL**: UI stays permanently offline. Must reload page to reconnect.

### Root Cause
- `hardwareClient.ts:235-254` — after `retryAttempts >= MAX_RETRY_ATTEMPTS` (3), sets status to `offline` and stops retrying
- No `setInterval` or background retry loop after entering offline state

### Files
- `packages/rb-apps/src/services/hardwareClient.ts` (retry logic around line 235)

---

## FAILURE 3: COM port can be opened twice

### Summary
Bridge agent uses `connecting: Set<string>` keyed by `deviceId`, not by port path. Two different deviceIds mapping to the same physical port can both open it.

### Reproduction
1. Start bridge: `pnpm run bridge:dev`
2. Connect via WS client or UI:
   ```json
   {"v":"rb-bridge.v1","id":1,"type":"CONNECT","payload":{"target":"arduino-uno","port":"COM6","baud":115200}}
   ```
3. Before first connection completes, send:
   ```json
   {"v":"rb-bridge.v1","id":2,"type":"CONNECT","payload":{"target":"basys3","port":"COM6","baud":115200}}
   ```
4. **EXPECTED**: Second request rejected with "Port COM6 already in use by arduino-uno"
5. **ACTUAL**: Both backends attempt to open COM6. SerialPort may throw EBUSY, or on some platforms both succeed causing data corruption.

### Root Cause
- `rb-bridge-agent/src/index.ts:100` — `connecting.has(deviceId)` checks deviceId, not port
- No `portToBackend` map exists
- No port-level mutex

### Files
- `packages/rb-bridge-agent/src/index.ts` (CONNECT handler around line 95)

---

## FAILURE 4: Recording unbounded memory

### Summary
Recording appends to `stimulus[]` and `trace[]` arrays using spread operator, creating O(n^2) cumulative cost with no cap.

### Reproduction
1. `pnpm dev`
2. Open **Logic Playground** → Build a circuit with several probes
3. Set tick rate to maximum (1000Hz if available, or highest)
4. Click **Record**
5. Let it run for 2-5 minutes
6. Open Chrome DevTools → Memory tab → Take heap snapshot
7. **EXPECTED**: Memory usage bounded (< 10MB for recording data)
8. **ACTUAL**: `trace` array grows unboundedly. At 1000Hz × 5min = 300K entries. Each `recordTraceSample` copies entire array via `[...state.trace, sample]`. Memory can reach 15-50MB+ for trace data alone. Browser may become sluggish.

### Root Cause
- `runRecorderStore.ts` — `recordTraceSample` and `recordEvent` use `[...state.array, newItem]` pattern
- No circular buffer, no cap, no downsampling
- Warning appears at 20K samples but doesn't prevent growth

### Files
- `packages/rb-apps/src/stores/runRecorderStore.ts` (recordTraceSample, recordEvent methods)

---

## FAILURE 5: 3D layout lost on refresh

### Summary
Node positions in the 3D lab are stored only in Zustand memory state. No persistence to localStorage or any storage. Refreshing the page resets all positions.

### Reproduction
1. `pnpm dev`
2. Open **Virtual Lab** → Select any lab → Start session
3. Move a 3D node (click to select, drag gizmo to translate)
4. Verify node is in new position
5. Press F5 (page refresh)
6. **EXPECTED**: Node remains in moved position
7. **ACTUAL**: Node resets to default auto-layout position. All manual positioning lost.

### Root Cause
- `packages/rb-logic-3d/src/lab-model/store.ts` — no Zustand `persist` middleware applied
- `LabCapsule` type exists (types.ts:121-129) but serialization to storage is not wired
- No localStorage read/write for graph positions

### Files
- `packages/rb-logic-3d/src/lab-model/store.ts` (store creation, no persist)
- `packages/rb-logic-3d/src/lab-model/types.ts` (LabCapsule type, unused)

---

## FAILURE 6: React 19 / Zustand test skips

### Summary
Two test suites are skipped due to React 19 + Zustand `useSyncExternalStore` infinite loop issues.

### Skipped Tests

**1. Palette interaction tests**
- File: `packages/rb-apps/src/__tests__/playground-palette-interaction.test.tsx`
- Status: `describe.skip()`
- Root cause (documented at lines 377-383):
  > React 19 + Zustand infinite loop issue. Stores use real Zustand subscriptions that trigger React 19's stricter useSyncExternalStore. Core stores cannot be mocked without defeating test purpose.
- Fix needed: Update stores to cache getSnapshot results, or replace `Set` objects with arrays in store state

**2. Golden path E2E test**
- File: `tests/e2e/logic-playground-golden-path.spec.ts`
- Status: `test.skip()`
- Root cause: "Rewritten for ECELabApp, old StudentLabApp workflow no longer exists"
- Fix needed: Rewrite test for current VirtualLabApp workflow

### Files
- `packages/rb-apps/src/__tests__/playground-palette-interaction.test.tsx`
- `tests/e2e/logic-playground-golden-path.spec.ts`
