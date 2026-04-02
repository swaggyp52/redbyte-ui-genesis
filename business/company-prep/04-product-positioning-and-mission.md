# Product Positioning and Mission

**Company:** RedByte LLC (proposed)
**Prepared:** 2026-04-02

> All claims in this document are grounded in the current product. Features that are aspirational or on the roadmap are labeled as such.

---

## Mission Statement

To make digital logic and hardware design genuinely understandable — by giving learners a tool that is visual, transparent, and real enough to connect to actual hardware workflows.

---

## Vision Statement

A world where any student learning digital logic can go from a single logic gate to a working processor on real hardware, without losing the thread of understanding at any step along the way.

---

## Short Product Description (one sentence)

RedByte is a browser-based educational IDE where students visually design digital circuits, verify their behavior, and export complete, working projects for the Digilent Basys3 FPGA board.

---

## Long Product Description

RedByte is a web-based FPGA educational IDE for students learning digital logic and computer architecture. It provides a structured six-step workflow — Project, Design, Verify, Hardware, Export, Import — that takes a learner from an empty canvas to a real, synthesizable hardware design without requiring prior HDL experience.

In the Design surface, users build circuits visually using a schematic editor with a library of logic primitives: gates, flip-flops, multiplexers, and more. The simulation engine is deterministic and tick-based — circuits behave identically every run, which makes systematic debugging possible and meaningful.

In the Verify surface, users run test scenarios against their design and receive pass/fail results with waveform inspection and diagnostic hints. The engine explicitly distinguishes between a stale result and a failing result, and flags structural issues — combinational loops, multiple drivers, floating outputs — during design rather than at export time.

In the Hardware surface, users map their circuit's inputs and outputs to physical pins on the Basys3 FPGA board: switches, LEDs, buttons, and the 7-segment display. In the Export surface, they download a complete Vivado Kit ZIP — VHDL source, XDC pin constraints, testbench, and a TCL project script — that can be opened directly in AMD Vivado 2024.2 or later and synthesized for physical deployment.

The product runs entirely in the browser. No installation is required. No accounts are required for basic use. It is live at [redbyteapps.dev](https://redbyteapps.dev).

RedByte is designed to be credible — not a toy that simplifies away the real engineering, but a tool that makes the real engineering approachable. The exported files are real VHDL and real XDC. They work in Vivado without modification (for supported circuit types). The simulation engine is not a visual metaphor — it is a deterministic discrete logic engine with a documented execution model.

**Current supported scope:** Combinational circuits and rising-edge single-clock sequential circuits. Falling-edge clocking, multi-clock designs, and active-low reset are explicitly out of scope in the current version and are blocked at the verification and export stage.

---

## Founder Origin Story

Connor Angiel built RedByte while taking digital logic in college. The course covered the material — Boolean algebra, truth tables, combinational circuits, flip-flops, FSMs. But the tools available for learning were not built for learners. Professional EDA tools are designed for engineers validating production hardware. General-purpose circuit simulators abstract away the behavior you are trying to understand. There was no tool that showed you the full path: design a circuit, verify it behaves correctly, understand how it maps to a real board, and export a project you could actually synthesize.

RedByte exists because that tool should exist. Not a dumbed-down simulator that hides the engineering, and not a professional tool that assumes you already know everything. Something in between — transparent, visual, real enough to matter.

---

## Value Proposition

**For students:** A single, coherent environment for the entire digital logic workflow — from gate to hardware — that gives honest feedback and does not hide the engineering behind abstraction.

**For instructors:** A structured platform where students can work through the full design → verify → export → synthesize path with a consistent, auditable workflow. Submission archives include integrity hashes. Lab fixtures are pre-built.

**For self-directed learners:** A browser-based, zero-install tool for exploring how computers work from first principles.

---

## What RedByte Is Not

This matters and should be stated clearly in any positioning:

RedByte is not a replacement for AMD Vivado. It generates the project files that Vivado opens — synthesis and board programming still happen inside Vivado. RedByte is the front end of the workflow, not the whole workflow.

RedByte is not a general-purpose HDL editor. It generates VHDL from a schematic. Users who need to write complex HDL by hand should use a proper HDL editor or IDE.

RedByte is not a professional EDA tool. It does not model voltage, timing margins, or physical layout. It is an educational simulation and design environment.

RedByte is not a cloud service with accounts and stored projects (not yet). Currently, projects are stored locally in the browser.

RedByte is not AI-assisted design. It does not auto-generate circuits or suggest fixes automatically. It gives feedback and flags problems, but the student has to solve them.

RedByte is not classroom-ready in every deployment scenario yet. Hardware rehearsal with live Basys3 boards is a known open item.

---

## Target Market (Current)

**Primary:** University-level digital logic and computer architecture courses using the Digilent Basys3 FPGA board and AMD Vivado toolchain. Particularly ECE and CS programs where the standard lab environment includes Basys3 hardware.

**Secondary:** Individual learners — makers, hobbyists, professionals refreshing fundamentals — who want an interactive, real-feeling environment for learning digital logic.

---

## Competitive Landscape (Brief)

RedByte occupies a gap between two categories:

**General-purpose circuit simulators** (e.g., Logisim, CircuitVerse, Digital): These are excellent learning tools for pure logic simulation but do not connect to a real hardware workflow. They do not generate HDL or hardware-ready exports.

**Professional EDA tools** (e.g., AMD Vivado, Quartus Prime): These are the industry standard and the end destination for FPGA work, but they are not designed for first-time learners. The learning curve is steep and the tooling is opaque.

RedByte is the bridge — a visual, learner-centered design and simulation environment that produces real Vivado-compatible output. It is not trying to replace either category; it is the on-ramp to the professional toolchain.
