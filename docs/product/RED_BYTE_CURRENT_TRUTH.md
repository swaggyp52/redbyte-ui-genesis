---
doc_status: current
last_validated: 2026-06-14
owner: Connor Angiel
used_by_claude: true
role: compact current-truth control layer for RedByte product and agent sessions
---

# RedByte Current Truth

Use this doc to stop source drift before work starts. It is a control layer, not a product spec.

## 1. Source Hierarchy

| Truth type | Canonical owner | How to use it |
|---|---|---|
| Runtime truth | Code + focused tests | Code wins if docs lag. |
| Agent startup and latest repo posture | `AGENTS.md`, `AI_STATE.md`, `CLAUDE.md` | Read first. `AI_STATE.md` wins over prior prompt context. |
| Current priorities | `docs/ACTIVE_WORK.md` | Cockpit for what should happen next. |
| Ordered work | `docs/product/RED_BYTE_WORK_QUEUE.md` | Near-term V1 queue for agents and maintainers. |
| V1 product contract | `docs/contracts/RED_BYTE_V1_PRODUCT_CONTRACT.md` | Current V1 target contract and work order. |
| Under-the-hood source map | `docs/architecture/RED_BYTE_UNDER_THE_HOOD_MAP.md` | Concrete subsystem, state owner, mutation, persistence, proof, and risk map. |
| State authority matrix | `docs/architecture/RED_BYTE_STATE_AUTHORITY_MATRIX.md` | Canonical state owners and invalidation rules. |
| Invariant matrix | `docs/architecture/RED_BYTE_INVARIANT_MATRIX.md` | Product invariants, existing proof, missing proof, and gate routing. |
| Gate ownership | `docs/development/RED_BYTE_TEST_AND_GATE_OWNERSHIP.md` | How to choose and wire Vitest, Playwright, classroom, golden, manual, and hardware proof. |
| Normal-use breakage audit | `docs/audits/2026-06-13-redbyte-normal-use-breakage-audit.md` | Current normal-use audit and deferred findings. |
| V1 research and audit | `docs/research/RED_BYTE_COMPETITIVE_AND_WORKFLOW_RESEARCH.md`, `docs/audits/2026-06-13-redbyte-v1-contract-reset-visual-audit.md` | Why the V1 reset exists and what the current UI evidence shows. |
| V1 execution/inventory | `docs/plans/RED_BYTE_V1_EXECUTION_PROGRAM.md`, `docs/plans/RED_BYTE_DELETE_DEMOTE_REBUILD_INVENTORY.md` | Implementation order and delete/demote/rebuild decisions. |
| Product-brain routing | `docs/product/RED_BYTE_PRODUCT_BRAIN_ARCHITECTURE.md` | How current, target, proof, audit, and stale docs should be used. |
| Current release truth | `docs/STUDENT_RELEASE_READINESS.md`, `docs/release/**` | Safe public, TA, and hardware claims. |
| Current product behavior | `docs/manuals/RedByte_Product_Manual.md` | What the product does today. |
| Current course quickstarts | `docs/course/STUDENT_QUICKSTART.md`, `docs/course/INSTRUCTOR_QUICKSTART.md`, `docs/course/TA_TROUBLESHOOTING_GUIDE.md`, `docs/course/windows-quickstart.md` | Public-facing student, instructor, TA, and Windows setup guidance. |
| Older target contract | `docs/contracts/RedByte_Product_Contract.md` | Historical/broader target standard; do not let it override the V1 reset queue. |
| Lab profile model and seam | `docs/product/RED_BYTE_LAB_PROFILE_MODEL.md`; `packages/rb-apps/src/apps/ide/labProfiles/` | Current data-only course/profile boundary; deeper course-pack authoring remains future work. |
| Historical audit | `docs/roadmap/RedByte_Gap_Audit.md` | Closure history and remaining audit context. |
| Background / stale | Stale zone in `docs/DOC_INDEX.md` | Do not use as default context for current product work. |

Practical read order for a normal session:

