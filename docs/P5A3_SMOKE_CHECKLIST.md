# P5A-3 Smoke Checklist — Help/Troubleshooting App (Slice 1 + Slice 2)

**Purpose**: Quick human validation of Help app functionality and entry points before release.

**Duration**: ~8 minutes

**Prerequisites**:
- Local dev server running (`pnpm dev`)
- RedByte OS booted to desktop

---

## Slice 1: Help App Core Functionality

### 1. Open Help App
- [ ] Click launcher or run `Ctrl+P → "Help"`
- [ ] Help window opens with title "Help & Troubleshooting"
- [ ] Layout: search box at top, topic list on left (320px), content pane on right

### 2. Browse Topics
- [ ] Topic list shows 7 topics:
  - Bridge Offline / Hardware Connect
  - Export / Submission (.rbproj / .rbx.zip)
  - Autosave / Recovery ("You Can't Lose Your Work")
  - Performance Mode ("Why is Scope Slow?")
  - Hardware Timeout / Device Not Found
  - Firmware Upload / Programming Failed
  - Error Codes / Troubleshooting Matrix
- [ ] Click a topic → content pane shows title and 2-8 steps
- [ ] Click another topic → content pane updates

### 3. Search Functionality
- [ ] Type "HW_NOT_CONNECTED" in search box
- [ ] Topic list filters to "Bridge Offline / Hardware Connect"
- [ ] First result is auto-selected (content pane shows it)
- [ ] Clear search → all 7 topics reappear

### 4. Search by Keyword
- [ ] Type "autosave" in search box
- [ ] "Autosave / Recovery" topic appears (matches title)
- [ ] Type "timeout" → "Hardware Timeout / Device Not Found" and "Error Codes" appear
- [ ] Clear search → all topics reappear

### 5. Copy Diagnostics
- [ ] Select a topic (e.g., "Bridge Offline")
- [ ] Click "Copy Diagnostics" button
- [ ] Toast notification: "Diagnostics copied to clipboard"
- [ ] Paste clipboard → verify JSON contains:
  - `timestamp` (ISO string)
  - `appVersion` ("1.0.0")
  - `performanceMode` (true/false)
  - `bridgeDryrun` (true/false based on URL)
  - `selectedTopic` (object with id/title/steps)
  - `recentFailures` (array, may be empty if progressBus not available)

### 6. Contract Gate (Slice 1)
- [ ] Run `pnpm ui:help-topics-contract-gate`
- [ ] All 9 tests pass:
  - ✓ all topics have required structure (id,title, steps)
  - ✓ every topic has 2-8 actionable steps
  - ✓ all steps are non-empty strings
  - ✓ all referenced error codes are well-formed strings (UPPER_SNAKE_CASE)
  - ✓ no duplicate topic IDs
  - ✓ all topic IDs are kebab-case
  - ✓ all topic titles are descriptive (not empty)
  - ✓ errorCodes field is optional and array if present
  - ✓ at least one topic exists

---

## Slice 2: Help Entry Points

### 7. ErrorBoundary → Help (App Crash)
- [ ] Open Logic Playground or ECE Lab
- [ ] Trigger an app crash (e.g., modify code to throw error in dev tools)
- [ ] Crash screen appears with "App Crashed" message
- [ ] **"Open Help" button visible** (cyan accent color)
- [ ] Click "Open Help" → Help app opens with error code pre-filled (if available)
- [ ] Verify Help auto-selected relevant topic or showed generic error-codes topic

### 8. ErrorBoundary → Help (Unknown Error)
- [ ] Trigger crash with generic Error (no RbUserError code)
- [ ] Click "Open Help" → Help opens to generic error-codes topic
- [ ] Verify no specific error code pre-filled (generic troubleshooting shown)

### 9. Hardware Errors → Troubleshoot (Progress Toast)
- [ ] Disconnect FPGA board or simulate hardware failure
- [ ] Trigger hardware operation (e.g., connect to bridge, select device)
- [ ] Progress toast shows error: "Bridge unreachable" or "Device not connected"
- [ ] **"Troubleshoot" button visible** in toast actions
- [ ] Click "Troubleshoot" → Help app opens with error code pre-filled (e.g., HW_NOT_CONNECTED)
- [ ] Verify Help auto-selected "Bridge Offline / Hardware Connect" topic

### 10. Hardware Error Codes → Topic Mapping
Test that hardware error codes open correct Help topics:
- [ ] HW_NOT_CONNECTED → "Bridge Offline / Hardware Connect"
- [ ] BRIDGE_UNREACHABLE → "Bridge Offline / Hardware Connect"
- [ ] HW_TIMEOUT → "Hardware Timeout / Device Not Found"
- [ ] HW_DEVICE_NOT_FOUND → "Hardware Timeout / Device Not Found"
- [ ] FIRMWARE_UPLOAD_FAILED → "Firmware Upload / Programming Failed"
- [ ] DEVICE_VERIFICATION_FAILED → "Firmware Upload / Programming Failed"

### 11. Entry Points Gate (Slice 2)
- [ ] Run `pnpm ui:help-entrypoints-gate`
- [ ] All 18 tests pass:
  - ✓ HelpApp seed resolution (4 tests)
  - ✓ Error code extraction from student errors (3 tests)
  - ✓ Hardware error code mapping (8 tests)
  - ✓ Help entry point invariants (3 tests)

---

## Expected Behavior

- **Search**: Filters topics by title, error codes, or step content (case-insensitive)
- **Auto-select**: First search result is automatically selected; error code seeds auto-select matching topic
- **Copy Diagnostics**: Collects system state + selected topic, copies as JSON
- **Error codes**: Topics link to error codes like HW_NOT_CONNECTED, BRIDGE_UNREACHABLE, etc.
- **Layout**: Responsive, dark theme, cyan accents, smooth focus states
- **Entry points**: "Open Help" buttons on crash screens, "Troubleshoot" actions on hardware error toasts
- **Topic priority**: Specific topics (bridge-offline, hardware-timeout) appear before generic error-codes topic

---

## Known Limitations

- **No automatic Help suggestions from non-hardware errors**: Only app crashes and hardware failures link to Help (by design for Slice 2)
- **Progress bus dependency**: Copy Diagnostics reads `window.__rbProgressBus` if available; may show empty `recentFailures` if not initialized

---

## Last Validated

- **Date**: 2026-02-06
- **Commit**: be95215e (fix/build-green-again)
- **Result**: PASS (all manual smoke tests + pnpm ci:parity)
- **Command**: `pnpm ci:parity` (11 gates, 63 tests)
- **GREEN LOCK**: Confirmed — all gates passing

---

## Failure Recovery

If any step fails:
1. Check browser console for errors
2. Verify `packages/rb-apps/src/help/helpTopics.ts` has 7 topics
3. Verify `packages/rb-apps/src/apps/HelpAppManifest.ts` exists
4. Verify `packages/rb-apps/src/index.ts` imports and registers HelpAppManifest
5. Verify `packages/rb-shell/src/Shell.tsx` passes onOpenHelp to AppErrorBoundary and ProgressToasts
6. Run `pnpm -r build` to ensure fresh build
7. Reload dev server and retry

If gate fails:
1. Run gate with `--reporter=verbose` to see detailed error output
2. Check that all topics have 2-8 steps
3. Check that all error codes are UPPER_SNAKE_CASE
4. Check for duplicate topic IDs
5. Verify error code → topic mappings are correct (specific before generic)

---

**Attribution**: Connor Angiel — RedByte OS Genesis
