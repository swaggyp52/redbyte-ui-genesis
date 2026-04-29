---
doc_status: current
last_validated: 2026-04-29
owner: Connor Angiel
used_by_claude: true
imported_by: CLAUDE.md
---

# RedByte — Active Work Cockpit

**Branch:** main · **Release:** RC1 (frozen 2026-04-23) · **Vivado:** 2024.2 · **Board:** Basys3 (`xc7a35tcpg236-1`)

> **What RedByte is right now:** an FPGA educational IDE. Student spine is **Design → Verify → Map Pins → Export**. Import is a utility. Board programming is an external handoff after Export. Primary package: `packages/rb-apps`.

---

## Top 3 priorities

1. **E2/E3 matrix completion for `golden-basys3-switch-and` and `signal-tour`** - E1 certified. Blocked on connected bench; do when hardware is available. Program `.bit`, observe LED behavior, log to `out/vivado-cert/`.
2. **Phase 2A usability audit continuation** - keep improving the student loop around Verify failure explanation, testbench authoring, and Design recovery before deeper Export/Import pipeline refactors.
3. **Render harness cleanup for combined surface suites** - focused render tests pass in isolation, but broad combined `vitest run verify` / mixed export render patterns can leave prior DOM in jsdom and produce duplicate `data-testid` failures. Clean this up before relying on broad pattern runs as one signal.

---

## Blocked

| Blocker | Why | Unblock by |
|---------|-----|-----------|
| E2/E3 proof for matrix rows | Requires connected Basys3 + Vivado 2024.2 + Digilent cable | Schedule lab bench session |
| Lab 8 / SSD-heavy / hierarchical-bus starters | Not RC1 turnkey; complexity exceeds support matrix | Out of scope for RC1 |

---

## Next bench / Vivado task

**Target:** `golden-basys3-switch-and` E2 + E3.

```powershell
pnpm lab:vivado:hw-probe   # must exit 0 — confirms target detected
$Vivado = "C:\Xilinx\Vivado\2024.2\bin\vivado.bat"
$Bit = "out\vivado-cert\golden-basys3-switch-and-unpacked\golden-basys3-switch-and\golden-basys3-switch-and.runs\impl_1\top.bit"
& $Vivado -mode batch -source scripts\vivado\redbyte_program_device.tcl -notrace -nojournal -log out\vivado-cert\vivado_program_golden_and.log -tclargs $Bit
```

E3 observation: LD0 lights **only** when SW0 ∧ SW1 are both high. Other cases off.

Then: same flow for `signal-tour` (SW0..SW3 → LD0..LD3 individually).

Full reproduce sequence: `docs/STUDENT_RELEASE_READINESS.md` §3 · `scripts/vivado/README.md`.

---

## Latest proof / evidence

| Evidence | Path |
|----------|------|
| Last live-bench E2 proof | `out/vivado-cert/vivado_program_two_bit_counter_e2_2026-04-23.log` |
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
| Done | Verify testbench authority: normalized evidence hash stops helper-vector stale loops; sequential Clock / timing panel previews edge stimulus before run | `this commit` |
| ✓ Done | Product takeover Phase 1: canonical workflow truth - strict Verify/export trust, draft export labeling, Hardware Verify-first handoff, stale gate contracts aligned | `ff1cccfe` |
| ✓ Done | Product takeover Phase 1: component support registry - Design, Verify, Export, Import, and Basys3 export stateful checks share one support matrix | `3aa8ba7d` |
| ✓ Done | BUG-003: testing-library render harness - upgraded to the current React 19-compatible `@testing-library/react@16.3.2` release and added a render smoke test | `010f4ada` |
| ✓ Done | Phase 2A foundation: Verify mismatch brief + label-first mapping cleanup - Design restates failed Verify context and Project/Hardware/Export show board labels before package pins | `1d92d5c3` |

---

## Docs to update when work lands

| When | Update these |
|------|--------------|
| Release tier changes (E1/E2/E3) | `docs/STUDENT_RELEASE_READINESS.md` (tier table), `docs/release/vivado-basys3-certification-matrix.md`, `docs/RC1_STUDENT_RELEASE_FREEZE.md` if posture shifts, **this file** (Latest proof + Next bench) |
| Surface behavior changes (Design/Verify/Hardware/Export) | `docs/ide/0{N}-{surface}.md`, **this file** (Top 3 priorities, In-flight) |
| Architecture changes (layer/schema/contract) | `docs/ARCHITECTURE.md`, `docs/contracts/RedByte_Product_Contract.md` if target-state shifts, **this file** |
| Bug status flip | `05 Bugs/BUG-NNN.md` in vault, **this file** (Top 3 priorities, Blocked) |

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
