# DEMO LOCK CHECKLIST

**Purpose**: Pre-demo verification that all systems are ready for live demonstration to stakeholders.

---

## Environment Setup

### Hardware/Network
- [ ] Laptop on power (not battery)
- [ ] 5GHz WiFi connected (not shared mobile hotspot)
- [ ] No VPN active
- [ ] Browser dev tools **closed** (F12 off)

### Ports & Services
- [ ] No other process using port **4173** (demo app port)
- [ ] No other process using **5173** (lab3 preview, if needed)
- [ ] Node.js v20+ installed (`node --version`)
- [ ] pnpm installed (`pnpm --version`)

---

## Pre-Demo Validation (Morning of Demo)

### 1. Build & Gate Chain Status
Run demo readiness command:
```bash
pnpm demo:ready
```

Expected output:
```
✅ DEMO READY - All gates passing
```

If fail, do not proceed to live demo. Debug and re-run.

### 2. Visual Verification
```bash
pnpm preview
```

Then navigate browser to: `http://127.0.0.1:4173/os`

Verify:
- [ ] Desktop shell appears without errors
- [ ] No console.error messages (F12 → Console tab)
- [ ] Home app opens when launcher icon clicked
- [ ] Settings app opens
- [ ] Export dialog works (Lab Workspace → Export)
- [ ] Submission Inspector accessible (Launcher → try opening a .rb-lab.zip)

### 3. E2E Test Report
Open Playwright HTML report:
```
file://<repo>/playwright-report/index.html
```

Verify:
- [ ] All 4 E2E smoke tests show ✅ PASSED
  - Shell boots to desktop without fatal errors
  - Dashboard and studio apps are registered
  - Export functionality is accessible
  - Submission inspector app is accessible

---

## Known Demos & Their Workflows

### Demo 1: Create & Export Submission (Student Path)
1. Open Launcher
2. Click "Lab Workspace"
3. Load a circuit (or create simple 2-input AND gate)
4. Click Export → .rb-lab.zip
5. Verify naming follows `RB-<lab>-<student>-<date>.rb-lab.zip`

**Files Involved**:
- `packages/rb-apps/src/apps/LabWorkspaceApp.tsx`
- `packages/rb-apps/src/utils/bundleExport.ts`

### Demo 2: Inspect Submission (TA Path)
1. Open Launcher
2. Click "Submission Inspector"
3. Drag/drop a `.rb-lab.zip` file into drop zone
4. Verify:
   - Lab ID extracted
   - Student name displayed
   - Submission date shown
   - Hardware mode indicated
   - Integrity hash verified

**Files Involved**:
- `packages/rb-apps/src/apps/SubmissionInspectorApp.tsx`
- `packages/rb-apps/src/utils/classroomDiagnosticsBundle.ts`

### Demo 3: Platform Stability
1. Open DevTools → Performance tab
2. Record a session:
   - Open Launcher
   - Open multiple apps (Home, Settings, Lab Workspace)
   - Click through tabs
   - Export a file
3. Verify:
   - No uncaught exceptions
   - No runaway listeners
   - Memory usage stable (not climbing)

**Performance Budget**:
- First interaction: < 500ms
- Launcher response: < 100ms
- App window open: < 1s

---

## Troubleshooting

### Port 4173 Already in Use
```bash
# Find and kill process on port 4173
lsof -i :4173
kill -9 <PID>
```

### `pnpm demo:ready` Fails
1. Check `pnpm rc:check` output directly
2. Look for:
   - Windows ENOTEMPTY errors → rebuild with `pnpm build --force`
   - Unit test failures → run `pnpm test`
   - E2E timeouts → ensure `pnpm preview` is not already running

### Console Errors in Browser
- Take screenshot with `F12 → Console`
- Check [AI_STATE.md](../AI_STATE.md) for known issues
- Verify git HEAD is on latest commit

### Submission Inspector Won't Open
- Ensure app is built with `pnpm build`
- Check that launcher includes it: Open DevTools → `localStorage.rb:mode:v1` should be `student` (or not present)
- For TA mode test: Add `?rb:mode=ta` to URL

---

## Post-Demo Checklist

- [ ] Close browser gracefully
- [ ] Stop `pnpm preview` (Ctrl+C)
- [ ] Document any issues to [AI_STATE.md](../AI_STATE.md)
- [ ] Commit any demo-related notes

---

**Last Updated**: 2026-02-15  
**Contact**: Connor Angiel  
**Release Branch**: `release/v1.0.0-next-lab-ready`
