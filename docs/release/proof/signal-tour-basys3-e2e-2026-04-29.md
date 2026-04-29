# Proof: IDE `signal-tour` - Basys3 E2/E3 (2026-04-29)

## 1. Commit and environment

- Commit tested: `259ae16ae0f840ecfbeb1bdb2741c9f4d2d4e5ac`
- Machine: Windows lab machine with terminal access
- Toolchain: Vivado 2024.2
- Board: Basys3 (`xc7a35tcpg236-1`)
- Hardware target: `localhost:3121/xilinx_tcf/Digilent/210183BF7C42A`
- Device: `xc7a35t_0`

## 2. Commands run

```powershell
pnpm lab:vivado:hw-probe
pnpm exec tsx scripts/vivado-cert-export-ide-example.ts signal-tour
$Vivado = "C:\Xilinx\Vivado\2024.2\bin\vivado.bat"
& $Vivado -mode batch -source scripts\vivado\redbyte_batch_synth_impl_bitstream.tcl -notrace -nojournal -log out\vivado-cert\vivado_batch_signal_tour_2026-04-29.log -tclargs "out\vivado-cert\examples\signal-tour\unpacked\signal-tour\signal-tour.xpr" 4
& $Vivado -mode batch -source scripts\vivado\redbyte_program_device.tcl -notrace -nojournal -log out\vivado-cert\vivado_program_signal_tour_2026-04-29.log -tclargs "out\vivado-cert\examples\signal-tour\unpacked\signal-tour\signal-tour.runs\impl_1\top.bit"
```

## 3. Artifact paths

- Batch log: `out/vivado-cert/vivado_batch_signal_tour_2026-04-29.log`
- Program log: `out/vivado-cert/vivado_program_signal_tour_2026-04-29.log`
- Bitstream: `out/vivado-cert/examples/signal-tour/unpacked/signal-tour/signal-tour.runs/impl_1/top.bit`

## 4. Result

| Tier | Status | Evidence |
|------|--------|----------|
| E1 | yes | `vivado_batch_signal_tour_2026-04-29.log` |
| E2 | yes | `vivado_program_signal_tour_2026-04-29.log` |
| E3 | yes | User-confirmed bench behavior on 2026-04-29 |

## 5. Manual board observation

User-confirmed on the live bench after programming the generated bitstream:

- `SW0` changes `LD0` only
- `SW1` changes `LD1` only
- `SW2` changes `LD2` only
- `SW3` changes `LD3` only

## 6. Caveats

- Observation was manual, not camera-captured.
- This proof certifies the IDE starter row, not every custom multi-output student project.
