---
doc_status: current
last_validated: 2026-06-12
owner: Connor Angiel
used_by_claude: true
role: navigation hub
---

# Documentation Index

**Last Updated:** 2026-06-12

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
8. `docs/STUDENT_RELEASE_READINESS.md`
9. Relevant product manual, contract, surface spec, release proof, or audit docs for the requested slice

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

**Stale zone:** `docs/00-canon/00-08-*.md`, `docs/STUDENT_WORKFLOW.md`, `docs/IMPLEMENTATION_STATUS.md`, `docs/PRODUCT_SURFACES.md`, `docs/INTERACTION_CONTRACT.md`, `docs/PROJECT_MODEL.md`, `docs/P*_SMOKE_CHECKLIST.md`. These may be useful history, but they do not override current code/tests or current docs.

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
| [audits/2026-06-12-redbyte-backbone-reconciliation.md](./audits/2026-06-12-redbyte-backbone-reconciliation.md) | Current docs/backbone reconciliation note |

---

## Release Readiness And Proof

| File | Purpose |
|------|---------|
| [STUDENT_RELEASE_READINESS.md](./STUDENT_RELEASE_READINESS.md) | Canonical TA surface: certified starter matrix, E0/E1/E2/E3 claims, safe class posture |
| [RC1_STUDENT_RELEASE_FREEZE.md](./RC1_STUDENT_RELEASE_FREEZE.md) | RC1 honest posture and TA checklist |
| [release/vivado-basys3-certification-matrix.md](./release/vivado-basys3-certification-matrix.md) | Certification matrix and dated proof links |
| [release/course-edition/08-validation-log.md](./release/course-edition/08-validation-log.md) | Course-edition validation log with visible failures and later pass records |
| [release/redbyte-bench-evidence-model.md](./release/redbyte-bench-evidence-model.md) | E0/E1/E2/E3 evidence classification model |
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
| [manuals/RedByte_Product_Manual.md](./manuals/RedByte_Product_Manual.md) | Canonical current product reference |
| [manuals/MANUAL_CLAIM_AUDIT.md](./manuals/MANUAL_CLAIM_AUDIT.md) | Claim audit against source |
| [manuals/MANUAL_TRACEABILITY_MATRIX.md](./manuals/MANUAL_TRACEABILITY_MATRIX.md) | Manual claims mapped to source |
| [manuals/MANUAL_CONFORMANCE.md](./manuals/MANUAL_CONFORMANCE.md) | Manual maintenance rules |
| [contracts/RedByte_Product_Contract.md](./contracts/RedByte_Product_Contract.md) | Target-state quality bar and product contract |
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
| [roadmap/RedByte_Gap_Audit.md](./roadmap/RedByte_Gap_Audit.md) | Historical product-legitimacy audit with current caveats added |

---

## Architecture And Current Surface Specs

| File | Purpose |
|------|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Five-layer architecture |
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

- The next technical slice is the classroom golden export SHA investigation under Node 20.19.0.
- The desktop audit ran under Node 24.15.0; treat runtime mismatch as a possible cause of SHA drift, not as a proven cause.
- Vivado 2024.2 was not found on this desktop at `C:\Xilinx\Vivado\2024.2\bin\vivado.bat`; no fresh local hardware proof should be claimed from this clone.
- `build:unified` is not a current blocker unless a fresh run reproduces a failure; later validation logs record passing build/unified checks after the old drift was fixed.

---

*Maintained by: Connor Angiel*
