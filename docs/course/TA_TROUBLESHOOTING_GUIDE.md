---
doc_status: current
last_validated: 2026-06-14
owner: Connor Angiel
used_by_claude: true
role: TA troubleshooting and support triage guide
---

# RedByte TA Troubleshooting Guide

Use this when a student or instructor is stuck during a RedByte lab.

Do not start by changing source files or editing a student's export ZIP. First identify the stage, collect evidence, and classify the proof tier.

## 1. Capture The Basics

Ask for:

- RedByte URL or local launch method
- operating system and browser
- whether this is hosted RedByte or a local repo/folder
- project name or starter/profile used
- current surface: Project, Design, Verify, Hardware, Export, Import, Vivado, or board
- screenshot of the visible error/state
- exported ZIP if the issue involves Export, Vivado, or Import
- Vivado logs if the issue is E1 or E2
- board observation note if the issue is E3

For local Windows setup, ask the student to run:

```powershell
.\doctor.ps1
```

The Windows setup reference is:

```text
docs/course/windows-quickstart.md
```

## 2. Classify The Proof Tier

| Tier | Question | Do not confuse it with |
|---|---|---|
| E0 | Did RedByte produce current browser/package evidence? | Vivado success |
| E1 | Did Vivado synth/impl/bitstream complete for this export? | Board programming |
| E2 | Did the bitstream program onto Basys3? | Correct board behavior |
| E3 | Did observed board behavior match the assigned procedure? | Programming success |

If a student says "it works," ask which tier they mean.

## 3. Stage Triage

### Setup / Launch

Symptoms:

- script blocked by PowerShell
- app does not open
- port is already in use
- dependencies are missing

Actions:

1. Use the execution-policy command from `docs/course/windows-quickstart.md`.
2. Run `.\setup.ps1`.
3. Run `.\launch.ps1 -Port 5180` if the default port is occupied.
4. Run `.\doctor.ps1` and save the result.

Do not require Vivado or a Basys3 board for browser-only E0 work.

### Project

Symptoms:

- student is unsure where to start
- old work may be open
- Import / Recover path is being used as the main route

Actions:

1. Use Project as the command center.
2. Choose Build Fresh, Course Starter, Open Saved Project, or Import / Recover.
3. If replacing current work, confirm the student has saved or exported what they need.
4. Remind the student that Import is a utility, not the default lab start.

### Design

Symptoms:

- circuit graph is missing or not centered
- wire will not connect
- output is undriven
- unsupported component or circuit issue appears

Actions:

1. Use Fit or Center to inspect the graph.
2. Confirm connections flow from output ports to input ports.
3. Check that each required input/output boundary exists.
4. Fix visible design issues before Verify.
5. For failed Verify cases, trace the signal named in the first mismatch.

### Verify

Symptoms:

- stale proof
- Compare FAIL
- waveform does not match expected output
- sequential lab is confusing

Actions:

1. Separate Observe from Compare.
2. Re-run Compare after any design, testbench, or mapping change.
3. Open the first mismatch and compare expected vs observed values.
4. If expected values are wrong, edit expected outputs and rerun.
5. If observed values are wrong, return to Design and repair the logic.
6. For board-clocked sequential designs, check `CLK100MHZ` / `W5` clock policy before assuming manual pulses are required.

### Hardware / Map Pins

Symptoms:

- mapping incomplete
- wrong switch or LED selected
- renamed signal appears duplicated
- student thinks mapping programs the board

Actions:

1. Select each required project signal row.
2. Map inputs to input-capable resources and outputs to output-capable resources.
3. Check the visible chain: project signal -> Basys3 resource -> package pin -> XDC line.
4. Re-run Verify or review Export if mapping changed after proof.
5. State plainly that mapping is E0 browser/package evidence, not board programming.

### Export

Symptoms:

- Export is Draft or Needs Review
- package is blocked
- expected artifact is missing
- student wants to submit before Verify passes

Actions:

1. Read the top Export handoff state first.
2. If Draft, decide whether the assignment accepts draft packages. Most trusted handoffs need Compare PASS and mapping.
3. If blocked, follow the direct repair path shown by Export.
4. Rebuild/download after repairing Design, Verify, or mapping drift.
5. Ask for the fresh ZIP, not edited files from inside an old ZIP.

### Vivado

Symptoms:

- port not found
- XDC object not found
- synthesis or implementation fails
- timing warning appears

Actions:

1. Confirm the ZIP came from the current RedByte project state.
2. Re-export from RedByte before hand-editing Vivado files.
3. Use the package README or `vivado_import.tcl`.
4. Confirm the target part is `xc7a35t-1cpg236-1` or Basys3.
5. Save the full Vivado log for E1 triage.

### Board / Observation

Symptoms:

- board does not program
- programmed board does not show expected behavior
- student reports E2 as E3

Actions:

1. Confirm cable, board power, and Vivado Hardware Manager target.
2. Collect the programming log or screenshot for E2.
3. Run the assigned observation procedure separately for E3.
4. Record expected controls, controls toggled, expected outputs, observed outputs, and pass/fail/uncertain status.
5. Do not promote E2 to E3 without observed behavior.

### Import / Recovery

Symptoms:

- ZIP import fails
- imported circuit has missing vectors or mapping
- student imports `top.vhd` and expects a full RedByte project

Actions:

1. Prefer a RedByte export ZIP with `project.rbproj.json`.
2. Treat Vivado ZIPs and HDL-only inputs as reconstruction-limited.
3. Do not replace current work until the review state is acceptable.
4. If import fails, confirm that the active project was not replaced and choose RedByte ZIP, Vivado re-export, or Paste HDL as the next path.

## 4. Escalate When

- the app crashes or shows a blank surface after reload
- a current Compare PASS cannot be reached for a supported simple circuit
- Export changes artifact bytes unexpectedly without a source change
- a clean trusted E0 export fails Vivado for a supported project class
- a RedByte manifest ZIP corrupts or replaces active work unexpectedly
- a public starter/scaffold appears to include a solved assignment where the no-solution policy forbids it
- the issue requires a claim about E1/E2/E3 without current evidence

Use the product-hardening ticket template for product defects:

```text
docs/release/product-hardening-ticket-template.md
```

Use the rehearsal failure template for rehearsal failures:

```text
docs/rehearsal/failure-ticket-template.md
```

## 5. Support Notes

- RedByte supports Basys3 as the V1 board target.
- Accounts, rosters, LMS integration, and hosted grading are deferred.
- Vivado is external. RedByte exports handoff artifacts; Vivado builds and programs hardware.
- Physical board behavior must be observed and recorded separately from programming success.

## Attribution

Connor Angiel
