> ℹ️ **ASPIRATIONAL PRINCIPLES (2026-01-05).** The eight principles below are philosophically valid for RedByte today. However, the concrete examples and "In Scope" lists reference an OS-era product (3D views, oscilloscope, CPU modules) that no longer describes the current FPGA IDE. Read for principles; ignore the feature lists.

# 01 — Core Principles

**Status:** ASPIRATIONAL PRINCIPLES — see note above
**Last Updated:** 2026-01-05
**Maintainer:** Connor Angiel

---

## The Foundation

Every decision in RedByte is guided by eight core principles. These are not aspirations—they are boundaries. If a feature violates these principles, it does not ship.

---

## Principle 1: Truth Over Simplicity

### The Claim
**"Never lie to make teaching easier."**

### What This Means

Many educational tools trade accuracy for simplicity:
- Logic gates that work "instantly" (no propagation delay)
- Circuits that stabilize in zero time
- Flip-flops that ignore setup/hold times
- CPUs that execute instructions "as soon as you press run"

Students learn these simplified models, then face confusion when encountering real hardware or professional simulators. They must **unlearn** the lies.

RedByte refuses this trade. Our gates have delay. Our combinational circuits settle over multiple ticks. Our flip-flops require clock edges. Our CPUs step through fetch-decode-execute cycles.

### Boundaries

**We will:**
- Simulate real propagation delay (minimum 1 tick per gate)
- Show signals stabilizing over time in combinational circuits
- Require clock edges for sequential state changes
- Make timing diagrams the default view for debugging

**We will not:**
- Remove delay to "make circuits easier"
- Hide timing complexity from beginners
- Pretend circuits work instantly
- Use "magic" that cannot be explained

### Exceptions

There is one acceptable simplification: **We use discrete time (ticks), not continuous time (nanoseconds).**

Real gates have delay measured in picoseconds. Our gates have delay measured in ticks. This is a **principled abstraction**: discrete time preserves causality and ordering while being simpler to reason about.

We are honest about this abstraction. We do not claim to be a SPICE simulator.

---

## Principle 2: Local-First, Privacy-Respecting

### The Claim
**"Your circuits never leave your machine unless you choose to share them."**

### What This Means

RedByte runs entirely in the browser:
- No account required
- No login screen
- No telemetry or tracking
- No server dependency
- Works offline

Your circuit designs, your learning progress, your mistakes—all stay on your computer. We cannot see them, analyze them, sell them, or leak them.

### Why This Matters

1. **Privacy**: Students experimenting with circuits should not be surveilled
2. **Reliability**: No service outages, no "server maintenance," no shutdowns
3. **Ownership**: You control your data, not us
4. **Speed**: Local computation is faster than round-tripping to a server

### Boundaries

**We will:**
- Run all simulation in the browser (JavaScript/WebAssembly)
- Store all data in localStorage or IndexedDB
- Provide explicit export/import (user-initiated file download)
- Make sharing opt-in (URL encoding or file sharing)

**We will not:**
- Require account creation
- Send circuit data to our servers without explicit user action
- Track user behavior or circuit designs
- Use analytics or telemetry (even "anonymized")

### Future Considerations

Optional cloud features (collaboration, cloud sync) may be added later, but:
- Always opt-in, never required
- Encrypted end-to-end
- User can delete all data at any time
- Local-first remains the default

---

## Principle 3: Deterministic by Design

### The Claim
**"Same initial state + same inputs → same outputs, every time."**

### What This Means

A RedByte simulation is **reproducible**:
- Run a circuit twice → same results both times
- Share a circuit file → recipient gets identical behavior
- Record inputs → replay produces exact same outputs

There are no race conditions, no nondeterministic timing, no "works on my machine" bugs.

### Why This Matters

1. **Debugging**: If a circuit fails, the failure is reproducible
2. **Teaching**: Students can verify their designs produce consistent results
3. **Trust**: The simulator never lies or changes behavior randomly

### How We Achieve This

1. **Discrete time**: Tick-based simulation, not continuous
2. **Deterministic ordering**: Nodes evaluated in consistent order each tick
3. **No randomness**: No `Math.random()`, no system timestamps affecting logic
4. **Explicit clocks**: Time advances only via explicit clock ticks

### Boundaries

**We will:**
- Use tick-based discrete time
- Evaluate circuit nodes in deterministic order (topological sort where possible)
- Expose tick count as first-class state
- Provide determinism verification tools (record/replay)

