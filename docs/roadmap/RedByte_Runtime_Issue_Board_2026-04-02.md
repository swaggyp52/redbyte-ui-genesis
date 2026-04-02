# RedByte Runtime Issue Board — 2026-04-02

Live browser inspection of the full student workflow using the "Signal Tour: Switches → LEDs" starter project.
All six surfaces inspected. Issues are ranked by student impact.

---

## CRITICAL

### RIB-001 · IDE Verify Workbench Contract gate fails after a PASS run
**Surface:** Verify  
**File:** `scripts/gates/ide-verify-workbench-contract.mjs`  
**Impact:** Classroom signoff returns `NOT_READY`. Single blocker for `node ./scripts/classroom-signoff.mjs`.  
**Root cause:** After a PASS verify run, `verifyLayoutPolicy` sets `leftDockMode: 'collapsed'`.  
The dock content (signal buttons, `ide-verify-signal-*`) is removed from the DOM.  
The gate called `waitForFunction` querying for those elements _before_ opening the dock → 10 s timeout → failure.  
The correct dock-expansion code existed directly below but was unreachable.  
**Fix applied:** Deleted the premature `waitForFunction`. Moved dock-expansion logic immediately after  
`waitForSelector('ide-verify-workspace-waveform')` so the dock is opened _before_ signal buttons are queried.  
**Status:** FIXED in this session.

---

## HIGH

### RIB-002 · Map Pins pipeline progress perpetually shows "pending" despite complete mapping
**Surface:** Export and Import pipeline progress bar  
**File:** `packages/rb-apps/src/apps/ide/components/PipelineStrip.tsx`  
**Impact:** Student sees "M" (pending) for Map Pins in every post-hardware surface, even after all required  
pins are mapped. The left-rail nav correctly shows ✓ (using `hasIoMapping` from `IdeApp`).  
The inconsistency erodes confidence and makes the workflow look broken.  
**Root cause:** `deriveStageStatus` case `'hardware'` unconditionally returned `'pending'`  
(comment: "has no strong pass signal in the health model yet").  
`hasIoMapping` is not threaded into `ProjectHealth`, but `blockingIssues` contains `RBP1001`  
exactly when `!hasIoMapping` — the signal was already present.  
**Fix applied:** Changed `case 'hardware'` to return `'pass'` when `!codes.has('RBP1001')`,  
matching the left-rail ✓ condition exactly.  
**Status:** FIXED in this session.

### RIB-003 · Waveform PASS view shows only output signals; inputs invisible without dock interaction
**Surface:** Verify — waveform SVG after a PASS run  
**Observed:** After 32/32 ASSERTIONS MATCH, the waveform SVG renders only the 4 output signals (ld0–ld3).  
The 4 input signals (sw0–sw3) are absent from the canvas. Students cannot see the stimulus that drove  
the passing outputs without manually opening the collapsed signal dock and adding input signals.  
**Root cause (design decision vs. bug TBD):** `relevantSignalTimeline` filters to mapped + failing signals  
on a PASS run. On pass, there are no failing signals and the "relevant" set collapses to outputs only.  
**User impact:** Instructionally confusing — students cannot read off what input produced which output  
without extra interaction.  
**Suggested fix:** On a PASS run, include all mapped input signals in the waveform (not just failing).  
The oscilloscope is most useful for confirming cause-and-effect on success.  
**Fix applied:** PASS runs now force mapped input lanes visible in the waveform viewport by default when no mismatches exist, so students can see stimulus-to-output causality without opening signal groups.  
**Proof:** `verifySurface.waveform-priority.test.tsx` now includes `shows mapped input stimulus lanes by default on PASS runs`.  
**Status:** FIXED in this session.

---

## MEDIUM

