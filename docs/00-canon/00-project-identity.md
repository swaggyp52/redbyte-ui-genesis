> ⚠️ **SUPERSEDED — OS ERA (2026-01-05).** This document describes a prior product direction: a 3D Redstone/multi-view OS platform. The current product is an FPGA educational IDE. See `docs/ACTIVE_WORK.md` and `docs/DOC_INDEX.md` for current truth. Do not use this as agent context for current-product decisions.

# 00 — Project Identity

**Status:** SUPERSEDED — see note above
**Last Updated:** 2026-01-05
**Maintainer:** Connor Angiel

---

## What RedByte Is

RedByte is a **deterministic interactive computation framework** for teaching digital logic and computer architecture from first principles to CPU design.

It is:

1. **An educational medium** — A learning environment where students build functioning digital circuits and observe their behavior in real time
2. **A logic playground** — An interactive workspace for constructing circuits from primitive gates (AND, OR, NOT) to complex sequential logic (flip-flops, registers, CPUs)
3. **A multi-view system** — Simultaneous visualization of the same circuit as 2D schematic, 3D Redstone world, timing diagram, and eventually exported HDL
4. **A deterministic universe** — Every tick is reproducible; no race conditions, no undefined behavior, no "it works on my machine"
5. **A local-first application** — All computation happens in the browser; no server required, no telemetry, no lock-in

### The Core Claim

**"One computational truth, many views."**

The circuit exists as a single source of truth. Every visualization—schematic, 3D world, oscilloscope—is a lens onto the same deterministic state. When you toggle a switch in the schematic, the Redstone torch changes in 3D, the signal waveform updates, and the timing is exact and verifiable.

This is not just "educational software." It is an argument that **computation can be made transparent, trustworthy, and teachable** without simplification or lies.

---

## What RedByte Is Not

### Not a Game
RedByte is not Minecraft. It uses Minecraft-inspired 3D visuals (voxel Redstone) as a **pedagogical bridge**, but it is a rigorous logic simulator. The 3D view is a teaching aid, not the primary interface.

### Not a Professional HDL Tool (Yet)
RedByte is not Vivado or ModelSim. It does not (yet) export production-ready Verilog or synthesize to FPGAs. It is **complementary** to professional tools:
- **RedByte**: Teaches understanding and intuition
- **Professional tools**: Teach industry workflows and scale

The long-term vision includes HDL export, but the current focus is **education and conceptual mastery**.

### Not a "Learn to Code" Platform
RedByte does not teach programming languages. It teaches **computational thinking** at the hardware level:
- How signals propagate through gates
- How memory is built from feedback loops
- How a CPU executes instructions

Programming comes *after* you understand what a CPU is.

### Not Cloud-Dependent
RedByte runs entirely in the browser using WebAssembly and JavaScript. No account required, no server dependency, no "sign in to continue." This is intentional:
- **Privacy**: Your circuits never leave your machine
- **Reliability**: Works offline, no service disruptions
- **Ownership**: You control your data

Optional cloud features (collaboration, sharing) may be added later, but the core will always be local-first.

### Not Dumbed Down
RedByte adheres to the principle: **"Never lie to teach."**

Many educational tools simplify to the point of falsehood:
- Logic gates that don't have propagation delay
- Circuits that work "instantly" without clock cycles
- Abstractions that cannot be unwound

RedByte simulates **real digital logic**:
- Gates have delay (1 tick minimum)
- Combinational circuits stabilize over multiple ticks
- Sequential circuits require clock edges
- Race conditions are impossible because time is discrete and deterministic

Students learn correct mental models, not oversimplifications they must later unlearn.

---

## Who RedByte Is For

### Primary Audience: Self-Directed Learners

**Age 14 to adult** who want to understand computers from the ground up:
- High school students exploring CS/EE
- University students supplementing coursework
- Career changers learning hardware fundamentals
- Hobbyists building CPU designs for fun

### Secondary Audience: Educators

Teachers who want a tool that:
- Visualizes abstract concepts (gates, timing, state machines)
- Allows hands-on exploration without physical breadboards
- Provides immediate feedback loops
- Scales from simple gates to full CPUs

### Non-Audience: Professional Engineers (Current Phase)

RedByte is not (yet) targeting working engineers who need:
- FPGA synthesis
- Timing analysis for production silicon
- Verilog/VHDL linting and debugging
- Testbench generation

These may be future features, but the current focus is **learning**, not production workflows.

---

## The Problem RedByte Solves

### The Gap

Digital logic education has two failure modes:

1. **Pure Theory** (textbooks, lectures)
   - Students memorize truth tables and Boolean algebra
   - No hands-on feedback
   - Abstract concepts remain abstract
   - High dropout rate

2. **Shallow Simulators** (basic logic gates apps)
   - Gates work "instantly" (no propagation delay)
   - No path from gates → CPU
   - No multi-view understanding
   - Students hit a ceiling and quit

### The RedByte Bridge

RedByte bridges the gap by providing:

1. **Immediate Feedback** — Click a switch, see the lamp light up in <100ms
2. **Incremental Complexity** — Start with a single AND gate, end with a working CPU
3. **Multi-View Understanding** — See the *same circuit* as schematic, 3D world, timing diagram
4. **Deterministic Behavior** — Every run is identical; no bugs from randomness
5. **No Prerequisites** — No programming, no hardware, just a browser

Students can **build a working CPU** and understand every gate, every wire, every clock cycle. This is rare.

---

## Design Philosophy (8 Core Principles)

These principles guide every decision in RedByte:

### 1. Truth Over Simplicity
Never lie to make teaching easier. If real gates have delay, our gates have delay. If combinational circuits settle over time, so do ours.

