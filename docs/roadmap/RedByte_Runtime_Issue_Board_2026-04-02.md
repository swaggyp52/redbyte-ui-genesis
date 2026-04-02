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
| RIB-005 | LOW | Export | **FIXED** (via RIB-002) |
| RIB-006 | LOW | Hardware | Known / Acceptable |

Four issues fixed across the current runtime board session set. Remaining low-priority note: RIB-006 (known/acceptable).
