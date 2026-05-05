---
doc_status: current
last_validated: 2026-05-03
owner: Connor Angiel
used_by_claude: true
role: product identity spine — what RedByte is, what it is not, and how to talk about it
---

# RedByte Studio — Product Brief

**Version:** v1 draft
**Audience:** Claude Code sessions, future engineers, instructors, Connor
**Purpose:** Single authoritative answer to "what is this product?" Every session that touches product work must be consistent with this doc.

---

## 1. What RedByte Is

RedByte is a **browser-based educational IDE for digital logic and FPGA development.**

A student opens it in a browser, builds a circuit visually using logic primitives (gates, flip-flops, muxes), verifies the circuit's behavior against test scenarios with a deterministic simulation engine, maps inputs and outputs to physical pins on a Digilent Basys3 board, and exports a complete Vivado-ready project — VHDL source, XDC constraints, testbench, TCL script — that can be synthesized and programmed onto real hardware.

The workflow is linear and opinionated:

```
Project → Design → Verify → Map Pins → Export
```

Import is a utility entry point (load prior work into the pipeline). Board programming is an external handoff after Export. The IDE does not program the board.

**One-sentence version:** RedByte is a browser-based educational IDE where students visually design digital circuits, verify their behavior, and export complete working projects for the Digilent Basys3 FPGA board.

---

## 2. What RedByte Is Not

State these clearly. Do not soften them.

- **Not a replacement for AMD Vivado.** RedByte generates the project files that Vivado opens. Synthesis, implementation, and board programming still happen inside Vivado.
- **Not a general-purpose HDL editor.** Users who need to write complex VHDL or Verilog by hand should use a proper HDL IDE. RedByte generates HDL from a schematic.
- **Not a professional EDA tool.** It does not model voltage, timing margins, or physical layout.
- **Not a cloud service.** Projects are stored locally in the browser. No accounts required for basic use.
- **Not AI-assisted circuit generation.** It flags problems and gives feedback; students have to solve them.
- **Not a toy or simulator that hides the engineering.** The exported VHDL and XDC are real and work in Vivado without modification (for supported circuit types).
- **Not limited to ECE141-specific lab flows.** The spine supports serious from-scratch digital logic work within the supported component and board boundaries.
- **Not a black-box "make hardware work" button.** Students see and own every step.
- **Not a timing closure tool.**
- **Not a universal FPGA platform.** Current hardware target is Basys3 (`xc7a35tcpg236-1`) with Vivado 2024.2. No other boards are in scope for v1.

---

## 3. Core Product Thesis

**The gap RedByte fills:** Professional EDA tools (Vivado, Quartus) are not designed for first-time learners. General-purpose simulators (Logisim, CircuitVerse) do not connect to real hardware workflows. There is no tool that shows the full path — design, verify, map to real pins, export a project you can actually synthesize — in a single coherent environment.

RedByte is the on-ramp to the professional toolchain, not a replacement for it.

**The discipline that makes it credible:**
- Deterministic simulation: same circuit + same vectors = same results, always.
- Honest state vocabulary: Draft Export ≠ Trusted Export. Pass ≠ Simulated.
- Export truth: preview matches ZIP bytes (single codepath). Generated artifacts work in Vivado without modification.
- No overclaiming: the product says exactly what it can and cannot do.

---

## 4. Primary Users

**Primary:** University students in digital logic and computer architecture courses that use the Digilent Basys3 board and AMD Vivado toolchain (ECE/CS programs).

**Secondary:** Individual learners — makers, hobbyists, professionals refreshing fundamentals — who want an interactive, real-feeling environment for learning digital logic without a professional EDA background.

**Instructors and TAs:** Not primary users of the design workflow, but primary stakeholders for lab fixture quality, submission integrity, and workflow correctness.

---

## 5. Product Spine Detail

| Step | Surface | What it does |
|------|---------|-------------|
| 1 | Project | Project identity, metadata, workflow entry point, starter examples |
| 2 | Design | Visual schematic editor; logic primitives, flip-flops, muxes; undo/redo; inline circuit health |
| 3 | Verify | Deterministic simulation; test scenarios; pass/fail with waveform evidence; board-clock support |
| 4 | Map Pins | Bind circuit I/O to Basys3 board resources (switches, LEDs, buttons, CLK100MHZ) |
| 5 | Export | Generate Vivado Kit ZIP; trust/draft distinction; 8-step Vivado import checklist |
| — | Import | Utility: load `.rbx.zip` proof bundle or VHDL into the pipeline |

**State vocabulary that must be consistent across all surfaces:**

| Term | Meaning |
|------|---------|
| Draft Export | Structurally exportable, but proof is missing or stale |
| Trusted Export | Current Compare PASS + current mapping + current export bundle |
| Compare Passed | Observed outputs match expected outputs — the proof used for trusted handoff |
| Board Observed | Board behavior was recorded against an explicit observation procedure (E3 tier) |

---

## 6. Why RedByte Is Not Just Another Circuit Simulator

Logisim and CircuitVerse are excellent for exploring combinational logic behavior. RedByte is different in three ways:

1. **It connects to a real hardware workflow.** The output is not a screenshot or a simulation recording — it is a Vivado project that synthesizes and programs onto a Basys3.
2. **Verification is contract-based, not observational.** Students author expected outputs. Pass means the circuit matched the contract, not that it ran without crashing.
3. **The workflow is the pedagogy.** The five-step spine mirrors what engineers actually do: design → simulate → constrain pins → synthesize. Students learn the process, not just the behavior.

---

## 7. Why Vivado Is Downstream, Not Replaced

Vivado is the professional synthesis and implementation tool. RedByte does not attempt to replicate or replace it. This is intentional:

- Students who export from RedByte and open the project in Vivado are doing what engineers do.
- The constraint is honest: RedByte supports the design and verification phase. Vivado owns synthesis, implementation, and bitstream generation.
- Keeping the boundary clean means RedByte does not have to pretend to do timing closure, LUT mapping, or place-and-route.

The product framing is: **RedByte is the front end of the workflow. Vivado is the back end. Neither replaces the other.**

---

## 8. Product Language Rules

Follow these in all docs, website copy, onboarding text, and UI strings:

**Use:**
- "design, verify, map, export" (the verb spine)
- "deterministic simulation" (not "advanced AI simulation")
- "Vivado-ready project" or "Vivado Kit" (not "synthesized output")
- "supported circuit types" (not "all circuits")
- "Draft Export" / "Trusted Export" (exact casing, exact meaning)
- "Compare Passed" (not "verified" or "passed tests")
- "Basys3 (`xc7a35tcpg236-1`)" when precision matters

**Never use:**
- "auto-generate" (students build the circuit, the tool generates HDL from it)
- "AI-powered" or "intelligent" for any simulation or verification feature
- "works for any circuit" — it doesn't, and scope limits must be stated
- "replaces Vivado" or "no Vivado needed"
- "proven" as a blanket product claim — use the E1/E2/E3 tier matrix instead
- Hype language: "revolutionary," "seamless," "powerful," "next-generation"

**Tone:** Direct. Honest about limitations. Confident about what works. Engineering-appropriate.
