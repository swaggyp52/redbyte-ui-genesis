# Sequential Logic Verification & Clock Behavior Guide

**Document ID**: SEQUENTIAL_LOGIC_GUIDE  
**Last Updated**: February 2, 2026  
**Author**: Connor Angiel  
**Canonical Reference**: For use in RedByte OS Genesis labs

---

## Table of Contents

1. [Flip-Flop Types and Behavior](#flip-flop-types)
2. [Clock Edge Detection](#clock-edge-detection)
3. [Synchronization and Timing](#synchronization)
4. [Race Conditions and Prevention](#race-conditions)
5. [Sequential Circuit Patterns](#patterns)
6. [Verification Test Suite](#test-suite)
7. [Troubleshooting](#troubleshooting)

---

## Flip-Flop Types and Behavior

### D Flip-Flop (Implemented)

**Behavior:**
- Captures input D on **rising clock edge** (0→1 transition)
- Holds value between clock edges
- Asynchronous reset (RST=1 forces Q=0)

**Truth Table (Clock Edge = Rising):**

| D | Q(next) |
|---|---------|
| 0 | 0       |
| 1 | 1       |

**Timing:**
- Setup time: D must be stable before clock edge
- Hold time: D must remain stable after clock edge
- Propagation delay: ~5-10ns (simulated as immediate in discrete simulation)

**Example Usage:**

```javascript
// D flip-flop with rising edge detection
const circuit = {
  nodes: [
    { id: 'D', type: 'SWITCH', label: 'D', value: 0 },
    { id: 'CLK', type: 'SWITCH', label: 'CLK', value: 0 },
    { id: 'RST', type: 'SWITCH', label: 'RST', value: 0 },
    { id: 'Q', type: 'D_FLIP_FLOP', inputs: ['D', 'CLK', 'RST'] }
  ],
  wires: [
    { from: 'D', to: 'Q' },
    { from: 'CLK', to: 'Q' },
    { from: 'RST', to: 'Q' }
  ]
};
```

### JK Flip-Flop (Supported)

**Behavior:**
- J and K control next state:
  - J=0, K=0: Hold (Q unchanged)
  - J=1, K=0: Set (Q=1)
  - J=0, K=1: Reset (Q=0)
  - J=1, K=1: Toggle (Q inverts)

**Implementation Status:** Supported with equivalent D+logic conversion

### T Flip-Flop (Supported)

**Behavior:**
- T input controls:
  - T=0: Hold state
  - T=1: Toggle on clock edge

**Implementation Status:** Supported (often implemented as JK with J=K=T)

---

## Clock Edge Detection

### How Rising Edge Detection Works

The simulator implements edge detection via state tracking:

```javascript
// Pseudocode for rising edge detection
class D_FLIP_FLOP {
  constructor() {
    this.prevClk = 0;
    this.Q = 0;
  }

  evaluate(inputs) {
    const D = inputs.D;
    const CLK = inputs.CLK;
    const RST = inputs.RST;

    // Asynchronous reset takes priority
    if (RST === 1) {
      this.Q = 0;
      return;
    }

    // Detect rising edge (0→1)
    if (this.prevClk === 0 && CLK === 1) {
      this.Q = D;  // Capture D on rising edge
    }

    // Update previous state for next cycle
    this.prevClk = CLK;
  }
}
```

### Clock Frequency and Tick Rate

- **Simulation Tick**: 50ms by default (configurable)
- **Clock Period**: 2 ticks = 100ms in real time (5 Hz simulated)
- **For faster clocks**: Use fast mode with immediate ticks

**Clock Example (50ms/tick):**

| Time (ms) | CLK | Event         |
|-----------|-----|---------------|
| 0         | 0   | Initial state |
| 50        | 1   | Rising edge   |
| 100       | 0   | Falling edge  |
| 150       | 1   | Rising edge   |

### Practical Clock Patterns

**Pattern 1: Standard Clock (50% duty cycle)**
```javascript
// Toggle CLK every tick
tick1: CLK = 0
tick2: CLK = 1  ← Rising edge captured here
tick3: CLK = 0
tick4: CLK = 1  ← Rising edge captured here
```

**Pattern 2: Slow Clock (for debugging)**
```javascript
// Keep CLK high for several ticks, then low
ticks 1-5: CLK = 0
ticks 6-10: CLK = 1  ← Rising edge at tick 6
ticks 11-15: CLK = 0  ← Falling edge at tick 11
```

**Pattern 3: Pulse Clock (single-step)**
```javascript
// Single rising edge pulse
tick1: CLK = 0
tick2: CLK = 1  ← Single pulse
tick3: CLK = 0  ← Back to low
```

---

## Synchronization and Timing

### Multi-Flip-Flop Synchronization

When multiple flip-flops share the same clock, they sample simultaneously:

```javascript
// All three flip-flops capture on same rising edge
const circuit = {
  nodes: [
    // Inputs
    { id: 'IN0', type: 'SWITCH', value: 0 },
    { id: 'IN1', type: 'SWITCH', value: 0 },
    { id: 'IN2', type: 'SWITCH', value: 0 },
    { id: 'CLK', type: 'SWITCH', value: 0 },

    // Three flip-flops
    { id: 'Q0', type: 'D_FLIP_FLOP', inputs: ['IN0', 'CLK'] },
    { id: 'Q1', type: 'D_FLIP_FLOP', inputs: ['IN1', 'CLK'] },
    { id: 'Q2', type: 'D_FLIP_FLOP', inputs: ['IN2', 'CLK'] }
  ]
};

// On rising edge: Q0, Q1, Q2 all capture their respective inputs simultaneously
// This is deterministic and race-free
```

### Shift Registers (Cascaded Flip-Flops)

```javascript
const shiftRegister = {
  nodes: [
    { id: 'IN', type: 'SWITCH', value: 0 },
    { id: 'CLK', type: 'SWITCH', value: 0 },
    { id: 'Q0', type: 'D_FLIP_FLOP', inputs: ['IN', 'CLK'] },
    { id: 'Q1', type: 'D_FLIP_FLOP', inputs: ['Q0', 'CLK'] },
    { id: 'Q2', type: 'D_FLIP_FLOP', inputs: ['Q1', 'CLK'] }
  ]
};

// Behavior:
// After 1st clock: Q0=IN, Q1=0, Q2=0
// After 2nd clock: Q0=new_IN, Q1=old_IN, Q2=0
// After 3rd clock: Q0=new_IN, Q1=new_IN, Q2=old_IN
```

**Key Insight**: All flip-flops capture on the **same** clock edge, then data shifts down in the next cycle.

### Clock Period and Settling Time

The simulator ensures proper settling:

1. **Apply inputs** (e.g., set D=1)
2. **Tick simulation** (combinational logic evaluates)
3. **Apply clock edge** (set CLK=1 for rising edge)
4. **Tick simulation** (flip-flops capture)
5. **Release clock** (set CLK=0)
6. **Repeat**

---

## Race Conditions and Prevention

### Setup and Hold Time Violations

**Setup Time**: D must be stable N time units before rising edge

```javascript
// ✓ CORRECT: D stable before clock
engine.setNodeState('D', 1);
engine.tick();
engine.tick();  // Stability time
engine.setNodeState('CLK', 1);
engine.tick();  // Rising edge

// ✗ WRONG: D changes too close to clock
engine.setNodeState('D', 1);
engine.setNodeState('CLK', 1);
engine.tick();  // Not enough setup time!
```

### Hold Time Violations

**Hold Time**: D must remain stable N time units after rising edge

```javascript
// ✓ CORRECT: D remains stable after clock
engine.setNodeState('D', 1);
engine.setNodeState('CLK', 1);
engine.tick();
engine.tick();  // Hold time
engine.setNodeState('D', 0);
engine.tick();

// ✗ WRONG: D changes too soon after clock
engine.setNodeState('D', 1);
engine.setNodeState('CLK', 1);
engine.tick();
engine.setNodeState('D', 0);
engine.tick();  // Hold time violated!
```

### Metastability in Asynchronous Inputs

When asynchronous signals (not synchronized to clock) interact with synchronous logic, metastability can occur. **Solution: Use a synchronizer chain**

```javascript
// 2-stage synchronizer (standard practice)
const synchronizer = {
  nodes: [
    { id: 'ASYNC_IN', type: 'SWITCH' },
    { id: 'CLK', type: 'SWITCH' },
    { id: 'FF1', type: 'D_FLIP_FLOP', inputs: ['ASYNC_IN', 'CLK'] },
    { id: 'FF2', type: 'D_FLIP_FLOP', inputs: ['FF1', 'CLK'] },
    // FF2 output is now safe to use (synchronized)
  ]
};

// The 2-stage synchronizer:
// 1. FF1 may go metastable for a short time
// 2. FF2 captures FF1's settled value
// 3. Output of FF2 is guaranteed stable
```

### Avoiding Clock Domain Crossing Issues

**Problem**: Data changing in one clock domain can violate setup/hold in another

**Solution: Use proper synchronizers when crossing domains**

```javascript
// ✗ WRONG: Direct connection across domains
// ✓ CORRECT: With synchronizer

const dualClockFifo = {
  // Write side (CLK_W domain)
  writeDataFF: { type: 'D_FLIP_FLOP', inputs: ['writeData', 'CLK_W'] },

  // Synchronizer from write to read
  sync1: { type: 'D_FLIP_FLOP', inputs: ['writeDataFF', 'CLK_R'] },
  sync2: { type: 'D_FLIP_FLOP', inputs: ['sync1', 'CLK_R'] },

  // Read side (CLK_R domain) uses sync2 output
};
```

---

## Sequential Circuit Patterns

### 1. Counter (N-bit)

```javascript
// 4-bit binary counter
const counter = {
  nodes: [
    { id: 'CLK', type: 'SWITCH' },
    { id: 'EN', type: 'SWITCH' },  // Enable
    { id: 'RST', type: 'SWITCH' }, // Reset
    
    // Bit 0 (LSB)
    { id: 'Q0', type: 'D_FLIP_FLOP', inputs: ['EN', 'CLK', 'RST'] },
    
    // Bit 1 (Q0 AND EN)
    { id: 'EN_and_Q0', type: 'AND', inputs: ['EN', 'Q0'] },
    { id: 'Q1', type: 'D_FLIP_FLOP', inputs: ['EN_and_Q0', 'CLK', 'RST'] },
    
    // Continue for Q2, Q3...
  ]
};
```

### 2. Shift Register

```javascript
// 8-bit shift register
const shiftReg = {
  nodes: [
    { id: 'SIN', type: 'SWITCH' },  // Serial input
    { id: 'CLK', type: 'SWITCH' },
    
    { id: 'Q0', type: 'D_FLIP_FLOP', inputs: ['SIN', 'CLK'] },
    { id: 'Q1', type: 'D_FLIP_FLOP', inputs: ['Q0', 'CLK'] },
    // ... Q2 through Q7
  ]
};
```

### 3. State Machine

```javascript
// 3-state FSM (IDLE → ACTIVE → DONE → IDLE)
const fsm = {
  nodes: [
    // Current state register
    { id: 'STATE0', type: 'D_FLIP_FLOP', inputs: ['NEXT_STATE0', 'CLK'] },
    { id: 'STATE1', type: 'D_FLIP_FLOP', inputs: ['NEXT_STATE1', 'CLK'] },
    
    // Combinational logic for next state
    { id: 'input_signal', type: 'SWITCH' },
    { id: 'NEXT_STATE0', type: 'OR', inputs: [...] },
    { id: 'NEXT_STATE1', type: 'AND', inputs: [...] },
  ]
};
```

---

## Verification Test Suite

The `sequential-logic-verification.test.js` file contains comprehensive tests:

### Test Categories

1. **Clock Edge Detection**
   - Rising edge capture
   - Falling edge non-capture
   - Multi-input capture

2. **Synchronization**
   - Multiple flip-flops on same clock
   - Shift register operation
   - Cascade behavior

3. **Registers**
   - Multi-bit parallel capture
   - Consistent value storage
   - Simultaneous updates

4. **Counters**
   - Sequential counting
   - Enable signal handling
   - Wrap-around behavior

5. **Timing**
   - Setup/hold requirements
   - Metastability prevention
   - Synchronizer chains

### Running Tests

```bash
# Run all sequential logic tests
pnpm test sequential-logic-verification.test.js

# Run specific test suite
pnpm test sequential-logic-verification.test.js -t "Clock Edge Detection"

# With coverage
pnpm test --coverage sequential-logic-verification.test.js
```

---

## Troubleshooting

### Issue: Flip-Flop not capturing input

**Cause**: Clock edge not applied correctly

**Solution**:
```javascript
// ✓ Correct: Set D first, then apply rising edge
engine.setNodeState('D', 1);
engine.tick();
engine.setNodeState('CLK', 1);
engine.tick();  // Now Q captures D

// ✗ Wrong: CLK already high when D is set
engine.setNodeState('CLK', 1);  // Already high
engine.setNodeState('D', 1);
engine.tick();  // No rising edge - Q unchanged
```

### Issue: Counter not incrementing

**Cause**: Enable signal missing or incorrect

**Solution**:
```javascript
// Ensure EN is connected and set high
engine.setNodeState('EN', 1);
engine.setNodeState('CLK', 1);
engine.tick();

// Verify Q0 toggles
const Q0 = engine.getNodeValue('Q0', 'Q');
expect([0, 1]).toContain(Q0);
```

### Issue: Shift register not shifting

**Cause**: Q0 output not connected to Q1 input, or clock timing wrong

**Solution**:
```javascript
// Verify wiring
const wires = circuit.wires;
const Q0_to_Q1 = wires.find(w => w.from === 'Q0' && w.to === 'Q1');
expect(Q0_to_Q1).toBeDefined();

// Test shift pattern
const patterns = [[1, 0], [0, 1], [1, 1]];
for (const pattern of patterns) {
  engine.setNodeState('SIN', pattern[0]);
  engine.tick();
  // Verify next value appears at Q1 after 2 clocks
}
```

### Issue: Metastability in asynchronous logic

**Cause**: Direct async input to synchronous logic

**Solution**: Use 2-stage synchronizer chain (see "Asynchronous Input Handling" above)

---

## Best Practices

1. **Always synchronize**: Async signals must pass through ≥2-stage synchronizer
2. **Respect timing**: Allow setup/hold time between changes and clock edges
3. **Test carefully**: Use comprehensive test vectors (see test suite)
4. **Document clocks**: Clearly indicate clock frequencies and relationships
5. **Profile performance**: Use `PerformanceHUD` to verify tick rates meet targets

---

## References

- Digital Design textbooks: Chapter on Sequential Logic
- IEEE 802.3: Synchronization techniques
- FPGA Design: Xilinx/Altera/Intel timing constraints documentation
- RedByte Simulation Engine: `CircuitEngine.js` source code