1. `AGENTS.md`
2. `AI_STATE.md`
3. `CLAUDE.md`
4. `docs/ACTIVE_WORK.md`
5. `docs/DOC_INDEX.md`
6. `docs/product/RED_BYTE_CURRENT_TRUTH.md`
7. `docs/product/RED_BYTE_WORK_QUEUE.md`
8. Relevant contract, manual, release, proof, audit, or issue docs for the requested slice
9. For stateful product work, `docs/architecture/RED_BYTE_UNDER_THE_HOOD_MAP.md`, `docs/architecture/RED_BYTE_STATE_AUTHORITY_MATRIX.md`, `docs/architecture/RED_BYTE_INVARIANT_MATRIX.md`, and `docs/development/RED_BYTE_TEST_AND_GATE_OWNERSHIP.md`

## 2. Current Product Thesis

RedByte V1 is a deterministic, browser-based Basys3 digital-logic lab workbench.

Its narrow promise:

- students build supported circuits visually
- students prove behavior in Verify with authored stimulus and Compare checks
- students map signals to real Basys3 resources
- students export a Vivado-ready package that matches current browser proof
- Vivado and physical hardware remain downstream proof tiers

RedByte is not a Vivado replacement, not a universal HDL IDE, not a broad FPGA platform, and not a SaaS classroom-management product.

## 3. Current UX Spine

The active RedByte-owned spine is:

```text
Project -> Design -> Verify -> Map Pins / Hardware -> Export
```

Supporting truths:

- Import is a utility entry point, not the main student spine.
- Trusted/E0-ready Export requires current Compare PASS, current mapping, and current export state for the same project state.
- Draft Export is allowed when the project is structurally exportable but trusted proof is missing or stale.
- Vivado build, board programming, and board observation remain external proof tiers.

## 4. Current Known Risks

### V1 contract reset posture

- The 2026-06-13 V1 reset is docs/control only.
- Current-HEAD screenshots were captured from `http://127.0.0.1:5174` because the pre-existing `localhost:5173` server showed stale build `a4fc624`.
- The screenshot harness captured 30 images across `1366x768`, `1440x900`, and `1920x1080` with zero console/page errors and no root horizontal overflow.
- The captured UI build hash was `2d17655`, matching repo HEAD `2d176550`.
- The reset did not change product source, tests, gates, goldens, export generation, Vivado evidence, or Basys3 evidence.

### Under-the-hood mastery posture

- The 2026-06-13 Under-the-Hood Mastery Sprint mapped 27 RedByte subsystems, their state owners, mutation paths, persistence paths, proof coverage, and known risks.
- The authoritative source/state docs are `docs/architecture/RED_BYTE_UNDER_THE_HOOD_MAP.md`, `docs/architecture/RED_BYTE_STATE_AUTHORITY_MATRIX.md`, and `docs/architecture/RED_BYTE_INVARIANT_MATRIX.md`.
- The normal-use breakage audit ran on a fresh local server at `http://127.0.0.1:5175/` and confirmed visible build `Buildd235823`.
- The audit found no console/page errors and no Design blank-canvas regression in the exercised normal-use spine.
- The Export generated-artifact preview finding is now closed by `ide:gate:export-trust-integrity`; the Import utility access/fidelity finding is closed locally by `ide:gate:import-recovery-contract`.
- Invariant gates `ide:gate:design-workbench-integrity`, `ide:gate:design-workbench-v1`, `ide:gate:design-no-bridge-required`, `ide:gate:import-recovery-contract`, `ide:gate:shell-layout-integrity`, `ide:gate:shell-workbench-hierarchy`, `ide:gate:export-trust-integrity`, `ide:gate:export-handoff-station`, and `ide:gate:verify-evidence-workbench-integrity` are part of `classroom:gate` and `verify:gates:classroom`.

### Product immersion posture

