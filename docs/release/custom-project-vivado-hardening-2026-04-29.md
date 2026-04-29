# Custom project Vivado hardening ledger (2026-04-29)

This is the live custom-project campaign ledger for real RedByte -> Vivado -> Basys3 hardening on the Windows lab machine.

## Matrix

| Case ID | Project class | Student intent | Created how | RedByte design status | Verify/testbench status | Map Pins status | Export status | Vivado synth status | Vivado impl status | Bitstream status | Board program status | Board observation | Failure log path | Root cause | Fix made | Support posture | Student-facing improvement needed |
|---------|---------------|----------------|-------------|-----------------------|-------------------------|-----------------|---------------|---------------------|--------------------|------------------|----------------------|------------------|------------------|------------|----------|-----------------|----------------------------------|
| `fs-comb-switch-and` | Basic combinational | Build a blank-project AND-to-LED circuit | `rbproj` fixture (`fs-comb-switch-and-basys3`) | pass | fixture vectors only | pass | pass | pass | pass | pass | not run in this harness pass | pending board observation | `out/vivado-cert/custom-projects/fs-comb-switch-and/vivado_batch.log` | none in this path | new custom harness | Supported | Still needs a true browser-authored blank-project run, not only fixture replay |
| `fs-custom-four-switch-led` | Multi-output custom | Recreate signal-tour from a blank project | `rbproj` fixture | pass | fixture vectors only | pass | pass | pass with Vivado empty-top warning | pass | pass | not run in this harness pass | pending board observation | `out/vivado-cert/custom-projects/fs-custom-four-switch-led/vivado_batch.log` | Direct input-to-output passthrough triggers benign Vivado "empty top module" warning after optimization | added tracked blank-project fixture + harness coverage | Supported with caveat | BRINGUP/docs should warn that direct passthrough designs may still build with harmless optimizer warnings |
| `fs-custom-mixed-gate-chain` | Mixed combinational | Build a multi-stage custom logic output | `rbproj` fixture | pass | fixture vectors only | pass | pass | pass | pass | pass | not run in this harness pass | pending board observation | `out/vivado-cert/custom-projects/fs-custom-mixed-gate-chain/vivado_batch.log` | none in this path | added tracked blank-project fixture + harness coverage | Supported | Still needs a browser-authored from-scratch rehearsal plus stronger starter testbench generation |
| `fs-seq-two-bit-counter` | Sequential clocked | Build a blank-project 2-bit counter with `CLK100MHZ` | `rbproj` fixture (`fs-seq-two-bit-counter-basys3`) | pass | fixture vectors only | pass | pass | pass | pass | pass | not rerun in this harness | pending board observation | `out/vivado-cert/custom-projects/fs-seq-two-bit-counter/vivado_batch.log` | none in this path | new custom harness | Supported with caveat | Needs a fresh Verify workbench student rehearsal because clock/testbench authoring is still a manual risk surface |

## Harness

- Command: `pnpm lab:vivado:cert:custom -- --case <case-id> (--project <path.rbproj> | --fixture <fixture-id>) [--program true|false]`
- Deterministic output root: `out/vivado-cert/custom-projects/<case-id>/`
- Each case folder now preserves:
  - source project copy
  - `top.vhd`
  - `top.xdc`
  - `BRINGUP.md`
  - `EXPECTED_IO.json`
  - `program_and_test.tcl`
  - `vivado_batch.log`
  - copied stage logs: `vivado_synth.log`, `vivado_impl.log`, `vivado_bitstream.log`
  - `export-summary.json`
  - `result.md`

## What is now proven

- RedByte can drive repeatable real-Vivado E1 proof for custom blank-shaped projects, not only canned gallery exports.
- The harness works for:
  - one custom basic combinational project
  - one custom mixed combinational project
  - one custom multi-output project
  - one custom sequential project with clock

## What is still caveated

- Custom board-program/E3 proof is not complete yet for the new harness rows.
- The browser-authored blank-project student loop has not yet been replayed end-to-end in this session.
- Verify/testbench evidence for these custom rows still comes from fixture vectors, not a fresh manual Verify rehearsal.

## What is unsupported for RC1 today

- Blanket claims that every custom student project is board-certified.
- Lab 8 / SSD-heavy / hierarchy-heavy custom projects without dedicated matrix rows and real hardware proof.

## What students can safely do today

- Use the supported logic subset and blank-shaped custom projects that match the proven rows above.
- Export those projects into real Vivado Open Project bundles and expect deterministic E1 proof on the lab machine.

## Next session targets

1. Finish `golden-basys3-switch-and` E3 manual confirmation.
2. Program `fs-custom-four-switch-led` and record custom-project E2/E3.
3. Replay a true browser-authored blank-project student loop through Design -> Verify -> Map Pins -> Export -> Vivado -> Program Board.
4. Run the 2-bit counter Verify workbench rehearsal with the updated clock/testbench flow.