### RIB-004 · Import surface: orphaned native file input rendered outside main content
**Surface:** Import  
**Observed:** A browser-native "Choose File" button appears at the very bottom of the page,  
outside the main card/modal structure. This is likely the DOM-rendered `<input type="file">` element  
for the ZIP uploader that is not properly hidden/positioned via CSS.  
**Impact:** Visual clutter; could confuse students who see two "Choose File" affordances.  
**Root cause:** ZIP picker visibility depended on CSS class hiding (`ide-hidden-file-input`) only. If stylesheet application/order fails, the native control can render in normal flow and appear as an orphaned chooser at page bottom.  
**Fix applied:** Import ZIP picker is now intrinsically hidden in markup (`hidden` attribute) in `ImportSurface.tsx`, removing runtime dependence on CSS-only hiding for this control.  
**Proof:** `importSurface.submission.test.tsx` now includes `keeps the ZIP input intrinsically hidden from layout` and passes.  
**Status:** FIXED in this session.

### RIB-007 · First-look import flow hid sample honesty demos behind secondary navigation
**Surface:** Import first-look onboarding
**File:** `packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx`
**Impact:** New students landed on the first-look shell but could not immediately run structural vs blocked-behavioral sample demos without switching into the workbench path first. This made the import honesty story harder to discover during first contact.
**Root cause:** Sample controls (`ide-import-load-sample-*`, behavioral toggle) only rendered in non-first-look workbench sections.
**Fix applied:** First-look guidance now includes direct quick-demo actions for:
- structural sample (`ide-import-load-sample-and-gate`)
- unsupported-example toggle (`ide-import-toggle-behavioral-samples`)
- blocked behavioral sample (`ide-import-load-sample-edge-detect`)

All sample loading now goes through one helper path (`loadImportSample`) to keep first-look and workbench behavior consistent.
**Proof:** import suites pass with first-look + honesty expectations:
- `importSurface.first-look.test.tsx`
- `importSurface.honesty.test.tsx`
- `importSurface.workstation.test.tsx`
- `importSurface.verify-reset.test.tsx`
- `importSurface.submission.test.tsx`
**Status:** FIXED in this session.

### RIB-008 · First-look manual-path guidance contradicted visible quick-demo affordances
**Surface:** Import first-look onboarding copy
**File:** `packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx`
**Impact:** The guidance card still told students to use “Other ways to start only…” for manual path even after quick-demo buttons were promoted into first-look. That copy understated available onboarding actions and created a trust/legibility mismatch.
**Root cause:** Guidance copy predated RIB-007 quick-demo controls and was not updated when those controls moved into first-look.
**Fix applied:** Updated first-look manual-path guidance to explicitly mention both routes:
- manual HDL paste via “Other ways to start”
- quick demos for supported structural vs blocked behavioral examples
**Proof:** `importSurface.first-look.test.tsx` now asserts the first-look guidance includes “quick demos”, and focused import suites remain green.
**Status:** FIXED in this session.

### RIB-009 · Behavioral import blocker CTA promised Design but routed to Project
**Surface:** Import blocker recovery path
**Files:**
- `packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx`
- `packages/rb-apps/src/apps/IdeApp.tsx`
**Impact:** The blocker callout button label said `Start fresh in Design →`, but the handler used the Project navigation callback. That contradiction breaks recovery trust at exactly the moment students need clear next-step guidance.
**Root cause:** The blocker CTA was wired to `onGoToProject` while copy and intent were design-surface recovery.
**Fix applied:** Added explicit `onGoToDesign` support to ImportSurface and rewired blocker CTA handlers to use it. IdeApp now passes `onGoToDesign={() => setCurrentMode('design')}` to ImportSurface.
**Proof:** `importSurface.honesty.test.tsx` now includes `routes the blocker recovery CTA to Design instead of Project` and focused import suites pass (`17 passed`).
**Status:** FIXED in this session.

---

## LOW / INFORMATIONAL

### RIB-005 · Export pipeline progress: "Map Pins — pending" (same as RIB-002, now fixed)
Export surface snapshot confirmed the same pipeline progress inconsistency as Import.  
Resolved by the RIB-002 fix.

### RIB-006 · Hardware bring-up steps not enumerated in pipeline pass criteria
**Observed:** Hardware surface shows "Step 1 of 8" for "Prepare Board" even with all pins matched  
(MATCH status). The pipeline strip (after RIB-002 fix) marks Map Pins as pass when `hasIoMapping`  
matches the left-rail criterion. However, the 8 bring-up steps (connect USB, power on, etc.)  
are pre-hardware steps requiring physical hardware — they cannot be auto-checked.  
**Assessment:** Known and acceptable for software-only mode. Not a bug.

