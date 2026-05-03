---
doc_status: current
last_validated: 2026-05-02
owner: Connor Angiel
used_by_claude: true
imported_by: CLAUDE.md
---

# RedByte — Active Work Cockpit

**Branch:** main · **Release:** RC1 (frozen 2026-04-23) · **Vivado:** 2024.2 · **Board:** Basys3 (`xc7a35tcpg236-1`)

> **What RedByte is right now:** an FPGA educational IDE. **Project** is the dashboard/home surface that routes the product spine **Project -> Design -> Verify -> Map Pins / Hardware -> Export**. Import is a utility. Board programming is an external handoff after Export. Primary package: `packages/rb-apps`.

---

## Top 3 priorities

1. **Close `golden-basys3-switch-and` E3 and custom row E2/E3 honestly** - `signal-tour` is E2/E3, `golden` is E1/E2 with E3 still waiting on the manual four-case note, and custom rows remain E1-only unless programmed and observed.
2. **Turn screenshot coverage into a real safety net before more UI cleanup** - `docs/IDE_PRODUCT_DEBT_REGISTER.md` is now the canonical owner for open surface debt. The next cross-surface infrastructure task is enforcing authority-surface screenshots at `1366x768` and `1920x1080` before any serious CSS pruning or density cleanup.
3. **Use the debt register to sequence the next UI slice** - Hardware / Map Pins and Export are the highest-leverage open density problems. ScenarioBuilder deeper layout remains optional and must not touch the now-proven board-clock truth casually.

---

## Blocked

| Blocker | Why | Unblock by |
|---------|-----|-----------|
| Final E3 notes for `golden` + custom rows | Requires manual board observation after programming the current bitstream | Keep the board on the active row long enough to record the behavior |
| `build:unified` root `dist/` verification | Windows can hold the root `dist/` directory lock even after build + merge succeed | Identify the locking process and harden the unified-build handoff or recovery path |
| Lab 8 / SSD-heavy / hierarchical-bus starters | Not RC1 turnkey; complexity exceeds support matrix | Out of scope for RC1 |

---

## Next bench / Vivado task

**Target:** custom-project E2/E3 after `golden` E3 closes.

```powershell
pnpm lab:vivado:cert:custom -- --case fs-custom-four-switch-led --project packages/rb-apps/src/fixtures/cert/fs-custom-four-switch-led.rbproj --program true
```

Planned E3 observation: `SW0..SW3` each drive `LD0..LD3` on the custom blank-shaped row, then re-run the mixed gate chain or custom AND row on hardware.

Full reproduce sequence: `docs/release/custom-project-vivado-hardening-2026-04-29.md` · `docs/STUDENT_RELEASE_READINESS.md` §3 · `scripts/vivado/README.md`.

---

## Latest proof / evidence

| Evidence | Path |
|----------|------|
| Verify stimulus usability cleanup (UI-only): compact `Test stimulus` header, mode summary, section guidance, and compare-check explainer with board-clock/browser/export proof rerun | `AI_STATE.md` — Change Log 2026-05-02 (Verify ScenarioBuilderPanel usability cleanup) |
| Board-clock browser proof: auto `CLK100MHZ`/`W5` detected, no manual CLK row, counter waveform advances, manual-pulses override works, `clock_gen` process in exported VHDL | `artifacts/browser-proof-clock/BROWSER_PROOF_RESULTS.md` |
| Board-clock Verify fidelity pass: auto `CLK100MHZ` / `W5` runtime policy, Verify UI clock mode, free-running VHDL clock process, targeted regressions | `AI_STATE.md` — Change Log 2026-05-02 (Board-clock verify fidelity pass) |
| UI audit pass: Project bridge disclosure, Design idle inspector overview, Verify mode explainer, CSS debt note | `AI_STATE.md` — Change Log 2026-05-02 (UI audit pass) |
| Product-state language unification (draft/trusted/proven copy) | `AI_STATE.md` — Change Log (state language unification) |
| Batch 1 custom mixed-gate E1 refresh | `out/vivado-cert/custom-projects/b1-mixed/result.md` |
| Batch 1 custom counter E1 refresh | `out/vivado-cert/custom-projects/b1-counter/result.md` |
| Batch 1 browser/gate hardening ticket | `docs/release/product-hardening-ticket-2026-04-30-browser-rehearsal-gates.md` |
| `signal-tour` E2/E3 proof | `docs/release/proof/signal-tour-basys3-e2e-2026-04-29.md` |
| `golden-basys3-switch-and` blocker fix + E1/E2 | `docs/release/proof/golden-basys3-switch-and-e2e-2026-04-29.md` |
| Custom-project hardening ledger | `docs/release/custom-project-vivado-hardening-2026-04-29.md` |
| Custom-project proof bundle | `docs/release/proof/custom-projects-2026-04-29.md` |
| RC1 bench closeout | `docs/release/proof/rc1-bench-closeout-2026-04-23.md` |
| `two-bit-counter` E1 + E2 + E3 path | `docs/release/proof/two-bit-counter-basys3-e2e-2026-04-23.md` |
| From-scratch authoring cert | `docs/release/proof/from-scratch-authoring-cert-2026-04-23.md` |
| Vivado export fidelity | `docs/release/proof/vivado-export-fidelity-board-rehearsal-2026-04-23.md` |
| Complex multi-file round-trip | `docs/release/proof/security-lock-complex-round-trip-audit-2026-04-23.md` |

