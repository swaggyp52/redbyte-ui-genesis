---
doc_status: current
last_validated: 2026-06-22
owner: Connor Angiel
used_by_claude: true
role: navigation hub
---

# Documentation Index

**Last Updated:** 2026-06-22

Navigation hub for current RedByte documentation. Start with the startup order below, then follow the task-specific sections.

---

## Startup Reading Order

For a normal agent session:

1. `AGENTS.md`
2. `AI_STATE.md`
3. `CLAUDE.md`
4. `docs/ACTIVE_WORK.md`
5. `docs/DOC_INDEX.md`
6. `docs/product/RED_BYTE_CURRENT_TRUTH.md`
7. `docs/product/RED_BYTE_WORK_QUEUE.md`
8. `docs/contracts/RED_BYTE_V1_PRODUCT_CONTRACT.md`
9. For Product Trust Reset v2 work: `docs/product/RED_BYTE_STUDENT_UI_CONTRACT_V2.md`, `docs/contracts/RED_BYTE_VERIFY_TRUTH_MODEL_V2.md`, `docs/architecture/ADR_VERIFY_STATE_ORCHESTRATION.md`, `docs/architecture/RED_BYTE_VERIFY_RUNTIME_INTEGRATION_V2.md`, `docs/architecture/RED_BYTE_PROJECT_DURABILITY_MODEL.md`, `docs/architecture/ADR_PROJECT_DURABILITY_STORAGE.md`, `docs/architecture/RED_BYTE_WORKSPACE_LAYOUT_V2.md`, and `docs/architecture/RED_BYTE_VISUAL_SYSTEM_V2.md`
10. `docs/architecture/RED_BYTE_UNDER_THE_HOOD_MAP.md`
11. `docs/architecture/RED_BYTE_STATE_AUTHORITY_MATRIX.md`
12. `docs/architecture/RED_BYTE_INVARIANT_MATRIX.md`
13. `docs/product/RED_BYTE_PRODUCT_BRAIN_ARCHITECTURE.md`
14. `docs/STUDENT_RELEASE_READINESS.md`
15. Relevant product manual, contract, surface spec, release proof, audit, or issue-index docs for the requested slice

For docs-only work, prefer `corepack pnpm rb:doc:validate` and `corepack pnpm rb:encoding:check`. For app/source/gate work, follow the proof obligations in the relevant surface and release docs.

---

## Truth Hierarchy

When docs conflict:

1. Code and focused tests
2. `AGENTS.md` and `AI_STATE.md`
3. `docs/ACTIVE_WORK.md`
4. `docs/product/RED_BYTE_CURRENT_TRUTH.md` and `docs/product/RED_BYTE_WORK_QUEUE.md`
5. `docs/STUDENT_RELEASE_READINESS.md` and tracked release proof docs
6. Current product manual and product contract
7. Current IDE surface specs and architecture docs
8. Historical / aspirational docs

**Stale zone:** `docs/00-canon/00-08-*.md`, `docs/STUDENT_WORKFLOW.md`, `docs/IMPLEMENTATION_STATUS.md`, `docs/PRODUCT_SURFACES.md`, `docs/INTERACTION_CONTRACT.md`, `docs/PROJECT_MODEL.md`, `docs/P*_SMOKE_CHECKLIST.md`, legacy root quickstarts such as `docs/INSTRUCTOR_QUICKSTART.md`, `docs/TA_QUICKSTART.md`, and `docs/TA_VIVADO_HANDOFF_ONE_PAGE.md`. These may be useful history, but they do not override current code/tests or current docs.

`docs/00-canon/07-fpga-laboratory-constitution.md` and `docs/00-canon/08-fpga-agent-bootstrap.md` are background / aspirational unless a future edit marks a section current. This resolves the old contradiction between "read 00-canon/08" and "ignore 00-canon/00-08": read them only for historical or aspirational context, not as current product truth.

---

## Current State And Work Control

