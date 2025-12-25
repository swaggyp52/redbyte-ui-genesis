# Circuit Hierarchy: From Gates to Meta-Computers

**Purpose**: This document defines the complete learning progression from basic logic gates to computers building computers. It serves as the roadmap for tutorials, pattern recognition, chip system design, and feature prioritization.

**Philosophy**: If you can build a computer from scratch, you understand computers completely. This hierarchy proves it's actually really easy - we just need the right progression.

---

## Layer 0: Foundation (CURRENT STATE)

**Win Condition**: User places their first gate and sees it work.

### 0.1 Wire & Power
- **Concept**: Electricity flows, signals propagate
- **Circuits**:
  - Single wire connecting power to lamp
  - Multiple lamps on one wire (fan-out)
  - Wire branches (Y-splits)
- **Learning Goal**: "I can control when a light turns on"

### 0.2 Basic Gates (Individual)
- **Concept**: Each gate is a simple rule
- **Circuits** (one gate per circuit initially):
  - NOT gate (inverter): "flip the signal"
  - AND gate: "both inputs must be on"
  - OR gate: "either input turns it on"
  - NAND gate: "not both" (introduce as shortcut)
  - NOR gate: "not either" (introduce as shortcut)
  - XOR gate: "one or the other, but not both"
- **Learning Goal**: "I understand what each gate does in isolation"

---

## Layer 1: Combinational Logic (SIMPLE PATTERNS)

**Win Condition**: User recognizes they built something with a name ("You just made an XOR!").

### 1.1 Gate Combinations (2-3 gates)
- **Concept**: Gates work together to create new behaviors
- **Circuits**:
  - **XOR from basic gates**: 4 gates (2 NAND, 1 OR, 1 AND) or simplified version
  - **Half Adder**: XOR + AND (sum and carry)
  - **2-input Multiplexer**: "choose between two signals"
  - **Majority gate**: "output what most inputs say" (3-input voting)
- **Learning Goal**: "Small combinations create useful new functions"
- **Pattern Recognition**: When user builds these manually, highlight "You built a [name]!"

### 1.2 Multi-Bit Basics (Parallel Circuits)
- **Concept**: Same operation on multiple wires simultaneously
- **Circuits**:
  - **2-bit wire bundle**: Treat multiple wires as a group
  - **4-bit NOT**: Invert 4 signals at once
  - **4-bit AND**: Compare two 4-bit numbers
- **Learning Goal**: "Computers work with bundles of bits, not just one"

---

## Layer 2: Arithmetic & Logic (REUSABLE CHIPS)

**Win Condition**: User builds something that "does math" or makes a decision.

### 2.1 Adders
- **Concept**: Computers do math by combining carries
- **Circuits**:
  - **Half Adder** (from Layer 1, now packaged as chip)
  - **Full Adder**: Half Adder + carry-in support (3 inputs → sum + carry-out)
  - **4-bit Ripple Carry Adder**: Chain 4 Full Adders (first real "big" circuit)
  - **8-bit Adder**: Scale up (shows pattern repetition)
- **Learning Goal**: "Addition is just organized gate patterns"