---

## Cockpit links — start here when you need detail

| What | Where |
|------|-------|
| Release readiness (TA surface, tier table) | [docs/STUDENT_RELEASE_READINESS.md](./STUDENT_RELEASE_READINESS.md) |
| RC1 freeze (honest E1/E2/E3 posture) | [docs/RC1_STUDENT_RELEASE_FREEZE.md](./RC1_STUDENT_RELEASE_FREEZE.md) |
| Certification matrix (E0–E3 + dated logs) | [docs/release/vivado-basys3-certification-matrix.md](./release/vivado-basys3-certification-matrix.md) |
| Complex-project support (multi-file import) | [docs/release/proof/security-lock-complex-round-trip-audit-2026-04-23.md](./release/proof/security-lock-complex-round-trip-audit-2026-04-23.md) |
| Lab-day supported logic subset | [docs/lab-day-vivado-basys3-readiness.md](./lab-day-vivado-basys3-readiness.md) |
| From-scratch authoring checklist | [docs/release/from-scratch-basys3-authoring-checklist.md](./release/from-scratch-basys3-authoring-checklist.md) |
| Architecture (5-layer) | [docs/ARCHITECTURE.md](./ARCHITECTURE.md) |
| Surface specs | [docs/ide/](./ide/) (00-ide-layout, 01-project, 02-design, 03-verify, 04-export, 05-import) |
| Highest-priority engineering | This file, "Top 3 priorities" above |

---

## In-flight work (last 5 batches)

| Status | Item | Commit |
|--------|------|--------|
| Done | Persistent IDE debt audit: canonical debt register, live browser review, and repo/brain alignment for stable truths vs open debt | `95692723` |
| Done | Verify ScenarioBuilder UI-only clarity pass: `Test stimulus` header, explicit authoring sections, mode summary, compare-check explainer, and targeted regression proof rerun | `826a4f92` |
| Done | Board-clock Verify now auto-runs Basys3 `CLK100MHZ` / `W5`, preserves manual overrides, and exports a free-running VHDL board-clock process | `2e47abf9..6907453c` |
| Done | UI audit follow-up docs note: CSS debt documented in `ide-polish-pass.css`, no pruning without snapshot regression coverage | `fecabe35` |
| Done | Verify command bar now carries the inline Observe / Compare mode explainer beside the next-run selector | `713d7037` |

---

## Docs to update when work lands

| When | Update these |
|------|--------------|
| Release tier changes (E1/E2/E3) | `docs/STUDENT_RELEASE_READINESS.md` (tier table), `docs/release/vivado-basys3-certification-matrix.md`, `docs/RC1_STUDENT_RELEASE_FREEZE.md` if posture shifts, **this file** (Latest proof + Next bench) |
| Surface behavior changes (Design/Verify/Hardware/Export) | `docs/ide/0{N}-{surface}.md`, **this file** (Top 3 priorities, In-flight) |
| Architecture changes (layer/schema/contract) | `docs/ARCHITECTURE.md`, `docs/contracts/RedByte_Product_Contract.md` if target-state shifts, **this file** |
| Bug status flip | `05 Bugs/BUG-NNN.md` in vault, **this file** (Top 3 priorities, Blocked) |
| Documentation authority/routing changes | `docs/IDE_SYSTEM_MAP.md`, `docs/ide/SURFACE_CONFORMANCE.md`, **this file** |

---

## Operational commands

```bash
# Verify gates (run before any commit)
pnpm verify:gates

# Run a test (Windows-only — vitest has hardcoded Windows paths)
pnpm -w exec vitest run [pattern]

# Cert-export an IDE example
pnpm exec tsx scripts/vivado-cert-export-ide-example.ts <id>

# Hardware probe
pnpm lab:vivado:hw-probe
```

---

## How this file is updated

After every meaningful batch:
1. **Top 3 priorities** — reorder, replace done items
2. **Blocked** — add new, remove resolved
3. **Next bench / Vivado task** — replace with the next concrete bench action
4. **Latest proof / evidence** — prepend new dated log
5. **In-flight work** — rotate; keep newest 5
6. **`last_validated`** in frontmatter — bump to today's date

This file is imported into `CLAUDE.md` via `@docs/ACTIVE_WORK.md`. Every Claude session starts with this in context.
