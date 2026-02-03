/**
 * Tri-state and Open-drain Logic Implementation
 * Extends simulation engine with tri-state buffers, open-drain outputs, and pull-up/pull-down modeling
 * 
 * Attribution: Connor Angiel
 */

/**
 * Tri-state buffer behavior
 * Output can be 0, 1, or Z (high-impedance/floating)
 * 
 * Truth table:
 * OE | IN | OUT
 * ----|----|----- 
 * 0  | 0  | Z
 * 0  | 1  | Z
 * 1  | 0  | 0
 * 1  | 1  | 1
 */
export const TRISTATE_BUFFER = {
  evaluate: (node, inputs) => {
    const output_enable = inputs[0]; // OE pin
    const data_in = inputs[1];       // Data input

    if (output_enable === 0) {
      return 'Z'; // High impedance (floating)
    }
    return data_in; // Pass through input
  },

  ports: {
    inputs: ['oe', 'in'],
    outputs: ['out']
  }
};

/**
 * Open-drain output behavior
 * Can pull LOW (0) or float (Z), but cannot drive HIGH
 * Requires external pull-up resistor for HIGH state
 * 
 * Truth table:
 * IN | OUT
 * ---|----- 
 * 0  | 0
 * 1  | Z (pulled high by resistor)
 */
export const OPEN_DRAIN = {
  evaluate: (node, inputs) => {
    const data_in = inputs[0];

    if (data_in === 0) {
      return 0; // Drive low actively
    }
    return 'Z'; // Float, relies on pull-up
  },

  ports: {
    inputs: ['in'],
    outputs: ['out']
  }
};

/**
 * Wired OR: Multiple open-drain outputs on same line
 * Output is 0 if ANY driver pulls low, otherwise high-impedance
 * Physical implementation: AND gate with open-drain
 */
export const WIRED_OR = {
  evaluate: (node, inputs) => {
    // inputs is array of all signals on bus
    // Result is 0 if any input is 0, else Z

    for (const input of inputs) {
      if (input === 0) {
        return 0; // Any low driver wins
      }
    }
    return 'Z'; // All floating
  },

  ports: {
    inputs: ['bus'],      // Variable length bus
    outputs: ['out']
  }
};

/**
 * Pull-up resistor simulation
 * Pulls signal HIGH when floating (Z)
 * Allows LOW to override
 * 
 * Resistance effects (simplified):
 * - No load: pulls to 1 (HIGH)
 * - Driven low: forced to 0
 * - Driven high: follows driver
 */
export const PULL_UP = {
  evaluate: (node, inputs) => {
    const signal = inputs[0];

    switch (signal) {
      case 0:
        return 0; // Low driver overrides pull-up
      case 1:
        return 1; // High is high
      case 'Z':
        return 1; // Pull-up resistor drives high
      default:
        return 'Z';
    }
  },

  ports: {
    inputs: ['in'],
    outputs: ['out']
  }
};

/**
 * Pull-down resistor simulation
 * Pulls signal LOW when floating (Z)
 * Allows HIGH to override
 */
export const PULL_DOWN = {
  evaluate: (node, inputs) => {
    const signal = inputs[0];

    switch (signal) {
      case 0:
        return 0;
      case 1:
        return 1; // High driver overrides pull-down
      case 'Z':
        return 0; // Pull-down resistor drives low
      default:
        return 'Z';
    }
  },

  ports: {
    inputs: ['in'],
    outputs: ['out']
  }
};

/**
 * I2C-style bus: Open-drain outputs with pull-up resistor
 * Multiple devices can pull low, resistor provides high
 * SDA/SCL bus behavior
 */
export const I2C_BUS = {
  state: {},

  // Processes multiple drivers on same bus
  evaluate: (node, inputs, state) => {
    // inputs: array of open-drain driver outputs
    // state: bus voltage (0, 1, or Z)

    // Wired-OR logic: any 0 wins, else pulled high
    for (const driver of inputs) {
      if (driver === 0) {
        return 0; // Bus is LOW (some device pulling)
      }
    }

    // All drivers floating or high
    return 1; // Pull-up resistor brings bus HIGH
  },

  ports: {
    inputs: ['drivers[]'],  // Variable number of drivers
    outputs: ['bus_state']
  }
};

/**
 * Comparator with tri-state output
 * Compares two analog values, outputs HIGH/LOW with tri-state option
 */
export const COMPARATOR_TRISTATE = {
  evaluate: (node, inputs) => {
    const in_plus = inputs[0];   // Non-inverting input
    const in_minus = inputs[1];  // Inverting input
    const output_enable = inputs[2]; // OE pin

    if (output_enable === 0) {
      return 'Z'; // High impedance
    }

    // Comparator logic
    if (in_plus > in_minus) {
      return 1;
    } else {
      return 0;
    }
  },

  ports: {
    inputs: ['in+', 'in-', 'oe'],
    outputs: ['out']
  }
};

