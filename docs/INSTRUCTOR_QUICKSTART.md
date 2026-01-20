# Instructor Quickstart (FPGA MVP)

Copy/paste-ready steps for Day 1 class.

## 1) Install (one command)

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
iwr -useb https://raw.githubusercontent.com/<ORG>/<REPO>/main/scripts/bootstrap.ps1 | iex
```

Optional override to a specific tag or commit:

```powershell
$env:RB_GIT_REF="fpga-mvp-0.1.0"
iwr -useb https://raw.githubusercontent.com/<ORG>/<REPO>/main/scripts/bootstrap.ps1 | iex
```

## 2) Run a SIM smoke test (hardware-free)

```powershell
RB_FPGA_SIM=1 powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke_fpga.ps1
```

## 3) Generate instructor signing keys

```powershell
pnpm --filter @redbyte/rb-fpga-signing keygen
```

Keep the private key secret. Store the public key in `packages/rb-fpga-signing/src/trusted-keys.ts`.

## 4) Sign a student bundle

```powershell
pnpm --filter @redbyte/rb-fpga-signing rb-sign path\to\student.rb-lab.zip --key <privateKeyHex> --inplace
```

## 5) Grade with Submission Inspector

1. Open Submission Inspector and import the `.rb-lab.zip`.
2. Confirm signature status.
3. Review checks + replay.
4. Click **Export Grading Report** to download JSON.

## Common failures and fixes

- No COM ports: check USB cable, Windows Device Manager, or drivers.
- No packets: ensure the FPGA bitstream is programmed and UART is sending binary frames.
- Signature invalid: confirm instructor public key is in `trusted-keys.ts` and the bundle was re-signed after changes.
- Trace missing: ensure trace recording is enabled before export.
