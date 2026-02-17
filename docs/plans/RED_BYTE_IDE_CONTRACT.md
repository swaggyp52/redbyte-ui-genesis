# REDBYTE IDE CONTRACT

**Version 1.0 — Basys3 / VHDL Track**
**Date: 2026-02-16**
**Status: FROZEN — no feature additions without updating this document**

---

## 1. Product Definition

RedByte is a **VHDL-first FPGA learning IDE for Basys3.**

It is not:
- A generic logic toy
- A multi-board tool
- A playground-first sandbox
- A CI experiment platform
- A collection of apps

It is:
> A structured, visually excellent environment that moves students through **design → verification → board deployment** for every lab in the digital logic curriculum.

---

## 2. The Single Student Entry Point

When a student opens RedByte, they see exactly **one thing**: the **Lab Launcher**.

### Lab Launcher Requirements

**Visual standard:** High quality. This is the first thing students see. It must look like professional software, not a prototype. Use the full RedByte visual language — dark theme, red accent, glows, grid background, clean typography.

**Layout:**
- Full-screen launcher
- Header: RedByte wordmark + "ECE348 / GECE598 — Digital Logic" subtitle
- 8 lab cards in a responsive grid (2×4 or 4×2)
- No other navigation, no legacy apps, no floating panels

**Each Lab Card shows:**
- Lab number + title (e.g., "Lab 4 — ALU with Opcode Control")
- Status badge: `COMPLETED` (green) / `ACTIVE` (red pulse) / `LOCKED` (grey)
- One-line description of what the student builds
- Primary CTA: "Open Lab" button
- Secondary: estimated time

**Rules:**
- Students never see a blank infinite canvas as a starting point
- Students never see the raw Logic Playground directly
- All 8 labs are visible and accessible (no gating by default)
- No legacy apps (lab3-webapp, manual-site, docs app) are reachable from this entry point
- The launcher is the shell. Everything else opens inside it.

---

## 3. The Four Modes (Hard Boundary)

Once a student opens a lab, RedByte presents exactly **four modes** in a persistent top navigation bar. Students move through them in order. No hidden panels, no floating chaos.

```
[ Project ]  [ Design ]  [ Verify ]  [ Export ]
```

---

### Mode 1: Project

**Purpose:** Show the student what they're building and what files exist.

**UI:**
- Left panel: File tree
  - `top.vhd` (main entity)
  - `submodules/` (pre-verified blocks)
  - `testbench.vhd`
  - `constraints/top.xdc`
- Center: Lab Instructions (scrollable, step-by-step)
  - Objective
  - What's pre-built vs what the student must do
  - Pin mapping table (switches, LEDs, 7-seg pins)
  - Block diagram of the target architecture
- Right panel: Self-check progress (checklist, not hidden)

**Board and language are locked per lab:**
- Board: Basys3
- Language: VHDL

Students never configure these manually.

---

### Mode 2: Design

**Purpose:** Build the circuit. Two linked sub-tabs — students can use either.

#### Sub-tab A: Schematic

**Rules (non-negotiable):**
- Constrained grid with snap enforcement
- Fixed IO bar at bottom (inputs left, outputs right)
- Component palette on left (pre-verified blocks only — no raw gate chaos)
- No overlapping components
- Clear region separation (inputs / logic / outputs)
- Wire routing is guided, not freehand spaghetti
- Canvas does not feel infinite — it has visible bounds

This is the Logic Playground restructured as an IDE workspace. The sandbox behavior is removed.

#### Sub-tab B: VHDL Editor

- Syntax-highlighted `.vhd` source view
- Editable (for advanced students)
- Auto-generated from schematic; edits reflect back
- Entity/architecture structure visible at all times
- Signal names are meaningful (not `n1`, `n2` — actual names like `carry_out`, `opcode`)

**These two sub-tabs are linked.** Wiring a block in Schematic updates the VHDL. Editing a port in VHDL reflects in Schematic.

---

### Mode 3: Verify

**Purpose:** Remove guesswork. Make verification a visible stage, not a hidden button.

**UI Must Show:**
- Test vector table (input combinations vs expected vs actual output)
- Pass / Fail indicators per row (green / red)
- Waveform display (clean, labeled, not oscilloscope-overload)
- Mismatch highlighting with plain-English explanation
- Opcode mapping table for ALU labs

