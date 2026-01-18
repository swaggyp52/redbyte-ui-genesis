# End-to-End Demo Script for RedByte Lab System

**Goal**: Demonstrate complete student → professor workflow from lab attempt to submission inspection.

**Environment**: localhost:5173 (or deployed site)  
**Duration**: ~10 minutes  
**Labs Used**: Traffic Light (real), Half-Adder (real with PASS/FAIL presets)

---

## PART 1: Student Workflow (Traffic Light Lab)

### Step 1: Open Lab Workbench
1. Navigate to `http://localhost:5173` (or deployed URL)
2. You should see the RedByte desktop with icons in the top-left
3. Click on **"Lab Workbench"** (chip icon)
   - **Expected**: StudentLabApp opens with lab selection screen
   - **Check**: No JSON errors in console

### Step 2: Select Traffic Light Lab
1. In the lab list, click **"Traffic Light Controller"**
   - **Expected**: Spec loads, two presets appear in dropdown:
     - "Correct Implementation" (PASS)
     - "Missing Yellow State" (FAIL)
   - **Check**: No "Cannot GET" HTML errors; spec loaded successfully

### Step 3: Run Self-Check with PASS Preset
1. Keep preset selector on **"Correct Implementation"**
2. Click **"Run Self-Check"**
   - **Expected**: Results show all vectors PASS (green checkmarks)
   - **Expected**: Summary shows "4 / 4 PASS"
   - **Check**: No crashes; verdicts computed correctly

### Step 4: Export & Save Receipt
1. Click **"Export as .rb-lab.zip"**
   - **Expected**: ZIP downloads, receipt screen appears with:
     - Filename: `traffic-light-ATTEMPT_ID.rb-lab.zip`
     - SHA-256 hash (hex string, 64 chars)
     - Timestamp
     - Result: PASS (4/4)
     - Preset: Correct Implementation
   - **Check**: Download link works; hash displays

2. **Do NOT close** this tab yet; leave it open for reference

---

## PART 2: Student Workflow (Half-Adder Lab)

### Step 5: Select Half-Adder Lab
1. Click **"Start New Attempt"** or go back to lab selection
2. Select **"Half Adder"** from the list
   - **Expected**: Spec loads with 4 test vectors (A=0,B=0 through A=1,B=1)
   - **Expected**: Two presets available:
     - "Correct Implementation" (PASS)
     - "Carry Bug" (FAIL)
   - **Check**: Spec valid JSON

### Step 6: Run FAIL Preset
1. Select **"Carry Bug"** preset
2. Click **"Run Self-Check"**
   - **Expected**: Results show:
     - Vectors 1-3 PASS (green)
     - Vector 4 FAIL (red): "CARRY mismatch: expected 1, got 0"
   - **Expected**: Summary shows "3 / 4 PASS"
   - **Check**: Mismatch error displays correctly

### Step 7: Export FAIL Result
1. Click **"Export as .rb-lab.zip"**
   - **Expected**: Receipt shows:
     - Result: FAIL (3/4)
     - Preset: Carry Bug
     - SHA-256 hash (different from traffic-light export)

2. **Note the filename** (e.g., `half-adder-ABC123.rb-lab.zip`)

---

## PART 3: Professor Workflow (Submission Inspector)

### Step 8: Open Submission Inspector
1. Go to RedByte desktop (same page or new tab at `http://localhost:5173`)
2. Click on **"Submission Inspector"** (folder icon)
   - **Expected**: SubmissionInspectorApp opens with drag-drop zone
   - **Check**: No crashes; UI loads cleanly

### Step 9: Import Traffic Light ZIP
1. Drag the **traffic-light ZIP** into the drop zone
   - **Expected**: ZIP parses successfully
   - **Expected**: Summary tab shows:
     - Lab: "Traffic Light Controller"
     - Verdict: **PASS** (green)
     - Passed: 4, Failed: 0, Total: 4
     - Exit Code: 0
   - **Check**: No JSON parse errors ("Cannot read property..."); summary renders

### Step 10: Inspect Traffic Light Vectors
1. Click **"Vectors"** tab
   - **Expected**: All 4 vectors listed with green PASS badges
   - **Expected**: Each vector shows name (e.g., "Reset state")
   - **Check**: Vector list renders without errors

### Step 11: Inspect Traffic Light Events
1. Click **"Events"** tab
   - **Expected**: Timeline shows events from the export (if any), or "No events" message
   - **Check**: Tab doesn't crash if events.ndjson is missing