| File | Purpose |
|------|---------|
| [ACTIVE_WORK.md](./ACTIVE_WORK.md) | Current cockpit: branch posture, top priorities, blockers, latest proof, next target |
| [../AI_STATE.md](../AI_STATE.md) | Latest repo posture and factual change history |
| [../CLAUDE.md](../CLAUDE.md) | Agent operating manual |
| [product/RED_BYTE_CURRENT_TRUTH.md](./product/RED_BYTE_CURRENT_TRUTH.md) | Compact source hierarchy, product thesis, current risks, closed items |
| [product/RED_BYTE_WORK_QUEUE.md](./product/RED_BYTE_WORK_QUEUE.md) | Ordered near-term work queue |
| [product/RED_BYTE_STUDENT_UI_CONTRACT_V2.md](./product/RED_BYTE_STUDENT_UI_CONTRACT_V2.md) | Product Trust Reset v2 student-facing UI language, diagnostics boundary, no-internal-proof-language, no-generic-rails, and card-use contract |
| [contracts/RED_BYTE_VERIFY_TRUTH_MODEL_V2.md](./contracts/RED_BYTE_VERIFY_TRUTH_MODEL_V2.md) | Product Trust Reset v2 Verify truth model for observed, expected, course checks, My checks, stale, PASS/FAIL, and repair |
| [architecture/ADR_VERIFY_STATE_ORCHESTRATION.md](./architecture/ADR_VERIFY_STATE_ORCHESTRATION.md) | Product Trust Reset v2 Verify statechart decision and integration plan |
| [architecture/RED_BYTE_VERIFY_RUNTIME_INTEGRATION_V2.md](./architecture/RED_BYTE_VERIFY_RUNTIME_INTEGRATION_V2.md) | Product Trust Reset v2 Verify runtime adapter, selector boundary, and source-level proof |
| [architecture/RED_BYTE_PROJECT_DURABILITY_MODEL.md](./architecture/RED_BYTE_PROJECT_DURABILITY_MODEL.md) | Classroom project durability model, current storage authorities, source authority gate, compatibility writers, and target reliability guarantee |
| [architecture/ADR_PROJECT_DURABILITY_STORAGE.md](./architecture/ADR_PROJECT_DURABILITY_STORAGE.md) | Project storage durability ADR and rejected storage-migration alternatives |
| [architecture/RED_BYTE_WORKSPACE_LAYOUT_V2.md](./architecture/RED_BYTE_WORKSPACE_LAYOUT_V2.md) | Product Trust Reset v2 deterministic workspace layout contract |
| [architecture/RED_BYTE_VISUAL_SYSTEM_V2.md](./architecture/RED_BYTE_VISUAL_SYSTEM_V2.md) | Product Trust Reset v2 visual token and surface-level direction |
| [contracts/RED_BYTE_V1_PRODUCT_CONTRACT.md](./contracts/RED_BYTE_V1_PRODUCT_CONTRACT.md) | Active V1 product contract reset and work order |
| [architecture/RED_BYTE_UNDER_THE_HOOD_MAP.md](./architecture/RED_BYTE_UNDER_THE_HOOD_MAP.md) | Source-level subsystem, state, proof, and risk map |
| [architecture/RED_BYTE_STATE_AUTHORITY_MATRIX.md](./architecture/RED_BYTE_STATE_AUTHORITY_MATRIX.md) | Canonical state owners, mirrors, invalidation, persistence, and proof |
| [architecture/RED_BYTE_INVARIANT_MATRIX.md](./architecture/RED_BYTE_INVARIANT_MATRIX.md) | Product invariants, existing proof, missing proof, and gate ownership |
| [research/RED_BYTE_COMPETITIVE_AND_WORKFLOW_RESEARCH.md](./research/RED_BYTE_COMPETITIVE_AND_WORKFLOW_RESEARCH.md) | Primary-source competitive/workflow research for V1 |
| [audits/2026-06-13-redbyte-normal-use-breakage-audit.md](./audits/2026-06-13-redbyte-normal-use-breakage-audit.md) | Current normal-use breakage audit and deferred findings |
| [audits/2026-06-13-redbyte-v1-contract-reset-visual-audit.md](./audits/2026-06-13-redbyte-v1-contract-reset-visual-audit.md) | Current-HEAD screenshot-backed V1 visual audit |
| [plans/RED_BYTE_DELETE_DEMOTE_REBUILD_INVENTORY.md](./plans/RED_BYTE_DELETE_DEMOTE_REBUILD_INVENTORY.md) | V1 delete/demote/rebuild inventory |
| [plans/RED_BYTE_V1_EXECUTION_PROGRAM.md](./plans/RED_BYTE_V1_EXECUTION_PROGRAM.md) | Ordered V1 execution program |
| [product/RED_BYTE_PRODUCT_BRAIN_ARCHITECTURE.md](./product/RED_BYTE_PRODUCT_BRAIN_ARCHITECTURE.md) | Product-brain routing map for current, target, proof, audit, and stale docs |
| [product/RED_BYTE_LAB_PROFILE_MODEL.md](./product/RED_BYTE_LAB_PROFILE_MODEL.md) | Target lab-profile and course-pack architecture model |
| [product/RED_BYTE_COMMERCIALIZATION_READINESS.md](./product/RED_BYTE_COMMERCIALIZATION_READINESS.md) | Current commercial readiness boundary and deployment/support posture |
| [course/STUDENT_QUICKSTART.md](./course/STUDENT_QUICKSTART.md) | Current student first-lab quickstart |
| [course/INSTRUCTOR_QUICKSTART.md](./course/INSTRUCTOR_QUICKSTART.md) | Current instructor setup, assignment, and proof-tier quickstart |
| [course/TA_TROUBLESHOOTING_GUIDE.md](./course/TA_TROUBLESHOOTING_GUIDE.md) | Current TA troubleshooting and support triage guide |
| [course/windows-quickstart.md](./course/windows-quickstart.md) | Windows course setup, launch, doctor, update, and reset scripts |
| [audits/2026-06-12-redbyte-backbone-reconciliation.md](./audits/2026-06-12-redbyte-backbone-reconciliation.md) | Current docs/backbone reconciliation note |
| [audits/2026-06-12-redbyte-whole-app-product-immersion-audit.md](./audits/2026-06-12-redbyte-whole-app-product-immersion-audit.md) | Current whole-app student/product UX baseline |
| [audits/2026-06-12-redbyte-general-lab-workbench-audit.md](./audits/2026-06-12-redbyte-general-lab-workbench-audit.md) | General lab workbench, hardcoded-assumption, and gate-truth audit |
| [audits/2026-06-12-redbyte-visual-product-direction-audit.md](./audits/2026-06-12-redbyte-visual-product-direction-audit.md) | Browser-backed visual direction baseline after first-viewport repair |
| [audits/2026-06-12-redbyte-visual-system-integrity-audit.md](./audits/2026-06-12-redbyte-visual-system-integrity-audit.md) | Latest visual-system integrity sprint evidence and after-proof |
| [audits/2026-06-12-redbyte-feature-inventory.md](./audits/2026-06-12-redbyte-feature-inventory.md) | Feature and visible-control inventory from product immersion |
| [audits/2026-06-12-redbyte-ui-architecture-inventory.md](./audits/2026-06-12-redbyte-ui-architecture-inventory.md) | UI styling and surface architecture inventory for visual hardening |
| [plans/2026-06-12-redbyte-product-issue-index.md](./plans/2026-06-12-redbyte-product-issue-index.md) | Compact actionable product issue index |
| [plans/2026-06-12-redbyte-product-hardening-roadmap.md](./plans/2026-06-12-redbyte-product-hardening-roadmap.md) | Sequenced product-hardening roadmap |
| [plans/2026-06-12-redbyte-visual-design-hardening-plan.md](./plans/2026-06-12-redbyte-visual-design-hardening-plan.md) | Course Lab Workbench visual hardening sequence |
| [development/RED_BYTE_LOCAL_DEV_SERVER.md](./development/RED_BYTE_LOCAL_DEV_SERVER.md) | Current local dev server startup and pnpm/Corepack caveats |
| [development/RED_BYTE_TEST_AND_GATE_OWNERSHIP.md](./development/RED_BYTE_TEST_AND_GATE_OWNERSHIP.md) | Test/gate ownership and invariant proof routing |
| [development/RED_BYTE_GITHUB_OPERATIONS.md](./development/RED_BYTE_GITHUB_OPERATIONS.md) | GitHub Actions, required checks, safe push, and remote-green verification playbook |

