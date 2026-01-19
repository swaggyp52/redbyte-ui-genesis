# RedByte User Manual (Version 1)

**An Interactive Digital Logic Circuit Platform**

---

## Table of Contents

1. [What RedByte Is](#1-what-redbyte-is)
2. [How RedByte Thinks](#2-how-redbyte-thinks)
3. [The RedByte OS](#3-the-redbyte-os)
4. [The Logic Playground](#4-the-logic-playground)
5. [Getting Started: First Circuit](#5-getting-started-first-circuit)
6. [Time, Simulation, and Control](#6-time-simulation-and-control)
7. [Probes and the Oscilloscope](#7-probes-and-the-oscilloscope)
8. [Recording, Replay, and Verification](#8-recording-replay-and-verification)
9. [Saving, Loading, and Exporting Work](#9-saving-loading-and-exporting-work)
10. [The Terminal](#10-the-terminal)
11. [Files and Settings](#11-files-and-settings)
12. [How to Learn Effectively With RedByte](#12-how-to-learn-effectively-with-redbyte)
13. [What RedByte Is Not](#13-what-redbyte-is-not)
14. [Why RedByte Exists](#14-why-redbyte-exists)
15. [Where to Go Next](#15-where-to-go-next)
16. [From Logic to Bitstream](#16-from-logic-to-bitstream)
17. [Analog Simulation](#17-analog-simulation)
18. [Troubleshooting](#18-troubleshooting)

---

## Quick Demos (Start Here)

Try a few guided demos that map directly to the RedByte learning path:

- [Open Demo: NOT Gate](rb://demo/not-gate)
- [Open Demo: AND Gate](rb://demo/and-gate)
- [Open Demo: Half Adder](rb://demo/half-adder)

Each demo opens in Logic Playground and replaces the current circuit. Save any work first.

---

## 1. What RedByte Is

RedByte is an **interactive digital logic circuit simulation platform** that runs entirely in a web browser. It is a tool for learning how computers work from first principles—starting with basic logic gates and building upward to working processors.

### What Problems It Solves

Learning computer architecture traditionally requires choosing between abstraction and depth. Textbooks provide diagrams but no interaction. Physical kits offer hands-on experience but limited scale. Hardware description languages demand programming expertise. Simulators exist but often obscure the very mechanisms they simulate.

RedByte solves this by providing:

- **Immediate visual feedback** — Click a switch, see the result propagate through gates in real time
- **Complete transparency** — Every signal value is visible at every moment
- **Unlimited scale** — Build from single gates to complete processors without physical constraints
- **Reproducible behavior** — Circuits behave identically every time, enabling systematic debugging
- **Progressive complexity** — Start simple, build upward using proven components

### What Makes It Different

Most circuit simulators are designed for engineers validating professional designs. RedByte is designed for learners building understanding.

The platform provides:

1. **Multiple synchronized views** of the same circuit — schematic diagram, 3D visualization, timing diagram, structural netlist
2. **Pattern recognition** that celebrates when the user builds known circuits
3. **Time-travel debugging** through recording and replay
4. **Hierarchical construction** allowing circuits to become reusable components
5. **Zero installation** — runs completely in the browser with no accounts or servers

### Who It Is For

RedByte is for anyone who wants to understand how computers work at the physical logic level:

- Students learning digital logic or computer architecture
- Self-directed learners curious about processor design
- Educators teaching Boolean algebra and circuit fundamentals
- Professionals refreshing foundational knowledge
- Anyone who learns by building and experimenting

### Who It Is Not For

RedByte is not for:

- Professional electronic design automation (it does not model full voltage margins, timing closure, or physical layout; analog models are simplified)
- Real-time embedded system development (it is a teaching tool, not a production environment)
- Users seeking quick answers without building understanding
- Those expecting AI assistance or automatic circuit generation

RedByte requires active participation. The user must build circuits, observe behavior, and reason about results. The platform provides transparency and feedback, not shortcuts.

---

## 2. How RedByte Thinks

To use RedByte effectively, the user must understand the mental model underlying the platform. This is not a physics simulation. It is a discrete, logical system with specific rules.

### Digital Logic in Practical Terms

Digital logic is the mathematics of circuits that represent information using two states: **0** and **1**.

These states correspond to:

- **Electrical voltage levels** — low voltage (0) and high voltage (1)
- **Boolean values** — false (0) and true (1)
- **Logical conditions** — off (0) and on (1)

RedByte's core engine simulates logical states and how they transform as they pass through components. It also includes a small set of simplified analog models that use numeric values for voltage and resistance.

### What Signals Are

A **signal** is a value carried by a wire at a specific moment in time. In RedByte, most signals are either **0** or **1**. Analog nodes use numeric values (volts, ohms) on specific ports. There are no undefined or tri-state values.

### Analog Components (Limited)

RedByte includes a small set of deterministic analog models for lab-style experiments. These are not transistor-accurate simulations; they are simplified, stable models intended for learning.

Supported analog models:

- **VoltageSource** — Outputs a constant voltage for supply or reference
- **LDR** — Light-dependent resistor that outputs resistance based on light level
- **FixedResistor** — Constant resistance value
- **VoltageDivider** — Computes Vout from Vin, R1, and R2
- **LM358** — Comparator that outputs 1 when V+ > V-

Analog values propagate through the same tick-based engine as digital signals, so changes appear on the next tick.

To drive analog inputs:

- Select an **LDR** node and adjust **Light Level** in the inspector
- Select a **VoltageSource** node and adjust **Voltage (V)** to set supply or reference levels

When the user adds a probe to a circuit, the platform tracks that signal over time, recording its value at each tick.

### What a Circuit Is

A **circuit** is a collection of components connected by wires.

Components include:

- **Inputs** — switches, buttons, clocks, power sources
- **Logic gates** — AND, OR, NOT, XOR, NAND, NOR, XNOR
- **Outputs** — lamps, displays
- **Composite components** — flip-flops, adders, counters, and user-built chips

Wires carry signals from one component's output to another component's input.

Example of a minimal circuit:

```
[Switch] ───> [NOT Gate] ───> [Lamp]
   0            1              ON
```

When the switch is off (0), the NOT gate inverts it to 1, and the lamp turns on.

### What Time Means in RedByte

RedByte uses **discrete time**, measured in **ticks**.

A **tick** is the smallest unit of simulated time. During each tick:

1. All components read their input signals
2. Each component evaluates its internal logic
3. All components update their output signals

The simulation does not advance continuously. It advances in steps. One tick, then another, then another.

The user controls the tick rate (how many ticks per second). A slow rate (1 tick per second) allows careful observation. A fast rate (60 ticks per second) runs circuits at interactive speed.

Important: Components are not instantaneous. A logic gate takes **at least one tick** to respond to input changes. This delay is not a limitation—it is a critical property of real digital circuits, and RedByte teaches the user to account for it.

### What "Deterministic" Means in This Context

A system is **deterministic** if identical inputs always produce identical outputs.

In RedByte:

- The same circuit wired the same way behaves the same way every time
- Recording a simulation run and replaying it produces identical results
- No randomness affects circuit behavior
- No hidden state affects outcomes

This property enables:

- **Reliable debugging** — If a circuit misbehaves, the cause is discoverable through inspection
- **Reproducible verification** — A recorded run can be replayed and compared bit-for-bit
- **Confident experimentation** — Changes to the circuit produce predictable effects

### Why Visibility Matters

Traditional circuit design involves building a device, powering it on, and observing external outputs. Internal states remain invisible unless explicitly measured with test equipment.

RedByte inverts this. Every signal, at every moment, can be observed. Every component's output is accessible. Every wire's value is known.

This transparency transforms learning:

- The user sees **how** a gate computes its output, not just **that** it does
- The user observes **when** a signal changes, understanding propagation delays
- The user traces **where** incorrect behavior originates, enabling systematic debugging

RedByte's goal is not to hide complexity behind abstraction. It is to make complexity comprehensible through visibility.

### A Simple Example

Consider a two-input AND gate connected to a lamp:

```
[Switch A] ──┐
             ├──> [AND Gate] ───> [Lamp]
[Switch B] ──┘
```

Behavior by tick:

| Tick | A | B | AND Output | Lamp |
|------|---|---|------------|------|
| 0    | 0 | 0 | 0          | OFF  |
| 1    | 1 | 0 | 0          | OFF  |
| 2    | 1 | 1 | 0          | OFF  |
| 3    | 1 | 1 | 1          | ON   |

At tick 2, both inputs are 1, but the AND gate has not yet updated its output (it requires one tick to respond). At tick 3, the gate's output becomes 1, and the lamp turns on.

This delay is not an error. It is how digital circuits actually work. RedByte teaches the user to expect and account for propagation delays.

---

## 3. The RedByte OS

RedByte presents itself as an operating system, though it is not an operating system in the traditional sense. It is a **desktop environment** running inside a web browser, providing a familiar interface for managing multiple applications and files.

### What the OS Layer Is

The RedByte OS layer is a **windowing system** that allows the user to:

- Open multiple applications simultaneously
- Switch between applications using keyboard shortcuts or mouse clicks
- Resize, move, minimize, and close application windows
- Access a file system for saving and loading projects
- Adjust global settings affecting all applications

This layer exists to organize the user's workspace, not to manage hardware or processes. It is a user interface metaphor, not a kernel.

### Why RedByte Uses an OS Metaphor

Desktop environments are familiar. Users understand windows, menus, and file browsers. By adopting this structure, RedByte reduces cognitive load, allowing the user to focus on learning digital logic rather than navigating unfamiliar interfaces.

Additionally, the OS metaphor supports future extensibility. New applications can be added. Third-party tools can integrate. The platform can grow without breaking existing workflows.

### What the Desktop Is

The **Desktop** is the main workspace—a background area where application windows appear. The user can customize the desktop's appearance (wallpaper, theme) in the Settings application.

At the bottom of the screen, a **taskbar** displays:

- The current date and time
- Running applications with clickable icons
- System status indicators (theme, performance)
- A quick launcher for frequently used apps

### What Windows Are

Each application runs inside a **window**—a rectangular frame with:

- A title bar showing the application name
- Control buttons (minimize, maximize, close)
- A resizable content area

Windows can be:

- **Dragged** by their title bar to reposition them
- **Resized** by dragging their edges or corners
- **Minimized** to the taskbar to temporarily hide them
- **Maximized** to fill the entire screen
- **Closed** to terminate the application

Keyboard shortcuts:

- `Alt+Tab` — Switch between open windows
- `Ctrl+W` (Windows/Linux) or `Cmd+W` (Mac) — Close the current window

### What Apps Are

An **app** is a self-contained program with a specific purpose. RedByte includes several built-in apps:

- **Logic Playground** — The primary circuit design and simulation environment
- **Logic Help** — Interactive tutorials and conceptual explanations
- **Files** — A file browser for managing saved projects
- **Terminal** — A command-line interface for advanced users
- **Settings** — Configuration options for theme, performance, and behavior
- **Welcome** — An onboarding guide for new users

The user can open multiple instances of the same app (for example, multiple Logic Playground windows to work on separate circuits simultaneously).

### How the Logic Playground Fits Inside the OS

The **Logic Playground** is the flagship application—the core tool for building and simulating circuits. It occupies the central role in RedByte's purpose, while other apps provide supporting functionality:

- **Files** helps the user save and organize circuit projects
- **Settings** adjusts simulation speed and visual appearance
- **Terminal** provides power-user access to system commands
- **Help** offers guided learning when the user needs clarification

When the user opens RedByte for the first time, the Logic Playground typically opens automatically, ready for immediate experimentation.

---

## 4. The Logic Playground

The **Logic Playground** is the environment where the user builds, simulates, and debugs digital circuits. It is both a drawing canvas and a simulation engine, tightly integrated.

### What It Is

The Logic Playground is an interactive schematic editor that allows the user to:

- Place components (gates, switches, lamps, chips) onto a grid-based canvas
- Connect components with wires to form circuits
- Run simulations to observe circuit behavior in real time
- Inspect signal values at any point in the circuit
- Record and replay simulation runs for debugging
- Save circuits as reusable components

It is the primary tool for all circuit construction in RedByte.

### What It Allows the User to Build

The Logic Playground supports building circuits at any level of complexity:

- **Simple circuits** — A switch controlling a lamp through a single gate
- **Arithmetic circuits** — Adders, subtractors, multipliers
- **Memory circuits** — Latches, flip-flops, registers, counters
- **Control circuits** — Decoders, multiplexers, state machines
- **Complete processors** — CPUs with instruction sets, memory, and I/O

There is no hard limit on circuit size. The user can build as large a design as the browser's memory permits.

### What Kind of Thinking It Trains

Using the Logic Playground develops several cognitive skills:

1. **Decomposition** — Breaking complex behavior into simple logical operations
2. **Abstraction** — Treating circuits as reusable black-box components
3. **Systematic reasoning** — Tracing signal flow to predict or debug behavior
4. **Hierarchical thinking** — Building layers of functionality from primitives
5. **Causal reasoning** — Understanding how input changes propagate to outputs

The platform does not automate these processes. The user must perform them, developing fluency through practice.

---

### Understanding the Building Blocks

Before building circuits, the user must understand the fundamental elements available.

#### Nodes

A **node** is any component in a circuit. Nodes have:

- **Inputs** (ports that receive signals)
- **Outputs** (ports that produce signals)
- **Internal state** (for components like flip-flops and counters)
- **Behavior rules** (how inputs transform into outputs)

There are two categories of nodes:

**Primitive Nodes** — Built directly into RedByte:

- **Basic I/O** — PowerSource (constant 1), Switch (toggleable 0/1), Lamp (visual output)
- **Logic Gates** — AND, OR, NOT, NAND, NOR, XOR, XNOR
- **Timing** — Clock (periodic signal), Delay (buffer signal by N ticks)
- **Special** — INPUT, OUTPUT, Wire (connection node)

**Composite Nodes** — Circuits saved as reusable components:

- **Built-in chips** — RSLatch, DFlipFlop, FullAdder, Counter4Bit
- **User-created chips** — Any circuit the user builds and saves

Composite nodes contain entire subcircuits but appear as single components in higher-level designs.

#### Ports

A **port** is a connection point on a node where wires attach.

- **Input ports** receive signals from other nodes
- **Output ports** send signals to other nodes

Ports have labels (e.g., "A", "B", "Out") indicating their function. Hovering over a port displays its current signal value during simulation.

#### Wires

A **wire** is a connection carrying a signal from one node's output port to another node's input port.

Wires have no delay—they propagate signals instantaneously within the same tick. A wire does not perform computation; it only transmits values.

To create a wire:

1. Click an output port
2. Drag to an input port
3. Release to finalize the connection

To delete a wire, select it and press the Delete key.

#### Gates

A **gate** is a primitive node implementing a Boolean function. Each gate has one or more inputs and one output.

Common gates:

- **AND** — Output is 1 only if all inputs are 1
- **OR** — Output is 1 if at least one input is 1
- **NOT** — Output is the opposite of the input (0→1, 1→0)
- **XOR** — Output is 1 if inputs differ (odd parity)
- **NAND** — NOT-AND (output is 0 only if all inputs are 1)
- **NOR** — NOT-OR (output is 1 only if all inputs are 0)
- **XNOR** — NOT-XOR (output is 1 if inputs are the same)

All gates have a **one-tick delay**. When inputs change, the output updates on the next tick.

This delay is not a bug. Real digital circuits have propagation delays. RedByte models this accurately to teach correct timing analysis.

#### Chips

A **chip** is a saved circuit that can be reused as a component in other circuits.

For example, the user might build a Half Adder from gates:

```
   A ──┬──> [XOR] ──> Sum
       │
       └──> [AND] ──> Carry
   B ──┘
```

After verifying it works, the user can save it as a chip named "HalfAdder". From that point forward, the HalfAdder appears in the component palette and can be placed like a primitive gate.

Chips enable hierarchical construction:

- **Layer 0** — Gates
- **Layer 1** — Chips built from gates (e.g., XOR, Half Adder)
- **Layer 2** — Chips built from Layer 1 chips (e.g., Full Adder)
- **Layer 3** — Chips built from Layer 2 chips (e.g., 4-bit Adder)

This process continues upward to arbitrary complexity.

#### Switches

A **switch** is an input node the user can toggle between 0 and 1.

Switches appear as small rectangles on the canvas. Clicking a switch changes its state. The output port reflects the current state immediately.

Switches are the primary mechanism for providing input during manual testing.

#### Lamps

A **lamp** is an output node that visually indicates signal state.

- When the input signal is **0**, the lamp appears dim or off
- When the input signal is **1**, the lamp appears bright or lit

Lamps provide immediate visual feedback, allowing the user to verify circuit behavior at a glance.

#### Clocks

A **clock** is a timing component that produces a periodic signal—alternating between 0 and 1 at regular intervals.

Clocks drive sequential circuits (flip-flops, counters, state machines). Without a clock, these components cannot change state.

The user can configure:

- **Frequency** — How many times per second the clock toggles
- **Initial state** — Whether the clock starts at 0 or 1

Clocks are essential for building registers, CPUs, and any circuit involving memory or state transitions.

---

## 5. Getting Started: First Circuit

The best way to understand RedByte is to build a circuit and observe its behavior. This section walks through constructing the simplest possible circuit: a switch controlling a lamp.

### Step 1: Opening the Logic Playground

If the Logic Playground is not already open:

1. Click the **Launcher** icon in the taskbar
2. Select **Logic Playground** from the app list

A new window opens, displaying a grid canvas with an empty circuit.

Alternatively, press `Ctrl+K` (Windows/Linux) or `Cmd+K` (Mac) to open the Quick Add palette from anywhere.

### Step 2: Adding a Switch

On the top toolbar, locate the **Component Palette**. The palette organizes components into categories:

- Basic I/O
- Logic Gates
- Timing
- Composites
- User Chips

Click the **Basic I/O** category to expand it. Click the **Switch** component.

The cursor changes to indicate placement mode. Click anywhere on the canvas to place the switch.

The switch appears as a small rectangle with an output port labeled "Out".

### Step 3: Adding a Lamp

Still in the **Basic I/O** category, click the **Lamp** component.

Click on the canvas to the right of the switch to place the lamp.

The lamp appears as a larger rectangle with an input port labeled "In".

### Step 4: Wiring Them Together

Wires connect outputs to inputs.

1. Hover over the switch's output port until it highlights
2. Click and hold the mouse button
3. Drag the cursor toward the lamp's input port
4. When the lamp's input port highlights, release the mouse button

A wire appears connecting the switch to the lamp.

### Step 5: Running the Simulation

On the top toolbar, locate the **Run** button (a green play icon). Click it.

The simulation starts. The tick counter in the status bar begins incrementing.

At this point, nothing dramatic happens—the lamp remains off because the switch's initial state is 0.

### Step 6: Toggling the Switch

Click on the switch component on the canvas.

The switch changes state from 0 to 1. The lamp immediately lights up.

Click the switch again. The switch returns to 0. The lamp turns off.

### Understanding What Changed

When the user clicks the switch:

1. The switch's output changes from 0 to 1
2. The wire transmits the signal to the lamp's input
3. The lamp evaluates its input and updates its visual state
4. The entire process happens within one tick

This is the fundamental interaction loop in RedByte:

- User provides input (toggle switch)
- Circuit propagates signals (through wires and gates)
- Outputs update (lamp lights)
- User observes result

Every circuit, no matter how complex, operates on this principle.

---

## 6. Time, Simulation, and Control

RedByte simulates circuits in discrete time, measured in ticks. The user controls how the simulation advances.

### The Simulation Controls

On the top toolbar, the user finds several buttons:

- **Run** (green play icon) — Start or resume the simulation
- **Pause** (orange pause icon) — Stop the simulation at the current tick
- **Step** (blue step icon) — Advance exactly one tick while paused
- **Reset** (red reset icon) — Return the circuit to its initial state (tick 0)

Keyboard shortcuts:

- `Space` — Toggle between Run and Pause
- `S` — Step forward one tick (while paused)

### What "Step" Does

Stepping is the most important tool for understanding circuit behavior.

When paused, pressing the **Step** button advances the simulation by exactly one tick. All components update once. The tick counter increments by 1.

This allows the user to:

- Observe signal propagation in slow motion
- Verify that gates produce correct outputs
- Trace how a signal moves through a chain of components
- Debug timing-sensitive circuits

Example: A chain of three NOT gates

```
[Switch] ──> [NOT] ──> [NOT] ──> [NOT] ──> [Lamp]
```

If the switch is 1, stepping through the simulation reveals:

| Tick | Switch | NOT 1 | NOT 2 | NOT 3 | Lamp |
|------|--------|-------|-------|-------|------|
| 0    | 1      | 0     | 1     | 0     | OFF  |
| 1    | 1      | 0     | 1     | 0     | OFF  |
| 2    | 1      | 0     | 1     | 0     | OFF  |

After toggling the switch to 0:

| Tick | Switch | NOT 1 | NOT 2 | NOT 3 | Lamp |
|------|--------|-------|-------|-------|------|
| 3    | 0      | 0     | 1     | 0     | OFF  |
| 4    | 0      | 1     | 1     | 0     | OFF  |
| 5    | 0      | 1     | 0     | 0     | OFF  |
| 6    | 0      | 1     | 0     | 1     | ON   |

The signal takes **three ticks** to propagate through three gates. This is visible only through stepping.

### What "Run" Does

Clicking **Run** advances the simulation continuously at the configured tick rate.

The default tick rate is **20 ticks per second**, meaning the simulation updates 20 times every second. The user can adjust this in the Settings app or using the tick rate slider on the toolbar.

Running mode is useful for:

- Observing repetitive behavior (e.g., clocks, counters)
- Testing circuits at interactive speed
- Watching patterns emerge over many ticks

However, running mode can make fast changes difficult to perceive. For precise observation, pause and step.

### What "Pause" Does

Clicking **Pause** stops the simulation at the current tick. All component states freeze.

While paused, the user can:

- Inspect signal values in the Property Inspector
- Toggle switches to prepare the next input change
- Add or remove probes
- Step through ticks one at a time

Pausing does not reset the circuit. Clicking **Run** again resumes from the paused tick.

### What "Reset" Does

Clicking **Reset** returns the circuit to tick 0 with all components in their initial states:

- All gates output 0
- All flip-flops reset
- All counters return to 0
- All switches return to their default state (usually 0)

Reset is useful for:

- Starting a fresh test after observing incorrect behavior
- Re-running a simulation from the beginning
- Clearing accumulated state in sequential circuits

### The Tick Counter

In the status bar at the bottom of the screen, the **tick counter** displays the current simulation time.

It starts at 0 and increments by 1 for each tick. It resets to 0 when the user clicks **Reset**.

The tick counter helps the user understand when events occur and how long propagation delays last.

### The Tick Rate

The **tick rate** controls how many ticks occur per second when the simulation is running.

The user can adjust the tick rate using:

- A slider on the top toolbar (ranges from 1 to 60 ticks per second)
- The Settings app (same range)
- The Terminal app (`rate <hz>` command)

**When to use slow tick rates (1–5 Hz):**

- Observing complex circuits with many components
- Teaching or demonstrating circuit behavior
- Debugging timing issues

**When to use medium tick rates (10–20 Hz):**

- General interactive use
- Balanced speed and observability

**When to use fast tick rates (30–60 Hz):**

- Running counters or clocks for extended durations
- Stress-testing circuit performance
- Simulating real-time behavior

The tick rate does not change circuit behavior—it only changes how quickly the user observes it.

---

## 7. Probes and the Oscilloscope

Watching lamps light up provides basic feedback, but understanding circuit timing requires observing signals over time. This is the purpose of **probes** and the **oscilloscope**.

### What a Probe Is

A **probe** is a marker placed on a signal in the circuit. It instructs RedByte to record that signal's value at every tick.

Probes are invisible on the schematic canvas. Their presence is indicated in the **Oscilloscope** panel, where the signal appears as a trace.

### Why Probing Matters

Without probes, the user sees only the current state of the circuit at the current tick. With probes, the user sees the entire history of selected signals.

This enables:

- **Pattern recognition** — Identifying repeating or periodic signals
- **Timing analysis** — Measuring how long signals remain high or low
- **Causality tracing** — Understanding which signal changes trigger other changes
- **Debugging** — Locating exactly when and where a signal becomes incorrect

### How to Add a Probe

To add a probe to a signal:

1. Right-click on any component in the schematic canvas
2. Select **Add Probe** from the context menu
3. The probe appears in the oscilloscope's probe list

Alternatively:

1. Open the **Property Inspector** on the right panel
2. Select a component
3. Click the **Add Probe** button next to an output port

Each probe is assigned a unique color for visual distinction.

### How to Remove a Probe

To remove a probe:

1. Open the **Oscilloscope** panel
2. Locate the probe in the probe list
3. Click the **X** button next to the probe name

The probe disappears, and its trace is removed from the oscilloscope.

### What the Oscilloscope Shows

The **oscilloscope** is a timing diagram displaying signal values over time.

- The **horizontal axis** represents time (measured in ticks)
- The **vertical axis** represents signal amplitude (0 or 1)

Each probe appears as a horizontal trace:

- The trace remains at 0 when the signal is 0
- The trace jumps to 1 when the signal becomes 1
- Vertical transitions indicate state changes

Example oscilloscope view:

```
Clock   ┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐
        └─┘ └─┘ └─┘ └─┘ └─

Output  ──┐     ┌───────┐
          └─────┘       └──

        0   1   2   3   4   5   (ticks)
```

In this example:

- **Clock** alternates between 0 and 1 every tick (a square wave)
- **Output** changes from 0 to 1 at tick 1, remains high until tick 4, then returns to 0

### How to Read Traces

Reading an oscilloscope trace involves identifying:

1. **When transitions occur** — Vertical edges indicate state changes
2. **How long signals remain stable** — Horizontal segments indicate duration
3. **Relationships between signals** — Observing which signals change together or in sequence

Example: A delayed signal

```
Input   ┐ ┌───────────
        └─┘

Delayed ──┐ ┌─────────
          └─┘

        0 1 2 3 4 5  (ticks)
```

The **Delayed** signal copies the **Input** signal but one tick later. This is the behavior of a buffer or delay gate.

### What Persistence Means

The oscilloscope stores the **last 500 samples** of each probe. If the simulation runs beyond 500 ticks, old samples are discarded, and the oscilloscope displays the most recent 500.

This is called **circular buffering**. It prevents memory overflow during long simulations while preserving recent history.

### What Pause-Scroll Is

When the simulation is paused, the user can:

- **Zoom** the time axis to see fine-grained detail
- **Pan** left and right to examine earlier ticks
- **Hover** over traces to see exact tick numbers and signal values

This allows detailed inspection of specific events without the trace scrolling away.

### What "Follow Now" Does

When the simulation is running, the oscilloscope can operate in two modes:

1. **Follow mode** (default) — The time axis scrolls automatically to keep the current tick visible
2. **Fixed mode** — The time axis remains stationary, allowing the user to examine a specific time window

If the user pans the time axis while the simulation is running, the oscilloscope switches to **Fixed mode**.

To return to **Follow mode**, click the **Follow Now** button in the oscilloscope toolbar. The view jumps to the current tick and resumes scrolling.

### Renaming Probes

By default, probes are named after their component (e.g., "AND1.Out", "Switch2.Out"). These names can be unclear in complex circuits.

To rename a probe:

1. Open the **Oscilloscope** panel
2. Click on the probe name in the probe list
3. Type a new name (e.g., "Carry", "Sum", "ClockSignal")
4. Press Enter

Meaningful names make traces easier to identify and improve debugging efficiency.

### Toggling Probes On and Off

Probes can be temporarily hidden without deleting them.

Each probe in the oscilloscope's probe list has a checkbox. Unchecking the box hides the trace. Checking it again makes the trace reappear.

This is useful when:

- Too many traces clutter the display
- The user wants to focus on a subset of signals
- Comparing two signals requires isolating them visually

### Hovering for Measurements

Hovering the mouse over a trace in the oscilloscope displays:

- The exact **tick number** at the cursor position
- The **signal value** at that tick (0 or 1)

For periodic signals (like clocks), the oscilloscope automatically calculates:

- **Period** — The number of ticks for one complete cycle
- **Frequency** — The number of cycles per second (at the current tick rate)
- **Duty cycle** — The percentage of time the signal is high

These measurements appear in a tooltip when hovering over the signal.

---

## 8. Recording, Replay, and Verification

Circuits do not always behave as expected. When debugging, the user must determine what went wrong, when it went wrong, and why.

RedByte provides a **Run Recorder** that captures simulation runs and allows precise replay and analysis.

### What the Run Recorder Is

The **Run Recorder** is a tool that records:

1. The initial state of the circuit
2. All user inputs (switch toggles, button presses)
3. All probed signals at every tick

This recording is saved as a **Run Record**—a complete snapshot of the simulation session.

### What It Records

A Run Record contains:

- **Circuit snapshot** — The complete circuit structure (nodes, connections, component configurations)
- **Initial state** — All component states at tick 0
- **Stimulus events** — A timeline of user actions (e.g., "Toggle Switch A at tick 10")
- **Trace data** — The value of every probed signal at every tick
- **Metadata** — Timestamp, tick rate, RedByte version, user notes

### What Replay Means

**Replay** is the process of re-running a recorded simulation.

When the user loads a Run Record and clicks **Replay**:

1. The circuit is restored to its initial state (tick 0)
2. The simulation advances tick-by-tick
3. At each tick where a stimulus event occurred (e.g., a switch toggle), that event is automatically re-applied
4. The oscilloscope displays both the **original trace** (from the recording) and the **replay trace** (from the current simulation)

If the circuit is deterministic, the replay trace should match the original trace exactly.

### What Verification Means

**Verification** is the process of comparing the replay trace to the original trace to detect differences.

After replaying a Run Record, the user clicks the **Verify** button. RedByte compares the two traces sample-by-sample.

If the traces match, verification succeeds:

- The oscilloscope displays a green checkmark
- A toast notification confirms: "Replay matches original recording"

If the traces differ, verification fails:

- The oscilloscope highlights the first tick where the traces diverge
- The differing signals are marked in red
- A report lists which nodes produced mismatched outputs

### What Mismatches Indicate

A mismatch between the original trace and the replay trace indicates one of three possibilities:

1. **The circuit was modified** — If the user edited the circuit after recording, replay will not match the original
2. **Non-deterministic behavior** — If the circuit depends on randomness or external state (this should not occur in RedByte)
3. **A bug in the simulation engine** — If determinism is violated (this is a critical error and should be reported)

In practice, mismatches almost always result from circuit modifications. Verification helps the user confirm that changes to the circuit preserved correct behavior.

### Why This Matters for Learning

Recording and replay enable **time-travel debugging**:

- The user can step backward and forward through a failed test
- The user can inspect the exact tick where a signal became incorrect
- The user can isolate which component produced the wrong output

This transforms debugging from guesswork into systematic analysis.

Example debugging workflow:

1. Build a 4-bit adder circuit
2. Record a test: Input A = 5, Input B = 3
3. Observe the output: Sum = 9 (incorrect; should be 8)
4. Replay the test with all internal signals probed
5. Step through the replay tick-by-tick
6. Identify that the Carry signal from bit 2 is incorrect at tick 7
7. Inspect the Full Adder at bit 2 to find the wiring error
8. Fix the wiring, re-run the test, verify it matches expected behavior

Without recording, this process would require manual re-testing after every change.

### How to Record a Run

To record a simulation run:

1. Open the **Run Recorder** panel (usually on the right side of the Logic Playground)
2. Click the **Arm** button
3. The recorder enters "Armed" state, ready to capture
4. Click the red **Record** button to start recording
5. Interact with the circuit (toggle switches, observe outputs)
6. Click the **Stop** button to end the recording

The Run Record is saved and appears in the recorder's list.

### How to Replay a Recording

To replay a saved Run Record:

1. Open the **Run Recorder** panel
2. Select a Run Record from the list
3. Click the **Replay** button
4. The simulation resets to tick 0 and begins replaying the recorded stimulus

The user can pause during replay and step through ticks for detailed inspection.

### Exporting Run Records

Run Records can be exported as JSON files for sharing or archival.

To export:

1. Select a Run Record in the recorder panel
2. Click the **Export** button
3. Choose a save location
4. The file is saved with a `.json` extension

Exported Run Records can be loaded by other users to reproduce the exact simulation session.

---

## 9. Saving, Loading, and Exporting Work

RedByte provides multiple ways to save and export circuits, each serving a different purpose.

### Projects

A **project** is the native RedByte file format for saving circuits. It contains:

- The circuit structure (all nodes and connections)
- Probe definitions
- Oscilloscope configuration
- Recorded runs
- Metadata (project name, description, creation date)

Projects use the `.json` file extension and are stored in RedByte's virtual filesystem.

### Saving vs. Exporting

**Saving** stores a project in RedByte's internal filesystem. The user can reopen it later within RedByte.

**Exporting** converts the project to a different format for use outside RedByte.

To save a project:

1. Press `Ctrl+S` (Windows/Linux) or `Cmd+S` (Mac)
2. Enter a project name
3. Click **Save**

The project is saved to the virtual filesystem and appears in the **Files** app.

To export a project:

1. Open the **File** menu in the Logic Playground
2. Select **Export**
3. Choose an export format (Netlist, Verilog, Debug Bundle)
4. Click **Export** and choose a save location

### What Files RedByte Creates

RedByte stores data in the browser's **localStorage**, not on the disk. This means:

- No installation is required
- No file permissions are needed
- Data persists across browser sessions
- Data is isolated per browser and user profile

The **Files** app provides a traditional file browser interface, even though files are not physical files.

### What Netlists Are

A **netlist** is a structural description of a circuit, listing:

- All nodes (components) with their types and configurations
- All connections (nets) between nodes

Netlists are language-agnostic and machine-readable. They serve as interchange formats for circuit design tools.

Example netlist excerpt:

```json
{
  "nodes": [
    { "id": "n1", "type": "Switch", "position": [0, 0] },
    { "id": "n2", "type": "AND", "position": [2, 0] },
    { "id": "n3", "type": "Lamp", "position": [4, 0] }
  ],
  "connections": [
    { "from": "n1.Out", "to": "n2.A" },
    { "from": "n1.Out", "to": "n2.B" },
    { "from": "n2.Out", "to": "n3.In" }
  ]
}
```

Netlists are useful for:

- Documenting circuit structure
- Importing circuits into other simulators
- Generating reports or diagrams programmatically

### What Verilog Export Is

**Verilog** is a hardware description language used in professional electronic design.

RedByte can export circuits as **structural Verilog**, which describes the circuit as a list of module instances and wire connections.

Example Verilog export:

```verilog
module Circuit (
  input wire A,
  input wire B,
  output wire Out
);

  wire n1_out;

  AND gate1 (.A(A), .B(B), .Out(n1_out));
  Lamp lamp1 (.In(n1_out));

endmodule
```

Verilog export is **not synthesizable**—it cannot be compiled directly to hardware. It serves as documentation or as a starting point for manual conversion to synthesizable code.

Verilog export is useful for:

- Sharing circuits with engineers familiar with HDLs
- Comparing RedByte circuits to industry-standard designs
- Learning Verilog syntax by example

### What Debug Bundles Contain

A **Debug Bundle** is a comprehensive export format containing:

- The circuit netlist
- All probed signals and their values
- Oscilloscope configuration
- Run Records with verification results
- Mismatch reports (if verification failed)
- Metadata (timestamps, version info)

Debug Bundles are intended for:

- Reporting bugs to RedByte developers
- Sharing complex debugging scenarios with collaborators
- Archiving evidence of circuit behavior for future reference

### Who These Exports Are For

- **Netlists** — Engineers, researchers, and tool developers
- **Verilog** — Hardware designers and students learning HDLs
- **Debug Bundles** — Advanced users troubleshooting issues or documenting behavior

Beginners rarely need to export. Saving projects within RedByte is sufficient for learning and experimentation.

---

## 10. The Terminal

RedByte includes a **Terminal** app—a text-based command-line interface for interacting with the system.

### Why a Terminal Exists in RedByte

The Terminal provides:

- **Power-user access** — Keyboard-driven control without navigating menus
- **Scriptable actions** — Commands can be copied, pasted, and repeated
- **System inspection** — View running apps, memory usage, and configuration
- **Quick navigation** — Open files and apps with short commands

For users comfortable with command-line interfaces, the Terminal is faster than mouse-based interaction.

### What Kinds of Commands It Accepts

Available commands include:

- **`help`** — List all commands with descriptions
- **`clear`** — Clear the terminal screen
- **`about`** — Display RedByte version and build information
- **`status`** — Show system status (memory usage, running apps, uptime)
- **`apps list`** — List all running applications with their IDs
- **`apps close <app-id>`** — Close a specific application by ID
- **`theme <light|dark|system>`** — Change the color theme
- **`rate <hz>`** — Set the global tick rate (1–60 Hz)
- **`examples`** — List available example circuits
- **`load <example-id>`** — Load an example circuit into the Logic Playground
- **`open <filename>`** — Open a saved circuit file

Example session:

```
$ rate 10
Tick rate set to 10 Hz.

$ examples
Available examples:
  01_wire-lamp
  02_and-gate
  03_half-adder
  ...

$ load 03_half-adder
Loaded example: Half Adder

$ apps list
Running applications:
  - Logic Playground (id: lp-1)
  - Terminal (id: term-1)
```

### How It Relates to the Rest of the System

The Terminal is not a separate environment—it controls the same RedByte OS that the user interacts with via the GUI.

Changes made in the Terminal affect the GUI immediately:

- Setting the tick rate updates the slider in the Logic Playground
- Loading an example opens a new circuit in the active Logic Playground window
- Changing the theme updates all application windows

The Terminal is an alternative interface, not a parallel system.

### What It Is Not Meant For

The Terminal does **not** provide:

- **Circuit editing** — Circuits cannot be built or modified via text commands
- **File manipulation** — Files cannot be created, edited, or deleted (use the Files app)
- **Scripting or automation** — There is no scripting language or batch execution
- **Low-level system access** — This is not a Unix shell or operating system terminal

The Terminal is a convenience tool for common tasks, not a programming environment.

---

## 11. Files and Settings

RedByte includes tools for managing saved work and configuring the platform's behavior.

### File Browser

The **Files** app provides a graphical interface for navigating RedByte's virtual filesystem.

The sidebar displays:

- **Home** — The user's personal directory
- **Desktop** — Files and folders visible on the desktop background
- **Documents** — A default location for saving projects

The main panel shows the contents of the selected folder. The user can:

- **Create folders** — Right-click and select "New Folder"
- **Rename files** — Select a file and press `F2`
- **Delete files** — Select a file and press `Delete`
- **Open files** — Double-click to open in the associated app

Keyboard shortcuts:

- `Ctrl+Shift+N` — New folder
- `F2` — Rename selected
- `Delete` — Delete selected

### Project Files

Project files are saved with a `.json` extension. They contain the entire circuit, probes, oscilloscope state, and recordings.

When the user double-clicks a project file in the Files app, the Logic Playground opens and loads the circuit.

Projects are self-contained. Sharing a project file with another user allows them to open the exact circuit in their own RedByte instance.

### Settings (Theme, Performance, Session Behavior)

The **Settings** app controls global configuration options.

#### Appearance

- **Theme** — Choose between Light, Dark, or System (follows the operating system's theme preference)
- **Wallpaper** — Select a desktop background (Neon Circuit, Frost Grid, Gradient, Solid Color)

#### System

- **Tick Rate** — Set the default simulation speed (1–60 ticks per second)

#### File Associations

- **Default Apps** — Assign which app opens which file type (e.g., `.json` files open in Logic Playground)

#### Session

- **App Version** — Display the current RedByte version and build commit
- **Restart** — Reload the page to apply updates or reset the environment

All settings persist across browser sessions using localStorage.

### What Users Should and Should Not Change

**Safe to change:**

- Theme (does not affect circuit behavior)
- Wallpaper (purely cosmetic)
- Tick rate (adjustable at any time; does not affect correctness)
- File associations (only affects which app opens when double-clicking files)

**Should not change unless necessary:**

- Filesystem data (deleting files is permanent)
- Session settings (restarting clears undo history and unsaved work)

If unsure, leave settings at their defaults. RedByte is designed to work well out of the box.

---

## 12. How to Learn Effectively With RedByte

RedByte is a tool, not a teacher. It provides transparency and feedback, but the user must actively engage with it to develop understanding.

### How to Experiment

Effective experimentation follows a pattern:

1. **Form a hypothesis** — "If I connect two AND gates in series, the output will only be 1 if all four inputs are 1."
2. **Build the circuit** — Place the components and wire them
3. **Test the hypothesis** — Run the simulation and observe the output
4. **Analyze the result** — Did the circuit behave as expected? If not, why?

This cycle develops intuition. Each iteration teaches the user how circuits behave.

### How to Isolate Behavior

When debugging, isolate the problem:

- **Remove unnecessary components** — Simplify the circuit until only the problematic behavior remains
- **Probe intermediate signals** — Identify exactly where the signal becomes incorrect
- **Step through ticks** — Watch the signal propagate slowly to understand timing

If a 4-bit adder produces the wrong sum, test each bit's Full Adder independently. If one Full Adder fails, test its component gates individually.

Breaking the problem into smaller pieces makes the cause discoverable.

### How to Reason About Circuits

Understanding circuits requires thinking causally:

- **Inputs determine outputs** — If the output is wrong, at least one input must be wrong
- **Gates have delays** — If a signal does not appear immediately, it may be delayed by gate propagation
- **State affects behavior** — If a flip-flop or counter is involved, the circuit's history matters

Ask:

- "What input values produce this output?"
- "How many ticks does this signal take to propagate?"
- "What state is this flip-flop in, and why?"

Answering these questions builds the mental model needed to design circuits confidently.

### Common Beginner Mistakes

**Mistake 1: Expecting instant propagation**

Gates are not instantaneous. A chain of 5 gates delays the signal by 5 ticks. Beginners often expect the output to update immediately.

Solution: Step through the simulation and watch the signal propagate.

**Mistake 2: Forgetting to reset before testing**

If a circuit has sequential components (flip-flops, counters), its state accumulates over time. Testing without resetting can produce confusing results.

Solution: Click **Reset** before each test to ensure a clean starting state.

**Mistake 3: Probing too few signals**

Beginners often probe only the final output, missing intermediate signals that reveal the cause of errors.

Solution: Probe liberally. Probe inputs, intermediate gates, and outputs. The oscilloscope can handle many traces.

**Mistake 4: Ignoring tick count**

Beginners focus on "what happened" but not "when it happened." Timing is critical in digital circuits.

Solution: Watch the tick counter. Note when signals change. Compare expected timing to observed timing.

**Mistake 5: Building without verifying incrementally**

Building a large circuit all at once makes debugging difficult. If something goes wrong, the user does not know which part is broken.

Solution: Build in stages. Test each stage before adding the next. Save working circuits as chips.

### How to Debug Logically

Debugging is systematic investigation:

1. **Reproduce the error** — Ensure the problem occurs consistently
2. **Locate the failing component** — Use probes to find where the signal becomes incorrect
3. **Inspect inputs to that component** — Are its inputs correct?
4. **Trace backward** — If an input is incorrect, find where that input comes from
5. **Repeat until the root cause is found**

Example: A Full Adder produces the wrong Carry output.

1. Probe the Carry output — it is 1 when it should be 0
2. Probe the inputs to the Carry's OR gate — one input is 1 (incorrect)
3. Trace that input back to an AND gate
4. Probe the AND gate's inputs — one input is incorrect
5. Trace that input back to an XOR gate
6. Inspect the XOR gate's inputs — one wire is connected to the wrong port

The root cause is a wiring error at the XOR gate.

This process works for any circuit, no matter how complex.

### How to Build Confidence

Confidence comes from repeated success:

- **Start with examples** — Load an example circuit and observe its behavior before building from scratch
- **Modify examples** — Change one wire or gate and observe the effect
- **Build progressively** — Start with gates, build chips, build larger chips from smaller chips
- **Record and replay** — Verify that circuits behave reproducibly
- **Celebrate recognition** — When RedByte recognizes a circuit pattern, the user has mastered that concept

Mastery is not innate. It is earned through practice, observation, and iteration.

---

## 13. What RedByte Is Not

To use RedByte effectively, the user must understand its limitations and purpose.

### Not a Game

RedByte does not have levels, scores, achievements, or win conditions. It is a tool for learning, not entertainment.

The user defines their own goals. The platform provides feedback but no external rewards.

### Not a Shortcut

Understanding digital logic requires effort. RedByte makes the learning process more transparent and interactive, but it does not eliminate the need to think.

The user must:

- Read circuit behavior carefully
- Reason about signal flow
- Debug errors systematically
- Practice building circuits repeatedly

There is no "auto-solve" button. Learning requires engagement.

### Not Magic

RedByte simulates circuits using well-defined rules. Every component behaves according to Boolean algebra and timing delays.

If a circuit produces unexpected output, the cause is always discoverable through inspection. There are no hidden variables, no randomness, and no mysteries.

### Not an IDE Replacement

RedByte is not a development environment for writing software. It simulates hardware circuits, not programs.

While it is possible to build a CPU in RedByte and run code on it, this is an advanced goal, not the primary use case.

### Not an AI That Guesses

RedByte does not predict what the user intends to build. It does not autocomplete circuits or suggest designs.

The user must specify every gate, every wire, and every connection explicitly. The platform provides pattern recognition for validation, not generation.

---

## 14. Why RedByte Exists

RedByte was built to address a specific problem: **learning digital logic is unnecessarily difficult.**

### The Problem

Traditional approaches to teaching computer architecture fall into three categories:

1. **Textbooks** — Provide diagrams and explanations but no interaction
2. **Physical kits** — Offer hands-on experience but limited scale and observability
3. **Professional tools** — Provide power but steep learning curves and hidden abstractions

Each approach has value, but none provides the combination of:

- Immediate feedback
- Complete transparency
- Unlimited scale
- Zero setup cost

### The Solution

RedByte provides a **transparent, interactive, scalable platform** for building circuits from first principles.

It enables the user to:

- **See every signal at every moment** — No hidden state, no black boxes
- **Build incrementally** — Start with gates, progress to CPUs
- **Experiment without cost** — No physical components, no risk of damage
- **Verify behavior reproducibly** — Record, replay, and compare results

### What It Enables

RedByte enables self-directed learning. The user can:

- Explore circuits at their own pace
- Test hypotheses immediately
- Build confidence through iteration
- Progress from simple to complex without switching tools

### What Kind of Understanding It Aims to Provide

RedByte teaches **mechanistic understanding**—the ability to trace how inputs transform into outputs step-by-step.

This is distinct from:

- **Abstract understanding** — Knowing that an adder computes sums without knowing how
- **Procedural understanding** — Knowing how to use an adder without understanding its internals

Mechanistic understanding is durable. Once the user knows how a Full Adder works, they can:

- Design variations (subtractors, comparators)
- Debug failures (trace incorrect carries)
- Build larger systems (multi-bit ALUs)

This understanding transfers. The principles learned in RedByte apply to real hardware, HDLs, and computer architecture courses.

### Why Transparency Matters

Complexity is not the enemy. **Hidden complexity** is the enemy.

When a textbook shows a CPU block diagram with a "Control Unit" box, the learner does not understand what happens inside that box. When a simulator runs a circuit but does not show internal signals, the learner cannot debug failures.

RedByte eliminates hiding. Every component's behavior is observable. Every signal's value is accessible. Every delay is explicit.

This transparency transforms learning from memorization to comprehension.

---

## 15. Where to Go Next

RedByte provides a platform. The user provides the curiosity and effort. This section suggests next steps for continued learning.

### Suggested Next Experiments

After building basic circuits (switch-lamp, AND gate, Half Adder), try:

**Layer 1: Combinational Logic**

- Build an **XOR gate from NAND gates** (requires 4 NANDs)
- Build a **Full Adder** (two Half Adders + OR gate)
- Build a **2-to-1 Multiplexer** (selects one of two inputs based on a control signal)
- Build a **4-bit Adder** (chain four Full Adders)

**Layer 2: Sequential Logic**

- Build an **SR Latch** (cross-coupled NOR gates; first memory element)
- Build a **D Flip-Flop** (clocked memory)
- Build a **4-bit Register** (four D Flip-Flops with a shared clock)
- Build a **Counter** (increments every clock tick)

**Layer 3: Arithmetic and Control**

- Build an **ALU** (performs multiple operations: ADD, SUB, AND, OR)
- Build a **Decoder** (converts binary input to one-hot output)
- Build a **Multiplexer Tree** (selects one of many inputs)

**Layer 4: Memory and State Machines**

- Build **RAM** (register file with address decoder)
- Build a **state machine** (changes behavior based on current state and input)

### Suggested Types of Circuits to Build

To deepen understanding, build circuits in these categories:

**1. Arithmetic circuits**

- Adders, subtractors, multipliers, comparators
- Teaches: Propagation delay, carry logic, multi-bit operations

**2. Memory circuits**

- Latches, flip-flops, registers, shift registers
- Teaches: State, clocking, edge-triggered behavior

**3. Control circuits**

- Decoders, multiplexers, demultiplexers
- Teaches: Data routing, address decoding, selection logic

**4. Timing circuits**

- Counters, dividers, pulse generators
- Teaches: Clock domains, frequency division, periodic signals

**5. Complete systems**

- Simple CPUs (fetch-decode-execute)
- Teaches: Instruction sets, program counters, control flow

### How to Deepen Understanding Over Time

Mastery develops through iteration:

**Phase 1: Observation** (Days 1–7)

- Load and run example circuits
- Toggle switches, watch lamps
- Observe oscilloscope traces
- Step through simulations

**Phase 2: Modification** (Days 7–14)

- Change wires in examples
- Add gates to existing circuits
- Observe how changes affect behavior
- Learn by breaking and fixing

**Phase 3: Construction** (Days 14–30)

- Build circuits from scratch
- Reference examples when stuck
- Save working circuits as chips
- Build progressively larger designs

**Phase 4: Debugging** (Days 30–60)

- Record test runs
- Replay and verify behavior
- Isolate failures systematically
- Develop debugging intuition

**Phase 5: Design** (Days 60+)

- Design circuits without examples
- Optimize for size or speed
- Create novel components
- Teach others using RedByte

### Final Advice

**Start small.** Do not attempt to build a CPU on day one. Build a Half Adder. Build a flip-flop. Build confidence.

**Probe everything.** The oscilloscope is the most powerful debugging tool. Use it liberally.

**Step through simulations.** Running at full speed hides what is happening. Stepping reveals causality.

**Save progress.** Save working circuits as chips. Save projects regularly. Build on proven foundations.

**Embrace failure.** Circuits that do not work are opportunities to learn. Debug systematically. Find the root cause.

**Ask why.** When a circuit behaves unexpectedly, do not guess. Investigate. Understand.

RedByte provides visibility, feedback, and tools. The user provides curiosity, patience, and effort.

The platform is ready. The question is: What will the user build?

---

## 16. From Logic to Bitstream

RedByte can move beyond simulation and create FPGA-ready outputs for Basys 3 boards. The flow is deterministic and mirrors standard FPGA toolchains:

1. **Build a digital circuit** in Logic Playground (analog nodes are simulation-only).
2. **Export a netlist** from the circuit graph.
3. **Generate synthesizable Verilog** plus the RedByte primitive library.
4. **Generate an XDC constraints file** for Basys 3 switch and LED pins.
5. **Run synthesis** in Vivado batch mode to produce a `.bit` file.
6. **Program the board** with Vivado or openFPGALoader.

The Hardware Panel shows toolchain detection status and provides synth/program controls once Vivado is available.

---

## 17. Analog Simulation

Analog models are simplified and deterministic. They are intended for teaching lab concepts (comparators, sensors, and references) rather than transistor-level accuracy.

**Example: LDR + Voltage Divider + LM358**

1. Place an **LDR**, **FixedResistor**, **VoltageDivider**, **LM358**, and **Lamp**.
2. Feed **VoltageSource** into `VoltageDivider.v_in`.
3. Wire `FixedResistor.resistance` to `VoltageDivider.r1`.
4. Wire `LDR.resistance` to `VoltageDivider.r2`.
5. Wire `VoltageDivider.v_out` to `LM358.V_plus`.
6. Provide a `VoltageSource` reference to `LM358.V_minus`.
7. Wire `LM358.out` to the Lamp input.

As light increases, the LDR resistance drops, lowering the divider output. The comparator toggles when `V_plus` crosses `V_minus`.

Analog values appear in the Inspector under **Analog Readings**, showing inputs, outputs, and their source connections.

---

## 18. Troubleshooting

**Vivado not found**

- Install AMD Vivado WebPACK and ensure the Vivado binary is on your PATH.
- Reopen the Hardware Panel to refresh toolchain detection.

**Board not detected**

- Confirm Basys 3 USB connection and power.
- On Windows, check FTDI drivers and COM port availability.

**UI unresponsive**

- Refresh the page and reopen the Logic Playground.
- Close unused windows to reduce render load.

**Simulator does not tick**

- Ensure simulation is running (Space).
- Verify tick rate is above 0.
- Exit replay mode to resume live ticks.

---

**End of RedByte User Manual (Version 1)**