/**
 * Bus resolver: Converts multiple tri-state signals to single logical value
 * Enforces bus contention rules
 * 
 * Resolution logic:
 * - Multiple 0s: Valid (wired AND) → 0
 * - Multiple 1s: Valid (wired OR) → 1
 * - Mix of 0 and 1: Bus contention (ERROR)
 * - All Z: Floating (undefined, may use pull-up/pull-down)
 */
export class BusResolver {
  constructor() {
    this.contention_errors = [];
  }

  resolve(signals) {
    let hasZero = false;
    let hasOne = false;
    let hasZ = false;

    for (const signal of signals) {
      if (signal === 0) hasZero = true;
      else if (signal === 1) hasOne = true;
      else if (signal === 'Z') hasZ = true;
    }

    // Check for contention (multiple drivers with conflicting values)
    if (hasZero && hasOne) {
      this.contention_errors.push({
        timestamp: Date.now(),
        message: 'Bus contention: multiple drivers with conflicting values',
        signals
      });
      return 'X'; // Undefined value
    }

    // Normal resolution
    if (hasZero) return 0;
    if (hasOne) return 1;
    if (hasZ) return 'Z'; // All floating
    
    return 'Z'; // No drivers
  }

  getErrors() {
    return this.contention_errors;
  }

  clearErrors() {
    this.contention_errors = [];
  }
}

/**
 * Bus with multiple open-drain drivers (I2C, CAN, etc.)
 */
export class MultiDriverBus {
  constructor(pullUpValue = 1) {
    this.drivers = new Map(); // nodeId -> output value
    this.pullUpValue = pullUpValue; // 1 for pull-up, 0 for pull-down
    this.resolver = new BusResolver();
    this.history = [];
  }

  /**
   * Register a driver on the bus
   */
  addDriver(nodeId) {
    this.drivers.set(nodeId, 'Z'); // Initially floating
  }

  /**
   * Update driver output
   * For open-drain: 0 or Z only
   * For tri-state: 0, 1, or Z
   */
  updateDriver(nodeId, value) {
    this.drivers.set(nodeId, value);
  }

  /**
   * Resolve current bus state
   * Applies wired logic (wired AND/OR)
   */
  resolve() {
    const values = Array.from(this.drivers.values());
    const resolved = this.resolver.resolve(values);

    // Apply pull-up/pull-down if floating
    if (resolved === 'Z') {
      return this.pullUpValue;
    }

    return resolved;
  }

  /**
   * Get all drivers and their current values
   */
  getDrivers() {
    return new Map(this.drivers);
  }

  /**
   * Get bus contention errors
   */
  getErrors() {
    return this.resolver.getErrors();
  }

  /**
   * Record state for waveform analysis
   */
  recordHistory(tick) {
    this.history.push({
      tick,
      state: this.resolve(),
      drivers: new Map(this.drivers)
    });
  }

  /**
   * Get history of bus states
   */
  getHistory(fromTick, toTick) {
    return this.history.filter(
      entry => entry.tick >= fromTick && entry.tick <= toTick
    );
  }
}

/**
 * Register all tri-state/open-drain nodes with the logic engine
 */
export function registerTriStateNodes() {
  return {
    TRISTATE_BUFFER,
    OPEN_DRAIN,
    WIRED_OR,
    PULL_UP,
    PULL_DOWN,
    I2C_BUS,
    COMPARATOR_TRISTATE
  };
}

/**
 * Validate tri-state circuit for common issues
 */
export function validateTriStateCircuit(circuit) {
  const issues = [];

  // Check for unresolved buses (floating with no pull-up/down)
  const buses = circuit.connections.filter(c => c.type === 'bus');
  for (const bus of buses) {
    const hasResistor = circuit.nodes.some(
      n => (n.type === 'PULL_UP' || n.type === 'PULL_DOWN') && n.connections.includes(bus.id)
    );

    if (!hasResistor) {
      issues.push({
        level: 'warning',
        message: `Bus ${bus.id} has no pull-up/pull-down resistor`,
        bus: bus.id
      });
    }
  }

  // Check for multiple active drivers without tri-state or open-drain
  const driverGroups = new Map();
  for (const wire of circuit.wires) {
    if (!driverGroups.has(wire.to)) {
      driverGroups.set(wire.to, []);
    }
    driverGroups.get(wire.to).push(wire.from);
  }

  for (const [target, drivers] of driverGroups) {
    if (drivers.length > 1) {
      const targetNode = circuit.nodes.find(n => n.id === target);
      if (targetNode && !['TRISTATE_BUFFER', 'OPEN_DRAIN', 'PULL_UP', 'PULL_DOWN'].includes(targetNode.type)) {
        issues.push({
          level: 'error',
          message: `Node ${target} has multiple drivers without tri-state/open-drain`,
          drivers,
          target
        });
      }
    }
  }

  return issues;
}
