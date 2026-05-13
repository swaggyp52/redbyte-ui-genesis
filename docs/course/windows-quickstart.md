# RedByte Windows Course Quickstart

Use these commands from the RedByte repo root in PowerShell.

## Start Here

- [Student Quick Start](./student-quick-start.md)
- [Professor Quick Start](./professor-quick-start.md)
- [Evidence Levels](./evidence-levels.md)
- [Troubleshooting Fast Path](./troubleshooting-fast-path.md)

## Setup

```powershell
.\setup.ps1
```

This checks PowerShell, Node.js, pnpm/Corepack, and installs dependencies with `pnpm install --frozen-lockfile`.

Vivado is optional for normal app launch. A Basys3 board is optional for normal app launch.

## Launch

```powershell
.\launch.ps1
```

The launcher starts RedByte locally, prints the URL, and writes logs under `.redbyte/course/logs/`.

Useful options:

```powershell
.\launch.ps1 -Port 5180
.\launch.ps1 -NoOpen
.\launch.ps1 -Foreground
```

When launched in the default background mode, the script prints a `taskkill /PID ... /T /F` stop command and writes it to `.redbyte/course/logs/launch-latest.json`.

## Doctor

```powershell
.\doctor.ps1
```

The doctor checks Node.js, pnpm, installed dependencies, product scripts, startup smoke, and the public start route contract. Git, Vivado, and Basys3 checks are advisory unless a professor asks for hardware validation.

## Update

```powershell
.\scripts\course\windows\update.ps1
```

For Git clones, this pulls `origin/main` with a fast-forward-only update and reinstalls dependencies. If the folder came from a ZIP, the script explains the safe ZIP replacement path.

## Reset

```powershell
.\scripts\course\windows\reset.ps1
```

Reset defaults to dry-run mode. To actually remove allowlisted local generated files:

```powershell
.\scripts\course\windows\reset.ps1 -ConfirmReset
```

The reset script is limited to generated/cache folders. It does not delete source files or student project exports by default.

## Execution Policy

If PowerShell blocks a script on a student machine, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1
```

Use the same pattern for `launch.ps1` or `doctor.ps1` if needed.

## Evidence Reminder

- E0: RedByte export package exists.
- E1: Vivado build / bitstream evidence exists.
- E2: board programming evidence exists.
- E3: observed physical board behavior exists.

RedByte can create E0 packages. Vivado and hardware evidence remain separate steps; E2 board programming does not prove E3 observed behavior.
