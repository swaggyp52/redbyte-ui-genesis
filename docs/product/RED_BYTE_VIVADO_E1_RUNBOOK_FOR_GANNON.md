---
doc_status: current
last_validated: 2026-07-02
owner: Connor Angiel
used_by_claude: true
role: Gannon Vivado E1 runbook
---

# RedByte Vivado E1 Runbook For Gannon

## Purpose

This runbook lets a Gannon lab machine turn RedByte browser export confidence into real Vivado E1 evidence.

E1 means Vivado can import/open the RedByte package, accept compile order, run the included behavioral testbench when present, and complete synthesis. E1 does not mean bitstream generation, Basys3 programming, or observed board behavior.

## Machine Requirements

- Windows lab machine.
- Vivado 2024.2 installed, preferably at `C:\Xilinx\Vivado\2024.2\bin\vivado.bat`.
- PowerShell.
- Git.
- Network access to GitHub and `https://redbyteapps.dev/os`.
- Enough disk space for Vivado project extraction and logs.

Do not install or update Vivado during the certification run unless the lab owner explicitly approves it.

## Target Designs

Run the full five-design set when possible:

1. Logic Gates
2. Half Adder
3. Full Adder
4. 4-Bit Ripple Carry Adder
5. 2-Bit Up Counter

The minimum Gannon pilot decision set is Logic Gates, Full Adder, 4-Bit Ripple Carry Adder, and 2-Bit Up Counter. Half Adder is a simple arithmetic control.

## Prepare The Repo

Open PowerShell and run:

```powershell
git clone https://github.com/swaggyp52/redbyte-ui-genesis.git redbyte-ui-genesis-main
cd redbyte-ui-genesis-main
git fetch origin
git checkout main
git pull --ff-only origin main
git rev-parse HEAD
```

The final SHA must match the intended RedByte release SHA for the run. Also check the public build identity:

```powershell
(Invoke-WebRequest -Uri 'https://redbyteapps.dev/os/version.json' -UseBasicParsing).Content
(Invoke-WebRequest -Uri 'https://redbyteapps.dev/os/build.json' -UseBasicParsing).Content
```

If local `HEAD`, `origin/main`, and production `/os/version.json` do not point at the intended release, stop and report the mismatch.

## Check Vivado

Run:

```powershell
where.exe vivado
Get-Command vivado
powershell -ExecutionPolicy Bypass -File scripts/vivado/redbyte-e1-certify.ps1 -Mode EnvCheck
```

If Vivado is not found but the lab machine has it installed elsewhere, rerun certification with `-VivadoPath <path-to-vivado.bat>`.

## Collect Packages

If production ZIPs were already downloaded into one folder, use that folder as the package directory.

If no package folder exists yet, use:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/vivado/redbyte-e1-collect.ps1 -OutDir .redbyte/vivado-e1-packages
```

If the collector reports missing packages, download the RedByte/Vivado ZIPs from production Export and put them in `.redbyte/vivado-e1-packages`.

## Run E1

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/vivado/redbyte-e1-certify.ps1 -Mode Certify -PackageDir .redbyte/vivado-e1-packages -OutDir .redbyte/vivado-e1/<timestamp>
```

Replace `<timestamp>` with a simple run label such as `20260702-gannon-e1`.

Optional route-only implementation dry run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/vivado/redbyte-e1-certify.ps1 -Mode Certify -PackageDir .redbyte/vivado-e1-packages -OutDir .redbyte/vivado-e1/<timestamp>-impl-dry-run -IncludeImplementation
```

This optional run still does not claim bitstream or board success.

## Send Results Back

Send the entire `.redbyte/vivado-e1/<timestamp>/` folder back, including:

- `manifest.json`
- `results.md`
- `environment.json`
- `package-summary.json`
- `designs/`
- `logs/`

Do not summarize from memory. Preserve exact Vivado logs.

## Classify Results

Use these meanings:

- `PASS_E1`: Vivado E1 completed for the design.
- `FAIL_IMPORT`: project open/import/package shape failed.
- `FAIL_COMPILE`: compile order or elaboration readiness failed.
- `FAIL_TESTBENCH`: behavioral testbench failed.
- `FAIL_SYNTH`: synthesis failed.
- `FAIL_IMPL_DRY_RUN`: optional implementation dry run failed.
- `BLOCKED_NO_VIVADO`: Vivado is not installed or discoverable.
- `BLOCKED_PACKAGE_MISSING`: a required ZIP was missing.
- `BLOCKED_UNSUPPORTED_CONSTRUCT`: static audit found unsupported content before Vivado certification.

If Vivado fails, do not guess. Send the logs.

## Gannon Pilot Meaning

Passing E1 would mean the selected RedByte exports are credible Vivado-build inputs for the Gannon pilot. It would not mean:

- bitstream E2 proof,
- Basys3 programming proof,
- observed board behavior E3,
- a full-course commercial readiness claim,
- unsupervised grading readiness.

Use E1 as a real toolchain gate before any board proof or broader pilot claim.
