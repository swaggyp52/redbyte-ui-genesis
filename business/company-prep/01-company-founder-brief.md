# Company and Founder Brief

**Company:** RedByte LLC (proposed)
**State:** New York
**Structure:** Single-member LLC
**Prepared:** 2026-04-02

---

## What RedByte Is

RedByte is a browser-based educational IDE for digital logic design and FPGA development. It is built for students, instructors, and self-directed learners who want to understand how computers work at the hardware level — starting from basic logic gates and building upward.

The platform is live at [redbyteapps.dev](https://redbyteapps.dev).

RedByte gives users a six-step, integrated workflow inside a single web application:

**Project** — Set up student identity, load examples, track readiness.

**Design** — Build digital circuits visually using a schematic editor with a library of logic primitives (AND, OR, NOT, XOR, flip-flops, and more). Wire components together on a canvas with real-time structural feedback.

**Verify** — Run test scenarios and see pass/fail results with waveform inspection and diagnostic hints. The simulation engine is deterministic and tick-based.

**Hardware** — Map circuit inputs and outputs to physical pins on the Digilent Basys3 FPGA board (switches, LEDs, buttons, 7-segment display).

**Export** — Download a complete Vivado Kit ZIP: VHDL source, XDC pin constraints, testbench, and a TCL project script. The exported package can be opened directly in AMD Vivado and synthesized for deployment to the Basys3 board.

**Import** — Paste VHDL to import an existing circuit with fidelity reporting.

The product is a web application — no installation required — deployed on Cloudflare Pages. It is built as a TypeScript monorepo using React 19, Vite, Zustand, and Vitest.

---

## Why RedByte Exists

Digital logic is one of the most fundamental topics in computer engineering, and it is consistently one of the hardest to teach well.

Existing options force an uncomfortable tradeoff. Textbooks provide theory but no interactivity. Physical lab kits offer hands-on learning but limited scale and no software feedback. Professional EDA tools like Vivado are powerful but steep — they were designed for working engineers, not students learning the concepts for the first time. General-purpose circuit simulators often obscure the behavior they are supposed to make transparent.

RedByte was built because that tradeoff does not have to exist. A student should be able to visually build a circuit, immediately see what it does, verify it against expected behavior, understand how it maps to real hardware, and export a real project file — all in one place, with no friction between steps.

The tool was built by the founder during and after taking a digital logic course. The course covered the material correctly. But there was no tool that made the hardware path feel real and approachable at the same time. RedByte is the tool that would have made that course click faster.

---

## Founder

**Connor Angiel**
New York

Connor is the sole author of the RedByte codebase, including the simulation engine, six-surface IDE application, VHDL/XDC export pipeline, and the full documentation system. The software was designed and built as a personal project, motivated by direct experience as a digital logic student who felt the existing tooling failed learners at the conceptual stage.

---

## Target Users

RedByte is designed for three audiences:

**Students** learning digital logic and computer architecture at the university level. Particularly those working with the Digilent Basys3 FPGA board and AMD Vivado toolchain, which is standard in many ECE and CS programs.

**Instructors and TAs** who run digital logic labs and want a visual, structured tool their students can use to design, simulate, verify, and export before touching hardware.

**Self-directed learners** — makers, engineers refreshing foundational knowledge, or anyone curious about how processors work — who want a real, interactive way to explore hardware concepts without a formal lab environment.

---

## Current Product Scope

The following capabilities are implemented and functional in the current product:

- Visual schematic editor with a library of combinational and sequential components
- Deterministic tick-based simulation (topological sort, integer-only signals)
- Verification engine with pass/fail semantics, waveform viewer, and diagnostic hints
- Design-time structural error detection (combinational loops, multiple drivers, floating outputs)
- Basys3 hardware pin mapping with four assignment modes
- Vivado Kit export (VHDL, XDC, testbench, TCL project script) for rising-edge single-clock circuits and combinational circuits
- VHDL import with fidelity reporting
- Classroom lab fixtures (e.g., Lab 4 ALU starter with pre-defined test vectors)
- Full instructor workflow: student submission archives with SHA-256 integrity hashes

The product currently supports combinational circuits and rising-edge single-clock sequential circuits. Falling-edge clocking, multi-clock designs, and active-low reset are explicitly blocked by the verification and export pipeline.

---

## Long-Term Product Direction

RedByte is intended to become a complete FPGA educational platform — one where a learner can go from understanding what a logic gate does to building and running a working processor on real hardware, without leaving the platform or losing the thread of understanding.

The immediate roadmap includes: expanded sequential logic support, hardware bridge for direct board communication, improved visual polish and instructor tooling, and a structured lab library.

The longer-term direction is classroom and institutional adoption — a tool that universities and training programs can license as part of their digital logic and computer architecture curriculum infrastructure.

This is a stated direction, not a shipped product feature. Institutional adoption requires product maturity that is still in progress.

---

## Why an LLC Makes Sense

RedByte is a real software product with a live URL, a proprietary license, an active codebase, and a clear commercial path (institutional licensing to schools and programs). Forming an LLC creates a legal boundary between the business and the founder personally, establishes clear ownership of the software and related assets, and enables the company to enter into contracts, open business bank accounts, and eventually license the software to institutions.

A single-member LLC in New York is the appropriate starting structure — simple, flexible, and appropriate for a founder-operated software business at this stage.
