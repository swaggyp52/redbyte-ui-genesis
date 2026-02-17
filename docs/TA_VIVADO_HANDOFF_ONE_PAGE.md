# TA One-Page: Vivado Handoff Demo (2-3 min)

## Preflight
- `git rev-parse --short HEAD` is `2e1db2b6` or later
- `git status --short` is empty
- Optional cleanup: `Remove-Item -Recurse -Force .\vivado_out -ErrorAction SilentlyContinue`

## Click Path
1. Open **Lab 4**
2. Open **HDL Editor**
3. In **Vivado Handoff**:
   - Confirm buttons: `Download TCL`, `Run Vivado Batch`, `Demo Reset`, `Inject XDC Mismatch`, `Restore XDC`

## Pass/Fail Checks
- **Vivado command field** updates preview deterministically when path is edited
- **Download TCL** produces `synth_check.tcl`
- `synth_check.tcl` contains:
  - part `xc7a35tcpg236-1`
  - `./top.vhd`, `./top.xdc`
  - output root `./vivado_out`
  - report outputs under `vivado_out/reports`
- **Run Vivado Batch** surfaces clear status/log outcome in panel

## Expected Output Filenames
- `synth_check.tcl`
- `vivado_out/vivado.log`
- `vivado_out/reports/utilization.rpt`
- `vivado_out/reports/timing.rpt`
- `vivado_out/reports/messages.rpt`
- `vivado_out/reports/drc.rpt`

## Intentional Failure Demo
1. Click `Inject XDC Mismatch`
2. Click `Run Vivado Batch`
3. Verify Build Console shows mismatch block with missing/extra port list
4. Click `Restore XDC`
5. Re-run and confirm normal flow

## Reset Between Demos
- Click `Demo Reset`
- Optional filesystem cleanup:
  - `Remove-Item -Recurse -Force .\vivado_out -ErrorAction SilentlyContinue`

## Live Script (say this)
1. "Export is VHDL-first: `top.vhd`, `top.xdc`, README."
2. "Vivado Handoff generates deterministic `synth_check.tcl` and runs headless batch."
3. "Reports/logs are surfaced in-panel; failures are reproducible and actionable."