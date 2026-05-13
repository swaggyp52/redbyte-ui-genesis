# RedByte Student Quick Start

This guide is for ECE141 students using RedByte on a Windows machine.

## What RedByte Is

RedByte is a digital logic lab assistant. It helps you:

- start an ECE141 project
- build a circuit in the browser
- run Verify checks
- map signals to Basys3 board pins
- export a Vivado handoff ZIP
- keep evidence levels separate

The normal workflow is:

```text
Project -> Design -> Verify -> Hardware / Map Pins -> Export -> Vivado / board evidence
```

## What RedByte Is Not

RedByte is not Vivado. It does not synthesize the design, generate the bitstream, program the board, or prove that the physical board behaved correctly.

RedByte is also not a replacement for understanding digital logic. If Verify fails, use the failure information to reason about your circuit.

By itself, a RedByte export is only E0 evidence. It is not E1, E2, or E3.

## First-Time Setup

Open PowerShell in the RedByte folder and run:

```powershell
.\setup.ps1
```

Setup checks PowerShell, Node.js, pnpm/Corepack, and installs the project dependencies with:

```powershell
pnpm install --frozen-lockfile
```

Setup does not require Vivado, a Basys3 board, or administrator permissions for normal RedByte launch.

If PowerShell blocks the script, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1
```

## Launch

From the RedByte folder, run:

```powershell
.\launch.ps1
```

The launcher prints the local URL. Open that URL in your browser if the browser does not open automatically.

Useful launch options:

```powershell
.\launch.ps1 -NoOpen
.\launch.ps1 -Port 5180
.\launch.ps1 -Foreground
```

## Basic Lab Workflow

1. **Project**: choose the certified course starter or open your saved work.
2. **Design**: build the circuit on the canvas.
3. **Verify**: run Compare checks and fix any failing rows.
4. **Hardware / Map Pins**: bind each circuit input and output to a Basys3 control or LED.
5. **Export**: build and download the RedByte Vivado handoff package.
6. **Vivado / board evidence**: use Vivado and the Basys3 board if your instructor requires build, programming, or observed-behavior evidence.

## Certified Starter Path

Start with the certified course path unless your instructor gives different instructions:

1. Logic Gates
2. Half Adder
3. 2-Bit Up Counter

Other starters may be useful, but they may need instructor guidance.

## Evidence Levels

| Level | Meaning | Example |
|---|---|---|
| E0 | RedByte export package exists | You downloaded the RedByte Vivado ZIP. |
| E1 | Vivado build / bitstream evidence exists | Vivado generated a bitstream or build log. |
| E2 | Board programming evidence exists | Vivado Hardware Manager programmed the Basys3 board. |
| E3 | Observed physical board behavior exists | A photo, video, or instructor observation shows the LEDs behaving correctly. |

Do not turn in E0 as if it proves E1, E2, or E3. Your instructor decides which levels are required for a lab.

## What To Submit

Your instructor may ask for different evidence by lab. Common items are:

- the RedByte export package
- Vivado build evidence, if required
- board programming evidence, if required
- observed board behavior evidence, if required

When in doubt, submit the RedByte package plus the evidence your instructor asked for.

## When You Are Stuck

Run:

```powershell
.\doctor.ps1
```

Then check the workflow in order:

1. Re-run Verify.
2. Fix failing Compare rows before Export.
3. Check Hardware / Map Pins for missing or stale mappings.
4. Rebuild Export after changes.
5. Try a non-destructive reset preview:

```powershell
.\scripts\course\windows\reset.ps1 -DryRun
```

Ask your professor or TA with the RedByte package, screenshots, Doctor output, and the exact step where you got stuck.

## More Help

- [Windows Course Quickstart](./windows-quickstart.md)
- [Evidence Levels](./evidence-levels.md)
- [Troubleshooting Fast Path](./troubleshooting-fast-path.md)
