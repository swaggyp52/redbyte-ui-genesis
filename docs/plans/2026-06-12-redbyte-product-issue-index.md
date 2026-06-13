---
doc_status: current
last_validated: 2026-06-13
owner: Connor Angiel
used_by_claude: true
role: compact product issue routing index for RedByte V1 hardening
---

# RedByte Product Issue Index

Primary reset docs:

- `docs/contracts/RED_BYTE_V1_PRODUCT_CONTRACT.md`
- `docs/architecture/RED_BYTE_UNDER_THE_HOOD_MAP.md`
- `docs/architecture/RED_BYTE_STATE_AUTHORITY_MATRIX.md`
- `docs/architecture/RED_BYTE_INVARIANT_MATRIX.md`
- `docs/audits/2026-06-13-redbyte-normal-use-breakage-audit.md`
- `docs/development/RED_BYTE_TEST_AND_GATE_OWNERSHIP.md`
- `docs/research/RED_BYTE_COMPETITIVE_AND_WORKFLOW_RESEARCH.md`
- `docs/audits/2026-06-13-redbyte-v1-contract-reset-visual-audit.md`
- `docs/plans/RED_BYTE_DELETE_DEMOTE_REBUILD_INVENTORY.md`
- `docs/plans/RED_BYTE_V1_EXECUTION_PROGRAM.md`

Prior source audits:

- `docs/audits/2026-06-12-redbyte-whole-app-product-immersion-audit.md`
- `docs/audits/2026-06-12-redbyte-feature-inventory.md`
- `docs/audits/2026-06-12-redbyte-general-lab-workbench-audit.md`

This is a routing index, not a replacement for hardening tickets. Use one issue per implementation slice unless a direct dependency is proven.

## Current Work Order

1. V1 Contract Reset.
2. Under-the-Hood Mastery Sprint.
3. Export Trust Integrity.
4. Verify Evidence Workbench.
5. Shell and Workbench Layout Reset.
6. Project Command Center.
7. Export Handoff Station.
8. Hardware / Basys3 Workbench.
9. Design Workbench.
10. Import / Recovery.
11. Lab Profile / Course Pack Data Seam.
12. Student/Instructor Quickstarts.
13. Vivado/Basys3 Proof Restoration.
14. Packaging/Commercial Readiness.

## Active Issue Index

