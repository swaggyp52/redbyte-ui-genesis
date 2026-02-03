/**
 * Tri-state and Open-drain Logic Tests
 * Tests tri-state buffer, open-drain, and multi-driver bus behavior
 * 
 * Attribution: Connor Angiel
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TRISTATE_BUFFER,
  OPEN_DRAIN,
  WIRED_OR,
  PULL_UP,
  PULL_DOWN,
  BusResolver,
  MultiDriverBus,
  validateTriStateCircuit
} from '../tristateLogic';

describe('Tri-state Buffer', () => {
  it('should output input when OE=1', () => {
    expect(TRISTATE_BUFFER.evaluate({}, [1, 0])).toBe(0);
    expect(TRISTATE_BUFFER.evaluate({}, [1, 1])).toBe(1);
  });

  it('should output Z (high-impedance) when OE=0', () => {
    expect(TRISTATE_BUFFER.evaluate({}, [0, 0])).toBe('Z');
    expect(TRISTATE_BUFFER.evaluate({}, [0, 1])).toBe('Z');
  });

  it('should have correct port definitions', () => {
    expect(TRISTATE_BUFFER.ports.inputs).toEqual(['oe', 'in']);
    expect(TRISTATE_BUFFER.ports.outputs).toEqual(['out']);
  });

  it('should follow complete truth table', () => {
    const truthTable = [
      // OE, IN, OUT
      [0, 0, 'Z'],
      [0, 1, 'Z'],
      [1, 0, 0],
      [1, 1, 1]
    ];

    for (const [oe, input, expected] of truthTable) {
      expect(TRISTATE_BUFFER.evaluate({}, [oe, input])).toBe(expected);
    }
  });
});

describe('Open-drain Output', () => {
  it('should output 0 when input is 0', () => {
    expect(OPEN_DRAIN.evaluate({}, [0])).toBe(0);
  });

  it('should output Z (high-impedance) when input is 1', () => {
    expect(OPEN_DRAIN.evaluate({}, [1])).toBe('Z');
  });

  it('should have correct port definitions', () => {
    expect(OPEN_DRAIN.ports.inputs).toEqual(['in']);
    expect(OPEN_DRAIN.ports.outputs).toEqual(['out']);
  });
});

describe('Wired OR (Multiple Open-drain)', () => {
  it('should output 0 if any input is 0', () => {
    expect(WIRED_OR.evaluate({}, [0, 1, 1])).toBe(0);
    expect(WIRED_OR.evaluate({}, [1, 0, 1])).toBe(0);
    expect(WIRED_OR.evaluate({}, [1, 1, 0])).toBe(0);
  });

  it('should output Z if all inputs are Z or floating', () => {
    expect(WIRED_OR.evaluate({}, ['Z', 'Z', 'Z'])).toBe('Z');
  });

  it('should output Z if all inputs are 1', () => {
    // 1 is treated as floating in open-drain context
    expect(WIRED_OR.evaluate({}, [1, 1, 1])).toBe('Z');
  });

  it('should handle empty bus', () => {
    expect(WIRED_OR.evaluate({}, [])).toBe('Z');
  });
});

describe('Pull-up Resistor', () => {
  it('should output 1 when input is Z (floating)', () => {
    expect(PULL_UP.evaluate({}, ['Z'])).toBe(1);
  });

  it('should output 0 when input is 0 (low driver wins)', () => {
    expect(PULL_UP.evaluate({}, [0])).toBe(0);
  });

  it('should output 1 when input is 1 (high driver)', () => {
    expect(PULL_UP.evaluate({}, [1])).toBe(1);
  });
});

describe('Pull-down Resistor', () => {
  it('should output 0 when input is Z (floating)', () => {
    expect(PULL_DOWN.evaluate({}, ['Z'])).toBe(0);
  });

  it('should output 0 when input is 0', () => {
    expect(PULL_DOWN.evaluate({}, [0])).toBe(0);
  });

  it('should output 1 when input is 1 (high driver overrides)', () => {
    expect(PULL_DOWN.evaluate({}, [1])).toBe(1);
  });
});

describe('Bus Resolver', () => {
  let resolver;

  beforeEach(() => {
    resolver = new BusResolver();
  });

  it('should resolve all zeros to 0', () => {
    expect(resolver.resolve([0, 0, 0])).toBe(0);
  });

  it('should resolve all ones to 1', () => {
    expect(resolver.resolve([1, 1, 1])).toBe(1);
  });

  it('should resolve all Z to Z', () => {
    expect(resolver.resolve(['Z', 'Z', 'Z'])).toBe('Z');
  });

  it('should detect bus contention (0 and 1)', () => {
    expect(resolver.resolve([0, 1])).toBe('X'); // Undefined
    expect(resolver.getErrors().length).toBe(1);
  });

  it('should handle 0 with Z (0 wins)', () => {
    expect(resolver.resolve([0, 'Z', 'Z'])).toBe(0);
  });

  it('should handle 1 with Z (1 wins)', () => {
    expect(resolver.resolve([1, 'Z', 'Z'])).toBe(1);
  });

  it('should clear errors', () => {
    resolver.resolve([0, 1]); // Create contention error
    expect(resolver.getErrors().length).toBeGreaterThan(0);
    resolver.clearErrors();
    expect(resolver.getErrors().length).toBe(0);
  });

  it('should record contention error details', () => {
    resolver.resolve([0, 1]);
    const errors = resolver.getErrors();
    expect(errors[0].message).toContain('Bus contention');
    expect(errors[0].signals).toEqual([0, 1]);
  });
});

describe('Multi-driver Bus', () => {
  let bus;

  beforeEach(() => {
    bus = new MultiDriverBus(1); // Pull-up to 1
  });

  it('should initialize with pull-up value', () => {
    expect(bus.pullUpValue).toBe(1);
  });

  it('should add drivers', () => {
    bus.addDriver('driver1');
    bus.addDriver('driver2');
    expect(bus.getDrivers().size).toBe(2);
  });

  it('should update driver values', () => {
    bus.addDriver('driver1');
    bus.updateDriver('driver1', 0);
    expect(bus.getDrivers().get('driver1')).toBe(0);
  });

  it('should resolve bus with single low driver', () => {
    bus.addDriver('driver1');
    bus.updateDriver('driver1', 0);
    expect(bus.resolve()).toBe(0);
  });

  it('should resolve bus with all floating drivers (pull-up)', () => {
    bus.addDriver('driver1');
    bus.updateDriver('driver1', 'Z');
    expect(bus.resolve()).toBe(1); // Pull-up value
  });

  it('should detect contention on open-drain bus', () => {
    bus.addDriver('driver1');
    bus.addDriver('driver2');
    bus.updateDriver('driver1', 0);
    bus.updateDriver('driver2', 1); // Contention: 0 and 1
    bus.resolve();
    expect(bus.getErrors().length).toBeGreaterThan(0);
  });

  it('should resolve multiple drivers with one low', () => {
    bus.addDriver('driver1');
    bus.addDriver('driver2');
    bus.addDriver('driver3');
    bus.updateDriver('driver1', 'Z');
    bus.updateDriver('driver2', 0);
    bus.updateDriver('driver3', 'Z');
    expect(bus.resolve()).toBe(0); // One driver pulls low
  });

  it('should record history', () => {
    bus.addDriver('driver1');
    bus.updateDriver('driver1', 'Z');
    bus.recordHistory(0);
    bus.updateDriver('driver1', 0);
    bus.recordHistory(1);

    expect(bus.history.length).toBe(2);
    expect(bus.history[0].state).toBe(1); // Pulled high
    expect(bus.history[1].state).toBe(0); // Driven low
  });

  it('should retrieve history within tick range', () => {
    for (let tick = 0; tick < 10; tick++) {
      bus.recordHistory(tick);
    }

    const range = bus.getHistory(2, 5);
    expect(range.length).toBe(4); // Ticks 2, 3, 4, 5
    expect(range[0].tick).toBe(2);
    expect(range[3].tick).toBe(5);
  });

  it('should handle pull-down bus', () => {
    const pdBus = new MultiDriverBus(0); // Pull-down to 0
    pdBus.addDriver('driver1');
    pdBus.updateDriver('driver1', 'Z');
    expect(pdBus.resolve()).toBe(0); // Pulled low
  });
});

describe('I2C-style Bus Behavior', () => {
  let bus;

  beforeEach(() => {
    bus = new MultiDriverBus(1); // I2C pull-up to HIGH
  });

  it('should support multiple open-drain devices', () => {
    // Simulate 3 devices on I2C bus
    bus.addDriver('device1');
    bus.addDriver('device2');
    bus.addDriver('device3');

    // All devices idle (releasing bus)
    bus.updateDriver('device1', 'Z');
    bus.updateDriver('device2', 'Z');
    bus.updateDriver('device3', 'Z');

    expect(bus.resolve()).toBe(1); // Pull-up holds HIGH
  });

  it('should show bus LOW when any device pulls', () => {
    bus.addDriver('device1');
    bus.addDriver('device2');

    bus.updateDriver('device1', 0); // Device 1 starts bit transmission
    bus.updateDriver('device2', 'Z'); // Device 2 idle

    expect(bus.resolve()).toBe(0); // Bus pulled LOW
  });

  it('should prevent multiple active drivers', () => {
    bus.addDriver('device1');
    bus.addDriver('device2');

    bus.updateDriver('device1', 0);
    bus.updateDriver('device2', 1); // Illegal in I2C (can't drive HIGH)

    bus.resolve();
    // This would be detected by circuit validation
    expect(bus.getErrors().length).toBeGreaterThan(0);
  });
});

describe('Tri-state Circuit Validation', () => {
  it('should detect unresolved buses', () => {
    const circuit = {
      nodes: [{ id: 'out1', type: 'TRISTATE_BUFFER' }],
      connections: [{ id: 'bus1', type: 'bus' }],
      wires: []
    };

    const issues = validateTriStateCircuit(circuit);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some(i => i.message.includes('no pull-up'))).toBe(true);
  });

  it('should detect multiple drivers without tri-state', () => {
    const circuit = {
      nodes: [
        { id: 'node1', type: 'AND' },
        { id: 'node2', type: 'OR' },
        { id: 'node3', type: 'DRIVER' }
      ],
      connections: [],
      wires: [
        { from: 'node1', to: 'node3' },
        { from: 'node2', to: 'node3' } // Multiple drivers
      ]
    };

    const issues = validateTriStateCircuit(circuit);
    expect(issues.some(i => i.level === 'error')).toBe(true);
  });

  it('should allow multiple tri-state drivers on same bus', () => {
    const circuit = {
      nodes: [
        { id: 'ts1', type: 'TRISTATE_BUFFER' },
        { id: 'ts2', type: 'TRISTATE_BUFFER' },
        { id: 'node3', type: 'PULL_UP', connections: ['bus1'] }
      ],
      connections: [{ id: 'bus1', type: 'bus' }],
      wires: [
        { from: 'ts1', to: 'node3' },
        { from: 'ts2', to: 'node3' }
      ]
    };

    const issues = validateTriStateCircuit(circuit);
    // Should not have errors for tri-state drivers
    expect(issues.filter(i => i.level === 'error').length).toBe(0);
  });
});

describe('Tri-state Integration', () => {
  it('should handle I2C START condition', () => {
    // I2C START: SDA goes LOW while SCL is HIGH
    const bus = new MultiDriverBus(1);
    bus.addDriver('master');

    // Normal state: both lines HIGH (pulled up)
    bus.updateDriver('master', 'Z');
    expect(bus.resolve()).toBe(1);

    // START: SDA pulled LOW while SCL released
    bus.updateDriver('master', 0); // SDA low
    expect(bus.resolve()).toBe(0);

    // STOP: SDA released (goes high)
    bus.updateDriver('master', 'Z');
    expect(bus.resolve()).toBe(1);
  });

  it('should simulate data transmission on open-drain bus', () => {
    const bus = new MultiDriverBus(1); // Pull-up to 1
    bus.addDriver('driver');

    // Transmit sequence: 0, 1, 0, 1
    const sequence = [0, 'Z', 0, 'Z']; // 0 (LOW), release (HIGH), 0 (LOW), release (HIGH)

    for (const [tick, value] of sequence.entries()) {
      bus.updateDriver('driver', value);
      bus.recordHistory(tick);
      
      if (value === 0) {
        expect(bus.resolve()).toBe(0);
      } else {
        expect(bus.resolve()).toBe(1);
      }
    }

    expect(bus.history.length).toBe(sequence.length);
  });
});
