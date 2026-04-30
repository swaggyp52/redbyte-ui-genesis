---
doc_status: current
last_validated: 2026-04-30
owner: Connor Angiel
used_by_claude: true
imported_by: CLAUDE.md
---

# RedByte — Active Work Cockpit

**Branch:** main · **Release:** RC1 (frozen 2026-04-23) · **Vivado:** 2024.2 · **Board:** Basys3 (`xc7a35tcpg236-1`)

> **What RedByte is right now:** an FPGA educational IDE. Student spine is **Design → Verify → Map Pins → Export**. Import is a utility. Board programming is an external handoff after Export. Primary package: `packages/rb-apps`.

---

## Top 3 priorities

1. **Close `golden-basys3-switch-and` E3 and custom row E2/E3 honestly** - `signal-tour` is E2/E3, `golden` is E1/E2 with E3 still waiting on the manual four-case note, and custom rows remain E1-only unless programmed and observed.
2. **From-scratch UX proof still needs a true blank-canvas browser pass** - real Vivado E1 is refreshed for mixed-gate and clocked custom rows, but manual browser authoring still leans on starters/fixtures instead of fully hand-authored canvas proof.
3. **Carry the browser-gate truth discipline into the next student-loop slice** - browser rehearsal gates now match Observe -> Expected outputs -> Compare and Map Pins authority; keep future student-path work aligned to that wording and ownership model.

---

## Blocked

| Blocker | Why | Unblock by |
|---------|-----|-----------|
| Final E3 notes for `golden` + custom rows | Requires manual board observation after programming the current bitstream | Keep the board on the active row long enough to record the behavior |
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
| Done | Batch 1 product truth consolidation: documentation authority map, product spine/state vocabulary, whole-app audit notes, browser rehearsal friction, and refreshed custom mixed/counter E1 Vivado proof | `this commit` |
| Done | Browser rehearsal gate reconciliation: current browser proof now matches Observe → Expected outputs → Compare, trusted export gate truth, and Map Pins authority instead of Project-side pin editing | `this commit` |
| Done | Verify workbench stabilization: broad render harness cleanup, explicit stale reasons, wider Build testbench workspace, Export stale-evidence wording, and broad `vitest run verify` restored to green | `this commit` |
| Done | Verify testbench authority: normalized evidence hash stops helper-vector stale loops; sequential Clock / timing panel previews edge stimulus before run | `0b754512` |
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
