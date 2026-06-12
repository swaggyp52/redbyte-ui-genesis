---
doc_status: current
last_validated: 2026-06-12
owner: Connor Angiel
used_by_claude: true
role: product hardening roadmap derived from whole-app immersion audit
---

# RedByte Product Hardening Roadmap

Date: 2026-06-12
Source audit: `docs/audits/2026-06-12-redbyte-whole-app-product-immersion-audit.md`
Feature inventory: `docs/audits/2026-06-12-redbyte-feature-inventory.md`

This roadmap is an ordering document, not authorization to edit product source. Each implementation slice still needs one narrow product-hardening ticket before coding.

## Operating Rules

- Keep the existing product spine: Project -> Design -> Verify -> Map Pins / Hardware -> Export.
- Keep Import as a utility, not a required spine step.
- Keep E0/E1/E2/E3 evidence boundaries honest.
- Do not rebaseline goldens or screenshots as part of UX repair unless the behavioral change is intended and reviewed.
- Keep JS mirrors in sync when TS/TSX source changes.
- Use focused tests before repairs, especially for Verify failure-repair behavior.
- Do not claim Vivado, bitstream, programming, or hardware observation proof without running Vivado and a Basys3 board.

## Phase 1: Product-Brain Routing and Stale-Truth Control

Goal: Make future agents start from the current product truth instead of stale OS-era, aspirational, or historical docs.

Issues addressed:

- Agents can still over-read stale docs unless routed through the current cockpit.
- Product-brain architecture was implicit across `ACTIVE_WORK`, `DOC_INDEX`, current truth, manual, contract, surface specs, and release proof docs.

Deliverables:

- Use `docs/product/RED_BYTE_PRODUCT_BRAIN_ARCHITECTURE.md` as the product-brain routing map.
- Use `docs/product/RED_BYTE_COMMERCIALIZATION_READINESS.md` as the current business/readiness boundary.
- After user review, consider linking these docs from `docs/DOC_INDEX.md`, `docs/ACTIVE_WORK.md`, and `docs/product/RED_BYTE_CURRENT_TRUTH.md`.

Acceptance proof:

- `corepack pnpm rb:doc:validate`
- `corepack pnpm rb:encoding:check`
- Future product agents can identify canonical current docs without adding `.redbyte-brain/`.

## Phase 2: First-Viewport Student UX Repair

Goal: Ensure the most important object and next action are visible without scrolling at common laptop dimensions.

Target tickets:

| Ticket | Surface | Problem | Acceptance proof |
|---|---|---|---|
| Project launch action visibility | Project | Recommended starter action can be below fold; no-circuit state says `Mapping 0 missing`. | Clean first launch at 1366x768 shows recommended starter CTA and neutral no-circuit status. |
| Circuit-first Design layout | Design | Starter circuit graph is below fold. | Loading Logic Gates and Half Adder shows meaningful nodes/connections in first viewport. |
| Hardware board/table first viewport | Map Pins / Hardware | Map table and board are hidden below fold; left rail copy wraps badly. | Certified starter Map Pins first viewport shows mapped rows, board affordance, and unambiguous mapped state. |
| Export action hierarchy | Export | Primary download/build action is below fold; rail and hero state can conflict. | Export first viewport shows trust state, primary action, and E0 boundary with no contradictory rail state. |

Recommended tests:

- Existing `ece141-product-immersion.spec.ts`
- Existing UI hierarchy/art-direction tests where applicable
- New or updated screenshot assertions only after behavior is intentionally changed

## Phase 3: Verify Failure-Repair Hardening

Goal: Make the fail -> understand -> repair -> rerun loop impossible to strand.

Target ticket:

- Title: Verify expected-output edit repair reaches a terminal state after intentional mismatch
- Surface: Verify
- Journey segment: Compare FAIL, edit expected output, rerun
- Observed behavior: In the in-app browser dirty context, repairing an intentional expected-output mismatch left stale failed/running state and disabled controls.
- Expected behavior: Restoring the expected value and rerunning reaches PASS or a clear new FAIL with enabled next action.

Acceptance proof:

- New focused browser regression: load Logic Gates, run Compare PASS, flip one expected value, confirm FAIL, restore the value, rerun, confirm PASS.
- Existing `ece141-product-immersion.spec.ts` remains green.
- No broad state reset masks the stale-state bug.

