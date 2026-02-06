# P5A-3 Smoke Checklist — Help/Troubleshooting App (Slice 1)

**Purpose**: Quick human validation of Help app functionality before release.

**Duration**: ~5 minutes

**Prerequisites**:
- Local dev server running (`pnpm dev`)
- RedByte OS booted to desktop

---

## Test Steps

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
  - Error Codes / Troubleshooting Matrix
  - Hardware Timeout / Device Not Found
  - Firmware Upload / Programming Failed
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

### 6. Contract Gate
- [ ] Run `pnpm ui:help-topics-contract-gate`
- [ ] All 9 tests pass:
  - ✓ all topics have required structure (id, title, steps)
  - ✓ every topic has 2-8 actionable steps
  - ✓ all steps are non-empty strings
  - ✓ all referenced error codes are well-formed strings (UPPER_SNAKE_CASE)
  - ✓ no duplicate topic IDs
  - ✓ all topic IDs are kebab-case
  - ✓ all topic titles are descriptive (not empty)
  - ✓ errorCodes field is optional and array if present
  - ✓ at least one topic exists

---

## Expected Behavior

- **Search**: Filters topics by title, error codes, or step content (case-insensitive)
- **Auto-select**: First search result is automatically selected
- **Copy Diagnostics**: Collects system state + selected topic, copies as JSON
- **Error codes**: Topics link to error codes like HW_NOT_CONNECTED, BRIDGE_UNREACHABLE, etc.
- **Layout**: Responsive, dark theme, cyan accents, smooth focus states

---

## Known Limitations (Slice 1)

- **NO automatic Help entry points** (Slice 2):
  - ErrorBoundary "Need Help?" button not wired
  - Hardware failures don't auto-suggest Help topics
  - Manual launch only (via launcher or command palette)

- **NO live progress bus integration** (Slice 2):
  - Copy Diagnostics reads `window.__rbProgressBus` if available
  - May show empty `recentFailures` if progressBus not initialized

---

## Last Validated

- **Date**: [PENDING — run smoke test and record date here]
- **Commit**: [PENDING — add commit SHA after P5A-3 Slice 1 commit]
- **Gate Count**: 10 gates (9 existing + ui:help-topics-contract-gate)
- **GREEN LOCK**: [PENDING — run `pnpm ci:parity` and confirm exit code 0]

---

## Failure Recovery

If any step fails:
1. Check browser console for errors
2. Verify `packages/rb-apps/src/help/helpTopics.ts` has 7 topics
3. Verify `packages/rb-apps/src/apps/HelpAppManifest.ts` exists
4. Verify `packages/rb-apps/src/index.ts` imports and registers HelpAppManifest
5. Run `pnpm -r build` to ensure fresh build
6. Reload dev server and retry

If gate fails:
1. Run `pnpm ui:help-topics-contract-gate --reporter=verbose` for details
2. Check that all topics have 2-8 steps
3. Check that all error codes are UPPER_SNAKE_CASE
4. Check for duplicate topic IDs

---

**Attribution**: Connor Angiel — RedByte OS Genesis
