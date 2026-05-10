---
doc_status: current
last_validated: 2026-05-06
owner: Connor Angiel
used_by_claude: true
role: navigation hub
---

# Documentation Index

**Last Updated:** 2026-05-06

Navigation hub for all RedByte documentation. Start with the **Active Work** section below.

---

## Truth Hierarchy

When docs conflict: code wins → active work queue → current release truth → surface specs → architecture → everything else.

**Stale zone:** `docs/00-canon/00–08-*.md`, `docs/STUDENT_WORKFLOW.md`, `docs/IMPLEMENTATION_STATUS.md`, `docs/PRODUCT_SURFACES.md`, `docs/INTERACTION_CONTRACT.md`, `docs/PROJECT_MODEL.md`, `docs/P*_SMOKE_CHECKLIST.md` — all carry explicit SUPERSEDED/HISTORICAL headers. Do not use as current context.

---

## Start Here (Active Work + Release Truth)

### [ACTIVE_WORK.md](./ACTIVE_WORK.md)
**Current priorities, in-flight work, RC1 posture.** Check this first.

### [CLAUDE.md](../CLAUDE.md)
Agent operating manual. Truth hierarchy, startup path, runtime constraints, @imports ACTIVE_WORK.md.

### [STUDENT_RELEASE_READINESS.md](./STUDENT_RELEASE_READINESS.md)
Canonical TA surface — certified starter matrix (L0/E0–E3 tiers), what is safe for class right now.

### [RC1_STUDENT_RELEASE_FREEZE.md](./RC1_STUDENT_RELEASE_FREEZE.md)
RC1 honest posture — E1 certified rows, E2/E3 status, TA closeout checklist.

---

## Product Control Pack

Compact agent-control docs for current truth, work ordering, and repo/vault sync.

