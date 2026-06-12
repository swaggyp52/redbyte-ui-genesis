---
doc_status: current
last_validated: 2026-06-12
owner: Connor Angiel
used_by_claude: true
role: compact current-truth control layer for RedByte product and agent sessions
---

# RedByte Current Truth

Use this doc to stop source drift before work starts. It is a control layer, not a new product spec.

---

## 1. Source Hierarchy

| Truth type | Canonical owner | How to use it |
|---|---|---|
| Runtime truth | Code + focused tests | Code wins if docs lag. |
| Agent startup and latest repo posture | `AGENTS.md`, `AI_STATE.md`, `CLAUDE.md` | Read first. `AI_STATE.md` wins over prior prompt context. |
| Current priorities | `docs/ACTIVE_WORK.md` | Cockpit for what should happen next. |
| Ordered work | `docs/product/RED_BYTE_WORK_QUEUE.md` | Near-term queue for agents and maintainers. |
| Product-brain routing | `docs/product/RED_BYTE_PRODUCT_BRAIN_ARCHITECTURE.md` | How current, target, proof, audit, and stale docs should be used. |
| Current release truth | `docs/STUDENT_RELEASE_READINESS.md`, `docs/release/**` | Safe public, TA, and hardware claims. |
| Current product behavior | `docs/manuals/RedByte_Product_Manual.md` | What the product does today. |
| Target truth | `docs/contracts/RedByte_Product_Contract.md` | Quality bar and target promise. Do not treat as shipped behavior. |
| UX debt ordering | `docs/RED_BYTE_IDE_PRODUCT_FLOW_MODEL.md`, `docs/IDE_PRODUCT_DEBT_REGISTER.md` | Ordered product follow-ups, not permission for broad redesign. |
| Current product UX baseline | `docs/audits/2026-06-12-redbyte-whole-app-product-immersion-audit.md`, `docs/plans/2026-06-12-redbyte-product-issue-index.md` | Dated whole-app evidence and compact issue routing. |
| Current visual direction baseline | `docs/audits/2026-06-12-redbyte-visual-product-direction-audit.md`, `docs/audits/2026-06-12-redbyte-visual-system-integrity-audit.md`, `docs/audits/2026-06-12-redbyte-ui-architecture-inventory.md`, `docs/plans/2026-06-12-redbyte-visual-design-hardening-plan.md` | Browser-backed visual baseline, latest visual integrity proof, and Course Lab Workbench hardening path. |
| Historical audit | `docs/roadmap/RedByte_Gap_Audit.md` | Closure history and remaining audit context. |
| Background / stale | `docs/00-canon/**` unless explicitly current, `PRODUCT.md` if it conflicts, and the stale zone in `docs/DOC_INDEX.md` | Do not use as default context for current product work. |

Practical read order for a normal session:

1. `AGENTS.md`
2. `AI_STATE.md`
3. `CLAUDE.md`
4. `docs/ACTIVE_WORK.md`
5. `docs/product/RED_BYTE_CURRENT_TRUTH.md`
6. `docs/product/RED_BYTE_WORK_QUEUE.md`
7. `docs/STUDENT_RELEASE_READINESS.md`
8. Relevant manual, contract, surface spec, and release proof docs

---

## 2. Current Product Thesis

RedByte is a deterministic, browser-based FPGA educational IDE for the Digilent Basys3 board.

Its promise is narrow and real:

- students design a circuit visually
- students prove behavior in Verify with authored stimulus and Compare checks
- students map signals to real Basys3 resources
- students export a Vivado-ready package that matches what the IDE proved

RedByte is not a Vivado replacement, not a general-purpose HDL IDE, and not a broad FPGA platform. Vivado remains downstream for synthesis, implementation, bitstream generation, and board programming.

---

## 3. Current UX Spine

The active workflow spine is:

`Project -> Design -> Verify -> Map Pins / Hardware -> Export`

Supporting truths:

- Import is a utility entry point, not a main workflow step.
- Trusted Export requires current Compare PASS, current mapping, and a current export bundle for the same project state.
- Draft Export is allowed when the project is structurally exportable but trusted proof is missing or stale.
- Board programming and board observation are external proof tiers after Export.

---

## 4. Current Known Risks

### Golden export SHA gate posture

- The desktop audit found two failing classroom golden ZIP SHA gates under Node 24.15.0 and pnpm 10.24.0.
- The 2026-06-12 investigation reproduced both failures twice with stable actual hashes, traced the drift to the intended README evidence-boundary section added in `4bced313`, and re-blessed the two committed SHA fixture files.
- The old expected SHAs were reproduced exactly by rebuilding each ZIP in memory with only that README section removed.
- The repo-pinned Node version remains 20.19.0 in `.nvmrc`, but no local Node version manager was available during the investigation. The root cause is source-explained rather than runtime-random.
- The two classroom golden gates now pass under the available Node 24.15.0 runtime.

### Vivado/Basys3 proof posture

- The audit did not run fresh Vivado or hardware proof on this desktop because `C:\Xilinx\Vivado\2024.2\bin\vivado.bat` was not found.
- Prior tracked proof docs remain proof history, but this clone cannot claim new E1/E2/E3 evidence without a Vivado/hardware run.
- E3 claims still require physical observation notes, not programming logs alone.

### Generated proof packs

- Tracked proof docs under `docs/release/**` and `docs/STUDENT_RELEASE_READINESS.md` are portable.
- Raw proof packs under `.redbyte/bench/runs/**`, `out/vivado-cert/**`, `dist/**`, `test-results/**`, and `playwright-report/**` are generated/local and may be absent in a clean clone.

### Product immersion posture

