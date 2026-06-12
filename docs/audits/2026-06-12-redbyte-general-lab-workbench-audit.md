---
doc_status: current
last_validated: 2026-06-12
owner: Connor Angiel
used_by_claude: true
role: general lab workbench audit and gate-truth record for RedByte
---

# RedByte General Lab Workbench Audit - 2026-06-12

## Scope

This audit records Sprint 0 for RedByte Platform Generalization + Gate Truth. The work did not try to make RedByte a universal FPGA IDE. It checked whether the current Basys3 educational IDE can support general digital-logic lab workflows inside the existing v1 boundaries, and whether the local gates describe current product truth.

Structured hardening ticket translation before coding:

- Title: RedByte general lab workflow and gate truth repair.
- Surface: Project, Design, Verify, Map Pins / Hardware, Export, gate harnesses.
- Journey segment: from-scratch blank project through exported Basys3 package.
- Observed behavior: current gates still carried stale starter/blank assumptions, and the blank-project export path exposed aliasing defects after map changes.
- Expected behavior: a small non-starter circuit can be built, verified, mapped, reverified, and exported without hidden ECE141 starter lock-in or false gate failures.
- Severity: P1 for gate truth and core workflow trust; P2 for broader course/lab profile architecture.
- Minimum acceptance proof: focused tests plus a browser gate proving blank -> AND -> Verify -> Map Pins -> post-map Verify -> Export artifact availability, without Vivado or board claims.
- Attribution: Connor Angiel.

## Where RedByte Is Already General

- The core spine is workflow-based rather than course-page-based: Project -> Design -> Verify -> Map Pins / Hardware -> Export.
- Design supports blank projects and generic digital primitives, not only certified starters.
- Verify can consume authored vectors and active runtime scenarios instead of only canned starter vectors.
- Map Pins stores authoritative IO rows and can map live input/output boundaries to Basys3 resources.
- Export generates a Vivado-oriented package from the current project state, including VHDL, XDC, testbench, README, Tcl, and `.rbproj` project data.
- Draft versus trusted export is already modeled around current proof state rather than a specific starter ID.

## Where RedByte Is Still Starter-Specific

- Several browser gates and package scripts still use `ece141-*` names even when the behavior they prove is broader than ECE141.
- Project copy still gives certified starters a dominant first-run posture and can read as starter-first instead of lab-workbench-first.
- Curated starter data, starter IDs, and ECE141 lab definitions are still mixed into app source modules rather than clean course-pack data.
- Some tests and gate harnesses were written against older starter/blank UI states and no longer matched current runtime truth.
- The current proof vocabulary is strongest around known starters and less complete for instructor-authored labs.

## Where ECE141 Assumptions Leak Into Core Product

- `packages/rb-apps/src/apps/ide/labStarters.ts` holds ECE141 lab-specific starter definitions in app code.
- `packages/rb-apps/src/apps/ide/starterKits/labStarterKits.ts` maps lab definitions into starter kits, which keeps course data close to core product source.
- `packages/rb-apps/src/apps/ide/examplesCatalog.ts` mixes generic examples with course-specific starter/exemplar posture.
- Scripts and Playwright gates named `ece141-*` are sometimes product-general checks with course-specific names.
- Starter labels such as `signal-tour`, `logic-gates`, `half-adder`, `two-bit-counter`, and `23_lab8-fsm-lock-starter-basys3` are deeper in workflows than a future course-pack boundary should require.

## Where Starter IDs Are Too Deeply Baked Into Behavior

- Gate harness defaults still choose starter IDs as setup shortcuts, even when the gate is meant to verify a surface contract.
- Some workflow proofs start from exact examples rather than a neutral project or a lab profile.
- Starter IDs are still the easiest route to known IO mappings and vector contracts.
- Tests often prove "this starter still works" rather than "this class of supported lab is valid."

## Where Basys3-Specific Logic Is Correct V1 Scope

- Basys3 pin names, package pins, clock resource handling, board-resource semantics, XDC generation, and Vivado handoff are correct v1 core boundaries.
- `CLK100MHZ` / `W5` board-clock handling remains a real product constraint, not course leakage.
- E0/E1/E2/E3 proof-tier wording is correct product safety language and should stay central.
- Export package contents should stay Basys3/Vivado specific until a real second-board profile exists.
- Hardware proof cannot be generalized by documentation; it requires board-specific Vivado and physical observation evidence.

## What Professors Need To Define New Labs

- A lab profile with title, learning goals, allowed primitives, required IO boundaries, board resource requirements, verification scenario requirements, expected-output policy, export requirements, and proof-tier requirements.
- A no-solution starter scaffold when a scaffold is useful, separate from any solution or instructor key.
- Optional curated examples that teach concepts without being required for every student project.
- A documented unsupported-component boundary, especially for sequential logic and board-clock behavior.
- A way to package lab/course data without editing RedByte core product logic.

## What Students Need For From-Scratch Work

- A Project path that treats blank projects as first-class, not secondary to starters.
- Stable generated IO labels and IDs so `Input 1`, `Input 2`, and `Output 1` survive Verify, Map Pins, and Export.
- Clear Verify authoring and expected-output repair loops.
- Map Pins rows that follow live design boundaries rather than stale labels.
- Export feedback that distinguishes draft package generation from trusted, current proof.