**We will not:**
- Allow nondeterministic timing or race conditions
- Use real-world time (Date.now()) in circuit logic
- Introduce randomness without explicit user-controlled RNG components

### Non-Determinism (Allowed Cases)

Some things are intentionally non-deterministic:
- **UI interactions**: Mouse position, click timing (not part of circuit state)
- **Rendering**: Frame rate, scroll position (visual only, does not affect logic)
- **Performance**: Browser optimizations, JIT compilation

The **circuit simulation** is deterministic. The **UI around it** is not required to be.

---

## Principle 4: One Truth, Many Views

### The Claim
**"The circuit is the source of truth. Every visualization is a projection."**

### What This Means

RedByte displays the same circuit in multiple ways:
- **2D Schematic**: Traditional logic diagram
- **3D Redstone**: Voxel world (Minecraft-style)
- **Oscilloscope**: Signal timing diagram
- **HDL Export**: Verilog code (future)

All views show the **same underlying circuit**. When you toggle a switch in the schematic:
- The Redstone torch updates in 3D
- The waveform changes in the oscilloscope
- The Verilog signal assignment would reflect the change

There is no "schematic circuit" vs "3D circuit." There is one circuit with multiple lenses.

### Why This Matters

1. **Conceptual Unity**: Students learn that schematic/3D/HDL are views, not separate systems
2. **No Sync Bugs**: No way for views to "get out of sync" because they share state
3. **Flexibility**: Users can work in whichever view suits their task

### Boundaries

**We will:**
- Store circuit as a single canonical data structure
- Derive all views from this single source
- Update all views synchronously when circuit changes
- Never allow views to have independent state

**We will not:**
- Store separate circuit representations per view
- Allow views to modify circuit independently
- Introduce "view-specific" circuit properties

---

## Principle 5: Keyboard-First Interaction

### The Claim
**"Power users must be able to build circuits without touching the mouse."**

### What This Means

Every core action has a keyboard shortcut:
- Add gate: `Cmd/Ctrl + K` (Quick Add palette)
- Wire nodes: `W` to start, click endpoints
- Delete: `Backspace` or `Delete`
- Undo: `Cmd/Ctrl + Z`
- Redo: `Cmd/Ctrl + Shift + Z`
- Run/Pause: `Space`
- Step: `S`

Advanced users can fly through circuit construction without ever clicking a toolbar button.

### Why This Matters

1. **Speed**: Keyboard is faster than mouse for repeated actions
2. **Flow**: Less context switching, less hand movement
3. **Accessibility**: Some users cannot or prefer not to use a mouse
4. **Professional Feel**: Power tools (Vim, Figma, VS Code) prioritize keyboard

### Boundaries

**We will:**
- Provide shortcuts for all core actions
- Show shortcut hints in UI (tooltips, help panel)
- Allow customization of shortcuts (future)
- Never require mouse for essential tasks

**We will not:**
- Remove mouse support (keyboard-first ≠ keyboard-only)
- Hide functionality behind keyboard-only commands
- Use obscure or conflicting shortcuts

---

## Principle 6: Progressive Disclosure

### The Claim
**"Beginners see simple gates. Experts see timing diagrams and state machines."**

### What This Means

RedByte has two modes:
1. **Learn Mode**: Guided tutorials, step-by-step instructions, minimal UI
2. **Build Mode**: Full toolbox, advanced features, power-user shortcuts

Beginners start in Learn Mode. They see:
- "Build an AND gate with two switches and a lamp"
- "Toggle the switches and observe the output"

They do not see:
- Timing diagrams (yet)
- Hierarchical chip navigation (yet)
- Export options (yet)

These features unlock as the user progresses.

### Why This Matters

1. **Reduced Overwhelm**: New users are not bombarded with features they don't understand
2. **Contextual Learning**: Features appear when they become relevant
3. **Retention**: Experts keep access to all tools, no dumbing down

### Boundaries

**We will:**
- Show simple gates and wires first
- Introduce flip-flops after combinational logic is mastered
- Gate advanced features behind "Unlock" or "Show Advanced Tools" options
- Remember user's progress (Learn Mode vs Build Mode)

**We will not:**
- Remove features permanently
- Force users into tutorials if they skip
- Hide essential debugging tools (oscilloscope, timing)

---

## Principle 7: Build-First, Explain-Later

### The Claim
**"Students learn by doing, not by reading essays."**