| ID | Severity | Surface | Problem | Student impact | Recommended fix | Likely files | Proof/gate needed | Status |
|---|---|---|---|---|---|---|---|---|
| RB-V1-001 | P1 | Docs / product control | Prior queue routed directly to lab-profile work even though current UI evidence shows shell/workbench hierarchy is the stronger bottleneck. | Agents could build data seams before the core workbench feels coherent to students. | Create research, visual audit, V1 contract, delete/demote/rebuild inventory, execution program, and cockpit updates. | `docs/research/**`; `docs/audits/**`; `docs/contracts/**`; `docs/plans/**`; cockpit docs | Docs validation, encoding check, diff check; commit/push/GitHub closeout. | Fixed / historical |
| RB-UNDER-001 | P1 | Product control / gates | The Design zoom bug showed RedByte lacked explicit subsystem ownership, state authority, and invariant gates around normal user actions. | Students could find entire classes of breakage before gates did. | Create source/state/invariant maps, normal-use audit, gate ownership docs, and invariant gates. | `docs/architecture/**`; `docs/audits/**`; `docs/development/**`; `scripts/gates/**`; gate aggregators | `ide:gate:design-workbench-integrity`; `ide:gate:shell-layout-integrity`; classroom gate; docs checks; GitHub closeout. | Fixed / historical |
| RB-EXPORT-TRUST-001 | P1 | Export | Normal-use audit reached generated-artifact state but did not find an obvious artifact preview; earlier V1 screenshots also showed mapping-summary contradiction risk. | Students may distrust whether the downloaded package matches the visible proof and mapping state. | Prove and, if needed, repair Export trust integrity across summary, artifact count, visible preview, ZIP entries, README/provenance, Draft/Trusted labels, and proof-tier wording. | `ExportSurface.tsx`; export primitives; `projectWorkflowAuthority.ts`; Basys3 export services; export gates | `ide:gate:export-trust-integrity`; export download/e2e/artifact explorer gates; ZIP entry inspection. | Fixed 2026-06-13 |
| RB-SHELL-001 | P1 | Global shell / workbench frame | Workflow/status state repeated across top ribbon, left rail, evidence box, surface heroes, right rail, and bottom status. | The current job object was harder to find, especially on common laptop viewports. | Rebuild one compact shell/status authority and stabilize the first-viewport frame across surfaces. | `IdeApp.tsx`; `IdeLeftRail.tsx`; `IdeStatusBar.tsx`; Verify waveform density; shell CSS; shell hierarchy gate | `ide:gate:shell-workbench-hierarchy`; `ide:gate:shell-layout-integrity`; product/Verify/Export gates; screenshots. | Fixed 2026-06-13 |
| RB-VERIFY-EVIDENCE-001 | P1 | Verify | Verify PASS/FAIL behavior was credible, but the evidence/repair hierarchy remained dense and instrument-panel-like. | Students could miss the relation between stimulus, expected output, observed output, mismatch, waveform, and repair action. | Rebuild Verify as an evidence workbench with first-order PASS/FAIL/repair hierarchy. | `ScenarioBuilderPanel.tsx`; Verify CSS; Verify gates | `ide:gate:verify-evidence-workbench-integrity`; `ide:gate:verify-fail-edit-repair`; Verify contract/workbench gates; PASS/FAIL screenshots. | Fixed 2026-06-13 |
| RB-PROJECT-CC-001 | P1 | Project | Project still reads as starter/course-first and can show mapping failure copy before a circuit exists. | New students can think they are blocked before starting, and advanced/from-scratch paths feel secondary. | Rebuild Project as command center for blank, starter, saved, import/recovery, and future instructor lab paths. | `ProjectSurface.tsx`; project panels; `projectWorkflowAuthority.ts`; `workflowStages.ts`; CSS | Clean first-launch screenshot; workflow-authority tests; product immersion Project path. | Open |
| RB-EXPORT-HANDOFF-001 | P1 | Export | Trust integrity is now gate-backed, but the later Export surface still needs the visual/workbench handoff station around one visible trust authority. | Students may miss the relation between package readiness, mapping/provenance, and Vivado handoff steps if the hierarchy remains dense. | Make Export one first-viewport handoff station for draft and E0-ready package trust without changing generated bytes. | `ExportSurface.tsx`; export primitives; workflow authority; export view models | Export ready/draft/trust gates; artifact explorer/download gates; screenshots. | Open / later |
| RB-HARDWARE-WB-001 | P2 | Hardware / Map Pins | Hardware table/board are strong, but ready language can read beyond E0 and toward hardware readiness. | Students may conflate browser/export readiness with Vivado build/programming/observation proof. | Tighten wording and keep signal -> board resource -> package pin -> XDC first-order. | `HardwareSurface.tsx`; `Basys3BoardView.tsx`; workflow authority | Hardware visual credibility; Map Pins recovery; screenshots. | Open |
| RB-DESIGN-WB-001 | P1 | Design | At `1366x768`, the loaded circuit graph is not the first-viewport focal object. | Students cannot immediately inspect what loaded or where circuit work happens. | Rebuild Design around canvas/graph first, with palette, toolbar, starter context, and inspector demoted. | `DesignSurface.tsx`; `DesignWorkspaceFrame.tsx`; `LogicCanvas`; CSS | Design screenshot showing meaningful nodes/connections; design workbench/wire/placement gates. | Open |
| RB-LAB-001 | P2 | Product architecture / course data | ECE141 lab data, starter IDs, and product-general gate names still sit too close to core product behavior. | Professors cannot yet define new labs cleanly without code changes. | Introduce first profile/course-pack data seam after workbench contract stabilizes. | `docs/product/RED_BYTE_LAB_PROFILE_MODEL.md`; starter/catalog modules; future data path | Profile-backed lab test; no-solution policy gate; starter paths still work. | Open / queue item 11 |
| RB-IMPORT-001 | P2 | Import | Import is smoke-tested but not proven across representative Vivado ZIP/HDL fidelity cases. | Instructors cannot rely on broad import recovery without manual verification. | Keep Import utility-scoped; expand representative good/corrupt package proof later. | `ImportSurface.tsx`; `packages/rb-apps/src/import/**`; import tests | Import/export recovery plus representative fixtures and screenshots. | Open / queue item 10 |
| RB-IMPORT-ACCESS-001 | P2 | Project / Import | Loaded Project did not expose an obvious Import utility entry point while the manual still says the left rail includes Import. | Students or professors may not know how to recover/import once a project is already loaded. | Resolve whether Import is a Project utility, route, command, or removed rail item; update manual/product contract and add access gate. | `IdeApp.tsx`; `ProjectSurface.tsx`; `ImportSurface.tsx`; manual docs | New `ide:gate:import-utility-access` after product contract decision. | Open / deferred |
| RB-DOC-001 | P2 | Student/instructor docs | Student and instructor quickstarts are missing as current public-facing package docs. | Instructors cannot assign RedByte cleanly without Connor/agent context. | Write concise student first-lab and instructor setup/support quickstarts after workbench/proof posture stabilizes. | `docs/course/**`; `docs/product/**`; release docs | Docs validation; manual walkthrough using only public-facing docs. | Open / queue item 12 |
| RB-HWPROOF-001 | P1 | Vivado / Basys3 proof | Vivado 2024.2 and hardware proof were not run in this reset. | Hardware-readiness claims cannot be renewed from this machine. | Restore Vivado/Basys3 proof only on a machine with Vivado 2024.2 and board access. | `docs/STUDENT_RELEASE_READINESS.md`; certification matrix; proof scripts/docs | E1/E2/E3 proof docs/logs and observation notes. | Open / hardware-gated |
| RB-COMM-001 | P2 | Commercial readiness | RedByte is not ready for unsupervised paid classroom deployment. | Universities would need stronger support, proof, quickstarts, deployment, and legal posture. | Keep commercial packaging after workbench hardening, quickstarts, proof restoration, and deployment review. | `docs/product/RED_BYTE_COMMERCIALIZATION_READINESS.md`; release docs | Commercial readiness checklist after product/proof work. | Open / queue item 14 |
| RB-ENV-001 | P2 | Runtime environment | Repo pins Node 20.19.0, but recent local proof ran under Node 24.15.0. | Artifact determinism claims remain slightly weaker until pinned-runtime proof exists. | Re-run relevant artifact/doc/browser gates under Node 20.19.0 when available. | `.nvmrc`; docs cockpit | `node -v` shows 20.19.0, then relevant gates pass. | Open / environment-gated |

