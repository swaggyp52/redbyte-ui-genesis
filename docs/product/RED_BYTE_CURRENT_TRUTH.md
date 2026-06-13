---
doc_status: current
last_validated: 2026-06-13
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
| V1 research and audit | `docs/research/RED_BYTE_COMPETITIVE_AND_WORKFLOW_RESEARCH.md`, `docs/audits/2026-06-13-redbyte-v1-contract-reset-visual-audit.md` | Why the V1 reset exists and what the current UI evidence shows. |
| V1 execution/inventory | `docs/plans/RED_BYTE_V1_EXECUTION_PROGRAM.md`, `docs/plans/RED_BYTE_DELETE_DEMOTE_REBUILD_INVENTORY.md` | Implementation order and delete/demote/rebuild decisions. |
| Product-brain routing | `docs/product/RED_BYTE_PRODUCT_BRAIN_ARCHITECTURE.md` | How current, target, proof, audit, and stale docs should be used. |
| Current release truth | `docs/STUDENT_RELEASE_READINESS.md`, `docs/release/**` | Safe public, TA, and hardware claims. |
| Current product behavior | `docs/manuals/RedByte_Product_Manual.md` | What the product does today. |
| Older target contract | `docs/contracts/RedByte_Product_Contract.md` | Historical/broader target standard; do not let it override the V1 reset queue. |
| Lab profile target model | `docs/product/RED_BYTE_LAB_PROFILE_MODEL.md` | Target architecture boundary for course packs; now queue item 8. |
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

### Product immersion posture

- Project, Hardware, and Export are materially stronger than earlier audits, but the V1 workbench hierarchy is still not done.
- Design still fails the V1 target at `1366x768`: the loaded circuit graph is not the first-viewport focal object.
- Verify behavior is credible and fail-edit-repair is covered, but the evidence workbench remains dense.
- Export distinguishes draft versus E0-ready states, but the current screenshot evidence shows a mapping-summary contradiction risk: `5/5 mapped` can coexist with "No required board I/O for this export."
- Hardware / Map Pins shows board/table mapping well, but hardware-ready wording must stay E0-scoped and not imply E1/E2/E3.

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
- General blank-project workflow proof is covered by `ide:gate:from-scratch-general-workflow`.
- Old `build:unified` route/lock drift is resolved unless a fresh run reproduces failure.

## 6. Default Next Move

Approved V1 order:

1. V1 Contract Reset.
2. Shell and Workbench Layout Reset.
3. Verify Evidence Workbench.
4. Project Command Center.
5. Export Handoff Station.
6. Hardware / Basys3 Workbench.
7. Design Workbench.
8. Lab Profile / Course Pack Data Seam.
9. Import / Recovery.
10. Student/Instructor Quickstarts.
11. Vivado/Basys3 Proof Restoration.
12. Packaging/Commercial Readiness.

The next code slice after this docs/control reset is:

```text
fix: reset RedByte workbench shell layout
```

Do not skip to lab-profile extraction, website, pilot, broad polish, accounts/SaaS, Vivado proof, or commercial packaging unless the user explicitly reprioritizes.