### 2.2 ALU Components
- **Concept**: Computers need to do multiple operations
- **Circuits**:
  - **4-bit Subtractor**: Adder + negation (two's complement intro)
  - **4-bit Bitwise AND/OR/XOR**: Direct bit manipulation
  - **Comparator**: "Is A > B?" (equality, less-than logic)
  - **4-bit Shifter**: Move bits left/right (multiply/divide by 2)
- **Learning Goal**: "Each operation is a different circuit path"

### 2.3 ALU Integration
- **Concept**: One chip, many operations (controlled by select signals)
- **Circuits**:
  - **4-bit ALU**: Multiplexer selects between add/sub/and/or/xor
  - **8-bit ALU**: Scale up with flag outputs (zero, negative, carry, overflow)
- **Learning Goal**: "The ALU is just a big selector that picks which circuit to use"
- **Milestone**: This is the "brain" of the CPU's math operations

---

## Layer 3: Memory & State (SEQUENTIAL LOGIC)

**Win Condition**: User builds something that "remembers" - the first non-deterministic-looking behavior.

### 3.1 Latches (Fundamental Memory)
- **Concept**: Circuits can hold state using feedback loops
- **Circuits**:
  - **SR Latch**: Set/Reset - the first "memory" (2 NOR gates looped)
  - **Gated SR Latch**: Add enable signal
  - **D Latch**: Data + Enable (simplest practical memory)
- **Learning Goal**: "Feedback loops let circuits remember things"
- **Aha Moment**: "Wait, the output affects the input? And that's... stable?"

### 3.2 Flip-Flops (Clocked Memory)
- **Concept**: Memory that only changes on clock edges (synchronous design)
- **Circuits**:
  - **D Flip-Flop**: Two latches in master-slave (changes on clock edge)
  - **T Flip-Flop**: Toggle on clock (useful for counting)
  - **JK Flip-Flop**: Most general flip-flop (historical completeness)
- **Learning Goal**: "Clocks synchronize when memory updates"

### 3.3 Registers (Multi-Bit Memory)
- **Concept**: Store entire numbers, not just single bits
- **Circuits**:
  - **4-bit Register**: 4 D flip-flops with shared clock
  - **8-bit Register**: Scale up
  - **Register with Enable**: Only load when signal is high
  - **Register Bank (4x4-bit)**: Multiple registers, select which to read/write
- **Learning Goal**: "Registers are just synchronized flip-flop bundles"

### 3.4 Counters (State Machines)
- **Concept**: Automatic state progression
- **Circuits**:
  - **2-bit Counter**: Counts 0→1→2→3→0 (uses T flip-flops or adder feedback)
  - **4-bit Counter**: Counts 0-15
  - **Decade Counter**: Counts 0-9 (BCD, introduces reset logic)
  - **Counter with Load/Reset**: Programmable starting point
- **Learning Goal**: "Counters are the simplest state machines"

---

## Layer 4: Control & Coordination (CPU BUILDING BLOCKS)

**Win Condition**: User builds something that "follows instructions."

### 4.1 Decoders & Encoders
- **Concept**: Convert between binary codes and control signals
- **Circuits**:
  - **2-to-4 Decoder**: 2 inputs → 4 outputs (one-hot encoding)
  - **3-to-8 Decoder**: Scale up (used for memory addressing)
  - **4-to-2 Encoder**: Reverse (priority encoding)
  - **7-Segment Decoder**: Binary to display (visual feedback)
- **Learning Goal**: "Decoders turn instruction codes into control signals"

### 4.2 Multiplexers & Demultiplexers
- **Concept**: Route data to/from multiple places
- **Circuits**:
  - **4-to-1 Multiplexer (4-bit)**: Choose between 4 sources
  - **8-to-1 Multiplexer**: Scale up (data path selection)
  - **1-to-4 Demultiplexer**: Route input to one of 4 outputs
- **Learning Goal**: "Multiplexers are how CPUs choose which data to use"

### 4.3 Simple Control Units
- **Concept**: Sequence of operations controlled by state
- **Circuits**:
  - **2-bit State Machine**: Counts through fetch→decode→execute→writeback
  - **Instruction Decoder**: Takes 4-bit opcode → control signals
  - **Microcode ROM**: Hardwired instruction sequences (simplified)
- **Learning Goal**: "Control units are just counters + decoders"

---

## Layer 5: Memory Systems (RAM & ROM)

**Win Condition**: User builds storage that can hold multiple values and address them.

### 5.1 Basic Memory
- **Concept**: Addressable storage cells
- **Circuits**:
  - **4x4-bit RAM**: 4 addresses, 4 bits each (16 bits total)
  - **8x8-bit RAM**: Small program memory
  - **16x8-bit RAM**: Enough to run simple programs
  - **ROM with Program**: Hardwired instruction memory
- **Learning Goal**: "RAM is just registers + address decoder"

### 5.2 Memory-Mapped I/O
- **Concept**: Treat devices like memory addresses
- **Circuits**:
  - **Output Port**: Write to address → lights up LEDs
  - **Input Port**: Read from address → gets button states
  - **Memory + I/O Decoder**: Some addresses are RAM, some are devices
- **Learning Goal**: "I/O is just special memory addresses"

---

## Layer 6: Simple Processors (8-BIT COMPUTERS)

**Win Condition**: User builds a CPU that runs a program from memory.

### 6.1 Minimal CPU (4-bit)
- **Concept**: Fetch-decode-execute loop
- **Components**:
  - **Program Counter (PC)**: Points to next instruction
  - **Instruction Register (IR)**: Holds current instruction
  - **ALU**: Does math/logic
  - **Accumulator (A Register)**: Holds working value
  - **Control Unit**: Generates control signals
- **Instruction Set** (4 instructions):
  - `LDA addr` - Load from memory to A
  - `ADD addr` - Add memory to A
  - `STA addr` - Store A to memory
  - `JMP addr` - Jump to address
- **Programs**:
  - Add two numbers
  - Infinite loop (JMP to self)
- **Learning Goal**: "A CPU is just these 5 components in a loop"

### 6.2 Enhanced 8-bit CPU
- **Concept**: Add more instructions and registers
- **Additions**:
  - **B Register**: Second working register
  - **Stack Pointer (SP)**: For subroutines
  - **Status Flags**: Zero, Carry, Negative (from ALU)
- **Extended Instruction Set** (16 instructions):
  - Arithmetic: `ADD`, `SUB`, `INC`, `DEC`
  - Logic: `AND`, `OR`, `XOR`, `NOT`
  - Memory: `LDA`, `LDB`, `STA`, `STB`
  - Control: `JMP`, `JZ` (jump if zero), `JC` (jump if carry)
  - Stack: `PUSH`, `POP`, `CALL`, `RET`
- **Programs**:
  - Count from 0 to 10
  - Multiply two numbers (addition loop)
  - Fibonacci sequence
  - Subroutine calls
- **Learning Goal**: "More instructions = more powerful, but same structure"

---

## Layer 7: Architecture & Optimization (ADVANCED CPU)

**Win Condition**: User understands tradeoffs and builds optimized processors.

### 7.1 Performance Improvements
- **Concept**: Make the CPU faster or more efficient
- **Circuits**:
  - **Pipelined CPU**: Fetch next instruction while executing current
  - **Carry Lookahead Adder**: Faster addition (vs ripple carry)
  - **Branch Prediction**: Guess which way a jump will go
- **Learning Goal**: "CPUs optimize by doing multiple things at once"

### 7.2 Alternative Architectures
- **Concept**: Different designs for different goals
- **Circuits**:
  - **Harvard Architecture**: Separate instruction and data memory
  - **RISC Design**: Simplified instruction set, faster clock
  - **Stack Machine**: No registers, everything on stack (Forth-like)
- **Learning Goal**: "There's no one 'correct' CPU design"

---

## Layer 8: Meta-Computing (COMPUTERS BUILDING COMPUTERS)

**Win Condition**: A simulated computer designs a circuit using Logic Playground, running inside Logic Playground.

### 8.1 Self-Hosting Tools
- **Concept**: Use the computer to help design circuits
- **Programs** (running on Layer 6/7 CPU):
  - **Gate Truth Table Generator**: Input function, output gate design
  - **Circuit Optimizer**: Minimize gate count
  - **Karnaugh Map Solver**: Simplify boolean expressions
- **Learning Goal**: "Computers can help design better computers"

### 8.2 Compiler & Assembler
- **Concept**: Write programs in higher-level form
- **Circuits**:
  - **Simple Assembler**: Text mnemonics → binary opcodes (in hardware!)
  - **Expression Evaluator**: Parse `A + B * C` into circuit
- **Learning Goal**: "Compilers are just circuits that transform text"

### 8.3 The Meta-Computer (Ultimate Goal)
- **Concept**: A computer running Logic Playground, designing circuits
- **Implementation**:
  - Build an 8-bit CPU (from Layer 6)
  - Load a program that:
    - Takes a truth table as input (from simulated keyboard/memory)
    - Generates a circuit definition (gate list + connections)
    - Outputs the circuit to simulated display
  - User can then "export" that circuit back into the real Logic Playground
- **Win**: Computer builds a circuit. You built the computer. You understand recursion.
- **Learning Goal**: "You just proved computers are understandable."

---

## Progression Strategy

### For 6th Graders (First Win: Instant Satisfaction)
- Start Layer 0.1 (wire + lamp)
- Jump to Layer 0.2 (try each gate individually)
- "You made a lamp turn on!" → "You made a NOT gate flip a signal!"

### For Hobbyists (First Win: "I Built Something Cool")
- Quick Layer 0 recap (skip if confident)
- Layer 1.1 (build XOR, Half Adder - see pattern recognition)
- Layer 2.1 (build 4-bit adder - "this does math!")

### For CS Students (First Win: "I Understand How CPUs Work")
- Skim Layers 0-2 (load examples, inspect)
- Focus on Layers 3-4 (memory, control)
- Build Layer 6.1 minimal CPU (final project worthy)

### For Professors (First Win: "This Teaches Better Than My Slides")
- Load Layer 6.2 full CPU
- Modify instruction set (add new opcode)
- Assign students to build missing components

### For Connor (First Win: "Meta-Computer Achieved")
- Build Layer 6.2 CPU
- Write program that generates circuits
- Export generated circuit
- "Computers building computers, proven."

---

## Implementation Priorities

### Phase 1: Foundation Complete (DONE)
- ✅ Layer 0 circuits work
- ✅ Basic gate palette
- ✅ Circuit persistence, sharing

### Phase 2: First Win Experiences (NEXT - Tutorial Polish)
- Polish Layer 0 tutorial (wire→lamp→gates)
- Add Layer 1.1 guided examples (build XOR, get recognition)
- Example library browsing (all layers available as loadable circuits)

### Phase 3: Pattern Recognition
- Detect when user builds known patterns (XOR, Half Adder, etc.)
- Toast: "You just built a [name]!" with explanation link
- Offer to "package as chip" (introduces Layer 2 concept)

### Phase 4: Chip System (Layer 2+ Enabler)
- User can "collapse" circuit section into reusable chip
- Chips have clean inputs/outputs (abstraction)
- Chip library (load Half Adder as black box, use in Full Adder)

### Phase 5: Sequential Logic (Layer 3)
- Add clock signal support
- Feedback loop detection (warn or guide)
- D Flip-Flop as first stateful example

### Phase 6: CPU Builder (Layer 6)
- Instruction memory editor (ROM programming)
- Step-through execution (PC, IR visualization)
- Program examples (add two numbers, etc.)

### Phase 7: Meta-Computer (Layer 8)
- Simulate I/O devices (keyboard input to RAM)
- Export circuit generator (CPU outputs circuit JSON)
- Full recursive loop demonstration

---

## Learning Philosophy Integration

### Learn By Doing
- Every concept has a buildable circuit
- No "read this first" walls - jump in anywhere

### Pattern Recognition
- When user builds a known circuit, celebrate it
- "You just built [name]! That's used in [bigger thing]."
- Show where it fits in hierarchy

### Tons of Examples
- Every circuit in this hierarchy is a loadable example
- Examples grouped by layer
- Each example has embedded explanation

### Context-Aware Guidance
- If user struggles, suggest next simplest example
- If user breezes through, skip ahead
- Adapt to their pace

### Deterministic Foundation
- Everything is 1s and 0s
- No hidden magic, no abstraction without explanation
- Truth tables always available

---

## Success Metrics (All Win Conditions)

- ✅ **6th Grader Win**: Builds wire→lamp, tries all gates, "I get it!"
- ✅ **Hobbyist Win**: Builds 4-bit adder, "This is so cool!"
- ✅ **Student Win**: Builds minimal CPU, runs program, "I understand computers now."
- ✅ **Professor Win**: Assigns Layer 6 CPU build as final project, students love it
- ✅ **Connor Win**: Meta-computer runs, generates circuit, exports it - "Computers building computers achieved."

---

**Version**: 1.0
**Created**: 2024-12-24
**Purpose**: Single source of truth for circuit progression, tutorial content, chip system design, and feature roadmap.
