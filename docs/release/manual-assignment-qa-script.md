# Manual Assignment QA Script (Project → Design → Verify → Map Pins → Export)

This script verifies the full student journey end-to-end for RedByte IDE.
Use it before classroom release candidates and after major UX/workflow changes.

## Scope

- Student-facing usability and flow coherence (not just unit pass/fail).
- Deterministic handoff across IDE surfaces:
  - Project entry / continue
  - Build (Design)
  - Test (Verify)
  - Map Pins
  - Export
  - Import / Recover utility (round-trip confidence; not a numbered stage)

## Product authority boundary

- The numbered RedByte-owned workflow is exactly `Project -> Design -> Verify -> Map Pins -> Export`.
- Import / Recover is a utility and must not appear as a sixth progress stage.
- The persistent shell is the compact top bar, five-stage rail, and active workbench. A proof ribbon, bottom status footer, or injected per-page product-spine header is a regression.
- Browser checks prove E0 product behavior only. Opening/building in Vivado, programming a board, and observing physical behavior require separate E1/E2/E3 evidence.

## Preconditions

- RedByte IDE launches locally.
- Basys3 target is selected/available.
- A starter project can be created or loaded.

## Scenario under test

Use a simple two-input combinational circuit first (e.g., AND), then include one macro/composite block pass.

---

## Phase 1 — Project entry and workflow orientation

1. Open IDE and create/open a project.
2. Load one starter from Project (Lab 8 preferred for a high-signal pass) and confirm Design opens with:
   - the active starter name
   - a visible starter-loaded handoff
   - a visibly changed schematic/canvas
3. Confirm the workflow is understandable at first glance:
   - Project -> Design -> Verify -> Map Pins -> Export is obvious in one five-stage rail.
   - Import / Recover is separate from stage progress.
   - Only one primary next action is emphasized.
4. Confirm developer-only metadata is not distracting in student path.

**Pass criteria**
- A first-time student can identify the next action in under 10 seconds.
- Loading a starter visibly updates the active design state without extra clicks or inference.

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

1. Open Verify, select Observe only, and use the single Run control.
2. Confirm simulation status language is neutral and action-oriented.
3. Step simulation forward three ticks.
4. Confirm waveform cursor and tick indicator stay in lock-step (t3 after three steps).
5. Add at least one custom vector in vector editor (example: A=1, B=1, OUT=1).
6. Select Compare checks, use the same Run control, and confirm the custom vector participates in evaluation. Confirm Compare stays selected after the preceding Observe run.
7. If mismatch exists, confirm panel shows:
   - expected vs actual
   - failing signal name
   - failing tick
   - input snapshot at failure tick

**Pass criteria**
- Differences are explained in plain language with explicit next inspection target.
- Custom vectors are editable, removable, and reflected in mismatch evidence.

---

## Phase 4 — Map Pins (Basys3)

1. Open Map Pins.
2. Confirm the mapping table is the first loaded work object and after-mapping tools are secondary.
3. Select a signal in the mapping table and click the matching Basys3 resource on the board reference.
4. Repeat for at least one input and one output.
5. Confirm mapped/unmapped states are visually distinct.
6. Rename one top-level input or output in Design, return to Project or Hardware, and confirm the renamed port still accepts a new pin assignment that persists into Export without creating a duplicate ghost port row.

**Pass criteria**
- Mapping table updates immediately after board interaction.
- Selected signal highlight and board highlight remain synchronized.
- Renamed top-level ports keep one shared mapping truth across Project, Hardware, and Export.

---

## Phase 5 — Export handoff quality

1. Export Vivado bundle.
2. Inspect artifact names for consistency across HDL/XDC/test assets.
3. Validate custom-labeled ports propagate into exported naming.

**Pass criteria**
- At browser E0, readiness state, generated artifact names, previews, and downloaded ZIP contents agree and use coherent naming.
- Any claim that the package opens/builds in Vivado is recorded separately as E1 evidence; this manual browser pass alone does not prove it.

---

## Phase 6 — Import / Recover utility round-trip confidence

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

## Failure handling

If any phase or acceptance check fails:

1. Open `docs/release/product-hardening-ticket-template.md` or `.github/ISSUE_TEMPLATE/product-hardening.yml`.
2. Record the journey segment, surface, observed behavior, expected behavior, exact repro steps, evidence, violated contract / QA clause, and minimum acceptance proof.
3. Review the relevant current-truth and target-truth docs before coding:
   - `docs/contracts/RedByte_Product_Contract.md`
   - `docs/manuals/RedByte_Product_Manual.md`
   - `docs/roadmap/RedByte_Gap_Audit.md`
   - `docs/IDE_SYSTEM_MAP.md`
   - `docs/ide/SURFACE_CONFORMANCE.md`
4. Do not close the work until the fix, proof, and impacted docs all agree.

---

## QA report template

- Project entry: PASS/FAIL
- Design: PASS/FAIL
- Verify: PASS/FAIL
- Map Pins: PASS/FAIL
- Export: PASS/FAIL
- Import utility: PASS/FAIL
- Notes:
  - UX friction observed:
  - Blocking defects:
  - Suggested follow-ups:

## Attribution

Connor Angiel