## Recently Fixed / Historical Issues

| ID | Status |
|---|---|
| RB-SHELL-001 | Fixed 2026-06-13: proof ribbon is the compact workflow/status authority, footer is support-only chrome, left rail no longer shows visible `OK` status labels, Verify default waveform density fits the existing first-viewport contract, and `ide:gate:shell-workbench-hierarchy` is wired into focused/classroom/broad classroom gates. |
| RB-VERIFY-EVIDENCE-001 | Fixed 2026-06-13: first-run starter checks keep the stimulus/expected-output editor visible; post-run stimulus and waveform chrome are condensed; `ide:gate:verify-evidence-workbench-integrity` proves Compare PASS -> intentional expected-output FAIL -> first mismatch expected/observed evidence -> repair PASS with overlap checks and screenshots. |
| RB-EXPORT-TRUST-001 | Fixed 2026-06-13: visible previews open by default, the mapping summary no longer contradicts mapped board I/O rows, and `ide:gate:export-trust-integrity` proves visible preview, ZIP entries, README/provenance, Draft/Trusted boundary, and E0/E1/E2/E3 wording together. |
| RB-UX-001 | Fixed 2026-06-12: Project first-viewport starter/start action improved. V1 still reopens Project at command-center level, not as the same old issue. |
| RB-UX-002 | Fixed 2026-06-12: first-viewport Design gate improved. V1 evidence still finds circuit graph priority insufficient, tracked as RB-DESIGN-WB-001. |
| RB-UX-003 | Fixed 2026-06-12: Hardware first-viewport board/table improved and visual credibility guard added. |
| RB-UX-004 | Fixed 2026-06-12: Export primary action visibility improved. |
| RB-UX-005 | Fixed 2026-06-12: Export Draft versus ready rail mismatch repaired. The 2026-06-13 Export Trust Integrity slice closed the later mapping-summary contradiction risk; remaining Export work is visual handoff-station hierarchy. |
| RB-VISUAL-001 | Fixed 2026-06-12: visual-system integrity gate and bounded Export/Verify/shell fixes added. |
| RB-GATE-001 | Fixed 2026-06-12: stale Verify/Export gate setup assumptions repaired; from-scratch general workflow gate added. |
| RB-FS-001 | Fixed 2026-06-12: blank-project IO labels and export/testbench aliasing repaired. |
| RB-VERIFY-001 | Fixed 2026-06-12: fail-edit-repair browser regression added and passed. |
| RB-WAVE-001 | Folded into fixed RB-VERIFY-EVIDENCE-001 for the V1 Verify Evidence Workbench slice. |
| RB-HW-001 | Folded into RB-PROJECT-CC-001 for neutral no-circuit state and command center work. |

## Non-Negotiables

- Do not mix shell reset, Verify workbench, Project command center, Export handoff, Hardware, Design, lab profile, Import, Vivado proof, or commercialization work unless a direct dependency is proven.
- Do not change simulation, Verify result semantics, pin mapping semantics, VHDL, XDC, testbench, Tcl, ZIP, or project data semantics in layout-only slices.
- Do not update goldens or screenshots as a substitute for explaining behavior.
- Screenshots prove layout. Tests prove behavior. Vivado/hardware runs prove downstream handoff.
- Accounts/SaaS stay deferred until a real hosted-data or classroom-management need exists.