- Project, Design, Export, Hardware, Import, the global shell, the first lab-profile data seam, and public course quickstarts are materially stronger than earlier audits; the next gap is fresh Vivado/Basys3 proof restoration.
- The Design no-bridge boundary is closed locally by `ide:gate:design-no-bridge-required`: Design opens the Logic Gates starter at classroom and desktop viewports with persisted hardware mode on, no bridge fatal copy, no ErrorBoundary/boot crash, and zero local bridge requests before Hardware mode.
- Import / Recovery is now closed locally by `ide:gate:import-recovery-contract`: Project exposes Import / Recover, the Import first look identifies RedByte manifest restore as highest fidelity, Vivado ZIP/VHDL is reconstruction-limited, corrupt import leaves the current project intact, imported Verify PASS is not trusted automatically, and no Vivado/Basys3 proof is claimed.
- Design Workbench v1 is now closed by `ide:gate:design-workbench-v1`: blank, loaded starter, selected node, selected wire, wire start/cancel, moved node, delete/undo, split/code, and zoom/fit/center states are browser-proved at `1366x768` and `1440x900`, with the graph/canvas as the first-viewport focal object.
- Verify Evidence Workbench is now closed by `ide:gate:verify-evidence-workbench-integrity`: first-run stimulus authoring stays visible, Compare PASS/FAIL/repair is browser-proved, first mismatch expected/observed values are visible, and the gate checks for meaningful evidence-region overlap.
- Shell and Workbench Layout Reset is now closed by `ide:gate:shell-workbench-hierarchy`: the proof ribbon is the compact workflow/status authority, the footer is support-only chrome, rail step labels no longer repeat completion status, and the workbench frame starts at the compact shell boundary across Project, Design, Verify, Hardware, Export, and Import.
- Export Handoff Station is now closed by `ide:gate:export-handoff-station`: Draft/Needs Review, Ready-to-build, and Trusted post-download states share one visible station; package handoff and artifact workspace are visible; README E0 and E1/E2/E3 boundaries are browser-proved; mapping summaries agree; Vivado next steps stay downstream; and the primary station action remains repair/build/download rather than hardware proof.
- Hardware / Basys3 Workbench is now closed by `ide:gate:hardware-basys3-workbench`: selected rows expose project signal, board resource, package pin, and XDC lines, and ready-state copy stays E0-only with Vivado build, bitstream programming, and board observation external.
- Lab Profile / Course Pack Data Seam is now closed locally by `lab:profile-contract`: built-in profile metadata references existing Logic Gates, Half Adder, 2-Bit Counter, and Lab 8 starter IDs; course metadata stays separate from runtime circuit state; Lab 8 remains scaffold/solution-forbidden; and all profile claims stay E0-only.
- Student/Instructor Quickstarts are now closed locally under `docs/course/`: student first-lab guidance, instructor assignment/setup/proof-tier guidance, TA troubleshooting, and Windows setup guidance all point at the current Project -> Design -> Verify -> Map Pins / Hardware -> Export spine and keep Vivado/Basys3 proof external.

### Vivado/Basys3 proof posture

- This desktop still cannot claim fresh Vivado or hardware proof unless Vivado 2024.2 and a Basys3 board are actually used.
- Prior tracked proof docs remain proof history, but they are not new proof from this reset.
- E3 claims require physical observation notes, not browser screenshots or programming logs alone.

### Generated proof packs

- Tracked proof docs under `docs/release/**` and `docs/STUDENT_RELEASE_READINESS.md` are portable.
- Raw proof packs under `.redbyte/bench/runs/**`, `out/vivado-cert/**`, `dist/**`, `test-results/**`, `playwright-report/**`, and `.redbyte/product-immersion/**` are generated/local and may be absent in a clean clone.

### Repo / process hygiene

- Canonical local RedByte worktree: `C:\Users\conno\redbyte-ui-genesis-main`.
- Remote: `https://github.com/swaggyp52/redbyte-ui-genesis.git`.
- Branch: `main`.
- Available local runtime in this shell: Node `v24.15.0`, pnpm `10.24.0`.
- Repo-pinned Node in `.nvmrc`: `20.19.0`; pinned-runtime proof remains environment-gated.
- Use pnpm/corepack pnpm. Do not run `npm install` in this repo.

## 5. Already Fixed - Do Not Reopen Without New Evidence

