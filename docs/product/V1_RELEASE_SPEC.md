---
doc_status: current
last_validated: 2026-05-03
owner: Connor Angiel
used_by_claude: true
role: v1 release scope definition — what must be true before calling this v1 public
---

# RedByte v1 — Release Specification

**Purpose:** Defines the minimum true scope of "v1 public release." Use this to evaluate whether a feature or fix is v1-required, post-v1, or out of scope entirely. Every item marked required must be honestly verified — not assumed.

---

## 1. Public v1 Name and Scope

**Product name:** RedByte Studio
**Version label:** v1.0
**Hardware target:** Digilent Basys3 (`xc7a35tcpg236-1`)
**Vivado version:** 2024.2
**Circuit scope:** Combinational circuits + rising-edge single-clock sequential circuits

**Out of scope for v1 (must be blocked or warned, not silently wrong):**
- Falling-edge-triggered state capture (authored high-to-low stimulus remains valid for the rising-edge model)
- Multi-clock domains
- Active-low reset
- Asynchronous sequential logic
- Any board other than Basys3

---

## 2. Required User Journey

A v1 release is complete when a student with no prior HDL experience can:

1. Open the IDE in a browser with no installation and no account.
2. Open or create a project (from a starter example or from scratch).
3. Build a supported circuit in Design (combinational or single-clock sequential).
4. Run Verify and receive a meaningful pass/fail result with waveform evidence.
5. Map circuit I/O to Basys3 board pins in Map Pins.
6. Export a Vivado Kit ZIP with a clear trust/draft label.
7. Open the exported project in Vivado 2024.2, synthesize it, and program a Basys3 board.
8. At no step encounter a contradictory status signal, a fake readiness indicator, or a silent failure.

This journey must be E1-certified for at least the following circuit classes:
- Combinational (switch → LED mapping)
- Sequential (single-clock counter with CLK100MHZ / W5)

---

## 3. Required Surfaces

All five workflow surfaces must be present and non-broken. "Non-broken" means:

| Surface | Minimum bar |
|---------|------------|
| Project | Loads, shows project metadata, navigates to all surfaces, starter gallery works |
| Design | Place/wire/delete/undo for all palette components; inline circuit health feedback; no silent failures on export-blocking errors |
| Verify | Runs scenarios; shows waveforms; reports Compare Pass/Fail honestly; board-clock (CLK100MHZ / W5) auto-detected and handled correctly |
| Map Pins | Maps all circuit I/O to Basys3 board resources; no phantom "NEEDS REVIEW" on complete mapping |
| Export | Generates valid Vivado Kit; honest trust/draft label; 8-step Vivado checklist present |

Import is a utility, not a workflow step. It must not crash and must navigate to Design after a successful import. Full fidelity reporting is post-v1 stretch.

---

## 4. Required Examples and Learning Path

The v1 starter gallery must contain at minimum:

| Example | Learning goal | Certification floor |
|---------|--------------|-------------------|
| `golden-basys3-switch-and` | Combinational: AND gate, switch → LED | E1 + E2 (E3 pending manual observation) |
| `signal-tour` | Combinational: 4 switches → 4 LEDs, identity mapping | E1 + E2 + E3 |
| `two-bit-counter` | Sequential: CLK100MHZ, counter, board clock auto-mode | E1 + E2 (E3 pending TA checklist) |

Each example must have:
- A short student-facing description (what this circuit does)
- The learning goal (what this teaches)
- The certification tier (honest: do not claim E3 if only E1 is proven)

Lab starters (`lab1-gates` through `lab8-security-lock-fsm`) exist and are L0/E0. They are not v1-required to be E1-certified but must not be labeled as "ready for hardware" without evidence.

**The v1 learning path order (guided):**
1. Basic combinational — AND/OR/XOR gate truth table (`signal-tour` or `golden`)
2. From-scratch combinational — build and export your own switch-LED design
3. Sequential introduction — `two-bit-counter` with board clock
4. From-scratch sequential — build your own counter and export it

---

## 5. Required Verification and Proof Behavior

Verify must behave truthfully:

- A "Compare Passed" result means observed outputs match expected outputs for the current circuit state. It is not valid if the circuit has changed since the last run.
- "Stale" must be surfaced when the circuit changes after a passing result.
- Export must not offer Trusted Export status when Verify is stale or failing.
- Board-clock scenarios (CLK100MHZ / W5) must auto-detect in the IDE and drive the testbench correctly in the exported VHDL.
- No scenario with unsupported sequential features (falling-edge-triggered capture, multi-clock, active-low reset) may silently pass — they must be blocked or warned at Verify and at Export. An authored high-to-low transition is valid rising-edge-model stimulus and must hold state rather than being rejected as a falling-edge-triggered design.

---

## 6. Required Basys3 / Vivado Export Behavior

The Vivado Kit ZIP must:

- Contain `top.vhd`, `top_tb.vhd`, `top.xdc`, `<project>.xpr`, `create_project.tcl`, `manifest.json`, `README.md`.
- Pass Vivado synth_1 → impl_1 → write_bitstream in batch mode with no errors (E1).
- Produce a bitstream that programs a real Basys3 via Hardware Manager (E2).
- Have an XDC that uses correct Basys3 package pin names (from the Digilent Basys3 master XDC).
- Include a `create_clock` constraint for CLK100MHZ / W5 when a clock is present.
- Have a testbench whose port names match the entity ports exactly (cross-artifact consistency check must pass).
- Preview in Export surface must match the bytes in the downloaded ZIP (single codepath — already enforced).

Export ZIP must be labeled:
- **Trusted Export** only when: Compare PASS is current, mapping is current, export bundle is current, and all these agree on the same project state.
- **Draft Export** in all other cases. Draft Export is not a failure state — it is honest framing.

---

## 7. Non-Goals for v1

Do not build these for v1. If a Claude Code session proposes one, reject it.

- LMS integration (Canvas, Blackboard, Moodle)
- Instructor dashboard / student progress tracking
- Accounts, cloud storage, or server-side project persistence
- AI-assisted circuit generation or auto-fix suggestions
- Board support beyond Basys3
- VHDL import with full fidelity reporting (partial import is acceptable)
- Seven-segment display heavy examples (Lab 8 / SSD)
- Hierarchical / bus-native circuits
- Multi-clock or asynchronous sequential support
- Desktop app or Electron packaging
- Offline mode / PWA
- Submission grading pipeline
- Any feature not grounded in the current working codebase