### What This Means

RedByte's tutorials say:
- ✅ "Add an AND gate. Connect two switches to the inputs. Connect the output to a lamp."
- ❌ "An AND gate is a Boolean logic element that implements conjunction. Its truth table is..."

Students build first, observe the behavior, then (optionally) read the explanation.

### Why This Matters

1. **Engagement**: Building is more engaging than reading
2. **Retention**: Hands-on learning sticks better than passive reading
3. **Curiosity**: Students ask "Why did that happen?" after observing, rather than memorizing rules upfront

### Boundaries

**We will:**
- Start tutorials with "Build X" instructions
- Provide optional "Learn More" links for deep dives
- Show immediate feedback (toggle switch → see output change)

**We will not:**
- Require reading before building
- Block progress until users pass quizzes
- Front-load theory before practice

---

## Principle 8: Respect the User's Time

### The Claim
**"60 FPS smooth scrolling, <100ms input latency, instant saves. No frustration."**

### What This Means

RedByte must feel **fast**:
- Scrolling is smooth (60 FPS)
- Clicking a switch lights a lamp in <100ms
- Saving is instant (localStorage write)
- Loading is near-instant (no "Loading..." screens)
- Building a 10,000-gate circuit runs at 30+ FPS

We do not waste the user's time with:
- Laggy UI
- Slow simulation
- Unnecessary loading screens
- Unskippable animations

### Boundaries

**We will:**
- Target 60 FPS for UI, 30+ FPS for large circuit simulation
- Profile performance regularly
- Optimize hot paths (rendering, simulation loop)
- Use web workers or WASM for heavy computation

**We will not:**
- Ship features that drop below 30 FPS
- Add animations that slow down workflows
- Require network requests for core functionality

### Performance Budget

- **Small circuits** (0–100 gates): 60 FPS
- **Medium circuits** (100–1,000 gates): 60 FPS
- **Large circuits** (1,000–10,000 gates): 30 FPS minimum
- **Input latency**: <100ms click → visual feedback

If we cannot meet these targets, we do not ship.

---

## How These Principles Are Enforced

### 1. Pre-Commit Checklist

Before merging a PR, ask:
- Does this feature lie to simplify? (Principle 1)
- Does this require cloud dependency? (Principle 2)
- Does this introduce nondeterminism? (Principle 3)
- Does this break multi-view sync? (Principle 4)
- Is this action keyboard-accessible? (Principle 5)
- Does this overwhelm beginners? (Principle 6)
- Does this require reading before doing? (Principle 7)
- Does this drop below 30 FPS? (Principle 8)

If the answer to any is "yes," the feature does not ship as-is.

### 2. Architectural Invariants

Our codebase enforces these principles:
- **Tick-based engine**: Ensures determinism (Principle 3)
- **Single circuit store**: Ensures one truth (Principle 4)
- **Zustand state management**: Ensures views stay in sync (Principle 4)
- **Keyboard shortcuts in TopCommandBar**: Ensures keyboard-first (Principle 5)
- **Learn Mode vs Build Mode**: Ensures progressive disclosure (Principle 6)

### 3. Testing Requirements

Tests verify these principles:
- **Determinism tests**: Run circuit twice, assert identical output
- **Performance tests**: Measure FPS on 10k gate circuit, assert >30 FPS
- **Keyboard tests**: Simulate shortcuts, assert actions complete without mouse
- **Multi-view tests**: Update circuit, assert all views reflect change

---

## When to Break These Principles

These principles are strong defaults, not absolutes. They can be broken when:

1. **Security requires it**: If local-first creates a vulnerability, server-side validation is acceptable
2. **Performance requires it**: If determinism costs too much performance, we may allow opt-in nondeterminism (e.g., "fast mode")
3. **Accessibility requires it**: If keyboard-first blocks users with disabilities, we add mouse-only alternatives

**But:** Breaking a principle requires:
- Explicit justification in the PR
- Documentation of the exception
- Review by project maintainer

By default, these principles are non-negotiable.

---

## Related Documents

- [00 — Project Identity](./00-project-identity.md) — What RedByte is
- [02 — Determinism Contract](./02-determinism-contract.md) — How determinism is achieved
- [03 — System Architecture](./03-system-architecture.md) — How these principles are implemented
- [06 — Owner's Manual](./06-owners-manual.md) — How to work with these principles

---

## Changelog

- **2026-01-05**: Initial canonical version (Documentation OS project)