| File | Purpose |
|------|---------|
| [product/RED_BYTE_CURRENT_TRUTH.md](./product/RED_BYTE_CURRENT_TRUTH.md) | Compact source hierarchy, product thesis, live blockers, and already-closed items that should not be reopened casually |
| [product/RED_BYTE_AGENT_OPERATING_RULES.md](./product/RED_BYTE_AGENT_OPERATING_RULES.md) | Canonical working rules for Claude/Copilot sessions |
| [product/RED_BYTE_WORK_QUEUE.md](./product/RED_BYTE_WORK_QUEUE.md) | Ordered near-term queue with done criteria and commit expectations |
| [product/RED_BYTE_OBSIDIAN_SYNC_RULES.md](./product/RED_BYTE_OBSIDIAN_SYNC_RULES.md) | Boundary and sync rules between repo docs and the Obsidian vault |
| [product/RED_BYTE_WORK_DRIVER.md](./product/RED_BYTE_WORK_DRIVER.md) | Local driver contract for turning the control docs and git state into bounded work packets |
| [product/RED_BYTE_LOCAL_AGENT_LAB.md](./product/RED_BYTE_LOCAL_AGENT_LAB.md) | Spec and operating guide for the Ollama-backed local agent harness (phases 0–2 live) |
| [product/RED_BYTE_OLLAMA_LOCAL_SETUP.md](./product/RED_BYTE_OLLAMA_LOCAL_SETUP.md) | Practical Windows setup and troubleshooting guide for local Ollama runtime with RedByte agent commands |
| [product/RED_BYTE_AGENT_CAPABILITY_MODEL.md](./product/RED_BYTE_AGENT_CAPABILITY_MODEL.md) | Trust and capability model defining what agents are allowed to do and how trust is earned across phases |
| [product/RED_BYTE_CURATED_LEARNING_PATH_SPEC.md](./product/RED_BYTE_CURATED_LEARNING_PATH_SPEC.md) | Curated student learning path through existing examples — curation spec, no new circuits |
| [product/RED_BYTE_OBSIDIAN_MEMORY_BRIDGE.md](./product/RED_BYTE_OBSIDIAN_MEMORY_BRIDGE.md) | Repo-local Obsidian + Ollama memory bridge operating guide for indexing, search, traceability, sync plans, and next-product context |
| [product/RED_BYTE_PRODUCT_TRACEABILITY_MODEL.md](./product/RED_BYTE_PRODUCT_TRACEABILITY_MODEL.md) | Claim-to-docs/code/tests/gates evidence model for RedByte product traceability |
| [product/RED_BYTE_AGENT_CONTROL_LOOP.md](./product/RED_BYTE_AGENT_CONTROL_LOOP.md) | Practical control-loop command layer that reconciles work-driver, memory, git history, and traceability before product work starts |
| [product/RED_BYTE_HQ_LOCAL_AGENT.md](./product/RED_BYTE_HQ_LOCAL_AGENT.md) | Standalone Marcus HQ local command-center contract, endpoint scope, tool-assisted chat modes, offline behavior, and safety boundaries |
| [product/RED_BYTE_MARCUS_SOURCE_GROUNDING.md](./product/RED_BYTE_MARCUS_SOURCE_GROUNDING.md) | Marcus source-grounding contract for structured sources, evidence level, confidence, degraded fallback labeling, and HQ display rules |
| [product/RED_BYTE_MARCUS_RUNTIME.md](./product/RED_BYTE_MARCUS_RUNTIME.md) | Marcus runtime launcher and health-recovery contract for `rb:marcus:start|status|doctor|stop`, standalone companion URL, runtime state files, and safety boundaries |
| [product/RED_BYTE_MARCUS_SYNC.md](./product/RED_BYTE_MARCUS_SYNC.md) | Repo-side Marcus Sync contract for bounded product-state packets posted to the Marcus Pi Node without cloning the repo onto the Pi |
| [product/RED_BYTE_MARCUS_AGENT_ENGINE.md](./product/RED_BYTE_MARCUS_AGENT_ENGINE.md) | Marcus Agent Engine v1 architecture, capability levels, tool registry policy, and coding-plan safety contract |
| [product/RED_BYTE_MARCUS_WORKBENCH_HISTORY.md](./product/RED_BYTE_MARCUS_WORKBENCH_HISTORY.md) | Marcus workbench history contract — packet types, field schema, storage rules, GET /packets endpoints, UI history panel, trust/safety rules |
| [product/RED_BYTE_MARCUS_SESSION_CONSOLE.md](./product/RED_BYTE_MARCUS_SESSION_CONSOLE.md) | Marcus session console contract — event types, JSONL store, GET /session/events endpoint, UI console panel rules |
| [product/RED_BYTE_MARCUS_OPERATOR_WORKBENCH.md](./product/RED_BYTE_MARCUS_OPERATOR_WORKBENCH.md) | Marcus operator workbench contract for packet detail, source preview, task queue, bench timeline, and safety boundaries |
| [product/RED_BYTE_MARCUS_CODE_INTELLIGENCE.md](./product/RED_BYTE_MARCUS_CODE_INTELLIGENCE.md) | Marcus read-only code intelligence and patch-proposal safety contract for allowlisted file search, bounded previews, and proposal-only artifacts |
| [product/RED_BYTE_PRODUCT_FEEDBACK_LOOP.md](./product/RED_BYTE_PRODUCT_FEEDBACK_LOOP.md) | Product feedback interpretation model for preserving raw intent and preventing overbuilt agent translations |
| [product/RED_BYTE_PRODUCT_PROBLEM_INTAKE.md](./product/RED_BYTE_PRODUCT_PROBLEM_INTAKE.md) | Operating guide for `rb:problem:*` intake, triage, trace, prompt, and closeout packets |
| [product/RED_BYTE_PUBLIC_START_PATH.md](./product/RED_BYTE_PUBLIC_START_PATH.md) | Public `/start.html` doorway contract for product explanation, local setup, standalone Marcus companion startup, Vivado/Basys3 boundaries, and evidence honesty |