**Rules:**
- Students cannot reach Export mode until at least one test vector passes (soft gate — warns, doesn't hard-block)
- No buried verification panel
- This mode is its own stage with its own dedicated UI

---

### Mode 4: Export

**Purpose:** Produce the files that go into Vivado.

**Single action:** One button labeled **"Export for Basys3"**

**Output ZIP contains:**
- `top.vhd` — clean, readable VHDL (entity/architecture, real signal names)
- `submodules.vhd` — pre-verified component declarations
- `top.xdc` — Basys3 pin constraints (correct, matching board manual)
- `testbench.vhd` — optional, auto-generated
- `rb-lab.zip` — evidence bundle for submission

**Visual feedback:** After export, show a success panel with:
- File listing with sizes
- SHA256 of the bundle (for integrity)
- The 5-step Vivado handoff guide (inline, not a separate link)

**This mode does NOT:**
- Attempt bitstream generation
- Invoke Vivado internally
- Replace the synthesis step

Vivado = compiler. RedByte = structured generator + verifier.

---

## 4. Lab Philosophy

### The Rule
Labs are **system integration exercises**, not raw invention from scratch.

Students are given pre-verified sub-components. Their job is to:
1. Understand what each block does
2. Wire them according to the specification
3. Define the integration logic (opcodes, enables, flags)
4. Verify the result
5. Export

They are not asked to design arithmetic circuits from first principles on a blank canvas.

### Lab 4 Specifically (ALU — Opcode Control)

Students receive:
- Verified 4-bit ripple-carry adder block
- Verified 4-to-1 mux block
- Verified 2-to-4 decoder block

Students must:
- Wire the datapath (adder → mux → output)
- Route the opcode lines to the decoder
- Connect carry/flag outputs to LEDs
- Define the truth table for opcode → operation mapping
- Verify all 4 operations pass
- Export VHDL + XDC

**Difficulty = integration and understanding. Not masochism.**

---

## 5. Visual Standard

Visual quality is a **first-class product requirement**, not a nice-to-have.

**RedByte must look like professional IDE software.**

Standard:
- Dark theme (near-black background, not grey)
- Red accent (`#FF2D2D` family) for active states, CTAs, highlights
- Subtle grid pattern on backgrounds
- Glow effects on active components and signals
- Clean, monospace typography for code; sans-serif for UI
- Smooth transitions (not jarring)
- No placeholder UI, no Lorem ipsum, no unstyled divs

Every surface students see — launcher, schematic, VHDL editor, verify panel, export screen — must meet this standard.

If it looks like a prototype, it ships as a prototype. That's not acceptable.

---

## 6. Scope Lock

**RedByte v1 does NOT:**
- Replace Vivado bitstream generation
- Support boards other than Basys3
- Support HDLs other than VHDL (Verilog export exists as internal bridge only, never student-facing)
- Add new experimental features outside this contract
- Expand CI surface beyond existing gates
- Show any legacy app (lab3-webapp, manual-site, docs) to students

**It only refines:**
- Launcher UX and visual quality
- Workspace structure (4 modes)
- Canvas constraints (Design mode)
- VHDL export quality and readability
- Lab 4 guided project template
- Vivado handoff documentation

Everything else is infrastructure. Infrastructure stays invisible.

---

## 7. What "ASAP" Means

Implementation priority, in strict order:

| # | Deliverable | Unblocks |
|---|-------------|---------|
| 1 | Lab Launcher with all 8 lab cards + visual quality | Students can find their lab |
| 2 | Lab 4 structured project template (pre-built blocks) | Lab 4 is teachable |
| 3 | Design mode: constrained canvas + VHDL view | Students can build without getting lost |
| 4 | Clean VHDL export (`top.vhd` with real signal names) | Vivado handoff works |
| 5 | Vivado handoff sheet (1 page, printable PDF or inline) | Students can program the board |

Items 1–2 are the critical path. Labs cannot run without them.
Items 3–5 complete the full loop.

No other work ships until items 1–5 are done.

---

## 8. Violation Conditions

This contract is violated if any of the following are true after v1 ships:

- [ ] A student opens RedByte and sees a blank canvas as the first screen
- [ ] A student can navigate to the lab3-webapp or any legacy app
- [ ] The VHDL export produces non-compilable or unreadable output
- [ ] Lab 4 requires a student to design an adder from scratch
- [ ] The Verify mode is hidden behind a non-obvious button
- [ ] The Export produces Verilog as the primary student-facing file
- [ ] Any panel or component looks unfinished or placeholder

If any of these are true, the violation must be fixed before the next lab session.

---

*This document is the source of truth for RedByte v1 product decisions.*
*Changes require explicit revision with a new version number and date.*
