# Tri-state and Open-drain Logic Guide

**Phase 2, Task 2.7** | Three-state buffer (0, 1, Z), open-drain outputs, multi-driver bus simulation

---

## Overview

RedByte now supports tri-state (three-state) logic and open-drain/open-collector outputs, essential for:

- **I2C and CAN bus protocols** (open-drain with pull-up)
- **Address and data buses** (tri-state buffers for demultiplexing)
- **Wired logic** (multiple open-drain drivers on same line)
- **Bus contention detection** (safety verification)

### Key Concepts

- **Z (High-Impedance)**: Output is "floating" — no active driver
- **Tri-state Buffer**: Can output 0, 1, or Z based on enable signal
- **Open-drain**: Can only drive 0 or Z (pull-up resistor provides 1)
- **Wired AND/OR**: Multiple drivers combined via logical rules
- **Bus Resolver**: Detects contention (conflicting 0 and 1 drivers)

---

## Architecture

### Tri-state Buffer

Standard tri-state buffer with enable control.

```javascript
import { TRISTATE_BUFFER } from '@redbyte/rb-logic-core';

// When OE=0: output is Z (floating)
// When OE=1: output = input (0 or 1)

const output = TRISTATE_BUFFER.evaluate({}, [OE, DATA_IN]);
// Output: 0, 1, or 'Z'
```

**Truth Table**:
| OE | IN | OUT |
|----|----|----- |
| 0  | 0  | Z   |
| 0  | 1  | Z   |
| 1  | 0  | 0   |
| 1  | 1  | 1   |

**Common Use**: Address/data bus multiplexing, output enable control

### Open-drain Output

Output can drive LOW (0) or float (Z), but never drives HIGH. Requires pull-up resistor.

```javascript
import { OPEN_DRAIN } from '@redbyte/rb-logic-core';

const output = OPEN_DRAIN.evaluate({}, [DATA_IN]);
// Output: 0 (driven) or 'Z' (floating, pulled up by resistor)
```

**Truth Table**:
| IN | OUT |
|----|-----|
| 0  | 0   |
| 1  | Z   |

**Physical**: Uses depletion-mode transistor, no HIGH driver
**Common Use**: I2C SDA/SCL, interrupt lines, shared busses

### Pull-up Resistor

Resistive pull to HIGH. When signal floats (Z), resistor brings it HIGH.

```javascript
import { PULL_UP } from '@redbyte/rb-logic-core';

const output = PULL_UP.evaluate({}, [SIGNAL]);
// Z → 1 (pulled high)
// 0 → 0 (low driver wins)
// 1 → 1 (high driver)
```

**Physical Resistance**: 10kΩ typical for I2C (slower rise time, lower power)

### Pull-down Resistor

Resistive pull to LOW. When signal floats, resistor brings it LOW.

```javascript
import { PULL_DOWN } from '@redbyte/rb-logic-core';

const output = PULL_DOWN.evaluate({}, [SIGNAL]);
// Z → 0 (pulled low)
// 1 → 1 (high driver wins)
// 0 → 0 (low driver)
```

### Bus Resolver

Combines multiple drivers using wired logic rules.

```javascript
import { BusResolver } from '@redbyte/rb-logic-core';

const resolver = new BusResolver();

// Multiple open-drain drivers
const state = resolver.resolve([0, 'Z', 'Z']);
// Result: 0 (any low wins)

resolver.resolve([0, 1]); // Contention detected!
resolver.getErrors(); // [{ message: 'Bus contention', ... }]
```

**Resolution Rules**:
- All 0s → 0 (wired AND)
- All 1s → 1 (wired OR)
- All Z → Z (floating, needs external pull-up)
- 0 and Z → 0 (low wins)
- 1 and Z → 1 (high wins)
- 0 and 1 → **ERROR** (bus contention)

### Multi-driver Bus

Simulates multiple devices on shared bus (I2C, CAN, parallel data bus).

```javascript
import { MultiDriverBus } from '@redbyte/rb-logic-core';

const bus = new MultiDriverBus(1); // Pull-up to HIGH

// Add three devices
bus.addDriver('device1');
bus.addDriver('device2');
bus.addDriver('device3');

// Normal operation: all released
bus.updateDriver('device1', 'Z');
bus.updateDriver('device2', 'Z');
bus.updateDriver('device3', 'Z');

const state = bus.resolve(); // 1 (pulled HIGH)

// Device 2 transmits LOW bit
bus.updateDriver('device2', 0);
const state2 = bus.resolve(); // 0 (driven LOW)

// Check for errors
const errors = bus.getErrors(); // [] if no contention
```

**Methods**:
- `addDriver(nodeId)`: Register device
- `updateDriver(nodeId, value)`: Set 0, 1, or Z
- `resolve()`: Get current bus state
- `recordHistory(tick)`: Save state for waveform
- `getHistory(fromTick, toTick)`: Retrieve recorded states