### 2. Local-First, Privacy-Respecting
All computation happens client-side. No telemetry, no tracking, no accounts required. Your circuits are yours.

### 3. Deterministic by Design
Every simulation run is reproducible. Same initial state + same inputs → same outputs, every time. No race conditions, no nondeterminism.

### 4. One Truth, Many Views
The circuit is the source of truth. Every visualization (2D schematic, 3D Redstone, oscilloscope, HDL) is a projection of the same data.

### 5. Keyboard-First Interaction
Power users must be able to build circuits without touching the mouse. Keyboard shortcuts for everything: add gates, wire connections, undo/redo, run/pause.

### 6. Progressive Disclosure
Beginners see simple gates and wires. Advanced users see chip hierarchies, timing diagrams, state machines. The complexity scales with the user.

### 7. Build-First, Explain-Later
Students learn by doing, not reading. The tutorial says "Build an AND gate," not "Here's a 5-page essay on Boolean algebra."

### 8. Respect the User's Time
60 FPS smooth scrolling, <100ms input latency, instant saves. No loading screens, no "please wait," no frustration.

---

## Success Criteria (How We Know This Works)

RedByte succeeds if:

1. **A motivated 15-year-old can build a working CPU** from scratch using only RedByte
2. **The CPU design is correct** — it runs real assembly code (ADD, SUB, JMP, etc.)
3. **The student understands every component** — not copying a tutorial, but able to explain each gate
4. **The learning curve is smooth** — no sudden difficulty spikes, no "I'm stuck and quitting"
5. **The tool stays out of the way** — 60 FPS, keyboard shortcuts, no UI clutter

We do *not* succeed if:
- Students memorize without understanding
- The tool lies about how circuits work
- Performance is poor (laggy, slow, buggy)
- Users abandon the project halfway through

---

## Scope & Boundaries

### In Scope (Current Roadmap)

- ✅ **Primitive logic gates**: AND, OR, NOT, NAND, NOR, XOR, XNOR
- ✅ **Timing elements**: Clock, Delay
- ✅ **I/O components**: Switch, Lamp, Power Source
- ✅ **Sequential logic**: Flip-flops (RS, D, JK), latches
- ✅ **Hierarchical chips**: Save subcircuits, reuse as components
- ✅ **Multi-view visualization**: 2D schematic, 3D Redstone, oscilloscope
- ✅ **Learn Mode**: Guided tutorials from gates → CPU
- ✅ **Undo/redo**: 50-step history, keyboard shortcuts
- ✅ **Deterministic simulation**: Tick-based engine, reproducible runs
- 🚧 **HDL export**: Verilog output (planned, not implemented)
- 🚧 **BOM export**: Component list for physical builds (planned)
- 🚧 **PDF schematic export**: Print-ready diagrams (planned)

### Out of Scope (Not Planned)

- ❌ Analog simulation (this is purely digital)
- ❌ SPICE-level transistor modeling
- ❌ Real-time collaboration (may be added later, not core)
- ❌ Cloud-based rendering or computation
- ❌ Multiplayer circuit building
- ❌ Integration with external FPGA toolchains (future possibility)

---

## Technical Identity

### Stack

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS
- **State**: Zustand (lightweight, no boilerplate)
- **3D**: React Three Fiber (Three.js for Redstone world)
- **Build**: Turborepo monorepo, pnpm workspaces
- **Deployment**: Static site (Vite build), no backend

### Architecture

- **Monorepo**: 11 packages (kernel, shell, apps, logic core, views, themes)
- **OS/App boundary**: Desktop shell provides windowing, apps are sandboxed
- **Logic engine**: Pure TypeScript, deterministic tick loop
- **Views**: Controlled components, circuit is source of truth

### Performance Targets

- **60 FPS**: Smooth scrolling, no dropped frames
- **<100ms input latency**: Click → visual feedback
- **10,000-gate circuits**: Run at 30 FPS minimum
- **Local-first**: No network dependency, works offline

---

## Intellectual Property & Licensing

### Current Status

- **Proprietary**: RedByte is not open source (yet)
- **Copyright**: Connor Angiel, 2025–2026
- **License**: RedByte Proprietary License (RPL-1.0)
- **Use**: Prohibited without permission

### Future Intent

- May open-source under permissive license (MIT or Apache 2.0) after MVP
- May offer dual licensing: Free for education, paid for commercial
- Undecided; current focus is building, not licensing

---

## Funding & Business Model (Current Phase)

### No Current Business Model

RedByte is currently:
- **Self-funded** (no investors, no revenue)
- **Not monetized** (no ads, no subscriptions, no purchases)
- **Not incorporated** (personal project, may form LLC later)

### Future Possibilities

1. **Freemium Model**
   - Core tool free forever
   - Optional paid features: Cloud sync, collaboration, advanced exports

2. **Educational Licensing**
   - Free for individual students
   - Paid licenses for schools/institutions

3. **Open Source + Services**
   - Open-source the core
   - Offer paid hosting, support, custom features

4. **Remains Free**
   - Never monetize, keep as public good

**Current stance:** No rush to monetize. Focus is on building something excellent, not chasing revenue.

---

## Related Documents

- [01 — Core Principles](./01-core-principles.md) — Detailed philosophy
- [02 — Determinism Contract](./02-determinism-contract.md) — Technical guarantees
- [03 — System Architecture](./03-system-architecture.md) — How it's built
- [04 — Experience Design](./04-experience-design.md) — How it works
- [05 — Roadmap](./05-roadmap.md) — What's next
- [06 — Owner's Manual](./06-owners-manual.md) — Complete system understanding

---

## Changelog

- **2026-01-05**: Initial canonical version (Documentation OS project)
