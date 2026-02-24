# Lab-Day Smoke Checklist

Run this top-to-bottom before opening to students.
Each line is one discrete click/observation — if any item fails, **block the deploy**.

---

## 0 · Setup

- [ ] `pnpm dev` starts with no compile errors in the terminal
- [ ] Browser opens at `http://localhost:517x` — IDE root renders without a white screen
- [ ] No red crash banner on first load
- [ ] Browser console has **zero** uncaught errors on first load (ignore HMR noise)

---

## 1 · Project Page — First-time student

- [ ] **Project page is the landing screen** (`P` mode active in left rail)
- [ ] Left rail: mode letters (P D V H E I) are all visible; clicking each changes the surface
- [ ] Hero CTA button reads **"Load Example or Import HDL →"** (not "Design")
- [ ] Readiness checklist shows exactly 5 rows: Circuit loaded / Mapping complete / Verify passed / Export ready / Hardware bring-up
- [ ] "Circuit loaded" row shows **BLOCKED** (no circuit yet) with action "Import HDL"
- [ ] No blocker callout appears twice (only once, in hero section if applicable)
- [ ] Left dock panel scrolls — drag it short or zoom to 150 % and confirm session controls are reachable below the fold

---

## 2 · Import — Load structural example

- [ ] Navigate to **I (Import)** mode
- [ ] Samples section shows **exactly 2 cards** (AND Gate + Switches → LEDs) — behavioral ones are hidden
- [ ] "▼ Show unsupported examples (will be blocked)" toggle is visible below the 2 cards
- [ ] Clicking toggle reveals the 2 behavioral cards (dashed, dim)
- [ ] Click **"AND Gate"** sample card
  - [ ] HDL editor fills with VHDL immediately (no click on "Parse HDL" required)
  - [ ] Parse result appears — no "Nothing parsed yet" message
  - [ ] Callout says ports detected (not "HDL detected — not yet parsed")
- [ ] Click **"▼ Show unsupported examples"** → click **"Edge Detector"** behavioral sample
  - [ ] Behavioral warning banner appears immediately
  - [ ] "Replace Project" and "Apply Pins Only" buttons are **disabled** with "Behavioral HDL detected" reason
  - [ ] No crash

---

## 3 · Design — Empty canvas + palette

- [ ] Navigate to **D (Design)** mode with the AND Gate loaded
- [ ] Canvas is NOT empty — nodes from the imported circuit are visible
- [ ] Left dock: "Palette" section visible; search box works (type "and" → AND gate appears)
- [ ] Left dock scrolls if viewport is short
- [ ] Simulation controls in inspector (Run / Step / Reset) respond — clicking Run starts the counter
- [ ] Clicking Reset stops counter and resets to tick 0
- [ ] Zoom presets (50 % / 75 % / 100 % / 125 % / Fit) all work

---

## 4 · Verify — Vector authoring + run

- [ ] Navigate to **V (Verify)** mode
- [ ] If no run yet: waveform area shows **"Run verification to see waveforms"** (not any conflicting message)
- [ ] If no vectors: callout "No vectors yet" with "Generate Basics" primary CTA
- [ ] Click **Generate Basics** → vectors appear in the inspector
- [ ] Click **Run verification** → status changes to PASS or FAIL (not stuck on "running")
- [ ] After run with waveform data: oscilloscope shows signal rows — no ✗ "Run verification" overlay
- [ ] After run with NO waveform (empty circuit edge case): oscilloscope shows **"No waveform data in this run — check I/O mapping in Design"** (not the old "Run verification" message)
- [ ] Pass hero shows only when `runRows.length > 0` — no "Verification Passed" with empty oscilloscope
- [ ] Failing rows appear in left dock under "Failures" — clicking one scrolls/selects the tick

---

## 5 · Export — Evidence Capsule (stop-ship check)

- [ ] Navigate to **E (Export)** mode
- [ ] Surface renders without a **white screen crash** ("ReferenceError: handleBuildEvidenceCapsule")
- [ ] Gate checklist visible — each gate shows PASS/WARN/ERROR badge
- [ ] If verify has passed: "Build Evidence Capsule" button is **primary** (not disabled)
- [ ] Click **"Build Evidence Capsule"** 5 times (rapid-click or sequential):
  - [ ] No "ReferenceError: Cannot access 'handleBuildEvidenceCapsule' before initialization"
  - [ ] Build runs and produces a ZIP download every time
  - [ ] Manifest section shows SHA-256 hash after build
- [ ] "Rebuild Export" button works (no crash, produces artifacts)
- [ ] Left dock / right inspector both scroll at 1080p if content is tall

---

## 6 · Hardware — Bring-up panel

- [ ] Navigate to **H (Hardware)** mode
- [ ] Board 2D renders (Basys3 graphic with switch + LED rows)
- [ ] Mode toggle: Live Monitor / Bring-Up / Proof all switch without crash
- [ ] Left dock **scrolls** (Live Monitor metadata + buttons should be reachable)
- [ ] If no export done: console shows "Bring-up blocked" with clear message

---

## 7 · Viewport / Responsive

- [ ] At **1920 × 1080**: left dock not clipped, all surfaces usable
- [ ] At **1366 × 768** (student laptop): scroll dock to reach session controls (Save / Restore / Reset)
- [ ] Left rail mode buttons all visible at both sizes
- [ ] No horizontal scrollbar on any surface main panel

---

## 8 · Navigation round-trip

- [ ] P → I → D → V → E → H → P: no surface throws an error
- [ ] Navigating away and back to Verify preserves last run state (waveform still visible)
- [ ] Navigating away and back to Export does NOT crash

---

## 9 · Session controls (left dock, Project page)

- [ ] **Save now** button persists the project (reload page → circuit still there)
- [ ] **Restore last save** reverts to the saved state
- [ ] **Reset project** shows the red danger button; clicking it clears the circuit

---

## Sign-off

| Run by | Date/Time | Result |
|--------|-----------|--------|
|        |           | PASS / BLOCK |

**If any item is BLOCK: do not distribute the URL to students.**
