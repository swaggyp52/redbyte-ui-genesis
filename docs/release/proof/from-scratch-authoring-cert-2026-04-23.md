# Proof: From-scratch authoring certification (RedByte → Vivado → Basys3)

**Date:** 2026-04-23  
**Scope:** Certify that **blank-shaped** student projects (no `sourceExampleId`, `projectKind: 'blank'`) flow through the same export + Vivado + programming path as curated examples.

## 1. Problem

Curated IDE examples were E1/E2-certified; **student trust** requires the **authoring workflow** (blank canvas → design → verify → map → export → board) to be equally real—not only pre-built gallery rows.

## 2. Root cause (historical gap)

Release docs emphasized **example rows** in the matrix. There was no **named, tested artifact** representing a save file from a blank project, nor a one-command export path separate from `examplesCatalog` / lab starters.

## 3. Files changed

- `packages/rb-apps/src/apps/ide/fixtures/fromScratchBasys3CertProjects.ts` — two **blank-shaped** `RBProject` factories (combinational AND; sequential 2-bit counter). **No import** from `examplesCatalog`.
- `scripts/vivado-cert-export-from-scratch.ts` — Open Project ZIP + unpack under `out/vivado-cert/from-scratch/`.
- `packages/rb-apps/src/__tests__/from-scratch-basys3-cert-fixtures.test.ts` — `bundle.valid`, slug, XDC/VHDL smoke.
- `packages/rb-apps/src/__tests__/vivado-cert-scripts-present-contract.test.ts` — script presence.
- `package.json` — `lab:vivado:cert:from-scratch`.
- `docs/release/from-scratch-basys3-authoring-checklist.md` — TA/student checklist.
- `docs/release/vivado-basys3-certification-matrix.md`, `docs/STUDENT_RELEASE_READINESS.md`, `scripts/vivado/README.md`, `AI_STATE.md` — claims + commands.

## 4. Workflow / product definition

| Audit question | Answer |
|----------------|--------|
| What “from scratch” means today | `projectRuntime.startBlankProject()` / empty canvas; `projectKind: 'blank'`; IO derived from placed INPUT/OUTPUT + **Map Pins** (`hardwareMappingV2` / `ioMapping`). |
| Minimum student-critical classes | (1) Combinational with switches/LEDs. (2) Clocked sequential with **CLK100MHZ** + real constraints. |
| Stale IO risk | Raw package pins (e.g. `V17`) still appear in some **lab starters**; **authoring checklist** steers students to **aliases** (`SW0`, `LD0`, `CLK100MHZ`). |
| Blank project → board resources | IDE does not auto-place pins; students must map—same as real class workflow. |
| Verify / mapping assumptions | Fixtures include `vectors` like a student-authored project; export does not read `activeExampleId`. |
| Certification targets | `fs-comb-switch-and-basys3`, `fs-seq-two-bit-counter-basys3`. |
| Automation vs GUI | Fixtures **mirror** a saved `.rbproj` after authoring; CI proves **pipeline**; humans follow the **checklist** for literal GUI proof. |
| Fragile areas | Complex FSM + 7-seg, hierarchy-heavy designs—still **fenced** in lab-day doc. |
| Docs that understated blank path | Matrix now has **from-scratch** rows distinct from **IDE example** rows. |
| Canonical proof path | `pnpm lab:vivado:cert:from-scratch <fixture-id>` → batch Tcl → (optional) `redbyte_program_device.tcl`. |

## 5. Automated proof

```text
pnpm -w exec vitest run packages/rb-apps/src/__tests__/from-scratch-basys3-cert-fixtures.test.ts
pnpm -s ide:gate:export-ready-contract
pnpm -s build:unified
```

## 6. Real Vivado proof (E1)

| Fixture | Batch log | Bitstream |
|---------|-----------|-----------|
| `fs-comb-switch-and-basys3` | `out/vivado-cert/vivado_batch_fs_comb_from_scratch.log` | `.../fs-comb-switch-and-basys3.runs/impl_1/top.bit` |
| `fs-seq-two-bit-counter-basys3` | `out/vivado-cert/vivado_batch_fs_seq_from_scratch.log` | `.../fs-seq-two-bit-counter-basys3.runs/impl_1/top.bit` |

Both logs end with `RedByte batch: SUCCESS` and a `BITSTREAM =` line.

## 7. Real board proof (E2)

| Fixture | Program log | Result |
|---------|-------------|--------|
| Combinational | `out/vivado-cert/vivado_program_fs_comb_from_scratch.log` | **SUCCESS** (2026-04-23) |
| Sequential | `out/vivado-cert/vivado_program_fs_seq_from_scratch.log` | **SUCCESS** (2026-04-23) |

**E3 (manual):** See `docs/release/from-scratch-basys3-authoring-checklist.md` § Observation.

## 8. Remaining from-scratch blockers

- **GUI-level** friction (palette ergonomics, first-time Verify setup) not fully automated here.
- **Arbitrary** student designs (unsupported constructs, timing fantasies) remain fenced—cert covers **representative** combinational + sequential classes.
- **Lab JSON / file imports** and **HDL-only** paths are out of scope for this slice.

## 9. Exact student-ready claim

**Safe:** A student (or TA using the checklist) can author a **blank** Basys3 project in the supported combinational/sequential subset, map **alias** pins, export an Open Project ZIP, and complete **synth/impl/bitstream** in Vivado 2024.2; on a bench where `hw_probe` exits **0**, programming succeeds—**proven** for the two **from-scratch fixtures** with logs above.

**Not claimed:** Every possible student circuit or every lab starter JSON without its own matrix row.
