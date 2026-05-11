---
doc_status: current
last_validated: 2026-05-06
owner: Connor Angiel
used_by_claude: true
role: compact current-truth control layer for RedByte product and agent sessions
---

# RedByte Current Truth

Use this doc to stop source drift before work starts. It is a control layer, not a new product spec.

---

## 1. Source hierarchy

| Truth type | Canonical owner | How to use it |
|---|---|---|
| Runtime truth | Code + focused tests | Code wins if docs lag. |
| Live repo posture | `AI_STATE.md` | First read for recent changes, active facts, and what is already closed. |
| Current priorities | `docs/ACTIVE_WORK.md` | Cockpit for what should happen next. |
| Current release truth | `docs/STUDENT_RELEASE_READINESS.md` | Safe public, TA, and hardware claims. |
| Current product behavior | `docs/manuals/RedByte_Product_Manual.md` | What the product does today. |
| Target truth | `docs/contracts/RedByte_Product_Contract.md` | Quality bar and target promise. Do not treat as shipped behavior. |
| UX debt ordering | `docs/RED_BYTE_IDE_PRODUCT_FLOW_MODEL.md`, `docs/IDE_PRODUCT_DEBT_REGISTER.md` | Ordered product follow-ups, not permission for broad redesign. |
| Historical audit | `docs/roadmap/RedByte_Gap_Audit.md` | Closure history and remaining audit context. |
| Caution / stale | `PRODUCT.md` if it conflicts, plus the stale zone in `docs/DOC_INDEX.md` | Do not use as default context for current product work. |

Practical read order for a normal session:

1. `AI_STATE.md`
2. `docs/ACTIVE_WORK.md`
3. `docs/STUDENT_RELEASE_READINESS.md`
4. `docs/manuals/RedByte_Product_Manual.md`
5. `docs/contracts/RedByte_Product_Contract.md`

---

## 2. Current product thesis

RedByte is a deterministic, browser-based FPGA educational IDE for the Digilent Basys3 board.

Its promise is narrow and real:

- students design a circuit visually
- students prove behavior in Verify with authored stimulus and Compare checks
- students map signals to real Basys3 resources
- students export a Vivado-ready package that matches what the IDE proved

RedByte is not a Vivado replacement, not a general-purpose HDL IDE, and not a broad FPGA platform. Vivado remains downstream for synthesis, implementation, bitstream generation, and board programming.

---

## 3. Current UX spine

The active workflow spine is:

`Project -> Design -> Verify -> Map Pins / Hardware -> Export`

Supporting truths:

- Import is a utility entry point, not a main workflow step.
- Trusted Export requires current Compare PASS, current mapping, and a current export bundle for the same project state.
- Draft Export is allowed when the project is structurally exportable but trusted proof is missing or stale.
- Board programming and board observation are external proof tiers after Export.

---

## 4. Current live blockers

### Proof closure

- 2026-05-05 broad bench refreshed E1/E2 for `golden-basys3-switch-and`, IDE `signal-tour`, IDE `half-adder`, and IDE `two-bit-counter`; a controlled evidence pack then narrowed to `golden-basys3-switch-and`, IDE `two-bit-counter`, and IDE `signal-tour` under `.redbyte/bench/runs/20260505-222402/`.
- 2026-05-06 evidence tooling added `pnpm rb:bench:evidence:classify` and `pnpm rb:bench:evidence:observe`; controlled run `20260505-222402` currently classifies `golden-basys3-switch-and`, IDE `signal-tour`, and IDE `two-bit-counter` as E2 because observation is still uncertain/manual.
- The controlled pack confirms Vivado 2024.2, Hardware Manager Tcl board detection/programming on `xc7a35t_0`, and classifies warning patterns, but it records no new physical LED/switch behavior observations.
- `golden-basys3-switch-and`, IDE `half-adder`, and IDE `two-bit-counter` still need final E3 observation closure.
- Custom-row E2/E3 proof is still incomplete unless a row is programmed and observed in a later bench run.
- Student-safe public claims must stay scoped to the current certification matrix.

### Workflow-language and trust clarity

- No open workflow-language friction items at this time.

### Repo / process hygiene

- The working tree may contain concurrent edits; isolate each slice before committing.
- `build:unified` still has a Windows `dist/` lock caveat and must not be treated as solved.

---

## 5. Already fixed - do not reopen without new evidence

- README and manual overclaim cleanup are closed.
- Sequential boundary enforcement is closed: falling-edge, multi-clock, and active-low reset are blocked.
- Design-time circuit health feedback is live.
- Basys3 board-clock truth (`CLK100MHZ` / `W5`) and exported testbench parity are proven; do not casually reopen board-clock semantics.
- Import now routes to Design after a successful project import.
- Project first-load black-screen issue (`F-P2`) is resolved.
- Project next-action semantics (`F-P1`) now keep Verify as the dominant story when Verify is the required next step.
- Curated learning path is resolved: commit `13d77a3b` adds the six-step guided path and `006a208c` wires it through IDE props.
- Product-visible debug chrome toggles are hidden from main IDE surfaces by default: commit `eb3cf578`.
- Map Pins `F-H2` / `F-H3` mapping guide collapses when complete; hint names the specific Verify action when evidence is advisory — resolved 2026-05-05 commit `aeda6bc4`.
- Broad Verify redesign is not the current roadmap; preserve current locked truths and fix narrow contradictions instead.

---

## 6. Default next move after this control pass

If the working tree is understood and isolated, the first real product priority is:

1. Finish honest proof closure: `golden` E3, custom-row E2/E3, certification matrix.
2. If the connected bench is unavailable, choose the next non-bench product slice from `docs/ACTIVE_WORK.md`, this current-truth file, and the course-edition release docs without reopening completed queue items.

Do not skip to website, pilot, broad example expansion, or stale learning-path work while proof closure remains open or board-gated.