## What Should Become Course Or Lab Profile Data Later

- Course names, lab numbers, lab titles, rubric text, starter ordering, starter copy, no-solution policy per assignment, and professor-specific verification expectations.
- Starter IDs and examples that are useful for one course but not product invariants.
- Required vector counts, checkpoint names, assignment-specific hints, and manual QA scripts.
- Which proof tier an assignment demands before submission.

## What Must Stay Core Product Logic

- Circuit editing, supported primitive registry, runtime simulation, deterministic Verify, scenario/vector state, IO row authority, Basys3 board resource model, pin mapping, export generation, artifact consistency checks, and proof-tier vocabulary.
- Draft/trusted export state derivation from current Verify, mapping, and export state.
- Safety boundaries for unsupported temporal logic, multi-clock designs, Vivado handoff, and no-hardware-claim posture.

## Gate Truth Matrix

| Gate or test | Previous status | Root cause | Action | Replacement / final status |
|---|---|---|---|---|
| `ide:gate:export-ready-contract` | Failed before Export. | Harness still expected an older Verify setup path with visible generate-basics or existing ready-vector state. | Reused the shared Verify-vector readiness helper and aligned setup with current Verify flow. | Repaired; rerun as part of closeout validation. |
| `ide:gate:verify-contract` | Failed waiting for older blank-Verify banner. | Gate targeted stale blank/banner UI instead of current starter-backed Verify contract. | Rewrote gate around current Project -> Logic Gates -> Verify -> Compare PASS evidence. | Repaired; rerun as part of closeout validation. |
| Focused Export workstation Vitest | Failed stale right-dock expectation. | Test expected mounted inspector content while current UI defaults to collapsed right dock. | Updated expectation to the current collapsed-dock contract. | Passed in focused regression batch. |
| Focused Verify workstation Vitest | Failed stale first-run helper expectation. | Test expected absent collapsed helper while current UI renders the sequential helper inside the first-run clock policy block. | Updated expectation to current source behavior. | Passed in focused regression batch. |
| `ide:gate:from-scratch-general-workflow` | New gate. | No product-general from-scratch gate existed for blank -> build -> verify -> map -> export. | Added a thin package script and Playwright gate path using blank-project AND circuit workflow. | Passed locally after the product fixes below. |
| Blank Map Pins selector | False-positive mapping count risk. | Gate selector counted child spans under map-row buttons. | Switched to actual `button[data-testid^="ide-hw-map-row-"]` buttons. | Gate maps exactly the three intended rows. |
| Blank generic IO labels | Real product bug. | Two generic inputs could share weak machine labels and create export/verify alias ambiguity. | Generated stable numbered labels and row IDs from blank IO creation. | Covered by runtime regression test. |
| Export required-port validation | Real product bug. | Mapping validation matched human labels but not IR boundary names for the same node. | Added IR boundary alias matching by node ID. | Covered by export regression and from-scratch gate. |
| Runtime-backed testbench scenario aliases | Real product bug. | Collapsed keys such as `input1` and `output1` did not map back to entity refs for labels like `Input 1`. | Added collapsed alphanumeric aliases in testbench label resolution. | Covered by export regression and from-scratch gate. |
| Sequential runtime fixture expectation | Stale test data. | Fixture expected manual-clock hold behavior while current contract samples every clocked-macro vector after a rising edge. | Updated expected `q` values to current post-rising-edge semantics. | Passed in focused regression batch. |

## Gate Truth After Sprint 0

The repaired from-scratch gate proves E0 browser/runtime behavior for the smallest useful blank workflow:

`blank project -> add two inputs -> add AND -> add output -> wire -> Verify Compare PASS -> Map Pins -> Verify Compare PASS after mapping -> Export artifacts and README preview`.

It does not prove:

- Vivado synthesis, implementation, bitstream generation, or programming.
- Physical Basys3 observation.
- Broad imported HDL fidelity.
- A complete instructor lab-profile/course-pack implementation.
- Intentional fail -> edit expected output -> repair -> PASS. That remains the next behavior slice.

## Hardcoded Assumption Inventory

High-signal hardcoding found during audit:

- `ece141-*` gate names: mostly naming debt when gates now prove broader product contracts.
- `examplesCatalog.ts`: starter/example IDs are useful but should become data-driven over time.
- `labStarters.ts` and `starterKits/labStarterKits.ts`: course/lab definitions should migrate toward lab profile or course-pack data.
- Project starter-first copy: should be softened later so blank/instructor-authored work feels first-class.
- Basys3 pin/resource logic: keep in core v1 product because the supported board is Basys3.

## Recommended Next Slices

1. Add the focused Verify fail-edit-repair-pass regression and fix.
2. Extract the first lab-profile/course-pack seam without moving Basys3 board logic out of core.
3. Rename or wrap product-general gates that still carry ECE141-only names.
4. Adjust Project copy and first-run hierarchy so blank and instructor-authored labs are first-class within supported boundaries.
5. Restore fresh Vivado/Basys3 proof only on a machine with Vivado 2024.2 and hardware access.
