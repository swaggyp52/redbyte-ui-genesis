# RedByte Troubleshooting Fast Path

Use this when something blocks setup, launch, Verify, Export, Vivado handoff, or import recovery.

## RedByte Will Not Launch

Check:

- You are in the RedByte folder.
- Setup already ran successfully.
- Another process is not using the launch port.

Run:

```powershell
.\doctor.ps1
.\launch.ps1 -NoOpen
```

Collect:

- the Doctor output
- the URL printed by launch
- any log path printed under `.redbyte/course/logs/`

Ask your professor or TA if Doctor reports FAIL or launch never prints a URL.

## Setup Failed

Check:

- Node.js is installed.
- pnpm/Corepack is available.
- You did not run `npm install`.

Run:

```powershell
.\setup.ps1
.\doctor.ps1
```

Collect:

- the first FAIL line
- the Node and pnpm versions Doctor reports

Ask for help if dependencies do not install or Node/pnpm cannot be found.

## Browser Does Not Open

Check:

- The terminal printed a local URL.
- Your browser can open the URL manually.

Run:

```powershell
.\launch.ps1 -NoOpen
```

Collect:

- the printed URL
- whether the URL opens manually

Ask for help if the page does not load after launch reports success.

## Verify Does Not Pass

Check:

- Expected outputs match the circuit you intended to build.
- Inputs are driven for each row.
- Sequential circuits use the supported clock/reset pattern.

Run:

```powershell
.\doctor.ps1
```

Then go back to Verify and run Compare checks again.

Collect:

- a screenshot of the failing Verify row
- the expected and observed output values
- a screenshot of the Design canvas

Ask for help after you can point to the first failing row.

## Export Says Stale Or Draft

Check:

- You changed Design after the last Verify run.
- You changed testbench rows after the last Verify run.
- You changed pin mapping after the last Verify run or export.

Run:

```powershell
.\doctor.ps1
```

Then:

1. Re-run Compare checks in Verify.
2. Re-check Hardware / Map Pins.
3. Return to Export and rebuild the package.

Collect:

- Export readiness screenshot
- Verify status screenshot
- Hardware mapping screenshot

Ask for help if the same stale warning stays after re-running Verify and rebuilding Export.

## Pins Are Unmapped

Check:

- Every required input has a Basys3 control.
- Every required output has a Basys3 LED or display resource.
- No two signals conflict on the same board resource unless the assignment expects it.

Run:

```powershell
.\doctor.ps1
```

Collect:

- Hardware / Map Pins screenshot
- the signal name that will not map
- the board resource you tried to use

Ask for help if the board resource is unavailable or conflicts unexpectedly.

## Vivado Does Not Open The Project

Check:

- You extracted the RedByte ZIP before opening it in Vivado.
- You are using the generated Tcl/project instructions from the export package.
- You are not expecting RedByte itself to run Vivado.

Collect:

- the RedByte export ZIP
- Vivado error text or screenshot
- the generated README from the export package

Ask for help with the Vivado error. This is outside RedByte's E0 export proof.

## Board Does Not Behave As Expected

Check:

- Vivado build succeeded.
- The bitstream was programmed to the Basys3 board.
- Switches/buttons/LEDs match the Hardware / Map Pins assignments.
- The expected behavior was tested with the same controls.

Collect:

- RedByte export package
- Vivado build or bitstream evidence
- programming evidence
- photo/video or instructor notes of observed behavior

Ask for help with the evidence level you reached: E1 build, E2 programming, or E3 observation.

## Import Failed

Check:

- The ZIP contains a RedByte project snapshot if you expect full restore.
- Raw Vivado HDL may import with partial fidelity only.
- Behavioral HDL may be blocked or imported only as ports.

Run:

```powershell
.\doctor.ps1
```

Collect:

- the import ZIP or file
- the Import surface error text
- whether you expected full restore or partial reconstruction

Ask for help if Import would replace work you still need.

## Project Feels Corrupted

Check:

- Whether you have an exported RedByte project package.
- Whether a browser refresh restores the last saved state.
- Whether Import can restore from a previous package.

Run a dry-run reset first:

```powershell
.\scripts\course\windows\reset.ps1 -DryRun
```

Do not run destructive reset until you know where your exports are saved.

Collect:

- current project name
- most recent export package
- reset dry-run output

Ask for help before deleting any local generated files.

## PowerShell Blocks Scripts

Check:

- The error says script execution is disabled.
- You are running from the RedByte folder.

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\launch.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\doctor.ps1
```

Collect:

- the exact PowerShell error
- whether the bypass command works

Ask for help if school machine policy blocks even the bypass command.
