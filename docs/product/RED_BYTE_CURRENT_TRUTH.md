---
doc_status: current
last_validated: 2026-07-04
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
| Workbench model | `docs/architecture/RED_BYTE_WORKBENCH_MODEL.md` | Current shell, side-tool, task-plane, Hardware board-first, and proof-boundary model. |
| Release-readiness target | `docs/product/RED_BYTE_RELEASE_READINESS_TARGET.md` | Current visual/workbench target for proportional tool windows, no cropped controls, and unobstructed board visuals. |
| Release-candidate decision | `docs/product/RED_BYTE_RELEASE_CANDIDATE_DECISION.md` | Current E0 browser release-candidate posture, Node 20 status, final-SHA discipline, and not-shippable items. |
| Browser E0 release proof | `docs/product/RED_BYTE_BROWSER_E0_RELEASE_PROOF.md` | Current pinned-runtime proof status, browser E0 flows proven, final-SHA rules, and no-hardware proof boundary. |
| Browser E0 packaging checklist | `docs/product/RED_BYTE_BROWSER_E0_PACKAGING_CHECKLIST.md` | Browser E0 package/demo checklist, release/deploy SHA rules, blockers, and exact no-overclaim language. |
| Gannon pilot readiness | `docs/product/GANNON_PILOT_READINESS.md`, `docs/product/GANNON_PILOT_GAP_MAP.md` | Current supervised pilot boundary: Labs 1-5 browser-E0 student flow, submission copy, adoption gaps, and not-sell-ready constraints. |
| Product reality sprint | `docs/product/REDBYTE_PRODUCT_REALITY_SPRINT.md`, `docs/product/REDBYTE_STUDENT_FRICTION_AUDIT.md` | Current student-friction ranking and the selected complex-build signal-trace debugging slice. |
| Summer rescue audit | `docs/product/REDBYTE_SUMMER_RESCUE_AUDIT.md` | Current ranked normal-use friction audit and chosen Testbench Editor Simplification + Export Confidence fix package. |
| Vivado-grade export reality audit | `docs/product/REDBYTE_VIVADO_GRADE_EXPORT_REALITY_AUDIT.md` | Current live-production browser-E0 ZIP audit for critical starters and explicit Vivado E1 blocked/not-proven boundary. |
| Vivado E1 certification protocol | `docs/product/RED_BYTE_VIVADO_E1_CERTIFICATION_PROTOCOL.md`, `docs/product/RED_BYTE_VIVADO_E1_RESULT_TEMPLATE.md`, `docs/product/RED_BYTE_VIVADO_E1_RUNBOOK_FOR_GANNON.md`, `docs/product/RED_BYTE_E1_LAB_MACHINE_CHECKLIST.md` | Current tracked harness, lab-machine runbook, checklist, and result language for real Vivado import/compile/testbench/synthesis proof without bitstream or board overclaim. |
| Wrong-build diagnosis | `docs/product/WRONG_BUILD_DIAGNOSIS_AND_REPAIR_GAP_MAP.md` | Current wrong-circuit repair map: failed Compare -> Inspect Design -> direct driver facts / bounded upstream signal trace -> repair -> rerun Compare -> Export E0 boundary. |
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
- The current local professional-rebrand branch renders exactly those five stages in the progress rail; Import is reachable as a separate utility action and does not receive a stage number or completion state.
- The shell hierarchy is the compact top bar, five-stage rail, and active work surface. The older proof ribbon, bottom status footer, and injected per-surface product-spine header are removed in the local slice so they cannot compete as duplicate authorities.
- The Gannon pilot path is a supervised browser-E0 lab flow, not a hosted grading or commercial classroom platform.
- The Round 13A Gannon pilot flow must not be treated as release-ready unless `ide:gate:project-command-center` passes alongside `ide:gate:gannon-pilot-student-flow`, `ide:gate:build-fresh-after-import-replacement`, and `ide:gate:build-fresh-replacement-integrity`; Project first-launch density is part of the required classroom truth, not a cosmetic check.
- Trusted/E0-ready Export requires current Compare PASS, current mapping, and current export state for the same project state.
- Draft Export is allowed when the project is structurally exportable but trusted proof is missing or stale.
- Vivado build, board programming, and board observation remain external proof tiers.
- The current E1 harness is `scripts/vivado/redbyte-e1-certify.ps1` plus `scripts/vivado/redbyte-e1-certify.tcl`; it can record `BLOCKED_NO_VIVADO` locally, but only a real Vivado run can produce `PASS_E1`.

## 4. Current Known Risks

### Professional rebrand / product recomposition posture (local, 2026-07-13)