---

## Release Readiness And Proof

| File | Purpose |
|------|---------|
| [STUDENT_RELEASE_READINESS.md](./STUDENT_RELEASE_READINESS.md) | Canonical TA surface: certified starter matrix, E0/E1/E2/E3 claims, safe class posture |
| [RC1_STUDENT_RELEASE_FREEZE.md](./RC1_STUDENT_RELEASE_FREEZE.md) | RC1 honest posture and TA checklist |
| [product/RED_BYTE_BROWSER_E0_RELEASE_PROOF.md](./product/RED_BYTE_BROWSER_E0_RELEASE_PROOF.md) | Current browser E0 proof package, pinned Node status, final-SHA rules, and no-hardware boundary |
| [product/RED_BYTE_BROWSER_E0_PACKAGING_CHECKLIST.md](./product/RED_BYTE_BROWSER_E0_PACKAGING_CHECKLIST.md) | Browser E0 package/demo checklist, release/deploy SHA rules, blockers, and no-overclaim language |
| [release/vivado-basys3-certification-matrix.md](./release/vivado-basys3-certification-matrix.md) | Certification matrix and dated proof links |
| [release/course-edition/08-validation-log.md](./release/course-edition/08-validation-log.md) | Course-edition validation log with visible failures and later pass records |
| [release/redbyte-bench-evidence-model.md](./release/redbyte-bench-evidence-model.md) | E0/E1/E2/E3 evidence classification model |
| [release/RED_BYTE_PR78_MERGE_READINESS.md](./release/RED_BYTE_PR78_MERGE_READINESS.md) | Draft PR #78 Phase 3I branch review, blockers, and readiness decision |
| [release/RED_BYTE_PR78_PERFORMANCE_REVIEW.md](./release/RED_BYTE_PR78_PERFORMANCE_REVIEW.md) | Draft PR #78 performance/resource review |
| [release/RED_BYTE_PR78_SECURITY_PRIVACY_REVIEW.md](./release/RED_BYTE_PR78_SECURITY_PRIVACY_REVIEW.md) | Draft PR #78 security/privacy review |
| [release/proof/](./release/proof/) | Tracked proof notes |
| [release/vivado-basys3-bench-intelligence-2026-05-05.md](./release/vivado-basys3-bench-intelligence-2026-05-05.md) | Prior Vivado/Basys3 bench intelligence summary |

