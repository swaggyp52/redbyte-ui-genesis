# Proof: Student release readiness + certified starter matrix (2026-04-23)

**Slice:** RedByte student release readiness + real-tool certification of student-critical starters  
**Lab machine:** Windows, Vivado 2024.2, Basys3 (programming attempted)

## 1. Problem

RedByte needed a **single honest readiness surface** and **real Vivado proof** for starters students actually use, not only export-valid / local-test truth.

## 2. Root cause (prior gap)

Export fidelity and project-folder contracts proved **E0**; prior proof docs explicitly noted **no** full `synth_1`/`impl_1`/`write_bitstream` run on the bench. Student-facing confidence was therefore overstated without a filled matrix.

## 3. Files changed

- `docs/STUDENT_RELEASE_READINESS.md` — **canonical** TA/instructor “what is safe now” doc.
- `docs/release/vivado-basys3-certification-matrix.md` — tier table + student starter rows updated with evidence.
- `scripts/vivado-cert-export-ide-example.ts` — export Open Project ZIP from any `IDE_EXAMPLES` / `LAB_STARTERS` id under `tsx`.
- `scripts/vivado/redbyte_program_device.tcl` — fail fast when **no JTAG `hw_targets`** (clearer than generic `open_hw_target` error).
- `packages/rb-apps/src/__tests__/vivado-batch-build-script-contract.test.ts` — asserts programming Tcl includes `get_hw_targets`.
- `package.json` — `lab:vivado:cert:*` scripts (if present in tree).
- `docs/DOC_INDEX.md` — link to student release readiness.

## 4. Behavioral / release change

- **Tiers L0 / E0 / E1 / E2 / E3** are explicit in product docs; **E0 ≠ lab ready**.
- **Three** representative exports are **E1-certified** on this machine (logs below).
- **E2** attempted for golden combinational: **no JTAG target** (board not visible to `hw_server` in this run) — documented; not a product bug.

## 5. Automated proof run

Run before merge (representative):

```text
pnpm -w exec vitest run packages/rb-apps/src/__tests__/vivado-batch-build-script-contract.test.ts
pnpm -s ide:gate:export-ready-contract
pnpm build:unified
```

(Execute in workspace; paste outputs in PR if required.)

## 6. Real Vivado proof

| Project | Log | Result |
|---------|-----|--------|
| `golden-basys3-switch-and` Open Project export | `out/vivado-cert/vivado_batch_golden_and.log` | `impl_1 STATUS = write_bitstream Complete!` — bit: `…golden-basys3-switch-and.runs\impl_1\top.bit` |
| IDE `signal-tour` | `out/vivado-cert/vivado_batch_signal_tour.log` | `write_bitstream Complete!` — `…signal-tour.runs\impl_1\top.bit` |
| IDE `two-bit-counter` (clock on W5 in XDC) | `out/vivado-cert/vivado_batch_two_bit_counter.log` | `write_bitstream Complete!` — `…two-bit-counter.runs\impl_1\top.bit` |

Vivado batch driver: `scripts/vivado/redbyte_batch_synth_impl_bitstream.tcl`.

## 7. Real board proof

- **Programming:** `out/vivado-cert/vivado_program_golden_and.log` — `connect_hw_server` succeeded; **`get_hw_targets` / `open_hw_target`** — **no JTAG target** (exit 1 before script update; after update, explicit `hw_targets` count 0 path).
- **E3 behavior:** not recorded — requires connected Basys3 and TA observation checklist (see `docs/STUDENT_RELEASE_READINESS.md`).

## 8. Remaining unsupported / uncertified starter classes

- Lab starters **not** individually built in Vivado in this slice (matrix marks them E0/L0 until run).
- File examples under `packages/rb-apps/src/examples/*.json` — same rule.
- Lab 8 FSM, SSD-heavy, hierarchy — fenced in `docs/lab-day-vivado-basys3-readiness.md`.

## 9. Exact student-ready claim after this slice

**Certified for real Vivado bitstream generation (E1):** classroom golden combinational AND, IDE **signal-tour**, IDE **two-bit-counter** (sequential clock constraint path).  
**Not certified:** blanket “all gallery starters” or board behavior (E3) until matrix rows and logs exist.
