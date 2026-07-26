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
- The persistent shell is the compact top bar, horizontal five-stage navigator, and active workbench. A proof ribbon, bottom status footer, or injected per-page product-spine header is a regression.
- Browser checks prove E0 product behavior only. Opening/building in Vivado, programming a board, and observing physical behavior require separate E1/E2/E3 evidence.

## Preconditions

- RedByte IDE launches locally.
- Basys3 target is selected/available.
- A starter project can be created or loaded.

## Scenario under test

Use a simple two-input combinational circuit first (e.g., AND), then include one sequential document-policy pass. Guided 4-bit and Mapping Assistant v2 are not part of this candidate.

---

## Phase 1 — Project entry and workflow orientation

1. Open IDE and create/open a project.
2. Load one starter from Project (Lab 8 preferred for a high-signal pass) and confirm Design opens with:
   - the active starter name
   - a visible starter-loaded handoff
   - a visibly changed schematic/canvas
3. Confirm the workflow is understandable at first glance:
   - Project -> Design -> Verify -> Map Pins -> Export is obvious in one horizontal five-stage navigator.
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
8. Create or select a named Verify document for a sequential circuit and configure its document-owned policy:
   - choose execution mode
   - set run-cycle count
   - confirm the detected active edge and source/execution type
   - confirm reset behavior, when applicable
9. Save, reload, duplicate, and rename the document. Confirm its cases, checks, and sequential policy stay attached to that document.
10. In the manual/custom timeline, use the dedicated **Rows**, **Alternating**, **Rising edge**, **Falling edge**, **Hold high**, and **Hold low** commands and confirm their authored values remain distinct.
11. Run a flat-low clock lane and confirm rising-edge state does not advance. Then author low-to-high, repeated high, high-to-low, and repeated low steps. Confirm only the low-to-high transition advances rising-edge state; the falling transition is supported stimulus but does not capture state.
12. Keep reset deasserted in authored manual/custom rows and confirm no hidden reset sequence is injected.
13. In Auto mode, set `runCycles` beyond the authored-row count. Confirm the materialized sequence starts at cycle 0 and contains the selected number of cycles. When automatic reset applies, confirm reset is asserted in materialized cycle 0 and deasserted later; reject any extra hidden runtime reset-prelude row.
14. Confirm every Auto runtime/report row is sampled post-rising-edge and the corresponding generated VHDL assertion waits for that same rising edge, including cycle 0.
15. Confirm runtime summary, waveform, expected-check sampling, bring-up expectations, PASS/FAIL classification, and generated-testbench rows all describe the same materialized execution-vector sequence.

**Pass criteria**
- Differences are explained in plain language with explicit next inspection target.
- Custom vectors are editable, removable, and reflected in mismatch evidence.
- Waveform lanes use at least a 36px interaction target and readable 13px labels at the supported laptop viewports.
- A compatible Design edit preserves authored document intent but revokes stale run authority; a fresh Compare is required.
- `current`, `missing`, `stale`, and `failed` Verify evidence currentness remain distinct. Observe-only, stale, or failed evidence cannot support Export `verificationTrust: trusted`; a correctly evaluated flat-clock hold may still be part of a current Compare.

---

## Phase 4 — Map Pins (Basys3)

1. Open Map Pins.
2. Confirm the mapping table is the first loaded work object and after-mapping tools are secondary.
3. Select a signal in the mapping table, choose the matching Basys3 resource in the stable selected-signal editor, and use **Save assignment**.
4. Repeat for at least one input and one output. Treat the board graphic as a reference, not the assignment control.
5. Confirm mapped/unmapped states are visually distinct.
6. Rename one top-level input or output in Design, return to Project or Hardware, and confirm the renamed port still accepts a new pin assignment that persists into Export without creating a duplicate ghost port row.
7. Inspect the semantic mapping preview and confirm each assigned row agrees on logical signal identity, direction, artifact port name, board resource, package pin, I/O standard, and exact generated XDC line.
8. Create a conflict and confirm the row names the conflict and blocks trusted handoff without presenting the whole page as a generic error.

**Pass criteria**
- Mapping table updates immediately after **Save assignment**.
- Selected signal, editor choice, semantic preview, and board reference remain synchronized.
- Renamed top-level ports keep one shared mapping truth across Project, Hardware, and Export.

---

## Phase 5 — Export handoff quality

