# Proof: `golden-basys3-switch-and` - Basys3 E1/E2, E3 pending (2026-04-29)

## 1. Commit and environment

- Commit tested: `259ae16ae0f840ecfbeb1bdb2741c9f4d2d4e5ac`
- Machine: Windows lab machine with terminal access
- Toolchain: Vivado 2024.2
- Board: Basys3 (`xc7a35tcpg236-1`)
- Hardware target: `localhost:3121/xilinx_tcf/Digilent/210183BF7C42A`
- Device: `xc7a35t_0`

## 2. Real blocker found before certification

The classroom fixture exported a constant-low design instead of `SW0 AND SW1 -> LD0`.

- Broken file: `packages/rb-apps/src/fixtures/classroom/golden-basys3-switch-and.rbproj`
- Symptom in generated HDL: `and_0 <= '0' and '0';`
- Root cause: the fixture had only a lone `AND` node plus `classroom.ioMapping`, with no INPUT/OUTPUT nodes or signal connections.
- Smallest fix made:
  - rebuilt the fixture with `INPUT`/`OUTPUT` nodes and proper connections
  - updated deterministic golden hash in `packages/rb-apps/src/__tests__/__goldens__/golden-basys3-switch-and.zip.sha256`
  - recorded the blocker in `docs/release/product-hardening-ticket-2026-04-29-golden-basys3-switch-and-export-blocker.md`

Focused regression proof after the fix:

```powershell
pnpm -w exec vitest run packages/rb-apps/src/__tests__/classroom-golden-basys3-export-gate.test.ts
pnpm -s rc:e1:golden-basys3-export-gate
```

## 3. Commands run

```powershell
pnpm lab:vivado:hw-probe
pnpm exec tsx scripts/vivado-cert-export-open-project.ts
$Vivado = "C:\Xilinx\Vivado\2024.2\bin\vivado.bat"
& $Vivado -mode batch -source scripts\vivado\redbyte_batch_synth_impl_bitstream.tcl -notrace -nojournal -log out\vivado-cert\vivado_batch_golden_and_2026-04-29.log -tclargs "out\vivado-cert\golden-basys3-switch-and-unpacked\golden-basys3-switch-and\golden-basys3-switch-and.xpr" 4
& $Vivado -mode batch -source scripts\vivado\redbyte_program_device.tcl -notrace -nojournal -log out\vivado-cert\vivado_program_golden_and_2026-04-29.log -tclargs "out\vivado-cert\golden-basys3-switch-and-unpacked\golden-basys3-switch-and\golden-basys3-switch-and.runs\impl_1\top.bit"
```

## 4. Artifact paths

- Batch log: `out/vivado-cert/vivado_batch_golden_and_2026-04-29.log`
- Program log: `out/vivado-cert/vivado_program_golden_and_2026-04-29.log`
- Bitstream: `out/vivado-cert/golden-basys3-switch-and-unpacked/golden-basys3-switch-and/golden-basys3-switch-and.runs/impl_1/top.bit`

## 5. Result

| Tier | Status | Evidence |
|------|--------|----------|
| E1 | yes | `vivado_batch_golden_and_2026-04-29.log` |
| E2 | yes | `vivado_program_golden_and_2026-04-29.log` |
| E3 | pending | Board was reprogrammed for manual four-case check; confirmation still outstanding |

## 6. Expected E3 procedure

Manual board observation still required for these four cases:

- `SW0=0`, `SW1=0` -> `LD0` off
- `SW0=1`, `SW1=0` -> `LD0` off
- `SW0=0`, `SW1=1` -> `LD0` off
- `SW0=1`, `SW1=1` -> `LD0` on

## 7. Caveat

Do not claim full E3 until the four-case board observation above is recorded against this fixed fixture.