### Tracked Proof vs Generated Proof

Tracked proof docs under `docs/release/**` and `docs/STUDENT_RELEASE_READINESS.md` are portable and should be trusted as proof history unless newer evidence supersedes them.

Generated proof packs are local/ignored and may be absent in a clean clone:

- `.redbyte/bench/runs/**`
- `out/vivado-cert/**`
- `dist/**`
- `test-results/**`
- `playwright-report/**`

If a tracked doc references a generated pack that is missing locally, do not treat that as a contradiction. Regenerate the raw pack only when the approved slice needs it.

---

## Product Manual And Contract

| File | Purpose |
|------|---------|
| [course/STUDENT_QUICKSTART.md](./course/STUDENT_QUICKSTART.md) | Current student first-lab quickstart for Project -> Design -> Verify -> Map Pins -> Export |
| [course/INSTRUCTOR_QUICKSTART.md](./course/INSTRUCTOR_QUICKSTART.md) | Current instructor setup/support quickstart and proof-tier boundary |
| [course/TA_TROUBLESHOOTING_GUIDE.md](./course/TA_TROUBLESHOOTING_GUIDE.md) | Current TA triage guide for setup, RedByte surfaces, Vivado, board, and Import |
| [course/windows-quickstart.md](./course/windows-quickstart.md) | Current Windows course launcher and doctor reference |
| [manuals/RedByte_Product_Manual.md](./manuals/RedByte_Product_Manual.md) | Canonical current product reference |
| [contracts/RED_BYTE_V1_PRODUCT_CONTRACT.md](./contracts/RED_BYTE_V1_PRODUCT_CONTRACT.md) | Active V1 target contract and execution order |
| [product/RED_BYTE_LAB_PROFILE_MODEL.md](./product/RED_BYTE_LAB_PROFILE_MODEL.md) | Target model for professor-authored labs, course packs, and from-scratch student projects |
| [manuals/MANUAL_CLAIM_AUDIT.md](./manuals/MANUAL_CLAIM_AUDIT.md) | Claim audit against source |
| [manuals/MANUAL_TRACEABILITY_MATRIX.md](./manuals/MANUAL_TRACEABILITY_MATRIX.md) | Manual claims mapped to source |
| [manuals/MANUAL_CONFORMANCE.md](./manuals/MANUAL_CONFORMANCE.md) | Manual maintenance rules |
| [contracts/RedByte_Product_Contract.md](./contracts/RedByte_Product_Contract.md) | Older broad target-state quality bar; do not let it override the active V1 reset queue |
| [contracts/Sequential_Support_Boundary.md](./contracts/Sequential_Support_Boundary.md) | Enforced single-clock sequential support boundary |

