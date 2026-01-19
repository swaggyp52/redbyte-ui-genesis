# Demo Steps — Quick Reference

**Purpose**: Professor demo off localhost showcasing Logic Playground + Lab Workbench workflow

---

## Pre-Demo Setup

1. **Start dev server**: `pnpm dev` in terminal (keep terminal visible but minimized)
2. **Open browser**: Navigate to `http://localhost:5173`
3. **Verify boot**: Desktop should appear within ~3 seconds
4. **Hardware status**: Hardware bridge will show "offline (expected in demo mode)" — this is correct
5. **Close welcome dialog** (if shown) by clicking "Skip" or X

---

## Demo Flow (5 minutes)

### Part 1: Logic Playground (Interactive Circuit Design) — 2 min

**Goal**: Show how students build and test digital circuits visually

1. **Open Logic Playground** (click icon from app grid/dock)
2. **Add components**:
   - Click "+" or drag from palette: `PowerSource` → `Switch` → `LED`
3. **Wire them together**:
   - Click output port of PowerSource → input of Switch
   - Click output of Switch → input of LED
4. **Toggle the switch** (click toggle pill above switch node)
   - **Expected**: LED lights up green instantly
   - **Say**: "Real-time simulation — students see cause and effect immediately"
5. **Show oscilloscope** (click "Signals" tab at bottom)
   - **Expected**: Waveform shows signal change
   - **Say**: "Students can inspect timing and signal flow like real hardware engineers"

**If something breaks**:
- Switch not toggling? Check if in wire-draw mode (hit `Escape` to cancel)
- Can't see toggle pill? Zoom in with mouse wheel
- Wire won't connect? Click the small port circle (not the node body)

---

### Part 2: Lab Workbench (Autograded Lab Assignments) — 2 min

**Goal**: Show automated testing/grading workflow

1. **Open Lab Workbench** (click icon from app grid/dock)
2. **Select a lab**: Click "Traffic Light Controller" (or "Half Adder")
3. **Show lab description**: Point out objective, expected behavior, tests
4. **Run self-check**:
   - Click "Run Self-Check" button
   - **Expected**: Progress bar fills, then shows "PASS" or "FAIL" with detailed test results
   - **Say**: "Students get instant feedback — no waiting for TA grading"
5. **Export submission**:
   - Click "Export Submission ZIP"
   - **Expected**: File downloads immediately
   - **Say**: "Students submit this ZIP file — we can auto-grade it server-side or manually inspect"

**If something breaks**:
- Lab won't load? Refresh the page and reopen Lab Workbench
- Self-check stuck? Timeout is 30s, then shows error
- Export button disabled? Self-check must complete first (even if FAIL)

---

### Part 3: Submission Inspector (Grading Tool) — 1 min

**Goal**: Show TA/professor grading workflow

1. **Open Submission Inspector** (click icon from app grid/dock)
2. **Drag and drop** the exported ZIP file into the drop zone
3. **Show tabs**:
   - **Summary**: Student name, lab, pass/fail, timestamp
   - **Test Vectors**: Detailed input/output table with mismatches highlighted
   - **Files**: Browse circuit files, metadata
   - **Receipt**: Human-readable report for student feedback
4. **Say**: "Grading is deterministic and auditable — no subjectivity, no grade disputes"

**If something breaks**:
- Drop zone not accepting file? Try clicking "Browse Files" button instead
- ZIP won't parse? Make sure it's from Lab Workbench (not a random ZIP)

---

## Recovery Commands (If Demo Breaks Mid-Flow)

- **White screen / app won't open**: Refresh page (`F5`), desktop should reload in ~3s
- **Stuck in weird state**: Press `Escape` key to cancel most operations
- **Can't find an app**: Click taskbar search (magnifying glass icon) and type app name
- **Hardware errors spamming console**: Ignore them — hardware bridge is offline by design in demo mode
- **Total meltdown**: Close browser tab, restart `pnpm dev`, reopen `localhost:5173`

---

## Talking Points While Clicking

- "This runs entirely in the browser — no servers, no cloud, students work offline if needed"
- "Everything auto-saves every 5 seconds — students never lose work"
- "The simulation is deterministic — same inputs always produce same outputs"
- "We can export proof capsules with timestamps and hashes for academic integrity"
- "When real FPGA hardware arrives, circuits can be flashed and tested on physical boards"

---

## Hardware Offline Disclaimer

**What to say if asked about "hardware bridge offline" messages**:

> "The desktop hardware bridge is optional — it connects to physical FPGA boards via serial/JTAG. In demo mode, we're using local simulation. The system is designed to work offline-first, which is critical for classroom settings where students may not have hardware access initially. The bridge follows the same protocol whether it's talking to a simulator or real hardware, so the learning experience is identical."

---

## Post-Demo: How to Stop

1. Return to terminal running `pnpm dev`
2. Press `Ctrl+C` to stop server
3. Close browser tabs

**Optional**: Show terminal output briefly to emphasize "this is just Vite dev server — no complex infrastructure"

---

## Backup Demos (If Primary Flow Fails)

1. **3D Circuit View**: In Logic Playground, click "3D View" tab → show ThreeJS rendering
2. **Chip Hierarchy**: Double-click a chip node in Playground → "drill down" into implementation
3. **Custom Chips**: Show "My Chips" panel → demonstrate building reusable components
4. **Dark/Light Mode**: Toggle theme in Settings to show polish
5. **Keyboard Shortcuts**: Press `Cmd/Ctrl+K` → show command palette

---

**Last Resort**: If absolutely everything breaks, pivot to static docs or pre-recorded video backup.
