# RedByte OS Examples Catalog

## Overview

RedByte OS Genesis includes **18 pre-built circuit examples** spanning from basic gates to complete FPGA-ready systems. Examples are organized by **Circuit Layer** (0–6), representing increasing complexity from fundamental concepts to hardware synthesis.

---

## Table of Contents

1. [Quick Reference Table](#quick-reference-table)
2. [Layer 0: Foundation](#layer-0-foundation)
3. [Layer 1: Combinational Logic](#layer-1-combinational-logic)
4. [Layer 2: Arithmetic & Logic](#layer-2-arithmetic--logic)
5. [Layer 3: Memory & State](#layer-3-memory--state)
6. [Layer 4: Control & Coordination](#layer-4-control--coordination)
7. [Layer 5: Memory Systems](#layer-5-memory-systems)
8. [Layer 6: FPGA Hardware & Processors](#layer-6-fpga-hardware--processors)
9. [Loading Examples](#loading-examples)
10. [Creating Custom Examples](#creating-custom-examples)

---

## Quick Reference Table

| ID | Name | Nodes | I/O | Topic | Difficulty | Layer |
|----|------|-------|-----|-------|------------|-------|
| 01 | Wire + Lamp | 3 | 1→1 | Basic connection | Beginner | 0 |
| 02 | AND Gate | 5 | 2→1 | Logic gates | Beginner | 0 |
| 15 | NOT Gate | 4 | 1→1 | Signal inversion | Beginner | 0 |
| 03 | Half Adder | 7 | 2→2 | Arithmetic basics | Beginner | 1 |
| 06 | XOR from NANDs | 8 | 2→1 | Gate composition | Beginner | 1 |
| 07 | 2-to-1 Mux | 9 | 3→1 | Data selection | Intermediate | 1 |
| 08 | Full Adder | 12 | 3→2 | Carry propagation | Intermediate | 2 |
| 09 | 4-bit Adder | 16 | 9→5 | Multi-bit arithmetic | Intermediate | 2 |
| 10 | SR Latch | 6 | 2→2 | Memory basics | Intermediate | 3 |
| 11 | D Flip-Flop | 10 | 2→2 | Clocked storage | Advanced | 3 |
| 04 | 4-bit Counter | 14 | 2→4 | Sequential circuits | Advanced | 3 |
| 12 | 2-to-4 Decoder | 11 | 2→4 | Address decoding | Intermediate | 4 |
| 13 | 4-to-1 Mux | 15 | 6→1 | Data routing | Advanced | 4 |
| 14 | 4-bit Register | 13 | 5→4 | Parallel storage | Advanced | 5 |
| 16 | 8-bit Counter (Basys3) | 20 | 3→8 | FPGA synthesis | Advanced | 6 |
| 17 | Traffic Light FSM | 18 | 2→3 | State machines | Advanced | 6 |
| 18 | 4-bit ALU (Basys3) | 26 | 10→4 | Arithmetic logic | Advanced | 6 |
| 05 | Simple CPU | 150+ | 12→8 | Processor design | Advanced | 6 |

**Legend**:
- **I/O**: `Inputs → Outputs` (e.g., `2→1` = 2 inputs, 1 output)
- **Layer**: Circuit complexity tier (0 = basic, 6 = advanced/FPGA-ready)
- **Difficulty**: Recommended skill level (Beginner/Intermediate/Advanced)

---

## Layer 0: Foundation

*"Learn basic gates and how electricity flows"*

### 01_wire-lamp

**Concept**: The simplest possible circuit - power source to lamp.

**Circuit**:
```
[Power] ─────► [Lamp]
```

**Components**: 3 nodes (Power, Wire, Lamp)  
**Educational Value**: Teaches basic circuit connectivity, signal flow, and simulation basics.

**Key Concepts**:
- Signal propagation
- Node connections
- Simulation visualization

---

### 02_and-gate

**Concept**: Two switches control a lamp through an AND gate - both must be ON for the lamp to light.

**Circuit**:
```
[Switch A] ─┐
            ├─► [AND] ─► [Lamp]
[Switch B] ─┘
```

**Components**: 5 nodes (2 switches, AND gate, lamp, connections)  
**Educational Value**: Introduces Boolean logic, truth tables, and combinational gates.

**Key Concepts**:
- Boolean AND operation
- Truth table: `A AND B = Y`
  ```
  A | B | Y
  0 | 0 | 0
  0 | 1 | 0
  1 | 0 | 0
  1 | 1 | 1
  ```

---

### 15_not-gate

**Concept**: A switch controls a lamp through an inverter (NOT gate) - lamp is ON when switch is OFF.

**Circuit**:
```
[Switch] ─► [NOT] ─► [Lamp]
```

**Components**: 4 nodes  
**Educational Value**: Signal inversion, active-low logic, complement operations.

**Key Concepts**:
- Boolean NOT operation
- Truth table: `NOT A = Y`
  ```
  A | Y
  0 | 1
  1 | 0
  ```

---

## Layer 1: Combinational Logic

*"Combine gates to create new behaviors"*

### 03_half-adder

**Concept**: Adds two 1-bit numbers, produces sum and carry - the foundation of all arithmetic.

**Circuit**:
```
[A] ─┬─► [XOR] ─► [Sum]
     │
[B] ─┼─► [AND] ─► [Carry]
     └──────┘
```

**Components**: 7 nodes (2 inputs, XOR, AND, 2 outputs)  
**Educational Value**: First arithmetic circuit, introduces carry propagation concept.

**Truth Table**:
```
A | B | Sum | Carry
0 | 0 |  0  |   0
0 | 1 |  1  |   0
1 | 0 |  1  |   0
1 | 1 |  0  |   1
```

**Key Concepts**:
- Binary addition
- Carry generation
- Multi-output circuits

---

### 06_xor-gate

**Concept**: Build XOR from three NAND gates - demonstrates universal gates.

**Circuit**:
```
[A] ─┬─► [NAND] ─┬─► [NAND] ─► [Y]
     │           │
     └─► [NAND] ─┤
     ┌───────────┘
[B] ─┴───────────────────────►
```

**Components**: 8 nodes (2 inputs, 3 NANDs, 1 output)  
**Educational Value**: NAND as universal gate, gate synthesis, logic equivalence.

**Key Concepts**:
- Universal gates (NAND can build any logic function)
- Gate-level design
- Logic minimization

---

### 07_2to1-mux

**Concept**: Choose between two inputs using a select signal - the basis of data routing.

**Circuit**:
```
[I0] ─┬─► [AND] ─┐
      │          ├─► [OR] ─► [Y]
[I1] ─┼─► [AND] ─┘
      │
[SEL] ┴─► [NOT] ──┘
```

**Components**: 9 nodes  
**Educational Value**: Data selection, conditional logic, multiplexing.

**Truth Table**:
```
SEL | I0 | I1 | Y
 0  | 0  | X  | 0
 0  | 1  | X  | 1
 1  | X  | 0  | 0
 1  | X  | 1  | 1
```

**Key Concepts**:
- Multiplexing (many-to-one)
- Conditional data flow
- Control signals

---

## Layer 2: Arithmetic & Logic

*"Build circuits that do math"*

### 08_full-adder

**Concept**: 1-bit adder with carry-in support - can be chained for multi-bit addition.

**Circuit**:
```
[A] ─┬─► [XOR] ─┬─► [XOR] ─► [Sum]
     │          │
[B] ─┼──────────┤
     │          │
[Cin]┼──────────┘
     │
     └─► [Carry Logic] ─► [Cout]
```

**Components**: 12 nodes (3 inputs, 2 XORs, 2 ANDs, 1 OR, 2 outputs)  
**Educational Value**: Ripple carry principle, chaining adders, multi-bit arithmetic.

**Truth Table**:
```
A | B | Cin | Sum | Cout
0 | 0 |  0  |  0  |  0
0 | 0 |  1  |  1  |  0
0 | 1 |  0  |  1  |  0
0 | 1 |  1  |  0  |  1
1 | 0 |  0  |  1  |  0
1 | 0 |  1  |  0  |  1
1 | 1 |  0  |  0  |  1
1 | 1 |  1  |  1  |  1
```

**Key Concepts**:
- Carry propagation
- Cascading logic
- Modular design

---

### 09_4bit-adder

**Concept**: Chain four full adders to add 4-bit numbers - this does real math!

**Circuit**:
```
[A0,B0] ─► [FA0] ─┬─► [Sum0]
                   ├─► [Carry]
[A1,B1] ─► [FA1] ─┼─► [Sum1]
                   ├─► [Carry]
[A2,B2] ─► [FA2] ─┼─► [Sum2]
                   ├─► [Carry]
[A3,B3] ─► [FA3] ─┴─► [Sum3,Cout]
```

**Components**: 16 nodes (9 inputs, 4 full adders, 5 outputs)  
**Educational Value**: Multi-bit arithmetic, carry ripple delay, datapath design.

**Example**:
```
   A = 5 (0101)
 + B = 3 (0011)
 ───────────────
 Sum = 8 (1000), Carry = 0
```

**Key Concepts**:
- Ripple carry adder architecture
- Propagation delay (4-gate cascade)
- Unsigned binary addition

---

## Layer 3: Memory & State

*"Create circuits that remember things"*

### 10_sr-latch

**Concept**: First memory circuit - stores 1 bit using feedback loops.

**Circuit**:
```
[S] ─► [NOR] ─┬─► [Q]
     ┌────────┘
     │
[R] ─► [NOR] ─┴─► [Q̄]
```

**Components**: 6 nodes (2 inputs, 2 NORs with feedback, 2 outputs)  
**Educational Value**: Feedback loops, bistable circuits, memory basics.

**State Table**:
```
S | R | Q | Q̄ | Action
0 | 0 | Q | Q̄ | Hold (previous state)
0 | 1 | 0 | 1 | Reset
1 | 0 | 1 | 0 | Set
1 | 1 | X | X | Invalid (forbidden)
```

**Key Concepts**:
- Feedback creates memory
- Bistable states
- Set/Reset control

---

### 11_d-flipflop

**Concept**: Clock-controlled memory - stores data only on clock edges.

**Circuit**:
```
[D] ─► [Master Latch] ─► [Slave Latch] ─► [Q]
                     ┌──────────────────► [Q̄]
[CLK] ───────────────┤
                     └─► [Inverter]
```

**Components**: 10 nodes (2 inputs, 2 latches, inverter, 2 outputs)  
**Educational Value**: Edge-triggered memory, synchronous design, master-slave architecture.

**Timing Diagram**:
```
CLK:  _____╱‾‾╲_____╱‾‾╲_____
D:    __╱‾‾‾‾‾╲_____________
Q:    ______╱‾‾‾‾‾‾‾╲_______
      (captures D on rising edge)
```

**Key Concepts**:
- Edge-triggered vs level-sensitive
- Setup/hold time
- Synchronous design

---

### 04_4bit-counter

**Concept**: Clock-driven 4-bit binary counter - counts 0 to 15.

**Circuit**:
```
[CLK] ─► [T-FF0] ─► [T-FF1] ─► [T-FF2] ─► [T-FF3]
         [Q0]       [Q1]       [Q2]       [Q3]
```

**Components**: 14 nodes (2 inputs: CLK/RST, 4 T flip-flops, 4 outputs)  
**Educational Value**: Sequential circuits, state machines, timing analysis.

**Count Sequence**:
```
Tick | Q3 Q2 Q1 Q0 | Decimal
  0  |  0  0  0  0 |    0
  1  |  0  0  0  1 |    1
  2  |  0  0  1  0 |    2
  3  |  0  0  1  1 |    3
 ...
 15  |  1  1  1  1 |   15
 16  |  0  0  0  0 |    0 (wraps)
```

**Key Concepts**:
- Ripple counters
- State transitions
- Clock domain design

---

## Layer 4: Control & Coordination

*"Build CPU building blocks"*

### 12_2to4-decoder

**Concept**: Decodes 2-bit input into 4 output lines - basis of memory addressing.

**Circuit**:
```
[A0] ─┬─► [AND] ─► [Y0] (00)
      │
[A1] ─┼─► [AND] ─► [Y1] (01)
      │
      ├─► [AND] ─► [Y2] (10)
      │
      └─► [AND] ─► [Y3] (11)
```

**Components**: 11 nodes (2 inputs, NOTs, ANDs, 4 outputs)  
**Educational Value**: Address decoding, one-hot encoding, memory selection.

**Truth Table**:
```
A1 | A0 | Y3 | Y2 | Y1 | Y0
 0 | 0  | 0  | 0  | 0  | 1
 0 | 1  | 0  | 0  | 1  | 0
 1 | 0  | 0  | 1  | 0  | 0
 1 | 1  | 1  | 0  | 0  | 0
```

**Key Concepts**:
- One-hot decoding
- Address spaces
- Memory chip select

---

### 13_4to1-mux

**Concept**: Selects one of four inputs using 2 control signals - advanced data routing.

**Circuit**:
```
[I0] ─┬─► [AND] ─┐
      │          ├─► [OR] ─► [Y]
[I1] ─┼─► [AND] ─┤
      │          │
[I2] ─┼─► [AND] ─┤
      │          │
[I3] ─┴─► [AND] ─┘
```

**Components**: 15 nodes (6 inputs, ANDs, ORs, 1 output)  
**Educational Value**: Multi-way selection, control logic, datapath design.

**Selection Table**:
```
S1 | S0 | Output
 0 | 0  | I0
 0 | 1  | I1
 1 | 0  | I2
 1 | 1  | I3
```

**Key Concepts**:
- N-way multiplexing
- Control signal decoding
- Datapath routing

---

## Layer 5: Memory Systems

*"Design RAM and ROM"*

### 14_4bit-register

**Concept**: Stores 4 bits simultaneously - the building block of CPU registers.

**Circuit**:
```
[D0] ─► [D-FF0] ─► [Q0]
[D1] ─► [D-FF1] ─► [Q1]
[D2] ─► [D-FF2] ─► [Q2]
[D3] ─► [D-FF3] ─► [Q3]
[CLK] ──────────────┴── (shared)
```

**Components**: 13 nodes (5 inputs: 4 data + CLK, 4 D-FFs, 4 outputs)  
**Educational Value**: Parallel storage, bus interfaces, CPU register design.

**Operation**:
```
CLK edge: Captures all 4 data inputs simultaneously
Output:   Holds values until next clock edge
```

**Key Concepts**:
- Parallel load
- Bus width
- Synchronous capture

---

## Layer 6: FPGA Hardware & Processors

*"Build complete 8-bit computers and FPGA-ready circuits"*

### 16_8bit-counter-basys3

**Concept**: Hardware-ready 8-bit binary counter for Basys3 FPGA board.

**Circuit**: 8-bit ripple counter with clock, reset, and 8 LED outputs.

**Components**: 20 nodes (3 inputs: CLK/RST/Enable, 8 T-FFs, 8 outputs)  
**Board Mapping**:
- `CLK`: W5 (100 MHz system clock)
- `RST`: U18 (BTNC center button)
- `LED[0:7]`: U16, E19, U19, V19, W18, U15, U14, V14

**FPGA Features**:
- Synthesis-ready Verilog generation
- XDC constraints for Basys3
- Real-time LED output (counts 0-255)

**Key Concepts**:
- Clock domain crossing
- FPGA I/O constraints
- Hardware validation

---

### 17_traffic-light-fsm-basys3

**Concept**: 3-state traffic light controller with timer - hardware synthesis ready.

**Circuit**: Finite State Machine with 3 states (Red/Yellow/Green) and timer.

**Components**: 18 nodes (2 inputs: CLK/RST, 2 state FFs, 3 timer FFs, logic, 3 lamps)  
**Board Mapping**:
- `CLK`: W5 (system clock)
- `RST`: U18 (reset button)
- `RED`: U16 (LED0)
- `YELLOW`: E19 (LED1)
- `GREEN`: U19 (LED2)

**State Machine**:
```
RED (5 sec) → GREEN (10 sec) → YELLOW (3 sec) → RED
```

**Key Concepts**:
- Finite State Machines (FSM)
- Moore machine design
- Timer-based transitions

---

### 18_4bit-alu-basys3

**Concept**: Arithmetic Logic Unit with ADD/SUB/AND/OR operations - hardware ready.

**Circuit**: 4-bit ALU with operation select and flag outputs.

**Components**: 26 nodes (10 inputs: A[0:3], B[0:3], OP[0:1], 4 outputs)  
**Board Mapping**:
- `A[0:3]`: SW0-SW3 (switches)
- `B[0:3]`: SW4-SW7 (switches)
- `OP[0:1]`: SW8-SW9 (operation select)
- `Result[0:3]`: LED0-LED3 (outputs)

**Operations**:
```
OP | Operation | Description
00 | ADD       | A + B (XOR for simple add)
01 | SUB       | A - B (complement + add)
10 | AND       | Bitwise A AND B
11 | OR        | Bitwise A OR B
```

**Key Concepts**:
- ALU design
- Operation multiplexing
- Flag generation (Carry, Zero, Negative)

---

### 05_simple-cpu

**Concept**: Basic CPU with registers and ALU - runs real programs.

**Circuit**: 8-bit CPU with:
- Program Counter (PC)
- Instruction Register (IR)
- General-purpose registers (R0-R3)
- ALU (ADD, SUB, AND, OR, XOR)
- Control unit (instruction decoder)

**Components**: 150+ nodes  
**Instruction Set** (8 opcodes):
```
0x0: NOP        No operation
0x1: LOAD Rx    Load value into register
0x2: STORE Rx   Store register to memory
0x3: ADD Rx, Ry Add Rx + Ry → Rx
0x4: SUB Rx, Ry Subtract Rx - Ry → Rx
0x5: AND Rx, Ry Bitwise AND
0x6: OR Rx, Ry  Bitwise OR
0x7: JMP addr   Jump to address
```

**Example Program** (2-instruction loop):
```
0: LOAD R0, 5    // R0 = 5
1: ADD R0, R0    // R0 = R0 + R0 = 10
2: JMP 1         // Loop forever
```

**Key Concepts**:
- Von Neumann architecture
- Fetch-decode-execute cycle
- Instruction set architecture (ISA)

---

## Loading Examples

### In Logic Playground

1. **Click "Load Example" button** in toolbar
2. **Select example** from dropdown (organized by layer)
3. **Circuit loads** with all connections and metadata

**Keyboard Shortcut**: `Ctrl+E` → Opens example picker

### Via Shell Command

```shell
open logic-playground --load=08_full-adder
```

### Programmatic Access

```typescript
import { loadExample, loadExampleAsProject } from '@redbyte/rb-apps/examples';

// Load circuit data
const circuit = await loadExample('08_full-adder');

// Load as full project (with probes, metadata, I/O)
const project = loadExampleAsProject('08_full-adder');
```

---

## Creating Custom Examples

### Step 1: Design Circuit

Use Logic Playground to create your circuit with:
- Clear node labels
- Organized layout
- Proper I/O mapping

### Step 2: Export Circuit

```shell
export my-circuit.rbx.zip
```

### Step 3: Add to Examples Catalog

Edit `packages/rb-apps/src/examples/index.ts`:

```typescript
import example19 from './19_my-circuit.json';

export type ExampleId =
  | ... // existing IDs
  | '19_my-circuit';

const examples: Record<ExampleId, ...> = {
  // ... existing examples
  '19_my-circuit': {
    data: example19 as SerializedCircuitV1,
    metadata: {
      id: '19_my-circuit',
      name: 'My Custom Circuit',
      description: 'Brief description of what it does',
      layer: 2, // Choose appropriate layer
      difficulty: 'intermediate',
    },
  },
};
```

### Step 4: Rebuild Platform

```powershell
cd c:\Users\conno\redbyte-ui
pnpm -r build
```

---

## Layer Progression Guide

**Recommended Learning Path**:

1. **Start with Layer 0**: Get comfortable with basic gates and simulation
2. **Move to Layer 1**: Learn combinational logic patterns
3. **Tackle Layer 2**: Build arithmetic circuits (adders, comparators)
4. **Enter Layer 3**: Understand memory and sequential logic
5. **Explore Layer 4**: Design control logic and multiplexing
6. **Master Layer 5**: Create registers and memory systems
7. **Deploy Layer 6**: Synthesize circuits on real FPGA hardware

**Lab Assignment Strategy**:

- **Week 1-2**: Layers 0-1 (gates, combinational logic)
- **Week 3-4**: Layer 2 (arithmetic circuits)
- **Week 5-6**: Layer 3 (memory, state machines)
- **Week 7-8**: Layer 4 (control logic, CPU components)
- **Week 9-10**: Layer 5 (registers, memory)
- **Week 11-12**: Layer 6 (FPGA deployment, final project)

---

## Additional Resources

- **Instructor Guide**: [INSTRUCTOR_GUIDE.md](./INSTRUCTOR_GUIDE.md)
- **Project Model**: [PROJECT_MODEL.md](./PROJECT_MODEL.md)
- **Deployment Notes**: [DEPLOYMENT_NOTES.md](./DEPLOYMENT_NOTES.md)
- **User Manual**: [REDBYTE_USER_MANUAL.md](./REDBYTE_USER_MANUAL.md)
- **FPGA Validation**: [docs/fpga-validation-guide.md](./docs/fpga-validation-guide.md)

---

**Copyright © 2025 Connor Angiel — RedByte OS Genesis**  
*Use without permission prohibited. Licensed under the RedByte Proprietary License (RPL-1.0).*
