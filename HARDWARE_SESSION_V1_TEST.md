# Hardware Session v1 — Manual Test Checklist

## Test Environment Setup

### Prerequisites
1. Project built: `pnpm run build`
2. Dev server running: `pnpm dev` (port 5173)
3. Desktop Bridge running: `node tools/desktop-bridge.js` (port 3002)

## Test Scenarios

### Scenario 1: Bridge Online + Board Connected (Happy Path)

**Steps:**
1. Start Desktop Bridge: `node tools/desktop-bridge.js`
2. Open lab: `http://localhost:5173/lab.html?lab=traffic-light`
3. Enter student name, select traffic-light lab, click "Start Attempt"
4. Navigate to "3. Hardware" tab

**Expected:**
- ✅ Bridge status shows "● Online"
- ✅ Board status shows "● Connected"
- ✅ Board model displays "Basys3"
- ✅ Last checked timestamp updates every ~2 seconds

**Actions:**
5. Click "📸 Capture Snapshot" button

**Expected:**
- ✅ New snapshot card appears immediately
- ✅ Snapshot shows:
  - Timestamp (current time)
  - Source badge: "🔗 Bridge"
  - Inputs (JSON with SW, BTN values)
  - Outputs (JSON with LED value)
- ✅ Hardware tab badge shows snapshot count (e.g., "3. Hardware [1]")

6. Click "Capture Snapshot" 2 more times

**Expected:**
- ✅ Total 3 snapshot cards displayed
- ✅ Each has different I/O values (mock randomizes)
- ✅ Tab badge shows "3. Hardware [3]"

7. Navigate to "5. Export" tab
8. Click "Export Submission"
9. Confirm export

**Expected:**
- ✅ ZIP downloads successfully
- ✅ Receipt screen shows submission details
- ✅ Can download ZIP again

**Verification:**
10. Extract downloaded ZIP
11. Open `manifest.json`

**Expected:**
- ✅ Contains `hardware` section:
  ```json
  "hardware": {
    "evidence_path": "proofs/hardware.json",
    "bridge_status": "online",
    "board_status": "connected",
    "snapshots_count": 3
  }
  ```

12. Open `proofs/hardware.json`

**Expected:**
- ✅ File exists
- ✅ Contains:
  ```json
  {
    "bridge_status": "online",
    "board_status": "connected",
    "board_model": "Basys3",
    "snapshots": [ /* 3 snapshot objects */ ],
    "captured_at": "2026-01-18T..."
  }
  ```

13. Open `proofs/events.ndjson`

**Expected:**
- ✅ Contains `board_connected` event
- ✅ Contains 3 `snapshot_captured` events
- ✅ Contains `attempt_submitted` event with `hardware_snapshots_count: 3`

---

### Scenario 2: Bridge Offline (Manual Fallback)

**Steps:**
1. **Stop Desktop Bridge** (Ctrl+C in bridge terminal)
2. Refresh lab page: `http://localhost:5173/lab.html?lab=traffic-light`
3. Start new attempt
4. Navigate to "3. Hardware" tab

**Expected:**
- ✅ Bridge status shows "○ Offline"
- ✅ Board status shows "○ Not Connected"
- ✅ Hint displays: "Start the Desktop Bridge to enable automatic board detection."
- ✅ Action hint shows: "Manual entry will be used (no bridge/board detected)"

**Actions:**
5. Click "📸 Capture Snapshot"

**Expected:**
- ✅ Manual snapshot modal appears
- ✅ Modal has fields for:
  - Inputs (JSON)
  - Outputs (JSON)
  - Notes (optional)

6. Enter manual data:
   - Inputs: `{"SW":5,"BTN":1}`
   - Outputs: `{"LED":7}`
   - Notes: `Observed traffic light in RED state`
7. Click "Save Snapshot"

**Expected:**
- ✅ Modal closes
- ✅ Snapshot card appears with:
  - Source badge: "✏️ Manual"
  - Entered inputs/outputs
  - Notes displayed

8. Export and verify ZIP

**Expected:**
- ✅ `manifest.json` shows `bridge_status: "offline"`, `board_status: "disconnected"`
- ✅ `proofs/hardware.json` contains manual snapshot with source: "manual"
- ✅ Events include `snapshot_captured` with `source: "manual"`

---

### Scenario 3: Progress Indicator Integration

**Steps:**
1. Start fresh attempt (with bridge online)
2. Observe progress bar above tabs

**Expected:**
- ✅ Progress shows 5 steps: Spec → Build → Hardware → Self-Check → Export
- ✅ Hardware step initially NOT completed (gray/outlined)

3. Capture 1 snapshot

**Expected:**
- ✅ Hardware step shows completed (filled/green)

4. Complete Self-Check → Export

**Expected:**
- ✅ All 5 steps show completed

---

### Scenario 4: CI Compatibility (No Bridge in CI)

**Steps:**
1. Run existing CI tests: `pnpm ops:liveness:pass`

**Expected:**
- ✅ Tests still pass
- ✅ Export succeeds even without hardware snapshots
- ✅ Exported ZIP is valid (manifest + capsule + events present)
- ✅ `manifest.json` may omit `hardware` section if no snapshots captured
- ✅ Ops server ingests bundle successfully

---

## Acceptance Criteria

### Must Pass:
- ✅ Bridge detection works (online/offline polling)
- ✅ Board status updates automatically
- ✅ Snapshot capture works in both bridge and manual modes
- ✅ Snapshots included in export bundle (hardware.json + events)
- ✅ Manual fallback modal functions correctly
- ✅ Export works with 0, 1, or multiple snapshots
- ✅ Progress indicator reflects hardware completion
- ✅ Existing CI tests remain passing
- ✅ No console errors in browser

### Visual Checks:
- ✅ Hardware tab matches OLED luxury theme (dark, cyan accents)
- ✅ Status cards display correctly (online=green, offline=gray)
- ✅ Snapshot cards are readable and well-formatted
- ✅ Modal is centered and usable

---

## Rollback Plan

If Hardware Session v1 causes regressions:
1. Revert LogicLabApp.tsx to pre-hardware version
2. Revert bundleExport.ts changes
3. Remove hardware tab styles from LogicLabApp.module.css
4. Rebuild: `pnpm run build`
5. Verify CI passes: `pnpm ops:liveness:ci`

---

## Next Steps After v1

If this milestone passes, future enhancements:
- **Real USB detection** (via WebUSB API or native bridge)
- **Bitstream programming** (OpenOCD integration)
- **Live I/O monitoring** (real-time updates during lab)
- **Photo evidence upload** (alternative to manual JSON entry)