- The 2026-06-12 whole-app product immersion audit is the current student/product UX baseline.
- The 2026-06-12 visual product direction audit is the current browser-backed visual baseline after the first-viewport repair.
- The audit made no application source, test, golden, or product behavior changes.
- The first-viewport repair slice is implemented: Project, Design, Hardware/Map Pins, and Export now expose the core action/work area at 1366x768, and the Export rail no longer says Draft when the current state is ready to build.
- The repair was layout/hierarchy/copy only. It did not change simulation, export generation, VHDL, XDC, TCL, project data semantics, goldens, or Vivado/Basys3 proof.
- The Hardware / Map Pins visual credibility slice is implemented: the left guide no longer wraps copy word-by-word, the board/table remain the focal workbench, and `ide:gate:ece141-hardware-visual-credibility` guards the 1366x768 geometry. Before/after local artifacts live under `.redbyte/product-immersion/hardware-visual-credibility/`.
- The Hardware visual slice did not change pin mapping semantics, XDC generation, VHDL/testbench/Tcl export, project data format, goldens, Vivado proof, or Basys3 proof.
- The visual-system integrity slice is implemented: Export handoff/evidence/action content is visible in the first viewport, Draft Export no longer claims ready-to-build, Verify command/header overflow is removed, expected-output cells remain editable in the compact workbench, and `ide:gate:ece141-visual-system-integrity` guards the cross-surface geometry. Before/after local artifacts live under `.redbyte/product-immersion/visual-system-integrity/`.
- The visual-system integrity slice did not change simulation semantics, Verify result semantics, pin mapping semantics, VHDL/XDC/testbench/Tcl/ZIP generation, project data format, goldens, Vivado proof, or Basys3 proof.
- The current visual direction is Course Lab Workbench: serious circuit/proof/board/export artifacts, calm density, consistent trust-state grammar, and no generic SaaS or toy simulator styling.
- The next behavior/proof slice is the focused Verify fail-edit-repair-pass regression and fix. Do not mix it with visual-system cleanup or export/hardware work unless explicitly reprioritized.
- The next visual slice after the Verify behavior fix is remaining Verify density / evidence workbench cleanup, kept separate from fail-edit-repair.
- One preview-backed gate caveat remains: `ide:gate:export-ready-contract` currently fails before Export in Verify setup with `verify had neither a visible generate-basics action nor an existing ready-vector state`; the first-viewport export flow, product immersion export flows, and export download contract pass.
- Another older preview-backed caveat remains outside the visual-system slice: `ide:gate:verify-contract` still waits for the blank-Verify `ide-verify-banner` path, while the current ECE141 starter Verify workflow is covered by `ide:gate:verify-workbench-contract` and the ECE141 browser gates.

### Commercial posture

- RedByte is not commercially ready for unsupervised paid classroom use.
- Accounts/SaaS remain deferred. The likely v1 business shape is public/free hosted evaluation plus instructor/campus support or deployable classroom package after UX hardening, proof, and quickstarts.

### Repo / process hygiene

- The canonical local RedByte worktree is now `C:\Users\conno\redbyte-ui-genesis-main`.
- The prior `C:\Users\conno\OneDrive\Documents\RedByte FPGA` clone is historical/local source context only unless the user explicitly selects it again.
- The initial desktop audit started from a clean tracked worktree at `main` commit `08a324cf`.
- Bare `pnpm` was unavailable on PATH during the audit; `corepack pnpm` worked.
- Root dev scripts now call `corepack pnpm --filter ...` internally, so `corepack pnpm run dev` works in this shell and serves the app at `http://localhost:5173/`.
- Bare `pnpm` now works in the canonical clone after a user-level `pnpm@10.24.0` install to `C:\Users\conno\AppData\Roaming\npm`. `corepack enable` still fails locally with `EPERM` on `C:\Program Files\nodejs\pnpm`.
- If the user-level shim disappears, `corepack pnpm ...` remains the reliable fallback.
- `build:unified` is no longer a current known blocker. Later `AI_STATE.md` and course-edition validation-log entries record passing `build:unified` and dist verification after the old route/lock drift.

---

## 5. Already Fixed - Do Not Reopen Without New Evidence

- README and manual overclaim cleanup are closed.
- Sequential boundary enforcement is closed: falling-edge, multi-clock, and active-low reset are blocked.
- Design-time circuit health feedback is live.
- Basys3 board-clock truth (`CLK100MHZ` / `W5`) and exported testbench parity are proven; do not casually reopen board-clock semantics.
- Import now routes to Design after a successful project import.
- Project first-load black-screen issue (`F-P2`) is resolved.
- Project next-action semantics (`F-P1`) now keep Verify as the dominant story when Verify is the required next step.
- Curated learning path is resolved.
- Product-visible debug chrome toggles are hidden from main IDE surfaces by default.
- Map Pins `F-H2` / `F-H3` mapping guide collapses when complete; hints name the specific Verify action when evidence is advisory.
- Broad Verify redesign is not the current roadmap; preserve current locked truths and fix narrow contradictions instead.
- Old `build:unified` route/lock drift is resolved in later validation logs unless fresh evidence says otherwise.

---

## 6. Default Next Move

The approved order is:

1. Verify fail-edit-repair-pass regression and fix.
2. Verify density / evidence workbench cleanup.
3. Broader student workflow browser suite.
4. Vivado/Basys3 proof restoration on a machine with Vivado 2024.2 and hardware access.
5. Student and instructor quickstarts.
6. Commercial/license packaging later.

Do not skip to website, pilot, broad polish, accounts/SaaS, or new product features while the current product UX and proof posture remain unsettled.