The manual describes current behavior. The contract describes target-state obligations. Do not promote target-state text into current-state claims without proof.

---

## Product Hardening Governance

| File | Purpose |
|------|---------|
| [IDE_SYSTEM_MAP.md](./IDE_SYSTEM_MAP.md) | Product/system surface map |
| [ide/SURFACE_CONFORMANCE.md](./ide/SURFACE_CONFORMANCE.md) | Surface-change proof and conformance rules |
| [release/product-hardening-ticket-template.md](./release/product-hardening-ticket-template.md) | Local product-hardening ticket schema |
| [.github/ISSUE_TEMPLATE/product-hardening.yml](../.github/ISSUE_TEMPLATE/product-hardening.yml) | GitHub issue-form version of the hardening ticket |
| [architecture/RED_BYTE_UNDER_THE_HOOD_MAP.md](./architecture/RED_BYTE_UNDER_THE_HOOD_MAP.md) | Source-level map for RedByte subsystem ownership |
| [architecture/RED_BYTE_STATE_AUTHORITY_MATRIX.md](./architecture/RED_BYTE_STATE_AUTHORITY_MATRIX.md) | State authority matrix for project, graph, Verify, mapping, Export, Import, and proof tiers |
| [architecture/RED_BYTE_INVARIANT_MATRIX.md](./architecture/RED_BYTE_INVARIANT_MATRIX.md) | Invariant matrix and missing-gate routing |
| [architecture/ADR_VERIFY_STATE_ORCHESTRATION.md](./architecture/ADR_VERIFY_STATE_ORCHESTRATION.md) | Verify truth-state orchestration ADR |
| [architecture/RED_BYTE_VERIFY_RUNTIME_INTEGRATION_V2.md](./architecture/RED_BYTE_VERIFY_RUNTIME_INTEGRATION_V2.md) | Verify truth runtime adapter and Project/Export selector boundary |
| [architecture/RED_BYTE_PROJECT_DURABILITY_MODEL.md](./architecture/RED_BYTE_PROJECT_DURABILITY_MODEL.md) | Classroom durability and local persistence model |
| [architecture/ADR_PROJECT_DURABILITY_STORAGE.md](./architecture/ADR_PROJECT_DURABILITY_STORAGE.md) | Storage durability ADR |
| [development/RED_BYTE_TEST_AND_GATE_OWNERSHIP.md](./development/RED_BYTE_TEST_AND_GATE_OWNERSHIP.md) | Gate ownership, proof layer selection, and closeout rules |
| [plans/2026-06-12-redbyte-product-issue-index.md](./plans/2026-06-12-redbyte-product-issue-index.md) | Compact issue routing extracted from the current whole-app audit |
| [contracts/RED_BYTE_V1_PRODUCT_CONTRACT.md](./contracts/RED_BYTE_V1_PRODUCT_CONTRACT.md) | Active V1 product contract reset |
| [research/RED_BYTE_COMPETITIVE_AND_WORKFLOW_RESEARCH.md](./research/RED_BYTE_COMPETITIVE_AND_WORKFLOW_RESEARCH.md) | V1 research basis |
| [audits/2026-06-13-redbyte-v1-contract-reset-visual-audit.md](./audits/2026-06-13-redbyte-v1-contract-reset-visual-audit.md) | V1 visual audit and next hardening-ticket translation |
| [plans/RED_BYTE_DELETE_DEMOTE_REBUILD_INVENTORY.md](./plans/RED_BYTE_DELETE_DEMOTE_REBUILD_INVENTORY.md) | V1 delete/demote/rebuild control layer |
| [plans/RED_BYTE_V1_EXECUTION_PROGRAM.md](./plans/RED_BYTE_V1_EXECUTION_PROGRAM.md) | V1 phase program and acceptance proof |
| [plans/2026-06-12-redbyte-product-hardening-roadmap.md](./plans/2026-06-12-redbyte-product-hardening-roadmap.md) | Ordered implementation/proof roadmap derived from product immersion |
| [audits/2026-06-12-redbyte-visual-product-direction-audit.md](./audits/2026-06-12-redbyte-visual-product-direction-audit.md) | Browser-backed visual direction baseline and top visual issues |
| [audits/2026-06-12-redbyte-ui-architecture-inventory.md](./audits/2026-06-12-redbyte-ui-architecture-inventory.md) | Styling architecture inventory and design-system refactor risks |
| [plans/2026-06-12-redbyte-visual-design-hardening-plan.md](./plans/2026-06-12-redbyte-visual-design-hardening-plan.md) | Visual hardening phases and proof obligations |
| [audits/2026-06-12-redbyte-general-lab-workbench-audit.md](./audits/2026-06-12-redbyte-general-lab-workbench-audit.md) | Gate-truth and general lab workbench audit |
| [roadmap/RedByte_Gap_Audit.md](./roadmap/RedByte_Gap_Audit.md) | Historical product-legitimacy audit with current caveats added |

