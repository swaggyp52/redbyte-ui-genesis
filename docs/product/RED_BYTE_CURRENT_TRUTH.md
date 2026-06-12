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
| Current release truth | `docs/STUDENT_RELEASE_READINESS.md`, `docs/release/**` | Safe public, TA, and hardware claims. |
| Current product behavior | `docs/manuals/RedByte_Product_Manual.md` | What the product does today. |
| Target truth | `docs/contracts/RedByte_Product_Contract.md` | Quality bar and target promise. Do not treat as shipped behavior. |
| UX debt ordering | `docs/RED_BYTE_IDE_PRODUCT_FLOW_MODEL.md`, `docs/IDE_PRODUCT_DEBT_REGISTER.md` | Ordered product follow-ups, not permission for broad redesign. |
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

### Golden export SHA drift

- The desktop audit found two failing classroom golden ZIP SHA gates under Node 24.15.0 and pnpm 10.24.0.
- The repo-pinned Node version is 20.19.0 in `.nvmrc`.
- Runtime mismatch is a possible cause of artifact drift, not a proven cause.
- Do not update or re-bless golden SHAs until the artifact difference is reproduced and explained under the repo-pinned runtime.

### Vivado/Basys3 proof posture

- The audit did not run fresh Vivado or hardware proof on this desktop because `C:\Xilinx\Vivado\2024.2\bin\vivado.bat` was not found.
- Prior tracked proof docs remain proof history, but this clone cannot claim new E1/E2/E3 evidence without a Vivado/hardware run.
- E3 claims still require physical observation notes, not programming logs alone.

### Generated proof packs

- Tracked proof docs under `docs/release/**` and `docs/STUDENT_RELEASE_READINESS.md` are portable.
- Raw proof packs under `.redbyte/bench/runs/**`, `out/vivado-cert/**`, `dist/**`, `test-results/**`, and `playwright-report/**` are generated/local and may be absent in a clean clone.

### Repo / process hygiene

- The initial desktop audit started from a clean tracked worktree at `main` commit `08a324cf`.
- Bare `pnpm` was unavailable on PATH during the audit; `corepack pnpm` worked.
- Root scripts that call bare `pnpm` internally may fail for environment reasons even when their direct `corepack pnpm ...` equivalent passes.
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

1. Complete docs/backbone reconciliation.
2. Investigate the golden export SHA drift under Node 20.19.0 and pnpm 10.24.0.
3. Re-run or expand student workflow browser coverage as needed after the golden artifact truth is understood.
4. Restore Vivado/Basys3 proof on a machine with Vivado 2024.2 and hardware access.
5. Start product feature work only after these truths are stable or after explicit user reprioritization.

Do not skip to website, pilot, broad example expansion, or new product features while the current proof posture remains unsettled.
