# Product Hardening Ticket

## Ticket

- Title: `golden-basys3-switch-and` exports constant-low HDL instead of `SW0 AND SW1 -> LD0`
- Date: 2026-04-29
- Owner: Connor Angiel
- Surface: Export / classroom certification fixture
- Journey segment: RedByte export -> Vivado -> Basys3 certification
- Mode: Open Project Vivado export
- Environment:
  - Fresh machine / clean browser profile: no
  - OS: Windows lab machine
  - Browser: not used for repro
  - Node: v24.13.0
  - pnpm: 10.24.0
- Obsidian note:
- Linked GitHub issue:

## Problem

- Observed behavior: The repo-owned certification export for `golden-basys3-switch-and` generates `top.vhd` with `and_0 <= '0' and '0';`, and Vivado synthesis warns that `top` is effectively empty and `LED0` is driven by constant `0`.
- Expected behavior: The golden fixture should export a real combinational AND path so Basys3 behavior is `LD0` on only when both `SW0` and `SW1` are high.
- Why this matters: This is the first combinational E2/E3 classroom certification row. A broken golden fixture creates false export/build proof and blocks honest hardware certification.
- Severity: high

## Reproduction

- Exact repro steps:
  1. `pnpm exec tsx scripts/vivado-cert-export-open-project.ts`
  2. Open generated HDL at `out/vivado-cert/golden-basys3-switch-and-unpacked/golden-basys3-switch-and/golden-basys3-switch-and.srcs/sources_1/new/top.vhd`
  3. Run Vivado batch build:
     `C:\Xilinx\Vivado\2024.2\bin\vivado.bat -mode batch -source scripts/vivado/redbyte_batch_synth_impl_bitstream.tcl -notrace -nojournal -log out/vivado-cert/vivado_batch_golden_and_2026-04-29.log -tclargs <xpr> 4`
  4. Observe synthesis warnings about empty top / constant LED0.
- Reproducibility: always
- First known version or date: 2026-04-29 certification session

## Evidence

- Screenshot / recording:
- Console excerpt: `WARNING: [Synth 8-3917] design top has port LED0 driven by constant 0`
- Test / gate output: `pnpm verify:gates` and `pnpm -s build:unified` passed before certification
- Additional artifacts:
  - `packages/rb-apps/src/fixtures/classroom/golden-basys3-switch-and.rbproj`
  - `out/vivado-cert/golden-basys3-switch-and-unpacked/golden-basys3-switch-and/golden-basys3-switch-and.srcs/sources_1/new/top.vhd`
  - `out/vivado-cert/vivado_batch_golden_and_2026-04-29.log`

## Truth Sources

- Target truth clause(s): `docs/contracts/RedByte_Product_Contract.md` sections 1.2, 4.6, 6.1, 7 Gate 2
- Current truth doc(s): `docs/STUDENT_RELEASE_READINESS.md`, `docs/RC1_STUDENT_RELEASE_FREEZE.md`
- Gap truth reference(s): `docs/roadmap/RedByte_Gap_Audit.md`
- System map / ownership reference(s): `docs/IDE_SYSTEM_MAP.md`
- QA / rehearsal clause(s): `docs/release/v1-release-checklist.md`, `docs/release/product-hardening-ticket-template.md`

## Acceptance Proof

- Minimum acceptance proof: Regenerated golden export produces HDL whose top-level logic depends on `SW0` and `SW1`, Vivado batch still completes, device programs, and manual Basys3 observation matches the AND truth table.
- Required test / gate command(s):
  - `pnpm -w exec vitest run packages/rb-apps/src/__tests__/classroom-golden-basys3-export-gate.test.ts`
  - `pnpm -s rc:e1:golden-basys3-export-gate`
- Required manual proof:
  - Re-run Vivado batch and programming for `golden-basys3-switch-and`
  - Observe `SW0/SW1 -> LD0` on real Basys3
- Screenshot or recording expectation: optional board photo or dated manual observation note

## Docs Review

- Docs that must be reviewed if behavior changes:
  - `docs/ACTIVE_WORK.md`
  - `docs/STUDENT_RELEASE_READINESS.md`
  - `docs/RC1_STUDENT_RELEASE_FREEZE.md`
  - `docs/release/vivado-basys3-certification-matrix.md`
- Docs that must be updated if behavior changes:
  - proof docs under `docs/release/proof/`
  - `AI_STATE.md`

## Disposition

- Status: fixed in source; E3 proof note still pending
- Fix PR / commit:
- Notes: Root cause was a malformed classroom fixture, not the Vivado export script or board path. Fresh E1/E2 proof now exists; only the manual E3 note remains open.

## Attribution

Connor Angiel