## Phase 4: Manual Editor Control Proof

Goal: Prove the editor is not only starter-driven.

Target areas:

- Manual placement from palette/resource chips.
- Manual wiring and wire repair.
- Undo, redo, delete, fit.
- Code and Split views.
- Circuit-health error and warning recovery.

Current proof:

- `ide:gate:blank-canvas-product-proof` passes through blank-canvas reset, UI quick action for IO + AND, Verify Observe, save observed outputs, Compare PASS, map rows, and Export download-button presence.

Remaining proof gap:

- The blank-canvas gate uses a quick action, not fully manual palette placement and wiring from first principles.

Acceptance proof:

- Add a focused manual editor-control gate or extend an existing one.
- Verify no product source change ships without the relevant editor-control gate.

## Phase 5: Map Pins and Export Trust Handoff

Goal: Make the simulated-to-hardware handoff visually and semantically unambiguous.

Target tickets:

- Replace contradictory mapped/ready-to-map language with a single mapped-state summary.
- Keep XDC/package preview tied to visible mapping state.
- Make E0 export action first-viewport visible.
- Preserve README and EXPECTED_IO evidence boundary language.

Acceptance proof:

- `ece141-vivado-artifacts.spec.ts` passes.
- `ece141-map-pins-recovery.spec.ts` or equivalent passes.
- Visual proof shows first-viewport board/table/export action clarity.

## Phase 6: Import and Recovery Proof Expansion

Goal: Turn Import from "visible and smoke-tested" into a trustworthy utility.

Target areas:

- Vivado ZIP upload and parse.
- HDL paste path only after ZIP path stays reliable.
- Port mapping review.
- Schematic review before apply.
- Rejection of corrupt or mismatched packages.

Current proof:

- `ece141-import-export-recovery.spec.ts` passes project persistence and import/export recovery smoke.
- Import entry surface is visible and does not replace the current project before review.

Acceptance proof:

- Representative good ZIP imports.
- Corrupt ZIP stays safely blocked.
- Imported project can Verify, map, and Export without losing project provenance.

## Phase 7: Classroom Package Readiness

Goal: Make the app safe for a professor to assign without Connor standing beside every student.

Deliverables:

- Instructor quickstart.
- Student first-lab quickstart.
- Known-good starter list.
- Known limitation list.
- Troubleshooting guide for Vivado handoff.
- Support triage template using the product-hardening ticket fields.

Acceptance proof:

- Two clean rehearsal runs on a fresh browser profile.
- One instructor-style run using only public docs and UI.
- All support claims point to current docs, not historical gap-audit language.

## Phase 8: Vivado/Basys3 Proof Restoration

Goal: Restore fresh E1/E2/E3 evidence on a machine with Vivado 2024.2 and a Basys3 board.

Current local truth:

- Vivado was not found at `C:\Xilinx\Vivado\2024.2\bin\vivado.bat`.
- This audit inspected E0 packages only.

Target proof tiers:

- E1: Vivado project opens/synthesizes/implements/generates bitstream.
- E2: Basys3 can be programmed with the generated bitstream.
- E3: Observed hardware behavior matches expected behavior and is recorded.

Acceptance proof:

- Use existing Vivado/Basys3 proof docs and observation templates.
- Do not update E1/E2/E3 claims from screenshots or E0 packages alone.

## Phase 9: Commercialization Package

Goal: Decide what can be offered externally without creating a premature SaaS burden.

Recommended path:

1. Public/free hosted app for evaluation and student use.
2. Campus/instructor support package and license.
3. Downloadable/offline or campus-hosted static package if institutions need local control.
4. Accounts/SaaS only after a concrete user-data or classroom-management requirement appears.

Acceptance proof:

- `docs/product/RED_BYTE_COMMERCIALIZATION_READINESS.md` reviewed and updated after UX hardening.
- License/privacy/support terms reviewed before any paid deployment.
- Deployment pipeline proof distinguishes "GitHub source delivered" from "live for students".

## Suggested Immediate Order

1. Project/Design/Hardware/Export first-viewport repair.
2. Verify failure-repair regression and fix.
3. Manual editor-control proof beyond the quick action.
4. Map/export trust wording and first-action cleanup.
5. Import proof expansion.
6. Vivado/Basys3 proof restoration on hardware.
7. Classroom and commercialization packaging.