- Branch `product/redbyte-professional-rebrand` is local-only and was forked from `origin/main` at `e8b5ff7e0f9628efcd200abb4db1623cfb7d6207`; the professional token/primitive foundation is committed locally as `087ba2f36`.
- Start and Project are action-first, Design is canvas-first, Verify has one Run authority with the Observe-only -> Compare-checks transition repaired, Hardware / Map Pins is table-first, and Export is readiness-first.
- The slice is intended to change composition and interaction wiring only. Simulator/Compare truth, project format, mapping authority, generated files/ZIP bytes, goldens, and E0/E1/E2/E3 boundaries remain protected.
- Node `20.19.0` / pnpm `10.24.0` full `classroom:gate` passes all `72` steps, including the workspace build and final `30/30` determinism/parity tests. Focused Vitest passes `160/160`; the Start-page test, four-viewport professional gate, professional burn-down/classroom, Design wiring, guided Full Adder, Verify repair, wrong-build recovery, CSS audit, docs (`29/29`), encoding, syntax, and whole-slice diff checks pass. The slice is closed locally but is not pushed, deployed, production-current, remote-green, or E1/E2/E3 proven. Automated after evidence does not replace the incomplete fresh three-loop all-surface manual replay.

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
- Invariant gates `ide:gate:design-library-not-cropped`, `ide:gate:design-tool-window-coexistence`, `ide:gate:hardware-board-unblocked`, `ide:gate:hardware-resource-catalog-not-obstructing`, `ide:gate:release-readiness-visual-contract`, `ide:gate:no-cropped-controls-regression`, `ide:gate:import-guided-recovery-workflow`, `ide:gate:workbench-reconstruction-v1`, `ide:gate:design-dual-tool-windows`, `ide:gate:verify-task-plane-usability`, `ide:gate:hardware-board-dominance`, `ide:gate:action-first-entry-surfaces`, `ide:gate:root-overflow-regression`, `ide:gate:shell-navigation-overhaul`, `ide:gate:primary-work-object-dominance`, `ide:gate:nested-scroll-regression`, `ide:gate:project-identity-editing`, `ide:gate:side-dock-affordance`, `ide:gate:open-side-panel-density`, `ide:gate:workbench-obstruction-usability`, `ide:gate:design-canvas-direct-workbench`, `ide:gate:design-workspace-crash-proof`, `ide:gate:workbench-stability-overhaul`, `ide:gate:interaction-affordance`, `ide:gate:active-mode-reload-recovery`, `ide:gate:verify-saved-checks-default`, `ide:gate:verify-testbench-usable-layout`, `ide:gate:verify-workbench-layout-reset`, `ide:gate:verify-postrun-workbench-usability`, `ide:gate:release-solidification-v2`, `ide:gate:authoring-depth-release-safety`, `ide:gate:hardware-first-viewport`, `ide:gate:project-command-center`, `ide:gate:design-workbench-integrity`, `ide:gate:design-workbench-v1`, `ide:gate:design-no-bridge-required`, `ide:gate:workbench-space-utilization`, `ide:gate:import-recovery-contract`, `ide:gate:shell-layout-integrity`, `ide:gate:shell-workbench-hierarchy`, `ide:gate:export-trust-integrity`, `ide:gate:export-handoff-station`, `ide:gate:export-first-viewport-artifacts`, `ide:gate:export-artifact-direct-preview`, and `ide:gate:verify-evidence-workbench` are part of `classroom:gate` and `verify:gates:classroom`; `ide:gate:interaction-affordance` also guards Project `Flow` help placement so it cannot cover first-launch actions or loaded Project entry paths.
- Outer workflow and Verify rail gates `ide:gate:project-loaded-command-surface`, `ide:gate:import-guided-recovery-wizard`, `ide:gate:export-package-inspector`, `ide:gate:outer-workflow-action-density`, `ide:gate:card-chrome-regression`, and `ide:gate:verify-signals-dock-not-clipped` are also part of `classroom:gate` and `verify:gates:classroom`; they protect the loaded Project command board, Import first-look wizard, Export package inspector, non-card action density, and readable open Verify Signals rail.
- Release Solidification v1 gate `ide:gate:release-solidification-v1` is also part of `classroom:gate` and `verify:gates:classroom`; it protects the current release package across Verify open-Signals overflow, Export handoff checklist clarity, and Import selected-source editor/review layout.
- Student Task Completion gate `ide:gate:student-task-completion-flow` is also part of `classroom:gate` and `verify:gates:classroom`; it protects the complete student flow across Project starter, Design node selection/direct edits, Verify PASS/FAIL/repair/PASS, Hardware mapping visibility, and Export E0 handoff.
- Complex Build Signal Trace gate `ide:gate:complex-build-signal-trace-debugging` is also part of `classroom:gate` and `verify:gates:classroom`; it protects the failed Compare -> Inspect Design repair path across direct driver facts, bounded upstream trace rows, Focus node behavior, root-overflow checks, and console/page cleanliness.
- Release Solidification v2 gate `ide:gate:release-solidification-v2` is also part of `classroom:gate` and `verify:gates:classroom`; it protects first-launch Project orientation from blocking launch actions and Verify post-run PASS/repair action visibility without changing Verify truth.
- Authoring Depth gate `ide:gate:authoring-depth-release-safety` is also part of `classroom:gate` and `verify:gates:classroom`; it protects Project first-launch rename, Build Fresh, Design boundary I/O to direct Add AND/Wire continuation, starter authoring operations, reload continuity, and Verify/Hardware/Export/Import smoke while rejecting stale builds, dynamic import failures, error boundaries, root overflow, and browser console/page errors. `ide:gate:blank-adder-authoring-depth` is the focused blank-canvas depth proof for manual primitive full-adder and 4-bit adder authoring, Verify custom checks, Hardware mapping agreement, and Export ZIP inspection at `1366x768` and `1440x900`. `ide:gate:final-current-build-smoke` is a closeout-only harness for clean current-HEAD browser proof and is not a substitute for the classroom gate.
- Project interaction gate `ide:gate:interaction-affordance` also protects loaded Project workflow-help behavior after the release-candidate shakedown: loaded Project must not auto-show the full Workflow Orientation card after real work is loaded, but the `Flow` affordance must stay visible and explicit reopen must remain integrated, non-overlapping, and browser-clean at `1366x768` and `1440x900`.
- Release-candidate decision gates now include `ide:gate:release-candidate-decision`, `ide:gate:project-loaded-command-center-final`, `ide:gate:verify-evidence-clarity-final`, `ide:gate:node20-proof-status`, `ide:gate:release-final-sha-discipline`, and `ide:gate:browser-e0-packaging-readiness`. `ide:gate:active-mode-reload-recovery` now covers browser Back/Forward mode history in addition to route sync and reload recovery.

### Product immersion posture

