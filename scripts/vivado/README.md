# Vivado batch helpers (lab certification)

These scripts standardize **real tool** rehearsal on Windows lab machines. They are **not** run in CI by default (Vivado is an external dependency).

## Prerequisites

- Vivado installed (repo history assumes **2024.2** under `C:\Xilinx\Vivado\2024.2\bin\vivado.bat`).
- A RedByte **Open Project** export unzipped so that `<slug>/<slug>.xpr` exists (same layout as the IDE “Vivado Project (Open Project)” ZIP).

## Bench check (before E2)

Confirm the cable is visible **without** a bitstream:

```powershell
$Vivado = "C:\Xilinx\Vivado\2024.2\bin\vivado.bat"
& $Vivado -mode batch -source scripts/vivado/hw_probe.tcl -notrace -nojournal -log out/vivado-cert/hw_probe.log
```

Exit **2** = no `hw_targets` (USB/power/JTAG jumper/drivers). The programming script also runs `refresh_hw_server` and uses `get_hw_targets -of_objects [get_hw_servers]` for reliable enumeration.

**If the Basys3 is plugged in but Vivado still shows no targets:** confirm the cable is on the **same machine** that runs Vivado (not a remote IDE host without USB passthrough), JP1 is **JTAG**, board is powered, no other tool has the adapter open, and Digilent / cable drivers match Xilinx LabTools expectations. Re-run `hw_probe` after reconnecting USB.

## Canonical full build (synth → impl → bitstream)

From the repo root:

```powershell
$Vivado = "C:\Xilinx\Vivado\2024.2\bin\vivado.bat"
& $Vivado -mode batch -source scripts/vivado/redbyte_batch_synth_impl_bitstream.tcl -notrace -nojournal -log out/vivado-cert/vivado_batch.log -tclargs "C:\path\to\unzipped\golden-basys3-switch-and\golden-basys3-switch-and.xpr" 4
```

On success, the log prints `BITSTREAM =` with the path to `impl_1\*.bit`.

## Produce a student-shaped Open Project ZIP for rehearsal

The IDE path is authoritative; for a **deterministic golden** combinational case (SW0 ∧ SW1 → LED0):

```powershell
pnpm exec tsx scripts/vivado-cert-export-open-project.ts
```

This writes `out/vivado-cert/golden-basys3-switch-and.zip` and unpacks it to `out/vivado-cert/golden-basys3-switch-and-unpacked/`. Point the batch Tcl at the `.xpr` inside that folder.

## Programming (board tier — real hardware)

When a `.bit` exists and a Basys3 is connected over JTAG, use the repo-owned batch programmer:

```powershell
$Vivado = "C:\Xilinx\Vivado\2024.2\bin\vivado.bat"
$Bit = "C:\path\to\impl_1\top.bit"
& $Vivado -mode batch -source scripts/vivado/redbyte_program_device.tcl -notrace -nojournal -log out/vivado-cert/vivado_program.log -tclargs $Bit
```

**Remote `hw_server`** (lab PC attached to cable, you run Vivado elsewhere):

```powershell
& $Vivado -mode batch -source scripts/vivado/redbyte_program_device.tcl -notrace -nojournal -log out/vivado-cert/vivado_program.log -tclargs $Bit "192.168.1.10:3121"
```

Other flows:

1. **GUI:** Flow Navigator → Open Hardware Manager → Open Target → Program Device — good for first-time bring-up and visual confirmation.
2. **Export scaffold:** Bundles may include `program_and_test.tcl` (commented); prefer `redbyte_program_device.tcl` for certification so the `.bit` path is explicit.

See `docs/release/vivado-basys3-certification-matrix.md` for **E2 — Board-program-certified** vs manual behavior checks (**E3**).

## From-scratch certification exports (blank-shaped `RBProject`)

No `examplesCatalog` id — mirrors a student save with `projectKind: 'blank'`:

```powershell
pnpm lab:vivado:cert:from-scratch fs-comb-switch-and-basys3
pnpm lab:vivado:cert:from-scratch fs-seq-two-bit-counter-basys3
```

ZIPs land under `out/vivado-cert/from-scratch/<fixture-id>/`. TA checklist: `docs/release/from-scratch-basys3-authoring-checklist.md`.