---

## Architecture And Current Surface Specs

| File | Purpose |
|------|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Five-layer architecture |
| [architecture/RED_BYTE_UNDER_THE_HOOD_MAP.md](./architecture/RED_BYTE_UNDER_THE_HOOD_MAP.md) | Source-level RedByte subsystem map |
| [architecture/RED_BYTE_STATE_AUTHORITY_MATRIX.md](./architecture/RED_BYTE_STATE_AUTHORITY_MATRIX.md) | Canonical state authority matrix |
| [architecture/RED_BYTE_INVARIANT_MATRIX.md](./architecture/RED_BYTE_INVARIANT_MATRIX.md) | Invariant and proof coverage matrix |
| [STUDENT_UX_LAYER.md](./STUDENT_UX_LAYER.md) | Student-facing content and diagnostic language rules |
| [VIVADO_INTEGRATION.md](./VIVADO_INTEGRATION.md) | Vivado export workflow and generated file expectations |
| [ide/00-ide-layout.md](./ide/00-ide-layout.md) | IDE layout contract |
| [ide/01-project.md](./ide/01-project.md) | Project surface spec |
| [ide/02-design.md](./ide/02-design.md) | Design surface spec |
| [ide/03-verify.md](./ide/03-verify.md) | Verify surface spec |
| [ide/04-export.md](./ide/04-export.md) | Export surface spec |
| [ide/05-import.md](./ide/05-import.md) | Import surface spec |
| [ide/ui-contract.md](./ide/ui-contract.md) | Pixel-level UI contract |
| [ide/style-guide.md](./ide/style-guide.md) | Design tokens and component catalog |
| [ide/design-system-v1.md](./ide/design-system-v1.md) | Frozen design system contract |