- Project, Design, Verify run intent, Export, Hardware, Import, the global shell, the first lab-profile data seam, public course quickstarts, and the first visual-finish empty-state repairs are materially stronger than earlier audits; the next browser-first product issue must be chosen from live inspection, while the next non-visual proof gap remains fresh Vivado/Basys3 proof restoration.
- Current Git source posture on 2026-07-04: the latest synced and remote-green base before the Import recovery-copy slice is `1d1c4438c5ab7323e45037b68836615745b3efa0` (`fix: improve Verify evidence workbench gate truth`), with GitHub `Classroom Truth Gates`, deploy, and Cloudflare Pages checks green for that SHA. The earlier `9a639a43` "latest" output was stale context, not a remote regression; `d235823a`, `fdd1abd9`, and `fdf17b77` are ancestors of current main. Do not hard-code future current-head claims from this note; verify live Git and GitHub status before pushing or reporting remote-green proof.
- Summer Rescue Sprint / Testbench Editor Simplification + Export Confidence remains the browser-E0/export-confidence baseline, but it is no longer the latest source checkpoint. `docs/product/REDBYTE_SUMMER_RESCUE_AUDIT.md` and `docs/product/REDBYTE_VIVADO_GRADE_EXPORT_REALITY_AUDIT.md` remain proof history for Verify repair, Export confidence, and production ZIP structure. They do not prove Vivado E1, bitstream E2, or board observation E3.
- Release Readiness Tool Windows v1 is closed locally by `ide:gate:design-library-not-cropped`, `ide:gate:design-tool-window-coexistence`, `ide:gate:hardware-board-unblocked`, `ide:gate:hardware-resource-catalog-not-obstructing`, `ide:gate:release-readiness-visual-contract`, and `ide:gate:no-cropped-controls-regression`: the Design Library is no longer a clipped narrow rail, Design board resource chips fit inside the dock, and the Hardware resource summary no longer overlays the Basys3 board at `1366x768` and `1440x900`.
- Outer Workflow Command Surfaces + Verify Signals Dock v1 is closed locally by `ide:gate:project-loaded-command-surface`, `ide:gate:import-guided-recovery-wizard`, `ide:gate:export-package-inspector`, `ide:gate:outer-workflow-action-density`, `ide:gate:card-chrome-regression`, and `ide:gate:verify-signals-dock-not-clipped`: loaded Project now exposes direct current-action commands, Import first look reads as a guided recovery wizard, Export ready state opens as a package inspector with file-browser/preview behavior, and the open Verify Signals rail is readable at `1366x768` and `1440x900` without widening the collapsed rail or changing Verify semantics.
- Release Solidification v1 is closed locally by `ide:gate:release-solidification-v1`: Verify no longer creates internal horizontal overflow when Signals is open, collapsed-Signals Verify still preserves waveform dominance, Export now shows a compact Package / Verify / Pin Mapping / E0 Boundary checklist in the package inspector, and Import selected-source recovery uses editor plus source-review lanes with reload continuity at `1366x768` and `1440x900`.
- Student Task Completion / Design Direct Edits v1 is closed locally by `ide:gate:student-task-completion-flow`: selected Design nodes now open a proportional Inspector with visible Copy, Duplicate, and Swap type controls at `1366x768` and `1440x900`, while the same gate proves the student can continue through Verify PASS/FAIL/repair/PASS, Hardware mapping, and Export E0 handoff without root overflow or browser errors.
- Release Solidification v2 is closed locally by `ide:gate:release-solidification-v2`: first-launch Project Workflow Orientation now uses the integrated callout and does not overlap Build Fresh, starter, or primary launch actions, while Verify Compare PASS and repair PASS expose a compact next-action band and FAIL keeps the first failing-check action with the evidence workspace using the lower viewport.
- Product Reality Sprint / Complex Build Signal Trace Debugging is covered by `ide:gate:complex-build-signal-trace-debugging` and is wired into the classroom release guard: a scratch two-stage full-adder-style sum path intentionally uses `OR` where the second-stage sum should be `XOR`, authors correct expected outputs, fails Compare, opens Design, and shows a bounded upstream trace from `SUM_OUT` through `wrong_or_should_be_xor`, `XOR_AB`, `CIN`, `A`, and `B` with per-node Focus actions at `1366x768` and `1440x900`. This is browser E0 proof only; production status must still be confirmed by live build endpoints before claiming it current.
- Wrong-Build Diagnosis and Guided Design Repair is closed and deployed for commit `9826a77a77c008bc8f5a963051300ac57bc58a5c` by `ide:gate:wrong-build-diagnosis-repair-flow`: a scratch XOR-intended circuit intentionally built with an OR gate now fails Compare against correct expected outputs, offers separate expected/testbench and design-repair lanes, opens Design with failed-output expected/observed/input context, shows the direct OR driver and wire counts, focuses the driver for OR -> XOR repair, marks Verify stale after the design edit, reruns Compare to PASS, and keeps Export in the browser-E0 trust boundary.
- Authoring Depth + Release Safety Harness is closed and remote-green for implementation commit `9a9b3eb34340281f968c402c79f4b454fda4e58d` by `ide:gate:authoring-depth-release-safety`: after Build Fresh and Add boundary I/O, partial blank Design circuits now keep direct Add AND, Wire, and Open Verify continuation in the canvas instead of forcing students to hunt through collapsed support chrome. The release-safety harness also proves current visible build identity and broad reload smoke without changing simulation, Verify, mapping, generated artifacts, project format, goldens, import semantics, or hardware proof claims. Final current-build smoke and deployed `/os/version.json` proof verified the implementation SHA; browser evidence remains E0 only.
- Blank 4-bit Adder Authoring Depth is closed locally by `ide:gate:blank-adder-authoring-depth`: the browser now proves from-scratch SW/LD placement, labels, primitive full-adder wiring, invalid/cancel/delete/undo/move wire handling, four-`FullAdder` carry chain, Verify PASS/FAIL/repair/PASS, Hardware conflict/remap/final mapping, and Export preview/ZIP inspection. This is browser E0 proof only and makes no Vivado, bitstream, or physical-board claim.
- Vivado E1 Run Kit / Gannon Runbook is closed locally by `scripts/vivado/redbyte-e1-pack-runner.ps1`, `docs/product/RED_BYTE_VIVADO_E1_RUNBOOK_FOR_GANNON.md`, and `docs/product/RED_BYTE_E1_LAB_MACHINE_CHECKLIST.md`: the kit packages the tracked E1 harness and handoff instructions for a real Vivado 2024.2 host. This desktop still has no discoverable Vivado, so the valid local result remains `BLOCKED_NO_VIVADO`; no E1/E2/E3 pass is claimed.
- Design Wiring Simplification is closed locally by `ide:gate:design-wiring-simplification-flow`: the browser proves FullAdder from-scratch wiring guidance, source-preserving invalid-target recovery, selected-wire delete, five intended wires, and moved-block connection preservation. This is browser E0 usability proof only and does not change simulator truth, Verify comparison semantics, pin mapping, generated artifacts, or Vivado/Basys3 proof tiers.
- Custom Clock Sequential Truth is closed locally by `ide:gate:custom-clock-sequential-truth`: the browser now proves `CLK100MHZ` board-clock Verify/Export truth, hidden Sim Clock palette truth, imported sim-only Clock import-only Verify/Export blocking, manual switch/button clock policy, and a non-starter custom sequential board-clock export at `1366x768` and `1440x900`. This is Option B support/migration truth only; first-class explicit Clock oscillator semantics remain unimplemented.
- Build Fresh Replacement Integrity is closed locally by `ide:gate:build-fresh-replacement-integrity`: the browser now proves cancel preserves existing blank/custom work, confirmed Build Fresh creates a new empty Basys3 blank project, stale circuit nodes, I/O rows, `hardwareMappingV2`, Verify/export state, and Import state do not survive, and SW0 can be placed again in the replacement project at `1366x768` and `1440x900`. This is browser E0 proof only and makes no Vivado, bitstream, or physical-board claim.
- Build Fresh After Import Replacement is closed locally by `ide:gate:build-fresh-after-import-replacement`: the browser now proves an applied RedByte import can be canceled non-destructively from Project Build Fresh, then confirmed into a new empty Basys3 blank project with stale imported graph, I/O rows, `hardwareMappingV2`, import metadata, import URL state, Verify/export state, and old identity cleared. SW0 can be placed again after replacement and reload without the imported graph returning. This is browser E0 proof only and makes no production, Vivado, bitstream, or physical-board claim.
- Scratch Testbench Repair and Failure Recovery UX is closed locally by `ide:gate:scratch-testbench-repair-flow`: the browser now proves a scratch FullAdder plus extra OR logic path through Verify Observe/save, Compare PASS, wrong expected-output FAIL, a compact first-mismatch repair strip, `Use observed`, repaired PASS, stale expected-output edit detection, and Export E0 trust boundary. This is browser E0 proof only and makes no production, Vivado, bitstream, or physical-board claim.
- Verify Counter Repeat Compare Stability is closed locally by `ide:gate:verify-counter-repeat-compare-stability`: the browser now proves `2-Bit Up Counter (Basys3)` Observe, repeated Compare PASS with the same deterministic `reportHash`, intentional expected-output FAIL, repair PASS, and post-repair repeat PASS without the Verify UI staying `RUNNING`. This is browser E0 proof only and makes no Vivado, bitstream, physical-board, production, or true 60-minute session claim.
- Release Candidate Shakedown / Loaded Project Flow Auto-Collapse is closed locally by the strengthened `ide:gate:interaction-affordance`: Project first launch still auto-shows integrated workflow help, but loaded Project no longer defaults to the full Workflow Orientation card after real work exists. The `Flow` button remains the explicit reopen control and the reopened helper stays integrated without covering loaded Project entry paths. The slice changes only presentation/help behavior and browser proof; Node `20.19.0` proof remains environment-gated in this shell.
- Release Candidate Decision / Mode History + Node 20 Status is closed locally: full Project/Verify release-candidate audit found a normal browser-history release blocker, then `IdeApp` mode URL sync was hardened so in-app mode changes create restorable history entries and `popstate` restores the active surface. The decision report keeps the current status honest: browser E0 is approaching release-candidate quality, but final deployed-SHA proof and remaining Project/Verify visual maturity work are still required before packageable release claims.
- Pinned Runtime + Browser E0 Release Proof is closed locally: Node `20.19.0` proof now passes through an ignored repo-local portable runtime, and the release subset passed under Node `v20.19.0` / pnpm `10.24.0`, including full `classroom:gate`. `docs/product/RED_BYTE_BROWSER_E0_RELEASE_PROOF.md` records the current browser E0 proof package and no-hardware boundary.
- Release Proof Fork / Browser E0 Verify Evidence Density is closed locally: Vivado, `xsct`, `hw_server`, Xilinx/Vivado environment variables, and a Basys3/Digilent/Xilinx-like USB device were unavailable, so the slice took the browser E0 fork. `ide:gate:verify-postrun-workbench-usability` now also proves post-run waveform evidence top offset and viewport-visible chart height through Compare PASS, induced FAIL, and repair PASS at `1366x768` and `1440x900`; before/after proof is under `.redbyte/product-immersion/browser-e0-polish/2026-06-20/`.
- Verify Command Deck Readability is closed locally: fresh 1440x900 browser proof showed the post-run Verify command deck visually clipping `Compare checks` during the normal FAIL/repair loop. `ide:gate:verify-postrun-workbench-usability` now also measures every visible `Observe only` and `Compare checks` control against rendered font metrics through PASS, FAIL, repair, and toggle states; after proof is under `.redbyte/product-immersion/verify-command-readability/after/`. This is browser E0 layout proof only and makes no Verify semantic or hardware claim.
- Project Loaded Command Center + Browser E0 Packaging Readiness is closed locally pending final commit/deployed-SHA proof: `ide:gate:project-loaded-command-surface` now rejects boxed metric-card stacks in the loaded Project command board, `ide:gate:browser-e0-packaging-readiness` enforces the tracked Browser E0 package/no-overclaim checklist, and after proof under `.redbyte/product-immersion/project-packaging-readiness/2026-06-20/` shows loaded Project, Design edit return, Verify PASS/FAIL/repair, Hardware, Export, Import, reload, and Back/Forward continuity with visible build `53e0481`, zero overflow, and no hardware claims.
- Workbench Reconstruction v1 is closed locally by `ide:gate:workbench-reconstruction-v1`, `ide:gate:design-dual-tool-windows`, `ide:gate:verify-task-plane-usability`, `ide:gate:hardware-board-dominance`, `ide:gate:action-first-entry-surfaces`, and `ide:gate:root-overflow-regression`: the shell now releases empty auto-console space, the compact shell/proof/status model is documented in `docs/architecture/RED_BYTE_WORKBENCH_MODEL.md`, Design keeps Quick Inputs visible as a docked tool window while palette sections scroll internally, Hardware Map Pins starts with the board/table binding task plane instead of a non-action summary strip, Project/Export/Import entry actions remain first-order without root overflow at `1366x768` and `1440x900`, and `ide:gate:workbench-space-utilization` protects the wide `1920x1080` Verify workspace from returning to a capped/narrow layout.
- Import Guided Recovery Workflow v1 is closed locally by `ide:gate:import-guided-recovery-workflow`: Import first-look still presents a guided restore path, but active Paste HDL and unsupported-example states now replace the intro shell with a compact taskbar, keep editor/review content in the first viewport at `1366x768` and `1440x900`, preserve the review/apply selector contract, reject root overflow and console/page errors, and make no import parser/apply, project-format, Verify, mapping, generated-file, golden, Vivado, or Basys3 proof changes.
- Shell and Navigation De-Scaffold v1 is historical browser proof. The current local successor removes its compact proof-ribbon contract in favor of compact top bar + five-stage rail + workbench, while retaining Import utility reachability, focused support-window behavior, dominant work objects, and nested-scroll/overflow protections. The migrated focused gates and full classroom aggregate pass locally.
- Design Canvas Direct Workbench v1 is closed locally by `ide:gate:design-canvas-direct-workbench`: the loaded Logic Gates Design canvas now starts with only a compact `View <zoom>` affordance, no expanded Fit/Center/preset HUD, no minimap over the graph, open/reclose View-tools behavior, no default graph overlap, no root overflow, and no console/page errors at `1366x768` and `1440x900`.
- Workbench Stability Overhaul v1 is closed locally by `ide:gate:design-workspace-crash-proof` and `ide:gate:workbench-stability-overhaul`: failed/stale Design lazy-surface imports are classified as recoverable surface-load failures with non-destructive `Reload App` recovery, and normal Project -> Design -> Verify -> reload -> Map Pins -> Design continuity remains free of error boundaries, stuck loading states, root overflow, and console/page errors.
- Verify Workbench Rebuild v1 is closed locally by `ide:gate:verify-testbench-usable-layout` and `ide:gate:verify-workbench-layout-reset`: first-run Logic Gates Verify now gives the stimulus/testbench editor the primary pre-run workbench, keeps waveform readiness secondary until a run exists, shows all starter expected-output cells and case headers without horizontal testbench overflow, and preserves usable post-run layout through Compare PASS, intentional FAIL, repair, and final PASS.
- Verify Post-Run Workbench Usability v1 is closed locally by `ide:gate:verify-postrun-workbench-usability`: Logic Gates Compare PASS, induced expected-output FAIL, and repaired PASS keep the editable testbench/checks lane usable beside waveform evidence at `1366x768` and `1440x900`, while the updated dominance, nested-scroll, and workbench-space gates preserve a balanced evidence/repair contract through `1920x1080`.
- Core Product Acceleration Sprint 2 is closed locally by `ide:gate:verify-no-circuit-task-first` and `ide:gate:project-loaded-paths-first-viewport`: fresh direct Verify now opens on a no-circuit task panel with Open Design, Load starter, and Import / Recover actions instead of waveform/testbench apparatus or misleading mapping copy, and loaded Project keeps Continue, Build Fresh, Course Starter, Import / Recover, and Open Recent paths high in the useful first viewport at `1366x768` and `1440x900`.
- Side Dock Affordance v1 is closed locally by `ide:gate:side-dock-affordance`: collapsed Design Library/Inspector, Verify Signals, Hardware Inspector, and Export Inspector rails now use compact horizontal `+ / Show / Lib|Sig|Info` restore controls in a `48px` slot; opening reveals readable support content; closing restores workbench space; and Project, Design, Verify, Hardware, Export, and Import focal objects remain visible at `1366x768` and `1440x900`.
- Open Side Panel Density v1 is closed locally by `ide:gate:open-side-panel-density`: compact-width Hardware and Export right inspectors now open as proportional full-height side tools instead of full-width bottom cards; the gate proves the red `1017px`/`1089px` bottom-band failure is gone, workspace height is preserved, focal work objects remain visible, and collapse returns the restore rail at `1366x768` and `1440x900`.
- Workbench Obstruction Usability v1 is closed locally by `ide:gate:workbench-obstruction-usability`: Hardware Map Pins now starts with the Map support dock collapsed so board/table mapping is first-order, the compact `Map` rail can reopen the guide, right and left docks stay proportional when opened, and close-to-restore behavior, no root overflow, and no console/page errors are proved at `1366x768` and `1440x900`.
- Export Artifact Direct Preview v1 is closed locally by `ide:gate:export-artifact-direct-preview`: the ready-to-build Export handoff generated-file cues are real direct-preview controls. Clicking `top.vhd` and keyboard-activating `top.xdc` select the artifact, reveal the existing artifact workspace, expose selected state, and keep browser evidence E0-only without changing generated artifact bytes.
- Workflow Orientation Integrated v1 is closed locally by the strengthened `ide:gate:interaction-affordance`: loaded Project `Flow` reopen now renders a compact integrated callout with concise workflow/trust copy, while first launch keeps the fuller teaching card. The strengthened gate intentionally failed on the old bottom overlay covering Project paths and now proves no overlap with `ide-project-entry-paths`.
- Project Identity Editing v1 is closed locally by `ide:gate:project-identity-editing`: top-bar, upper Project identity strip, loaded Project title, and adjacent Rename affordances all open meaningful inline rename; Escape cancels; Enter/blur saves through existing persistence; navigation/reload preserves the renamed project title; and the starter/source label remains distinct from user-owned project identity.
- Project Interaction Affordance v1 is closed locally by `ide:gate:interaction-affordance`: Project first launch now has a visible `Flow` affordance to reopen Workflow Orientation after dismissal, the top-bar title opens inline rename, Escape cancels, Enter saves through existing project persistence, and reload preserves the renamed title in the top bar and Project identity strip.
- Export First-Viewport Artifact Visibility v1 is closed locally by `ide:gate:export-first-viewport-artifacts`: the ready-to-build Logic Gates Export handoff station now exposes `README.txt`, `top.vhd`, `top.xdc`, `testbench.vhd`, and `vivado_import.tcl` in the first viewport at `1366x768` and `1440x900`, while the artifact explorer remains available below and browser proof stays E0-only.
- Hardware Basys3 Vertical Hierarchy / Board Starts Too Low v1 is closed locally by `ide:gate:hardware-first-viewport`: the Logic Gates starter Map Pins path keeps the Basys3 board/table and selected SW0 -> board resource -> package pin -> XDC chain first-order at `1366x768` and `1440x900` without changing pin mapping or making E1/E2/E3 claims.
- Active Mode Reload Recovery v1 is closed locally by `ide:gate:active-mode-reload-recovery`: Project starter load now synchronizes the URL to `mode=design`, browser reload restores Design, left-rail Verify navigation synchronizes to `mode=verify`, and browser reload restores Verify.
- Verify Saved Checks Default / Compare Intent v1 is closed locally by `ide:gate:verify-saved-checks-default`: the Logic Gates starter now arms saved expected-output checks before the first run, the primary action names Compare, first Run reaches Compare PASS, Compare remains armed after PASS, and students can still intentionally switch Observe/Compare.
- Project Starter Density / Command Center Lab Shelf v1 is closed locally by `ide:gate:project-command-center`: Project first launch now opens the all-lab starter shelf by default, shows eight lab choices without another click, preserves Build Fresh / Import / saved / starter paths, and is browser-proved at `1366x768`, `1440x900`, and `1920x1080`.
- Workbench Visual Finish / Import Empty-State Composition v1 is closed locally by `ide:gate:workbench-visual-finish`: Import first-look now has one restore headline, no redundant command strip, visible RedByte ZIP / Paste HDL / structural sample / blocked example choices, compact recovery guidance above the fold, no root overflow, and Project/Design/Export neighbor captures at `1366x768`, `1440x900`, and `1920x1080`.
- Workbench Space Utilization / Rail Collapse v1 is now closed locally by `ide:gate:workbench-space-utilization`: persistent support rails were the highest-impact layout defect, so Design Library/Inspector and Verify Signals start collapsed/restorable; the gate proves Project, Design, Verify, Hardware, Export, and Import at `1366x768`, `1440x900`, and `1920x1080` with meaningful focal-object space and no root overflow.
- The Design no-bridge boundary is closed locally by `ide:gate:design-no-bridge-required`: Design opens the Logic Gates starter at classroom and desktop viewports with persisted hardware mode on, no bridge fatal copy, no ErrorBoundary/boot crash, and zero local bridge requests before Hardware mode.
- Import / Recovery is now closed locally and recovery-copy hardened by `ide:gate:import-recovery-contract`: Project exposes Import / Recover, the Import first look identifies RedByte manifest restore as highest fidelity, Vivado ZIP/VHDL is reconstruction-limited, corrupt and non-ZIP archive failures leave the current project intact, archive-level failures do not show HDL/XDC port-reconstruction guidance, imported Verify PASS is not trusted automatically, and no Vivado/Basys3 proof is claimed.
- Design Workbench v1 is now closed by `ide:gate:design-workbench-v1`: blank, loaded starter, selected node, selected wire, wire start/cancel, moved node, delete/undo, split/code, and zoom/fit/center states are browser-proved at `1366x768` and `1440x900`, with the graph/canvas as the first-viewport focal object.
- Verify Evidence Workbench is now closed and gate-truth hardened by `ide:gate:verify-evidence-workbench`: first-run stimulus authoring stays visible, Observe-only produces waveform evidence without trusted proof status, Compare PASS/FAIL/repair is browser-proved, first mismatch expected/observed values are visible, and the gate checks for meaningful evidence-region overlap.
- Shell and Workbench Layout Reset is a superseded historical checkpoint. The local professional-rebrand shell removes the proof ribbon and footer entirely, leaves stage state in the five-stage rail, and begins the workbench immediately below the top bar. Updated focused and classroom gate validation passes locally.
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
- Available default shell runtime: Node `v24.15.0`, pnpm `10.24.0`.
- Repo-pinned Node in `.nvmrc`: `20.19.0`; pinned-runtime proof now passes through ignored portable Node `.redbyte/tools/node-v20.19.0/` using process-scoped PATH/Corepack/pnpm.
- Use pnpm/corepack pnpm. Do not run `npm install` in this repo.