---

## Session Summary

| ID | Severity | Surface | Status |
|----|----------|---------|--------|
| RIB-001 | CRITICAL | Verify / Gate | **FIXED** |
| RIB-002 | HIGH | Export, Import, Pipeline | **FIXED** |
| RIB-003 | HIGH | Verify waveform | **FIXED** |
| RIB-004 | MEDIUM | Import | **FIXED** |
| RIB-007 | MEDIUM | Import first-look | **FIXED** |
| RIB-008 | LOW | Import first-look copy truth | **FIXED** |
| RIB-009 | MEDIUM | Import blocker recovery CTA | **FIXED** |
| RIB-005 | LOW | Export | **FIXED** (via RIB-002) |
| RIB-006 | LOW | Hardware | Known / Acceptable |

Seven issues fixed across the current runtime board session set. Remaining low-priority note: RIB-006 (known/acceptable).

---

## Session 3 — Student-Facing Language Legitimacy Audit

Product-wide audit found systematic use of internal developer jargon in student-facing text. Nine issues fixed:

### RIB-013 · Verify sends students to "Design" instead of "Map Pins"
**Severity:** CRITICAL · **Files:** `VerifySurface.tsx` · **Status:** FIXED
Two error messages said "check I/O mapping in Design" — mapping is on Map Pins. Fixed both.

### RIB-014 · StimulusCanvas empty state says "Hardware surface" (no CTA)
**Severity:** HIGH · **Files:** `StimulusCanvas.tsx` · **Status:** FIXED
Changed to "Map Pins", added clickable navigation button.

### RIB-015 · Shell fallback shows internal mode names ("Loading hardware workspace...")
**Severity:** HIGH · **Files:** `IdeApp.tsx` · **Status:** FIXED
Now uses `getIdeModeLabel()` → "Loading Map Pins workspace..."

### RIB-016 · ErrorBoundary titles use "crashed" / wrong surface names
**Severity:** HIGH · **Files:** `IdeApp.tsx` · **Status:** FIXED
All six titles now use student-facing labels and "encountered an error" instead of "crashed".

### RIB-017 · Verify shows "BLOCKED" when student hasn't started adding vectors
**Severity:** HIGH · **Files:** `VerifySurface.tsx` · **Status:** FIXED
Changed to "NOT STARTED" — nothing is blocked, the student just hasn't begun.

### RIB-018 · "Reference mode:" jargon in vector source labels
**Severity:** HIGH · **Files:** `VerifySurface.tsx` · **Status:** FIXED
All 7 branches rewritten. "Reference mode" → direct language about test vectors and expected outputs.

### RIB-019 · "deterministic rows" / "expectations" jargon in empty-reason messages
**Severity:** MEDIUM · **Files:** `VerifySurface.tsx` · **Status:** FIXED

### RIB-020 · Stale reference panel: jargon title, no recommendation
**Severity:** MEDIUM · **Files:** `VerifySurface.tsx` · **Status:** FIXED
Title: "Stale authored reference" → "Test vectors need updating". Added recommended action. Button labels simplified.

### RIB-021 · PipelineStrip "All stages current" → "All stages complete"
**Severity:** LOW · **Files:** `PipelineStrip.tsx` · **Status:** FIXED

### Session 3 Summary

| ID | Severity | Surface | Status |
|----|----------|---------|--------|
| RIB-013 | CRITICAL | Verify | **FIXED** |
| RIB-014 | HIGH | Verify / StimulusCanvas | **FIXED** |
| RIB-015 | HIGH | Shell | **FIXED** |
| RIB-016 | HIGH | Shell | **FIXED** |
| RIB-017 | HIGH | Verify | **FIXED** |
| RIB-018 | HIGH | Verify | **FIXED** |
| RIB-019 | MEDIUM | Verify | **FIXED** |
| RIB-020 | MEDIUM | Verify | **FIXED** |
| RIB-021 | LOW | PipelineStrip | **FIXED** |

Nine issues fixed. The systematic problem: RedByte used internal jargon where students see it. All affected strings now use the student-facing vocabulary from `workflowStages.ts`.