1. Confirm the first viewport answers **What should I submit?** and distinguishes a trusted current package from a structurally buildable draft.
2. Inspect the exact axes: structural `blocked` / `downloadable`, `verificationTrust` `unverified` / `draft` / `trusted`, and action `not-downloaded` / `downloaded`. Confirm Verify evidence currentness is displayed/routed separately rather than substituted into those enums.
3. Download the available package type. Inspect the host-level ZIP bytes directly outside the in-app browser transport, then compare its entry names and contents with the visible previews.
4. Validate custom-labeled ports propagate into exported naming.
5. Confirm the current receipt records package source fingerprint, project and Verify hashes, mapping currentness, download kind, trust state, and SHA-256.
6. Confirm the embedded manifest contains the exact generated `top.vhd` and `top.xdc` projections used by the package.
7. For Auto board-clock mode, confirm `testbench.vhd` contains the free-running clock generator and half-period constant, then waits for a rising edge before every materialized row assertion. Change `runCycles` beyond the authored-row count; when an automatic reset signal applies, change reset behavior separately. Confirm each applicable change alters the materialized sequence and generated bytes, cycle 0 remains explicit, Export becomes stale, and the previous receipt no longer describes the package.
8. For manual/custom mode, confirm `testbench.vhd` omits that free-running/rising-wait scaffold, assigns the resolved clock from each materialized authored vector, and uses the deterministic settle interval. Change authored stimulus or resolved clock data and confirm runtime, bring-up expectations, and generated testbench stay on the same materialized vector sequence and Export freshness updates.

**Pass criteria**
- At browser E0, readiness state, generated artifact names, previews, and downloaded ZIP contents agree and use coherent naming.
- Mapping preview, generated XDC, embedded manifest, and downloaded package must agree exactly for the current project.
- The exported testbench must agree with the shared materialized execution vectors and resolved clock/schedule projection used by runtime and bring-up expectations; browser-local storage must not be mistaken for package neutrality.
- A stale Verify result or stale mapping may allow a clearly labeled draft only; it must never produce a trusted-current receipt.
- Any claim that the package opens/builds in Vivado is recorded separately as E1 evidence; this manual browser pass alone does not prove it.

---

## Phase 6 — Import / Recover utility round-trip confidence

1. Import the exported RedByte ZIP back into RedByte.
2. Confirm user-facing fidelity label is clear:
   - Full restore / Reconstructed / Partial (as applicable).
3. Confirm the embedded manifest is authoritative and loose sibling HDL/XDC cannot override it.
4. Include scalar and vector-bit ports such as `SW[1]` and `LED[1]`; confirm exact logical identities survive Review, Apply, Map Pins, and re-export.
5. Separately import supported RedByte-generated concurrent-assignment VHDL without its manifest and confirm the supported graph reconstructs, while RedByte-only metadata is honestly reported as absent.
6. Try arbitrary behavioral/process HDL and confirm it remains partial or blocked rather than appearing as a lossless schematic.
7. If parser warnings occur, confirm messaging is friendly and actionable.

**Pass criteria**
- Student can decide whether to proceed based on plain-language fidelity guidance.
- Cancel and every failed parse/archive path leave the active project unchanged.

---

## Required acceptance checks (must all pass)

1. **Port naming**
   - Given custom input label `A`, exported HDL + XDC use `A`.
2. **Real-time highlighting**
   - Undriven lamp/output shows issue highlight before Verify run.
3. **Custom vectors**
   - Added vector is evaluated and appears in mismatch evidence when relevant.
4. **Board mapping**
   - Selecting the logical input, choosing SW0, and saving creates one coherent mapping projection and exact XDC line.
5. **Waveform lock-step**
   - Three step clicks => UI shows tick 3 and cursor at tick 3.
6. **Sequential document policy**
   - Save/reload/duplicate/rename preserve the active document's policy and authored rows without adding a portable `RBProject` field. Confirm the saved inputs rematerialize the same runtime/bring-up/testbench vectors; do not claim that the raw policy object itself is serialized into the package or that every policy field independently changes VHDL bytes.
7. **Package receipt authority**
   - Download kind, trust state, project/Verify hashes, mapping currentness, source fingerprint, and SHA-256 describe the exact downloaded package.
8. **Manifest-first vector recovery**
   - `SW[1]` and `LED[1]` remain the same logical ports through restore and re-export, and loose siblings cannot override the embedded manifest.

## Required standalone RC authority gates

Run these as separate commands on the same candidate under review:

```powershell
corepack pnpm -s ide:gate:sequential-testbench-authority
corepack pnpm -s ide:gate:mapping-preview-package-agreement
```

Both standalone invocations are required in addition to the uninterrupted 72-step `classroom:gate`. The aggregate does not substitute for either gate.

## Candidate evidence and release disposition

- Run this script against the reconstructed final candidate SHA, not only an earlier source-slice SHA.
- Record viewport, browser, operating system, branch, exact commit, Node/pnpm versions, and every phase verdict.
- Historical pre-sequential source `f4f7ca8f35f79258fe8f2ff6ecbc68600784efb7` passed the earlier 36-file/477-test matrix. Current integrated pre-doc source `0788044cbdf2699520d90a3428f2e5034dc73cab` passes the touched 20-file/258-test matrix and focused release gates. Neither checkpoint replaces this source-blind human assignment trial or the final exact-SHA automated run.
- Do not promote this script to Vivado, bitstream, programming, or board-behavior proof. Those claims require separate E1/E2/E3 evidence.

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