## 5. Already Fixed - Do Not Reopen Without New Evidence

- Canonical worktree establishment is closed.
- GitHub required `Classroom Truth Gates` repair is closed.
- Nightly FPGA Bridge Proof port isolation is closed and green on GitHub for commit `2d176550`.
- README/manual overclaim cleanup is closed.
- Sequential boundary enforcement is closed: falling-edge, multi-clock, and active-low reset are blocked.
- Design-time circuit health feedback is live.
- Basys3 board-clock truth (`CLK100MHZ` / `W5`) and exported testbench parity are proof-backed historically; do not casually reopen board-clock semantics.
- Sim-only Clock components are import-only: Verify must not promote them to board-clock truth, and Export blocks them with `CLK100MHZ` Board Resource migration copy.
- Import routes to Design after successful project import.
- Project first-load black-screen issue is resolved.
- Verify fail-edit-repair is covered by `ide:gate:verify-fail-edit-repair`.
- Verify saved-check first-run intent is covered by `ide:gate:verify-saved-checks-default`, including saved checks armed by default, Compare-oriented action copy, first-run Compare PASS, and explicit Observe/Compare switching.
- Direct Verify no-circuit entry is covered by `ide:gate:verify-no-circuit-task-first`, including task-first no-circuit recovery copy, visible Open Design / Load starter / Import Recover actions, hidden waveform/testbench apparatus, no misleading Hardware/Map Pins/No IO mapping copy, route actions, build-hash verification, root-overflow checks, and console/page error checks at `1366x768` and `1440x900`.
- Verify first-run testbench usability is covered by `ide:gate:verify-testbench-usable-layout` and `ide:gate:verify-workbench-layout-reset`, including stimulus-first pre-run layout, all starter expected-output cells/case headers visible without horizontal testbench overflow, and pass/fail/repair layout reset without changing Compare semantics.
- Verify post-run testbench usability is covered by `ide:gate:verify-postrun-workbench-usability`, including Compare PASS, induced expected-output FAIL, repaired PASS, usable editable checks width/share, waveform width, waveform evidence top offset, viewport-visible chart height, readable visible `Observe only` / `Compare checks` command labels, no mini-scroll trap, visible first-failing-check action, build-hash verification, no root overflow, and no console/page errors at `1366x768` and `1440x900`.
- Scratch testbench repair is covered by `ide:gate:scratch-testbench-repair-flow`, including scratch FullAdder plus extra logic authoring, Observe/save expected outputs, Compare PASS, intentional wrong expected-output FAIL, visible first-mismatch repair strip, `Use observed`, repaired PASS, expected-output stale detection after PASS, Export E0 trust boundary, build-hash verification, no root overflow, and console/page checks at `1366x768` and `1440x900`.
- Testbench editor and export confidence repair is covered by `ide:gate:testbench-editor-and-export-confidence-flow`, including first-run Verify concept labels, multiple authored cases, Observe/save evidence, intentional multi-output expected failures, explicit single-cell/selected-row/all-failed-output `Use observed` scopes, stale testbench evidence, Export stale/draft confidence, Export current browser-E0 confidence, and no browser E1/E2/E3 overclaim at `1366x768`.
- Complex build signal-trace debugging is covered by `ide:gate:complex-build-signal-trace-debugging` and the classroom release guard, including scratch two-stage sum authoring, correct expected-output checks, Compare FAIL, Design handoff, direct driver facts, upstream trace rows, per-node Focus actions, build-hash verification, no root overflow, and console/page checks at `1366x768` and `1440x900`.
- Workbench reconstruction is covered by `ide:gate:workbench-reconstruction-v1`, `ide:gate:design-dual-tool-windows`, `ide:gate:verify-task-plane-usability`, `ide:gate:hardware-board-dominance`, `ide:gate:action-first-entry-surfaces`, and `ide:gate:root-overflow-regression`, including compact shell/task-plane geometry, no empty auto-console layout tax, Design tool-window open/close behavior, Verify task-plane aggregate proof, Hardware board/table dominance, Project/Export/Import action-first entry surfaces, build-hash verification, no root overflow, and console/page error checks at `1366x768` and `1440x900`.
- Import guided recovery workflow is covered by `ide:gate:import-guided-recovery-workflow`, including first-look guidance, active Paste HDL editor-first layout, unsupported-example blocker/review first-viewport layout, visible build-hash verification, no root overflow, and console/page error checks at `1366x768` and `1440x900`.
- Release-readiness visual contracts are covered by `ide:gate:design-library-not-cropped`, `ide:gate:design-tool-window-coexistence`, `ide:gate:hardware-board-unblocked`, `ide:gate:hardware-resource-catalog-not-obstructing`, `ide:gate:release-readiness-visual-contract`, and `ide:gate:no-cropped-controls-regression`, including proportional Design tool-window geometry, no visible horizontal cropped controls, Hardware board/resource separation, build-hash verification, no root overflow, and console/page error checks at `1366x768` and `1440x900`.
- Student task completion and Design selected-node direct editing are covered by `ide:gate:student-task-completion-flow`, including visible build-hash verification, Project starter load, selected AND-node inspector width/action geometry, visible Copy/Duplicate/Swap controls, Verify PASS/FAIL/repair/PASS, Hardware map visibility, Export E0 handoff, no root overflow, no console/page errors, and no browser E1/E2/E3 overclaim at `1366x768` and `1440x900`.
- Design partial blank authoring and release-safety browser proof are covered by `ide:gate:authoring-depth-release-safety`, including Project first-launch rename, Build Fresh, Add boundary I/O, direct Add AND/Wire continuation, Design reload, starter select/duplicate/delete/undo, wire delete/undo, Project continuity, and Verify/Hardware/Export/Import reload smoke with visible build-hash, error-boundary, dynamic-import, overflow, and console/page checks at `1366x768` and `1440x900`. Deep blank adder authoring is covered separately by `ide:gate:blank-adder-authoring-depth`, including primitive full-adder wiring, four-block carry-chain wiring, Verify custom vectors, Hardware mapping agreement, and Export ZIP inspection.
- Build Fresh replacement integrity is covered by `ide:gate:build-fresh-replacement-integrity`, including confirmation cancel preservation, confirmed replacement of existing blank/custom work with an empty Basys3 blank project, stale Project/Verify/Hardware/Export/Import state rejection, SW0 re-placement in the replacement project, build-hash verification, root-overflow checks, and console/page checks at `1366x768` and `1440x900`.
- Build Fresh after applied Import replacement is covered by `ide:gate:build-fresh-after-import-replacement`, including applied RedByte ZIP import, confirmation cancel preservation, confirmed replacement of imported work with an empty Basys3 blank project, stale imported graph/I/O/mapping/import URL/Verify/export state rejection, SW0 re-placement after replacement, reload proof, build-hash verification, root-overflow checks, and console/page checks at `1366x768` and `1440x900`.
- Loaded Project Workflow Orientation auto-collapse is covered by `ide:gate:interaction-affordance`, including first-launch automatic help, loaded Project suppression of the full card, visible `Flow` reopen, non-overlap with loaded Project entry paths, build-hash verification, root-overflow checks, and console/page checks at `1366x768` and `1440x900`.
- Outer workflow command surfaces and Verify open-rail readability are covered by `ide:gate:project-loaded-command-surface`, `ide:gate:import-guided-recovery-wizard`, `ide:gate:export-package-inspector`, `ide:gate:outer-workflow-action-density`, `ide:gate:card-chrome-regression`, and `ide:gate:verify-signals-dock-not-clipped`, including loaded Project direct mode actions, Import first-look step hierarchy, Export file browser/selected preview, action density, real card-chrome regression coverage, readable open Verify Signals width, no collapsed-rail regression, no root overflow, and console/page error checks at `1366x768` and `1440x900`.
- Shell/navigation de-scaffold was historically covered by `ide:gate:shell-navigation-overhaul`, `ide:gate:primary-work-object-dominance`, and `ide:gate:nested-scroll-regression`. The local professional recomposition migrates that contract to compact top bar + five-stage rail + workbench, no proof ribbon/footer/product-spine header, Import utility reachability, dominant work objects, and no root overflow; the migrated gates pass focused and in the full classroom aggregate.
- Verify evidence workbench truth is covered by `ide:gate:verify-evidence-workbench`, including visible first-run expected-output editing, Observe-only as non-proof trace evidence, Compare PASS, intentional expected-output FAIL, first mismatch expected/observed evidence, waveform controls, repair back to PASS, and layout overlap checks.
- Shell/workbench hierarchy is migrated in the local professional-rebrand slice: `ide:gate:shell-workbench-hierarchy` rejects the removed proof ribbon, footer, and injected product-spine header while retaining focal-object and overflow checks across Project, Design, Verify, Map Pins, Export, and Import utility. Focused and full classroom proof passes locally.
- General blank-project workflow proof is covered by `ide:gate:from-scratch-general-workflow`.
- Design graph/camera/workbench hierarchy is covered by `ide:gate:design-canvas-zoom-integrity`, strengthened by `ide:gate:design-workbench-integrity`, and closed for the V1 canvas-first slice by `ide:gate:design-workbench-v1`.
- Design no longer treats the hardware bridge as a prerequisite: `ide:gate:design-no-bridge-required` and focused unit tests cover generic fetch error classification, explicit-off hardware client behavior, and no bridge-origin requests from Design.
- Project first-launch starter density is covered by `ide:gate:project-command-center`, including visible all-lab starter choices across `1366x768`, `1440x900`, and `1920x1080`, plus the existing command-center, loaded-project, and guarded Build Fresh contracts.
- Loaded Project action-path first-viewport placement is covered by `ide:gate:project-loaded-paths-first-viewport`, including Continue, Build Fresh, Course Starter, Import / Recover, and Open Recent path visibility, Continue navigation to Verify, Import route behavior, guarded Build Fresh behavior, build-hash verification, root-overflow checks, and console/page error checks at `1366x768` and `1440x900`.
- Project interaction affordance is covered by `ide:gate:interaction-affordance`, including Workflow Orientation dismiss/reopen, top-bar title inline rename, Escape cancel, Enter save through existing project persistence, Project/top-bar identity agreement, reload persistence, and visible build-hash verification.
- Project identity editing is covered by `ide:gate:project-identity-editing`, including top-bar, upper Project identity strip, loaded Project title, and adjacent Rename edit paths; Escape cancel; Enter/blur save; navigation/reload persistence; title agreement; a distinct starter source label; visible build-hash verification; and console/page error checks at `1366x768` and `1440x900`.
- Side dock collapsed affordance is covered by `ide:gate:side-dock-affordance`, including compact horizontal restore controls for Design Library/Inspector, Verify Signals, Hardware Inspector, and Export Inspector; `48px` collapsed rail slots; readable open dock content; close-to-restore workspace behavior; focal workbench visibility; no root overflow; and console/page error checks at `1366x768` and `1440x900`.
- Workbench visual finish for Import first-look is covered by `ide:gate:workbench-visual-finish`, including one visible restore headline, no redundant command strip, visible recovery alternatives without disclosure toggles, first-viewport guidance fit, neighboring Project/Design/Export captures, and no root horizontal overflow at `1366x768`, `1440x900`, and `1920x1080`.
- Workbench space utilization is covered by `ide:gate:workbench-space-utilization`, including primary work-object geometry across Project, Design, Verify, Hardware, Export, and Import; collapsed/restorable Design Library/Inspector and Verify Signals rails; readable Design canvas, Verify waveform/evidence, and Hardware board/table minimum areas; visible Project/Export/Import actions; and no root horizontal overflow.
- Core Project/Design/Verify/Hardware/Export layout visibility is strengthened by `ide:gate:shell-layout-integrity`.
- Export trust integrity is covered by `ide:gate:export-trust-integrity`, including visible preview, downloaded ZIP entries, README/provenance wording, Draft/Trusted boundary, E0/E1/E2/E3 wording, and mapped board I/O summary agreement.
- Export Handoff Station is covered by `ide:gate:export-handoff-station`, including Draft versus Trusted first-viewport state, package handoff visibility, artifact workspace files, README E0 boundary, mapping summary agreement, Vivado next steps, and no browser E1/E2/E3 overclaim.
- Export first-viewport artifact visibility is covered by `ide:gate:export-first-viewport-artifacts`, including ready-to-build artifact file names inside the handoff station, downstream artifact explorer presence, visible build-hash verification, and no browser E1/E2/E3 overclaim at `1366x768` and `1440x900`.
- Export artifact direct preview is covered by `ide:gate:export-artifact-direct-preview`, including button/keyboard generated-file cues, preview-path updates for `top.vhd` and `top.xdc`, artifact workspace reveal geometry, selected-state `aria-pressed`, visible build-hash verification, no root overflow, and no browser E1/E2/E3 overclaim at `1366x768` and `1440x900`.
- Workbench obstruction usability is covered by `ide:gate:workbench-obstruction-usability`, including Hardware Map Pins default-collapsed Map support, compact restore rail, board/table first-viewport geometry, proportional left/right support docks when opened, close-to-restore behavior, no root overflow, and console/page error checks at `1366x768` and `1440x900`.
- Hardware first-viewport hierarchy is covered by `ide:gate:hardware-first-viewport`, including build-hash verification, selected SW0 row proof, board/table first-viewport geometry, XDC consequence text, and no browser E1/E2/E3 overclaim at `1366x768` and `1440x900`.
- Hardware / Basys3 Workbench is covered by `ide:gate:hardware-basys3-workbench`, including first-viewport Basys3 workbench proof at `1366x768` and `1440x900`, selected signal -> board resource -> package pin -> XDC hierarchy, and E0-only ready wording.
- Import / Recovery is covered by `ide:gate:import-recovery-contract`, including Project utility discoverability, RedByte manifest restore as highest fidelity, Vivado/VHDL reconstruction limits, corrupt and non-ZIP archive safety, source-specific recovery copy that avoids HDL/XDC guidance for archive-level failures, imported Verify proof invalidation, and no browser Vivado/Basys3 overclaim.
- Active mode reload recovery is covered by `ide:gate:active-mode-reload-recovery`, including Project starter load route sync, Design reload recovery, left-rail Verify route sync, and Verify reload recovery.
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
12b. Workbench Space Utilization / Rail Collapse v1. Closed locally 2026-06-14.
12c. Workbench Visual Finish / Import Empty-State Composition v1. Closed locally 2026-06-15.
12d. Project Starter Density / Command Center Lab Shelf v1. Closed locally 2026-06-15.
12e. Active Mode Reload Recovery v1. Closed locally 2026-06-15.
12f. Verify Saved Checks Default / Compare Intent v1. Closed locally 2026-06-15.
12g. Hardware Basys3 Vertical Hierarchy / Board Starts Too Low v1. Closed locally 2026-06-15.
12h. Export First-Viewport Artifact Visibility v1. Closed locally 2026-06-16.
12i. Project Interaction Affordance v1. Closed locally 2026-06-16.
12j. Project Identity Editing v1. Closed locally 2026-06-16.
12k. Side Dock Affordance v1. Closed locally 2026-06-16.
12l. Open Side Panel Density v1. Closed locally 2026-06-16.
12m. Export Artifact Direct Preview v1. Closed locally 2026-06-16.
12n. Workflow Orientation Integrated v1. Closed locally 2026-06-16.
12o. Workbench Obstruction Usability v1. Closed locally 2026-06-16.
12p. Design Canvas Direct Workbench v1. Closed locally 2026-06-16.
12q. Workbench Stability Overhaul v1. Closed locally 2026-06-16.
12r. Verify Workbench Rebuild v1. Closed locally 2026-06-17.
12s. Shell and Navigation De-Scaffold v1. Closed locally 2026-06-17.
12t. Verify Post-Run Workbench Usability v1. Closed locally 2026-06-17.
12u. Core Product Acceleration Sprint 2. Closed locally 2026-06-17.
12v. Workbench Reconstruction v1. Closed locally 2026-06-18.
12w. Import Guided Recovery Workflow v1. Closed locally 2026-06-18.
12x. Release Readiness Tool Windows v1. Closed locally 2026-06-18.
12y. Outer Workflow Command Surfaces + Verify Signals Dock v1. Closed locally 2026-06-18.
12z. Release Solidification v1: Verify / Export / Import workbenches. Closed locally 2026-06-18.
12aa. Student Task Completion / Design Direct Edits v1. Closed locally 2026-06-19.
12ab. Release Solidification v2 / Verify Actions + Project Orientation. Closed locally 2026-06-19.
12ac. Authoring Depth + Release Safety Harness. Closed 2026-06-19; implementation commit `9a9b3eb34340281f968c402c79f4b454fda4e58d` is pushed, GitHub-green, and deployed with matching SHA proof.
12ad. Release Candidate Shakedown / Loaded Project Flow Auto-Collapse. Closed locally 2026-06-19.
12ae. Release Candidate Decision / Mode History + Node 20 Status. Closed locally 2026-06-19.
12af. Pinned Runtime + Browser E0 Release Proof. Closed locally 2026-06-19.
12ag. Release Proof Fork / Browser E0 Verify Evidence Density. Closed locally 2026-06-20; no E1/E2/E3 hardware proof claimed.
12ah. Project Loaded Command Center + Browser E0 Packaging Readiness. Closed locally 2026-06-20 pending final commit/deployed-SHA proof; no E1/E2/E3 hardware proof claimed.
12ai. Blank 4-bit Adder Authoring Depth. Closed locally 2026-06-28; browser E0 proof only, no E1/E2/E3 hardware proof claimed.
12aj. Vivado E1 Run Kit / Gannon runbook. Closed locally 2026-07-04; lab-machine handoff only until a real Vivado host runs it.
12ak. Design Wiring Simplification. Closed locally 2026-07-04; browser E0 FullAdder wiring affordance proof only.
12al. Verify Evidence Workbench Gate Truth. Closed 2026-07-04; `ide:gate:verify-evidence-workbench` is the named gate and proves Observe-only is trace evidence, not trusted Compare proof.
12am. Import Invalid ZIP Recovery Copy. Closed locally 2026-07-04; `ide:gate:import-recovery-contract` now proves non-ZIP and corrupt archive failures preserve the active project and do not show HDL/XDC port-reconstruction guidance before an archive is actually readable. Verify live GitHub status before claiming remote-green or deployed impact for the final pushed SHA.
13. Vivado/Basys3 Proof Restoration.
14. Packaging/Commercial Readiness.

The next browser-first product-polish slice should be selected only after live app inspection. Verify Evidence Workbench remains the strategic candidate if current inspection still shows evidence density, repair clarity, or Observe/Compare trust as the highest-impact normal-use defect; do not choose the target from this queue alone.

```text
browser-first product ownership: inspect, rank, choose one gateable defect
```

The next board-gated proof slice remains `docs: restore RedByte Vivado Basys3 proof`, and it should update E1/E2/E3 release evidence only from real Vivado 2024.2 and Basys3 runs. Do not skip to website, pilot, broad polish, accounts/SaaS, or commercial packaging unless the user explicitly reprioritizes.