---

## Product Manual (Canonical Product Reference)

The authoritative reference for what RedByte does today.

| File | Purpose |
|------|---------|
| [manuals/RedByte_Product_Manual.md](./manuals/RedByte_Product_Manual.md) | Canonical product reference (Markdown) |
| [manuals/RedByte_Product_Manual_print.html](./manuals/RedByte_Product_Manual_print.html) | Print-polished HTML companion |
| [manuals/RedByte_Product_Manual.pdf](./manuals/RedByte_Product_Manual.pdf) | Generated PDF (`pnpm docs:manual:pdf`) |
| [manuals/MANUAL_CLAIM_AUDIT.md](./manuals/MANUAL_CLAIM_AUDIT.md) | Fact-audit — claims verified against source |
| [manuals/MANUAL_TRACEABILITY_MATRIX.md](./manuals/MANUAL_TRACEABILITY_MATRIX.md) | 49 claims mapped to source files |
| [manuals/MANUAL_CONFORMANCE.md](./manuals/MANUAL_CONFORMANCE.md) | Rules for keeping the manual accurate |
| [manuals/assets/](./manuals/assets/) | SVG diagrams (DG-01 through DG-06) |

---

## Product Contract and Gap Audit (Target-State)

Defines what RedByte must become. Separate from the current-state manual.

| File | Purpose |
|------|---------|
| [contracts/RedByte_Product_Contract.md](./contracts/RedByte_Product_Contract.md) | Target-state blueprint — quality bar, surface contracts, release gates |
| [contracts/Sequential_Support_Boundary.md](./contracts/Sequential_Support_Boundary.md) | Enforced sequential model: single-clock, rising-edge, active-high-reset |
| [roadmap/RedByte_Gap_Audit.md](./roadmap/RedByte_Gap_Audit.md) | Honest product-legitimacy audit (14 gaps, scorecard — P0+P1 closed) |

---

## Product Hardening Governance

These docs turn surface complaints into governed work with explicit proof obligations.

| File | Purpose |
|------|---------|
| [ide/SURFACE_CONFORMANCE.md](./ide/SURFACE_CONFORMANCE.md) | Surface change -> contract, QA, and proof review rules |
| [release/redbyte-bench-evidence-model.md](./release/redbyte-bench-evidence-model.md) | Durable E0/E1/E2/E3 post-Vivado evidence model and warning-classification rules |
| [release/product-hardening-ticket-template.md](./release/product-hardening-ticket-template.md) | Canonical local ticket schema for product-legitimacy issues |
| [.github/ISSUE_TEMPLATE/product-hardening.yml](../.github/ISSUE_TEMPLATE/product-hardening.yml) | GitHub issue-form version of the hardening ticket |

---

## Architecture (Current-Truth)

| File | Purpose |
|------|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Five-layer architecture (A: logic core, B: verify engine, C: Vivado adapter, D: submission engine, E: student UX shell) |
| [STUDENT_UX_LAYER.md](./STUDENT_UX_LAYER.md) | Student-facing content rules, diagnostic language bans, pill budgets |
| [STUDENT_RELEASE_READINESS.md](./STUDENT_RELEASE_READINESS.md) | **Canonical TA surface** — certified starter matrix tiers (L0/E0–E3), what is safe for class *this week*, Vivado/board proof links |
| [RC1_STUDENT_RELEASE_FREEZE.md](./RC1_STUDENT_RELEASE_FREEZE.md) | **RC1 release freeze** — honest E1 vs E2/E3 posture; TA checklist to complete hardware proof |
| [VIVADO_INTEGRATION.md](./VIVADO_INTEGRATION.md) | Vivado export workflow, generated files, port naming |

---

## IDE Surface Specs (Current-Truth)

All in `docs/ide/`:

