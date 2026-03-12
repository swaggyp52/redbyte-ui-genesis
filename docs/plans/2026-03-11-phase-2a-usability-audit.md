# Phase 2A Usability Audit

## Step 1 - What students actually need from Verify + simulation

- Verify must tell the truth about pass/fail status.
- A failing tick must be actionable, not just selectable. Students need signal name, expected value, observed value, and input context at that tick.
- Design simulation must continue the failure narrative. Jumping from Verify into Design should restate the mismatch in cause -> effect terms.
- Waveforms must remain readable and dominant enough to support debugging, not hidden behind layout chrome.
- Naming must stay stable across Project, Verify, Design, and Hardware so students are not translating between raw ports and mapped labels.

## Step 2 - What is present but still insufficient

- Verify now exposes stable run controls, visible waveforms, mismatch selection, tick scrubber, and a failure explainer with context.
- Design now provides live simulation controls, a story strip, and verify-linked signal tracing.
- Student-loop gates confirm the flow is reachable from Design through Verify and Export.
- The handoff still leaves cognitive work on the student: Design can freeze at the right tick without fully restating why that tick failed.
- Student-facing naming still drifts in a few visible places where raw port names can outrank mapped labels.

## Step 3 - What still feels confusing, fake, cramped, or disconnected

- The weakest point remains Verify -> Design. Mechanics are present, but explanation can feel detached from the selected mismatch.
- The Design story strip explains runtime changes, but not always the specific verify failure that motivated the jump.
- Project mapping can still surface generic `in`/`out` style names where students expect canonical labels like `SW0` or `LD0`.
- Green gates prove navigability and visibility, but they do not fully prove comprehension.

## Step 4 - The single best next implementation batch to improve student understanding

- Carry a compact verify mismatch brief into Design debug mode.
- When Verify opens Design at a failing tick, Design should show: selected signal, expected vs observed, input snapshot at that tick, and the next inspection hint.
- In the same small slice, enforce label-first student naming for top-level mapping displays so students see one canonical signal name.

## Step 5 - Concrete acceptance criteria based on student use, not code presence

- In Design debug mode, students immediately see which signal failed, expected vs observed values, and the relevant input context.
- The Design story summary becomes mismatch-specific when opened from Verify debug.
- Project mapping displays student-facing labels instead of generic raw ports when both exist.
- Existing student-loop behavior gates stay green.
- Focused workstation tests cover both the Design mismatch brief and label-first mapping display behavior.