---

## Application: I2C Bus Simulation

I2C uses open-drain with pull-up resistor on both SDA and SCL lines.

```javascript
// SDA line with pull-up
const sdaBus = new MultiDriverBus(1);
sdaBus.addDriver('master');
sdaBus.addDriver('slave1');
sdaBus.addDriver('slave2');

// SCL line with pull-up
const sclBus = new MultiDriverBus(1);
sclBus.addDriver('master');
sclBus.addDriver('slave1');
sclBus.addDriver('slave2');

// Normal: both released (HIGH)
sdaBus.updateDriver('master', 'Z');
sclBus.updateDriver('master', 'Z');
console.log(sdaBus.resolve()); // 1 (pulled HIGH)
console.log(sclBus.resolve()); // 1 (pulled HIGH)

// START condition: SDA pulled LOW while SCL HIGH
sdaBus.updateDriver('master', 0);
sclBus.updateDriver('master', 'Z');
console.log(sdaBus.resolve()); // 0 (SDA low)
console.log(sclBus.resolve()); // 1 (SCL high)

// STOP condition: SDA released while SCL HIGH
sdaBus.updateDriver('master', 'Z');
sclBus.updateDriver('master', 'Z');
console.log(sdaBus.resolve()); // 1 (both pulled high)
console.log(sclBus.resolve()); // 1

// Clock stretching: Slave pulls SCL LOW
sclBus.updateDriver('slave1', 0);
console.log(sclBus.resolve()); // 0 (slave holding LOW)
```

---

## Circuit Validation

Automatic detection of common wiring errors.

```javascript
import { validateTriStateCircuit } from '@redbyte/rb-logic-core';

const circuit = {
  nodes: [
    { id: 'out1', type: 'TRISTATE_BUFFER' },
    { id: 'out2', type: 'TRISTATE_BUFFER' },
    { id: 'and_gate', type: 'AND' }
  ],
  connections: [],
  wires: [
    { from: 'out1', to: 'and_gate' },
    { from: 'out2', to: 'and_gate' }
  ]
};

const issues = validateTriStateCircuit(circuit);
// Returns: [
//   {
//     level: 'error',
//     message: 'Multiple active drivers without tri-state',
//     drivers: ['out1', 'out2'],
//     target: 'and_gate'
//   }
// ]
```

**Validation Checks**:
1. Multiple drivers without tri-state/open-drain → ERROR
2. Floating bus without pull-up/pull-down → WARNING
3. Valid tri-state or open-drain drivers → OK

---

## Waveform Recording

Tri-state signals can be recorded in circuit recordings.

```javascript
// Record Z state in waveform
recordingEvent = {
  tick: 100,
  nodeId: 'data_bus[7]',
  value: 'Z', // High-impedance
  type: 'state_change'
};

// Displayed in oscilloscope as undefined/gray level
```

---

## Performance

| Operation | Time | Notes |
|-----------|------|-------|
| resolve() | < 0.1 ms | O(n) for n drivers |
| validateTriStateCircuit() | < 1 ms | O(wires) analysis |
| recordHistory() | < 0.01 ms | O(1) append |
| detectContention() | < 0.1 ms | Included in resolve() |

---

## Testing

Comprehensive test coverage for all scenarios:

```bash
pnpm exec vitest run packages/rb-logic-core/src/__tests__/tristateLogic.test.js
```

Tests include:
- Truth tables for all gates (tri-state, open-drain, pull-up, pull-down)
- Bus resolution (wired logic, contention)
- Multi-driver buses (I2C simulation, clock stretching)
- History recording and retrieval
- Circuit validation

---

## Troubleshooting

### Bus shows contention (0 and 1 together)

→ Check that only open-drain or tri-state outputs drive the bus

→ Verify each driver uses OE (output enable) or is open-drain

→ Example: Two regular AND gates directly connected = ERROR

### Bus state undefined (all Z, no pull-up)

→ Add PULL_UP resistor to bus

→ Example: `bus.recordHistory()` shows undefined state

→ Solution: Connect pull-up resistor from bus to VCC

### I2C clock stretching not working

→ Ensure all devices can pull SCL LOW independently

→ Check that pull-up resistor allows slow rise time

→ Slave should hold SCL=0 until ready

---

## Best Practices

1. **Use tri-state or open-drain for shared buses**: Never connect two regular (push-pull) outputs
2. **Always provide pull-up for open-drain**: Otherwise floating state is undefined
3. **Test for contention**: Run `validateTriStateCircuit()` before simulation
4. **Record bus history**: Use `recordHistory()` for waveform analysis
5. **Simulate realistic delays**: Pull-up rise time affects timing (e.g., I2C slope)

---

## References

- **I2C Specification**: https://www.i2c-bus.org/
- **CAN Bus**: https://en.wikipedia.org/wiki/CAN_bus
- **LVDS and differential signaling**: Various high-speed bus standards use tri-state variants