| File | Purpose |
|------|---------|
| [ide/00-ide-layout.md](./ide/00-ide-layout.md) | IDE layout contract — shell dimensions, modes, interaction rules |
| [ide/01-project.md](./ide/01-project.md) | Project surface spec |
| [ide/02-design.md](./ide/02-design.md) | Design surface spec |
| [ide/03-verify.md](./ide/03-verify.md) | Verify surface spec |
| [ide/04-export.md](./ide/04-export.md) | Export surface spec |
| [ide/05-import.md](./ide/05-import.md) | Import surface spec |
| [ide/ui-contract.md](./ide/ui-contract.md) | Pixel-level layout spec — shell dimensions, grid, typography |
| [ide/style-guide.md](./ide/style-guide.md) | Design tokens, CSS custom properties, component catalog |
| [ide/design-system-v1.md](./ide/design-system-v1.md) | Frozen design system contract |

---

## Canon Docs (Principles and Identity)

All in `docs/00-canon/`:

| File | Purpose | Status |
|------|---------|--------|
| [00-canon/00-project-identity.md](./00-canon/00-project-identity.md) | What RedByte is and is not | Current (principles), stale (tech details reference OS-era stack) |
| [00-canon/01-core-principles.md](./00-canon/01-core-principles.md) | 8 governing design principles | Current |
| [00-canon/07-fpga-laboratory-constitution.md](./00-canon/07-fpga-laboratory-constitution.md) | FPGA bridge vision and invariants | Aspirational — bridge not fully implemented |
| [00-canon/08-fpga-agent-bootstrap.md](./00-canon/08-fpga-agent-bootstrap.md) | Quick-reference bridge agent rules | Aspirational |

---

## Roadmap and Planning

| File | Purpose |
|------|---------|
| [roadmap/redbyte-classroom-gap-handoff.md](./roadmap/redbyte-classroom-gap-handoff.md) | Classroom readiness gap handoff |
| [roadmap/RedByte_Gap_Audit.md](./roadmap/RedByte_Gap_Audit.md) | Product-legitimacy audit |

---

## Stale / OS-Era Documents

These documents reference the older "RedByte OS" architecture (3D views, CPU modules, desktop shell). They are retained for historical reference but **do not describe the current product**.

Default agent context excludes these docs unless the task is explicitly about historical cleanup, legacy shell behavior, or archive review.

| File | Why stale |
|------|-----------|
| PRODUCT_SURFACES.md | Describes OS-era 3D surface model |
| INTERACTION_CONTRACT.md | Playground/2D/3D tripartite model, superseded by IDE |
| PROJECT_MODEL.md | OS-era data model with CPU/Signal/3D |
| ERROR_MESSAGE_MATRIX.md | OS-era error codes, not implemented |
| TROUBLESHOOTING_MATRIX.md | Mixed — build sections current, 3D/Shell/Replay sections dead |
| RB_FPGA_MVP_SPEC.md | Aspirational FPGA bridge spec, largely unbuilt |
| 00-canon/06-owners-manual.md | References OS-era code examples |

---

## Obsidian Engineering Brain

The Obsidian vault in the repo root (`01 Dashboard/` through `10 Reference/`) is the active working memory for engineering state. Entry point:

- `01 Dashboard/RedByte Engineering Brain.md` — master dashboard
- `08 Agents + Prompts/Canonical Notes Policy.md` — which notes are source of truth
- `03 Architecture/Note Schema.md` — metadata schema for all vault notes

---

## Package Documentation

The primary package under active development is `packages/rb-apps`. Other packages:

| Package | Purpose |
|---------|---------|
| `rb-logic-core` | Circuit simulation engine |
| `rb-fpga-toolchain` | VHDL/XDC generation |
| `rb-fpga-bridge` | Hardware bridge (in development) |
| `rb-primitives` | Shared UI primitives |
| `rb-tokens` | Design tokens |
| `rb-logic-view` | 2D circuit canvas |

---

*Maintained by: Connor Angiel + Claude agents*
