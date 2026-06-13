---
doc_status: current
last_validated: 2026-06-13
owner: Connor Angiel
used_by_claude: true
role: primary-source workflow research for the RedByte V1 product contract reset
---

# RedByte Competitive And Workflow Research

Date: 2026-06-13

This research grounds the RedByte V1 contract reset in current official or primary-source references. It is product input, not product proof. It does not claim new RedByte runtime, Vivado, Basys3, or hardware behavior.

## Research Method

Sources were chosen in this order:

1. Official vendor documentation for Vivado and Basys3 handoff.
2. Official project documentation or repositories for comparator educational tools.
3. Public university lab material showing common digital-logic and Basys3/Vivado teaching workflow.

## Source Set

| Source | Type | Why it matters for RedByte |
|---|---|---|
| [AMD Vivado Design Suite User Guide: Design Flows Overview UG892](https://docs.amd.com/r/en-US/ug892-vivado-design-flows-overview) | Vendor official | Establishes Vivado as the downstream design-flow owner for project/non-project, synthesis, implementation, reports, and bitstream flow. |
| [AMD Vivado Design Suite User Guide: Programming and Debugging UG908](https://docs.amd.com/r/en-US/ug908-vivado-programming-debugging) | Vendor official | Establishes programming/debugging as an external hardware proof path, not a RedByte browser claim. |
| [Digilent Basys 3 Reference](https://digilent.com/reference/programmable-logic/basys-3/start) | Board vendor official | Establishes Basys3 as the concrete board target and resource family. |
| [Digilent Basys-3-Master.xdc](https://github.com/Digilent/digilent-xdc/blob/master/Basys-3-Master.xdc) | Board vendor primary repository | Establishes the pin/XDC source RedByte should trace board bindings to. |
| [CircuitVerse for Educators](https://circuitverse-docs.netlify.app/chapter2/chapter2-cvforeducators/) | Official docs | Shows the classroom-platform direction: groups, assignments, grades, and embeddable circuits. Useful as a contrast, not immediate V1 scope. |
| [Logisim Evolution README](https://github.com/logisim-evolution/logisim-evolution) | Primary repository | Shows the mature educational simulator baseline: visual design, simulation, chronogram, component library, and board integration. |
| [Digital by hneemann README](https://github.com/hneemann/digital) | Primary repository | Shows a high bar for schematic simulation plus test cases, VHDL/Verilog export, and Basys3 support. |
| [HDLBits](https://hdlbits.01xz.net/wiki/Main_Page) and [HDLBits problem sets](https://hdlbits.01xz.net/wiki/Problem_sets) | Official site | Shows the immediate-feedback learning model: submit a small design, simulate with vectors, compare to a reference. |
| [UCF EEE3342 Digital Systems Lab Manual](https://www.ece.ucf.edu/wp-content/uploads/2019/09/EEE3342LabManual-small.pdf) | Public university lab manual | Shows a common beginner lab path: design a two-input gate, simulate/implement in Vivado, download to Basys board, test LEDs/switches, document truth table/results. |
| [Oakland University ECE2700 Digital Logic Design](https://www.secs.oakland.edu/~llamocca/Fall2022_ece2700.html) | Public university course page | Shows typical course resource packaging: board docs, master XDC files, Vivado software, lab assignments, and final projects. |

## Findings

### Vivado Is The Downstream Tool, Not The Competitor To Clone

Vivado owns synthesis, implementation, reports, bitstream generation, hardware manager, and device programming. RedByte should not promise to replace it. RedByte V1 should make the student-ready handoff to Vivado less fragile: coherent HDL, XDC, testbench, README, Tcl, and a proof label that says exactly what was proven before export.

Product implication:

- RedByte must keep E0 browser/package proof separate from E1 Vivado build, E2 programming, and E3 observed behavior.
- Export should feel like a handoff station, not a magic hardware button.
- The contract should require visible artifact provenance and "what to do next in Vivado" guidance.

### Basys3 Teaching Workflows Are Board-Resource Workflows

Basys3 labs commonly revolve around switches, LEDs, buttons, clock, seven-segment display, XDC constraints, Vivado simulation/build, board programming, and manual observation. The Digilent master XDC is a product-truth source for package pins and clock constraints.

Product implication:

- RedByte V1 should stay Basys3-specific until a second board profile has data, UI, export, and proof.
- Hardware / Map Pins should present the actual board-control binding job first: project signal, board alias, physical package pin, XDC effect.
- V1 should not hide board truth behind generic "hardware" dashboards.

### CircuitVerse Shows The Classroom Platform Branch, But That Is Not V1 Core

CircuitVerse has a browser simulator and educator workflows around groups, assignments, deadlines, grading, and embeddable circuits. That proves classroom management can be valuable, but it also shows that accounts and grading infrastructure are a separate product layer.

Product implication:

- RedByte should defer SaaS/accounts until there is a concrete class-data requirement.
- V1 should first earn trust as a local/browser lab workbench and Vivado handoff tool.
- Instructor support can begin with course packs and quickstarts before hosted classroom management.

### Logisim Evolution Sets The Educational Simulator Baseline

Logisim Evolution is a mature visual logic design and simulation tool with component breadth, chronograms, and an accessible first-circuit path. RedByte cannot win by being a generic simulator with more chrome.

Product implication:

- RedByte should focus on the workflow Logisim-style simulators do not own completely: Basys3 mapping, Vivado-ready package generation, and explicit proof tiers.
- Design must still feel like a real circuit workbench. If students cannot see the circuit graph immediately, RedByte loses even before its FPGA handoff value appears.

### Digital Raises The Bar For Test Cases, HDL Export, And Basys3 Support

Digital supports circuit simulation, test cases, VHDL/Verilog export, and direct Basys3 support. It is the closest comparator for "schematic to FPGA handoff" in this research set.

Product implication:

- RedByte Verify must behave like an evidence workbench, not a decorative run panel.
- Export must keep generated artifacts inspectable and internally consistent.
- Basys3 board support must be visible and honest, not buried below generic status panels.

### HDLBits Shows Why Immediate Feedback Matters

HDLBits uses small exercises, submitted HDL modules, simulation vectors, and immediate correctness feedback. The learning loop is simple: attempt, run, compare, repair.

Product implication:

- RedByte's Verify surface should prioritize the same loop: authored inputs, expected outputs, observed outputs, exact mismatch, repair path, rerun.
- Observe and Compare must stay distinct. Observe teaches behavior; Compare is the trusted proof state.
- Failure repair must be first-class, not secondary diagnostics.

### University Labs Show The Common Student Artifact Trail

Public lab material commonly asks students to provide truth tables, simulation results, code, constraints, downloaded/programmed board behavior, and written reports. These are artifacts, not just UI states.

Product implication:

- RedByte should produce teachable evidence: vectors, waveform/truth results, pin mapping, generated HDL/XDC/testbench, README, and explicit E0/E1/E2/E3 proof status.
- Student and instructor quickstarts should be written after the workbench states are stable.
- The product contract should include "no hardware claim without hardware proof" as a standing invariant.

## RedByte V1 Positioning From The Research

RedByte V1 should be:

- A browser-based Basys3 digital-logic lab workbench.
- A visual circuit editor with a truthful Verify evidence loop.
- A board mapping station that shows signal-to-Basys3-to-XDC truth.
- A Vivado handoff generator with transparent package artifacts.
- A proof-tiered teaching tool that keeps browser, Vivado, programming, and observation evidence separate.

RedByte V1 should not be:

- A Vivado replacement.
- A generic SaaS classroom platform.
- A broad HDL IDE.
- A universal FPGA-board abstraction.
- A simulator that hides real board and toolchain boundaries.
- A product that claims hardware readiness from screenshots or browser tests.

## Contract Inputs

These research conclusions feed directly into:

- `docs/contracts/RED_BYTE_V1_PRODUCT_CONTRACT.md`
- `docs/plans/RED_BYTE_DELETE_DEMOTE_REBUILD_INVENTORY.md`
- `docs/plans/RED_BYTE_V1_EXECUTION_PROGRAM.md`

## Attribution

Connor Angiel