### Step 12: Check Traffic Light Hardware
1. Click **"Hardware"** tab
   - **Expected**: Either shows snapshots (if bridge was used) or "No hardware snapshots" message
   - **Check**: Tab doesn't crash even if hardware data missing

### Step 13: Review Traffic Light Files
1. Click **"Files"** tab
   - **Expected**: Lists files in ZIP:
     - capsule.json (proof-core result)
     - events.ndjson (if any)
     - metadata.json
     - hardware.json (if any)
   - **Check**: File list renders; can expand/view JSON previews

---

## PART 4: Test Half-Adder FAIL Case

### Step 14: Import Half-Adder ZIP
1. Click **"Import Another Submission"** or drag new ZIP into the zone
2. Drag the **half-adder ZIP** (the FAIL one) into the drop zone
   - **Expected**: ZIP parses
   - **Expected**: Summary shows:
     - Lab: "Half Adder"
     - Verdict: **FAIL** (red)
     - Passed: 3, Failed: 1, Total: 4
     - Exit Code: 1 (or non-zero)

### Step 15: Verify Half-Adder Vectors Show Failure
1. Click **"Vectors"** tab
   - **Expected**: Shows 4 vectors:
     - sv-1, sv-2, sv-3 with green PASS badges
     - sv-4 with red FAIL badge and error: "CARRY mismatch: expected 1, got 0"
   - **Check**: Failure details visible; no crashes

### Step 16: Run PASS Preset on Half-Adder (Bonus)
1. Go back to **Lab Workbench** tab/window
2. Select **Half Adder** again
3. Select **"Correct Implementation"** preset
4. Run self-check
   - **Expected**: All 4 vectors PASS
5. Export ZIP
6. Return to **Submission Inspector**
7. Import this new half-adder ZIP
   - **Expected**: Verdict is now **PASS** (4/4)

---

## ACCEPTANCE CRITERIA (All must pass)

- [ ] Lab Workbench icon visible and clickable from desktop
- [ ] Lab selection screen loads without JSON errors
- [ ] Traffic Light PASS preset: all vectors green, self-check succeeds
- [ ] Traffic Light FAIL preset: correct vector shows red, self-check shows failure count
- [ ] Half-Adder PASS preset: all 4 vectors pass
- [ ] Half-Adder FAIL preset: sv-4 shows CARRY error
- [ ] ZIP export produces valid file with SHA-256 receipt
- [ ] Submission Inspector icon visible and clickable
- [ ] Submission Inspector drag-drop accepts ZIP without crashing
- [ ] Submission Inspector Summary tab shows correct lab_id, verdict, pass/total
- [ ] Submission Inspector Vectors tab renders all vectors with correct pass/fail status
- [ ] Submission Inspector Events tab doesn't crash if events missing
- [ ] Submission Inspector Hardware tab doesn't crash if hardware missing
- [ ] Submission Inspector Files tab lists ZIP contents
- [ ] No console JSON parse errors ("Unexpected token '<'", "<!DOCTYPE", etc.)
- [ ] No TypeScript errors during build
- [ ] Build completes successfully (`pnpm -r build`)

---

## TROUBLESHOOTING

### Issue: "Unexpected token '<', '<!DOCTYPE'"
- **Cause**: Lab spec fetched from wrong path, server returned HTML 404
- **Fix**: Verify `/public/labs/{lab-id}.spec.json` files exist and are in root Vite publicDir

### Issue: ZIP doesn't import
- **Cause**: ZIP structure doesn't match STUDENT_EXPORT_SCHEMA.md
- **Fix**: Check capsule.json, events.ndjson, metadata.json present and valid JSON

### Issue: Self-check shows no results
- **Cause**: `runSelfCheckWithPreset()` not called or preset vectors missing `pass` boolean
- **Fix**: Verify presets.json has `"pass": true/false` on each vector

### Issue: Missing icons on desktop
- **Cause**: Icon IDs ('chip', 'folder') not registered in Icon registry
- **Fix**: Verify `ChipIcon` and `FolderIcon` exported from rb-icons and registered in Desktop.tsx

---

## NOTES FOR GRADERS

- **Traffic Light**: Real lab with multiple presets; tests state machine understanding
- **Half-Adder**: Real lab with PASS/FAIL presets; tests combinational logic
- **Presets Are Honest**: No fake PASS results; all PASS presets reflect correct logic
- **Hardware Optional**: Bridge not required for demo; inspector handles missing hardware gracefully
- **Proof-Core Integration**: Self-check uses real `summarizeCapsule()` and `computeVectorVerdicts()` functions

---

**End of Demo Script**