---

## Canon Docs

All in `docs/00-canon/`:

| File | Purpose | Status |
|------|---------|--------|
| [00-canon/00-project-identity.md](./00-canon/00-project-identity.md) | Identity and principles | Current for principles only; stale for OS-era details |
| [00-canon/01-core-principles.md](./00-canon/01-core-principles.md) | Governing design principles | Current principles |
| [00-canon/07-fpga-laboratory-constitution.md](./00-canon/07-fpga-laboratory-constitution.md) | FPGA bridge vision and invariants | Aspirational/background |
| [00-canon/08-fpga-agent-bootstrap.md](./00-canon/08-fpga-agent-bootstrap.md) | FPGA agent quick reference | Aspirational/background |

Do not use canon docs to override current code, tests, `AI_STATE.md`, `docs/ACTIVE_WORK.md`, or current product/release docs.

---

## Package Documentation

The primary package under active development is `packages/rb-apps`. Other packages:

| Package | Purpose |
|---------|---------|
| `rb-logic-core` | Circuit simulation engine |
| `rb-fpga-toolchain` | VHDL/XDC generation |
| `rb-fpga-bridge` | Hardware bridge package, not a shipped browser replacement for Vivado |
| `rb-primitives` | Shared UI primitives |
| `rb-tokens` | Design tokens |
| `rb-logic-view` | 2D circuit canvas |

---

## Current Known Risk Snapshot

- The 2026-06-13 Under-the-Hood Mastery Sprint is the current source/state/proof control layer. Use the architecture map, state authority matrix, invariant matrix, normal-use breakage audit, and test/gate ownership doc before touching a stateful product path.
- The 2026-06-13 V1 product contract reset remains the active near-term product route. Use `docs/contracts/RED_BYTE_V1_PRODUCT_CONTRACT.md`, the V1 visual audit, and the V1 execution program before starting new product code.
- The normal-use breakage audit found Export artifact preview visibility and Import utility-access ambiguity; both are now closed by `ide:gate:export-trust-integrity`, `ide:gate:export-handoff-station`, and `ide:gate:import-recovery-contract`.
- The 2026-06-12 whole-app product immersion audit remains historical baseline input, and the 2026-06-13 V1 visual audit is the current screenshot-backed reset evidence.
- The 2026-06-12 general lab workbench audit is the current gate-truth and platform-generalization baseline. It proves only E0 browser/runtime behavior for a small blank AND workflow, not Vivado or hardware behavior.
- The user explicitly reprioritized visual stewardship on 2026-06-12; keep visual work scoped to the ordered V1 queue rather than broad polish.
- Verify fail-edit-repair is covered by `ide:gate:verify-fail-edit-repair`, Verify Evidence Workbench is covered by `ide:gate:verify-evidence-workbench-integrity`, the first lab-profile/course-pack seam is covered by `lab:profile-contract`, and current student/instructor/TA quickstarts live under `docs/course/`. The next implementation slice is Vivado/Basys3 Proof Restoration.
- Tests passing is evidence, not product readiness; use browser workflows, visual inspection, and hardware/Vivado proof for the claims they actually prove.
- Node 20.19.0 proof now passes through a checksum-verified portable runtime under ignored `.redbyte/tools/`; the default shell still reports Node 24.15.0 / pnpm 10.24.0.
- Vivado 2024.2 was not found on this desktop at `C:\Xilinx\Vivado\2024.2\bin\vivado.bat`; no fresh local hardware proof should be claimed from this clone.
- RedByte is not commercially ready for unsupervised paid classroom use; accounts/SaaS remain deferred until a concrete hosted-data or classroom-management need exists.
- `build:unified` is not a current blocker unless a fresh run reproduces a failure; later validation logs record passing build/unified checks after the old drift was fixed.

---

*Maintained by: Connor Angiel*
