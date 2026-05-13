# RedByte Evidence Levels

RedByte uses evidence levels so students and instructors do not confuse browser export, Vivado build, board programming, and observed hardware behavior.

## E0: RedByte Export Package Exists

E0 means RedByte produced a handoff package.

Example:

- A RedByte Vivado ZIP was downloaded from Export.
- The ZIP contains generated files such as VHDL, XDC, Tcl, README, and the RedByte project snapshot.

E0 does not mean Vivado built the design.

## E1: Vivado Build / Bitstream Evidence Exists

E1 means Vivado produced build evidence for the exported design.

Examples:

- Vivado synthesis and implementation completed.
- Vivado generated a bitstream.
- A Vivado build log records the successful run.

E1 does not mean the board was programmed or observed.

## E2: Board Programming Evidence Exists

E2 means the Vivado-generated bitstream was programmed onto a Basys3 board.

Examples:

- Vivado Hardware Manager shows the Basys3 target programmed.
- A programming log or screenshot records the programmed device.

E2 does not mean the board behaved correctly.

## E3: Observed Physical Board Behavior Exists

E3 means the physical board behavior was observed against the expected lab behavior.

Examples:

- A photo or video shows the correct LED behavior for the assigned switch inputs.
- An instructor or TA observes the board behavior directly.
- A lab note records the expected controls and observed outputs.

## Anti-Examples

| Claim | Why it is wrong |
|---|---|
| RedByte export proves Vivado success. | Export is E0, not E1. |
| Vivado bitstream proves board behavior. | Bitstream evidence is E1, not E3. |
| Board programmed means the lab worked. | Programming is E2; behavior still needs E3 observation. |
| A screenshot of RedByte Verify is board proof. | Verify is browser evidence; board behavior is external. |

## Quick Rule

Use the strongest evidence you actually have, and do not skip levels in your wording.
