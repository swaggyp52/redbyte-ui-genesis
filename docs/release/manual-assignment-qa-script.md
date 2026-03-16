# Manual Assignment QA Script (Build → Test → Export → Program)

This script verifies the full student journey end-to-end for RedByte IDE.
Use it before classroom release candidates and after major UX/workflow changes.

## Scope

- Student-facing usability and flow coherence (not just unit pass/fail).
- Deterministic handoff across IDE surfaces:
  - Build (Design)
  - Test (Verify)
  - Map (Hardware)
  - Export
  - Import (round-trip confidence)

## Preconditions

- RedByte IDE launches locally.
- Basys3 target is selected/available.
- A starter project can be created or loaded.

## Scenario under test

Use a simple two-input combinational circuit first (e.g., AND), then include one macro/composite block pass.

---

## Phase 1 — Project entry and workflow orientation

1. Open IDE and create/open a project.
2. Confirm the workflow is understandable at first glance:
   - Build → Test → Export → Program sequence is obvious.
   - Only one primary next action is emphasized.
3. Confirm developer-only metadata is not distracting in student path.

**Pass criteria**
- A first-time student can identify the next action in under 10 seconds.

---

## Phase 2 — Design surface usability

1. Place two inputs, one output, and one AND gate.
2. Connect wires; confirm snap/selection behavior is predictable.
3. Validate editing affordances:
   - duplicate
   - rotate (if supported)
   - alignment tools (if surfaced)
4. Open inspector and confirm labels/roles are clear.
5. Create or insert a reusable macro/composite block and confirm distinction from primitives is obvious.
6. Intentionally create a design issue (for example, output with no driver).

**Pass criteria**
- Real-time issue highlighting appears without running Verify.
- Student can resolve the issue from visible cues alone.

---

## Phase 3 — Verify surface (observation + comparison)

1. Open Verify and run simulation.
2. Confirm simulation status language is neutral and action-oriented.
3. Step simulation forward three ticks.
4. Confirm waveform cursor and tick indicator stay in lock-step (t3 after three steps).
5. Add at least one custom vector in vector editor (example: A=1, B=1, OUT=1).
6. Re-run Verify and confirm custom vector participates in evaluation.
7. If mismatch exists, confirm panel shows:
   - expected vs actual
   - failing signal name
   - failing tick
   - input snapshot at failure tick

**Pass criteria**
- Differences are explained in plain language with explicit next inspection target.
- Custom vectors are editable, removable, and reflected in mismatch evidence.

---

## Phase 4 — Hardware mapping (Basys3)

1. Open Hardware surface.
2. Enter mapping mode.
3. Select a signal in mapping list and click matching Basys3 pin on board view.
4. Repeat for at least one input and one output.
5. Confirm mapped/unmapped states are visually distinct.

**Pass criteria**
- Mapping table updates immediately after board interaction.
- Selected signal highlight and board highlight remain synchronized.

---

## Phase 5 — Export handoff quality

1. Export Vivado bundle.
2. Inspect artifact names for consistency across HDL/XDC/test assets.
3. Validate custom-labeled ports propagate into exported naming.

**Pass criteria**
- Export contains coherent naming and opens in Vivado without manual file edits.

---

## Phase 6 — Import round-trip confidence

1. Import the exported HDL/XDC back into RedByte.
2. Confirm user-facing fidelity label is clear:
   - Full restore / Reconstructed / Partial (as applicable).
3. If parser warnings occur, confirm messaging is friendly and actionable.

**Pass criteria**
- Student can decide whether to proceed based on plain-language fidelity guidance.

---

## Required acceptance checks (must all pass)

1. **Port naming**
   - Given custom input label `A`, exported HDL + XDC use `A`.
2. **Real-time highlighting**
   - Undriven lamp/output shows issue highlight before Verify run.
3. **Custom vectors**
   - Added vector is evaluated and appears in mismatch evidence when relevant.
4. **Board mapping**
   - Selecting SW0 and clicking SW0 maps immediately.
5. **Waveform lock-step**
   - Three step clicks => UI shows tick 3 and cursor at tick 3.

---

## QA report template

- Build: PASS/FAIL
- Verify: PASS/FAIL
- Hardware mapping: PASS/FAIL
- Export: PASS/FAIL
- Import: PASS/FAIL
- Notes:
  - UX friction observed:
  - Blocking defects:
  - Suggested follow-ups:

## Attribution

Connor Angiel
