# RedByte Professor Quick Start

This guide is for running RedByte ECE141 Course Edition in a lab, classroom, or pilot handoff.

## Course Use Case

RedByte supports the ECE141 digital logic workflow:

```text
Project -> Design -> Verify -> Hardware / Map Pins -> Export -> Vivado / board evidence
```

It is best positioned as a browser-based lab assistant for early digital logic and FPGA labs, with Vivado still downstream for synthesis, implementation, bitstream generation, and board programming.

## What You Can Rely On

- Certified starter path: Logic Gates, Half Adder, and 2-Bit Up Counter.
- Product gates for Project, Verify, Hardware / Map Pins, Export, Import/Export recovery, Vivado artifact ZIPs, UI hierarchy, and starter loading.
- Windows scripts for setup, launch, doctor checks, updates, and safe reset.
- E0 Vivado package export from RedByte.
- Import/export recovery for RedByte project packages.
- Explicit separation between E0, E1, E2, and E3 evidence.

## What You Should Not Claim

- A RedByte export is not proof that Vivado built the design.
- A RedByte export is not proof that a Basys3 board was programmed.
- A RedByte export is not proof that board behavior was observed.
- E2 board programming evidence is not the same as E3 observed behavior.

Use RedByte's E0 export as the handoff point into Vivado, not as a substitute for Vivado or physical-board evidence.

## Suggested Lab Progression

| Lab | Focus | RedByte role |
|---|---|---|
| Lab 1 | Basic gates | Start from Logic Gates, run Verify, map switches/LEDs, export E0. |
| Lab 2 | Half adder / combinational logic | Use Half Adder, inspect truth table checks, export for Vivado if required. |
| Lab 3 | Counter / sequential logic | Use 2-Bit Up Counter, discuss clock/reset boundaries, export for Vivado if required. |
| Later labs | Instructor-defined extensions | Use only within the supported component and evidence boundaries. |

Advanced starters can be useful demonstrations, but they should be explicitly bounded by the instructor.

## Setup Options

For lab machines:

1. Clone or unpack RedByte.
2. Run `.\setup.ps1`.
3. Run `.\doctor.ps1`.
4. Launch with `.\launch.ps1`.

For student laptops:

1. Give students the repo or ZIP package.
2. Have them run `.\setup.ps1` from PowerShell.
3. Have them run `.\doctor.ps1` if setup or launch fails.

For Git clones, updates can use:

```powershell
.\scripts\course\windows\update.ps1
```

For ZIP distribution, replace the folder with the new ZIP contents instead of trying to pull from Git.

## In-Class Support Workflow

When a student is stuck:

1. Ask them to run `.\doctor.ps1`.
2. Check whether Verify has a current Compare PASS.
3. Check Hardware / Map Pins for missing or stale mappings.
4. Check Export evidence rows and draft/trusted wording.
5. Ask for the RedByte package and screenshots when needed.

Do not debug Vivado or board behavior as if RedByte already proved it. Keep the evidence level clear.

## Grading And Evidence

| Level | How to grade it |
|---|---|
| E0 | RedByte package exists and contains the expected handoff files. |
| E1 | Vivado build or bitstream evidence exists. |
| E2 | Board programming evidence exists. |
| E3 | Board behavior was observed against the lab expectation. |

Do not grade E2 as E3. A programmed board is not automatically a correctly behaving board.

## Known Limitations

- Vivado remains external.
- Basys3 hardware remains external.
- Physical board behavior still requires human observation or recorded evidence.
- Some advanced starters may need instructor judgment.
- Fresh-clone / fresh Windows rehearsal is still the next handoff check before RC packaging.

## Recommended First-Week Rollout

1. Install day: students run `.\setup.ps1` and `.\doctor.ps1`.
2. Instructor demo: load Logic Gates and run Verify.
3. Student exercise: change the circuit, re-run Verify, and fix the result.
4. Mapping exercise: map switches and LEDs in Hardware / Map Pins.
5. Export exercise: download the E0 Vivado package.
6. Optional hardware day: build in Vivado, program Basys3, and collect E2/E3 evidence if required.

## Related Docs

- [Student Quick Start](./student-quick-start.md)
- [Windows Course Quickstart](./windows-quickstart.md)
- [Evidence Levels](./evidence-levels.md)
- [Troubleshooting Fast Path](./troubleshooting-fast-path.md)
