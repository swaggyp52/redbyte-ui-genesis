# Student First Run UX Audit

**Goal:** A first-time student should understand *what to do next* within 15 seconds on any screen.

## 1. Boot -> Desktop

**Expected:** Clean desktop, clear "Start Here" indication.
**Observations:**

- [x] **Failure:** `Shell.tsx` auto-launches `welcome` app (a generic marketing splash) instead of `start-here`.
- [x] **Failure:** `WelcomeApp` only offers "Logic Playground" or "Studio" (Close). It does not mention "Lab Assignment" or "Virtual Lab".
- [ ] **Start Here App:** This app exists and has a good 3-card layout ("Logic Playground", "Virtual Lab", "Lab Assignment"). It is pinned to the dock but students might miss it if `WelcomeApp` distracts them.

**Recommendation:**

- Replace `welcome` with `start-here` as the auto-launch app in `Shell.tsx`.
- Deprecate `WelcomeApp`.

## 2. Open Lab Assignment

**Expected:** Obvious way to launch a specific lab (e.g., Lab 0).
**Observations:**

- [x] **Failure:** In `StartHereApp`, the "Lab Assignment" button calls `openApp('ece-lab', { initialTab: 'hardware', simGuide: true })` but **does not pass a `labId`**.
- [x] **Failure:** `ECELabApp` defaults to `sim-only` mode if `labId` is missing.
- [ ] **Result:** Student clicks "Lab Assignment" -> Lands in "Simulate" mode (Free Play) with no lab instructions.

**Recommendation:**

- Update `StartHereApp` to pass `labId: 'lab-1'` (or generic lab selector) when "Lab Assignment" is clicked.
- Or, update `ECELabApp` to show a "Lab Selector" when opened without a `labId`.

## 3. Connect (Sim or Hardware)

**Expected:** One-click connection or clear status.
**Observations:**

- [x] **Good:** The "Start Guide" overlay (1, 2, 3) appears when `labId` is missing.
- [ ] **Confusion:** The `executionSource` switcher (Sim vs Hardware) is subtle (top bar tabs).
- [ ] **Confusion:** "Vector Runner" is hidden in the "TEST" tab on the right panel.

## 4. Grading / Export

**Expected:** "how do i turn this in?"
**Observations:**

- [ ] In `guided-lab` mode, we need to verify if the "Submit" or "Export" button is prominent.
- [ ] Currently, `ECELabApp` has a `handleToggleRecording` which prompts to save a capsule. This is an "expert" flow.
- [ ] **Recommendation:** Add a dedicated "Export for Grade" button in `guided-lab` mode.

## 5. Summary of Fixes Required (Phase 5.1)

1. **Shell:** Change auto-open from `welcome` to `start-here`.
2. **StartHereApp:** Update "Lab Assignment" button to pass `labId: 'lab-1'` (assuming Lab 0/1 is the target).
3. **ECELabApp:** Ensure `labId` triggers `guided-lab` mode correctly and shows instructions.