- Canonical worktree establishment is closed.
- GitHub required `Classroom Truth Gates` repair is closed.
- Nightly FPGA Bridge Proof port isolation is closed and green on GitHub for commit `2d176550`.
- README/manual overclaim cleanup is closed.
- Sequential boundary enforcement is closed: falling-edge, multi-clock, and active-low reset are blocked.
- Design-time circuit health feedback is live.
- Basys3 board-clock truth (`CLK100MHZ` / `W5`) and exported testbench parity are proof-backed historically; do not casually reopen board-clock semantics.
- Import routes to Design after successful project import.
- Project first-load black-screen issue is resolved.
- Verify fail-edit-repair is covered by `ide:gate:verify-fail-edit-repair`.
- Verify evidence workbench integrity is covered by `ide:gate:verify-evidence-workbench-integrity`, including visible first-run expected-output editing, Compare PASS, intentional expected-output FAIL, first mismatch expected/observed evidence, waveform controls, repair back to PASS, and layout overlap checks.
- Shell/workbench hierarchy is covered by `ide:gate:shell-workbench-hierarchy`, including compact proof ribbon/evidence geometry, support-only footer copy, rail labels without visible `OK` status text, visible focal objects, and no root overflow across Project, Design, Verify, Hardware, Export, and Import.
- General blank-project workflow proof is covered by `ide:gate:from-scratch-general-workflow`.
- Design graph/camera/workbench hierarchy is covered by `ide:gate:design-canvas-zoom-integrity`, strengthened by `ide:gate:design-workbench-integrity`, and closed for the V1 canvas-first slice by `ide:gate:design-workbench-v1`.
- Design no longer treats the hardware bridge as a prerequisite: `ide:gate:design-no-bridge-required` and focused unit tests cover generic fetch error classification, explicit-off hardware client behavior, and no bridge-origin requests from Design.
- Core Project/Design/Verify/Hardware/Export layout visibility is strengthened by `ide:gate:shell-layout-integrity`.
- Export trust integrity is covered by `ide:gate:export-trust-integrity`, including visible preview, downloaded ZIP entries, README/provenance wording, Draft/Trusted boundary, E0/E1/E2/E3 wording, and mapped board I/O summary agreement.
- Export Handoff Station is covered by `ide:gate:export-handoff-station`, including Draft versus Trusted first-viewport state, package handoff visibility, artifact workspace files, README E0 boundary, mapping summary agreement, Vivado next steps, and no browser E1/E2/E3 overclaim.
- Hardware / Basys3 Workbench is covered by `ide:gate:hardware-basys3-workbench`, including first-viewport Basys3 workbench proof at `1366x768` and `1440x900`, selected signal -> board resource -> package pin -> XDC hierarchy, and E0-only ready wording.
- Import / Recovery is covered by `ide:gate:import-recovery-contract`, including Project utility discoverability, RedByte manifest restore as highest fidelity, Vivado/VHDL reconstruction limits, corrupt import safety, imported Verify proof invalidation, and no browser Vivado/Basys3 overclaim.
- Lab Profile / Course Pack Data Seam is covered by `lab:profile-contract`, including deterministic profile IDs, existing starter/example references, required IO coverage, export artifact expectations, E0-only profile proof claims, and no-solution rejection for Lab 8 solved evidence.
- Current student/instructor/TA quickstarts are covered by `docs/course/STUDENT_QUICKSTART.md`, `docs/course/INSTRUCTOR_QUICKSTART.md`, and `docs/course/TA_TROUBLESHOOTING_GUIDE.md`; legacy root quickstarts are stale unless separately rewritten.
- Old `build:unified` route/lock drift is resolved unless a fresh run reproduces failure.

## 6. Default Next Move

Approved V1 order:

1. V1 Contract Reset.
2. Under-the-Hood Mastery Sprint.
3. Export Trust Integrity.
4. Verify Evidence Workbench.
5. Shell and Workbench Layout Reset.
6. Project Command Center.
7. Export Handoff Station.
8. Hardware / Basys3 Workbench.
9. Design Workbench.
10. Import / Recovery. Closed locally 2026-06-14.
11. Lab Profile / Course Pack Data Seam. Closed locally 2026-06-14.
12. Student/Instructor Quickstarts. Closed locally 2026-06-14.
12a. Design No-Bridge Required hotfix. Closed locally 2026-06-14.
13. Vivado/Basys3 Proof Restoration.
14. Packaging/Commercial Readiness.

The next board-gated slice after the Design No-Bridge Required hotfix is:

```text
docs: restore RedByte Vivado Basys3 proof
```

It should update E1/E2/E3 release evidence only from real Vivado 2024.2 and Basys3 runs, preserve E0/E1/E2/E3 separation, and avoid screenshots-only hardware claims. Do not skip to website, pilot, broad polish, accounts/SaaS, or commercial packaging unless the user explicitly reprioritizes.
