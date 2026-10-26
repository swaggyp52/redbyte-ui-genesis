// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { NodeBehavior, Signal, NodeInputs, NodeOutputs } from './types';
import { BUILTIN_COMPOSITE_DEFS } from './composite-defs';
import { getComponentSupport } from './analysis/componentSupportRegistry';

/**
 * PowerSource - Always outputs 1
 */
export const PowerSourceBehavior: NodeBehavior = {
  evaluate() {
    return {
      outputs: { out: 1 },
      state: {},
    };
  },
};

/**
 * Ground - Always outputs 0
 */
export const GroundBehavior: NodeBehavior = {
  evaluate() {
    return {
      outputs: { out: 0 },
      state: {},
    };
  },
};

/**
 * Switch - Toggleable input (state-based)
 */
export const SwitchBehavior: NodeBehavior = {
  evaluate(_inputs, state) {
    const isOn = state.isOn ?? 0;
    return {
      outputs: { out: isOn as Signal },
      state: { isOn },
    };
  },
};

/**
 * Lamp - Displays input state (passive)
 * Returns `out` so the signal propagates into the cache and is visible
 * in the Design surface output dock even on user-built (unmapped) circuits.
 */
export const LampBehavior: NodeBehavior = {
  evaluate(inputs) {
    const input = inputs.in ?? 0;
    return {
      outputs: { out: input as Signal },
      state: { isOn: input },
    };
  },
};

/**
 * Wire - Pass-through
 */
export const WireBehavior: NodeBehavior = {
  evaluate(inputs) {
    const input = inputs.in ?? 0;
    return {
      outputs: { out: input as Signal },
      state: {},
    };
  },
};

/**
 * AND gate
 */
export const ANDBehavior: NodeBehavior = {
  evaluate(inputs) {
    // Support both 'a'/'b' and 'in1'/'in2' naming conventions
    const in1 = inputs.in1 ?? inputs.a ?? 0;
    const in2 = inputs.in2 ?? inputs.b ?? 0;
    return {
      outputs: { out: (in1 && in2 ? 1 : 0) as Signal },
      state: {},
    };
  },
};

/**
 * OR gate
 */
export const ORBehavior: NodeBehavior = {
  evaluate(inputs) {
    // Support both 'a'/'b' and 'in1'/'in2' naming conventions
    const in1 = inputs.in1 ?? inputs.a ?? 0;
    const in2 = inputs.in2 ?? inputs.b ?? 0;
    return {
      outputs: { out: (in1 || in2 ? 1 : 0) as Signal },
      state: {},
    };
  },
};

/**
 * NOT gate
 */
export const NOTBehavior: NodeBehavior = {
  evaluate(inputs) {
    const input = inputs.in ?? 0;
    return {
      outputs: { out: (input ? 0 : 1) as Signal },
      state: {},
    };
  },
};

/**
 * NAND gate
 */
export const NANDBehavior: NodeBehavior = {
  evaluate(inputs) {
    // Support both 'a'/'b' and 'in1'/'in2' naming conventions
    const in1 = inputs.in1 ?? inputs.a ?? 0;
    const in2 = inputs.in2 ?? inputs.b ?? 0;
    return {
      outputs: { out: (in1 && in2 ? 0 : 1) as Signal },
      state: {},
    };
  },
};

/**
 * NOR gate
 */
export const NORBehavior: NodeBehavior = {
  evaluate(inputs) {
    // Support both 'a'/'b' and 'in1'/'in2' naming conventions
    const in1 = inputs.in1 ?? inputs.a ?? 0;
    const in2 = inputs.in2 ?? inputs.b ?? 0;
    return {
      outputs: { out: (in1 || in2 ? 0 : 1) as Signal },
      state: {},
    };
  },
};

/**
 * XOR gate
 */
export const XORBehavior: NodeBehavior = {
  evaluate(inputs) {
    // Support both 'a'/'b' and 'in1'/'in2' naming conventions
    const in1 = inputs.in1 ?? inputs.a ?? 0;
    const in2 = inputs.in2 ?? inputs.b ?? 0;
    return {
      outputs: { out: (in1 !== in2 ? 1 : 0) as Signal },
      state: {},
    };
  },
};

/**
 * XNOR gate
 */
export const XNORBehavior: NodeBehavior = {
  evaluate(inputs) {
    // Support both 'a'/'b' and 'in1'/'in2' naming conventions
    const in1 = inputs.in1 ?? inputs.a ?? 0;
    const in2 = inputs.in2 ?? inputs.b ?? 0;
    return {
      outputs: { out: (in1 === in2 ? 1 : 0) as Signal },
      state: {},
    };
  },
};

/**
 * AND3 gate - 3-input AND
 */
export const AND3Behavior: NodeBehavior = {
  evaluate(inputs) {
    const a = inputs.a ?? 0;
    const b = inputs.b ?? 0;
    const c = inputs.c ?? 0;
    return { outputs: { out: (a && b && c ? 1 : 0) as Signal }, state: {} };
  },
};

/**
 * OR3 gate — 3-input OR
 */
export const OR3Behavior: NodeBehavior = {
  evaluate(inputs) {
    const a = inputs.a ?? 0;
    const b = inputs.b ?? 0;
    const c = inputs.c ?? 0;
    return { outputs: { out: (a || b || c ? 1 : 0) as Signal }, state: {} };
  },
};

/**
 * NAND3 gate — 3-input NAND
 */
export const NAND3Behavior: NodeBehavior = {
  evaluate(inputs) {
    const a = inputs.a ?? 0;
    const b = inputs.b ?? 0;
    const c = inputs.c ?? 0;
    return { outputs: { out: (a && b && c ? 0 : 1) as Signal }, state: {} };
  },
};

/**
 * NOR3 gate — 3-input NOR
 */
export const NOR3Behavior: NodeBehavior = {
  evaluate(inputs) {
    const a = inputs.a ?? 0;
    const b = inputs.b ?? 0;
    const c = inputs.c ?? 0;
    return { outputs: { out: (a || b || c ? 0 : 1) as Signal }, state: {} };
  },
};

/**
 * XOR3 gate — 3-input XOR (odd-parity)
 */
export const XOR3Behavior: NodeBehavior = {
  evaluate(inputs) {
    const a = inputs.a ?? 0;
    const b = inputs.b ?? 0;
    const c = inputs.c ?? 0;
    const parity = (a ? 1 : 0) ^ (b ? 1 : 0) ^ (c ? 1 : 0);
    return { outputs: { out: parity as Signal }, state: {} };
  },
};

/**
 * Clock - Periodic oscillator
 * config.period: number of ticks per cycle (default 10)
 */
export const ClockBehavior: NodeBehavior = {
  evaluate(_inputs, state, config) {
    const period = config.period ?? 10;
    const tickCount = state.tickCount ?? 0;
    const halfPeriod = Math.floor(period / 2);
    const isHigh = (tickCount % period) < halfPeriod;

    return {
      outputs: { out: (isHigh ? 1 : 0) as Signal },
      state: { tickCount: tickCount + 1 },
    };
  },
};

/**
 * Delay - Fixed tick buffer
 * config.delay: number of ticks to delay (default 1)
 */
export const DelayBehavior: NodeBehavior = {
  evaluate(inputs, state, config) {
    const delay = config.delay ?? 1;
    const input = inputs.in ?? 0;
    const buffer: Signal[] = state.buffer ?? [];

    // Output is the oldest value (or 0 if buffer not full yet)
    const output = buffer.length >= delay ? buffer[0] : 0;

    // Add current input to buffer
    buffer.push(input as Signal);

    // Keep buffer at exactly delay+1 length (so we can output delay ticks ago)
    if (buffer.length > delay) {
      buffer.shift();
    }

    return {
      outputs: { out: output },
      state: { buffer },
    };
  },
};

function readFirstNumber(inputs: NodeInputs, names: readonly string[], fallback = 0): number {
  for (const name of names) {
    const value = inputs[name];
    if (typeof value === 'number') return value;
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Input pins: what a behaviour reads when nothing drives a pin
// ---------------------------------------------------------------------------

/** The part an input pin plays in its behaviour. */
export type InputPinRole = 'data' | 'clock' | 'reset' | 'enable';

/**
 * How a built-in behaviour reads one input pin. The engine passes no value for a pin that
 * nothing drives (CircuitEngine.buildNodeInputs), so the behaviour's own fallback applies. The
 * sequential behaviours below read their pins through these specs and describeInputPin reports
 * the same specs, so the description cannot drift from what executes; the combinational gates'
 * entries are checked against their behaviours in unconnectedInputs.test.ts.
 */
interface InputPinSpec {
  readonly role: InputPinRole;
  /** Connection port names the behaviour reads; the first one carrying a number wins. */
  readonly names: readonly string[];
  /** Names of bit `index` of a word input, read when no whole-word value is wired. */
  readonly bitNames?: (index: number) => readonly string[];
  /** The level the behaviour uses when nothing drives the pin. */
  readonly unconnected: 0 | 1;
  /** False when the configuration disables the pin: the behaviour does not read it, wired or not. */
  readonly usedWhen?: (config: Record<string, unknown>) => boolean;
  /** The level that asserts a reset or an enable under the configuration. */
  readonly activeLevel?: (config: Record<string, unknown>) => 0 | 1;
}

function readPin(inputs: NodeInputs, pin: InputPinSpec): number {
  return readFirstNumber(inputs, pin.names, pin.unconnected);
}

function isPinUsed(pin: InputPinSpec, config: Record<string, unknown>): boolean {
  return pin.usedWhen ? pin.usedWhen(config) : true;
}

const dataPin = (...names: string[]): InputPinSpec => ({ role: 'data', names, unconnected: 0 });
const activeHigh = (): 1 => 1;

const CLOCK_PIN: InputPinSpec = { role: 'clock', names: ['CLK', 'clk', 'clock', 'C'], unconnected: 0 };
const D_PIN = dataPin('D', 'd', 'in');
const DFF_RESET_PIN: InputPinSpec = {
  role: 'reset', names: ['RST', 'rst', 'RESET', 'reset', 'CLR', 'clr'], unconnected: 0, activeLevel: activeHigh,
};
/** An unconnected DFlipFlop EN reads 1: the flip-flop captures at every rising edge. */
const DFF_ENABLE_PIN: InputPinSpec = {
  role: 'enable', names: ['EN', 'en', 'ENABLE', 'enable'], unconnected: 1, activeLevel: activeHigh,
};
const REGISTER_WORD_PIN: InputPinSpec = {
  role: 'data', names: ['D'], bitNames: (index) => [`D[${index}]`, `D${index}`, `D_${index}`], unconnected: 0,
};
/** Read only when the configuration chooses a reset mode; the reset polarity sets its active level. */
const REGISTER_RESET_PIN: InputPinSpec = {
  role: 'reset',
  names: ['RST', 'rst', 'RESET', 'reset', 'CLR', 'clr', 'SET', 'set'],
  unconnected: 0,
  usedWhen: (config) => resolveResetKind(config) !== 'none',
  activeLevel: (config) => (resolvePolarity(config.resetPolarity) === 'active_low' ? 0 : 1),
};
/**
 * Read only with Clock enable on (config.hasEnable === true), as in the exported VHDL; without
 * it the register ignores EN, wired or not. An unconnected EN then reads 0.
 */
const REGISTER_ENABLE_PIN: InputPinSpec = {
  role: 'enable',
  names: ['EN', 'en', 'ENABLE', 'enable', 'CE', 'ce'],
  unconnected: 0,
  usedWhen: (config) => config.hasEnable === true,
  activeLevel: (config) => (resolvePolarity(config.enablePolarity) === 'active_low' ? 0 : 1),
};
const T_PIN = dataPin('T', 't', 'in');
const J_PIN = dataPin('J', 'j');
const K_PIN = dataPin('K', 'k');
const CLEAR_PIN: InputPinSpec = {
  role: 'reset', names: ['CLR', 'clr', 'RST', 'rst', 'RESET', 'reset'], unconnected: 0, activeLevel: activeHigh,
};
// The combinational behaviours read `inputs.in1 ?? inputs.a ?? 0` and the like.
const GATE_A_PIN = dataPin('in1', 'a');
const GATE_B_PIN = dataPin('in2', 'b');
const SINGLE_IN_PIN = dataPin('in');
const GATE3_PINS = [dataPin('a'), dataPin('b'), dataPin('c')];

const BUILTIN_INPUT_PINS: Readonly<Record<string, readonly InputPinSpec[]>> = {
  Lamp: [SINGLE_IN_PIN],
  Wire: [SINGLE_IN_PIN],
  OUTPUT: [SINGLE_IN_PIN],
  NOT: [SINGLE_IN_PIN],
  Delay: [SINGLE_IN_PIN],
  AND: [GATE_A_PIN, GATE_B_PIN],
  OR: [GATE_A_PIN, GATE_B_PIN],
  NAND: [GATE_A_PIN, GATE_B_PIN],
  NOR: [GATE_A_PIN, GATE_B_PIN],
  XOR: [GATE_A_PIN, GATE_B_PIN],
  XNOR: [GATE_A_PIN, GATE_B_PIN],
  AND3: GATE3_PINS,
  OR3: GATE3_PINS,
  NAND3: GATE3_PINS,
  NOR3: GATE3_PINS,
  XOR3: GATE3_PINS,
  DFlipFlop: [D_PIN, CLOCK_PIN, DFF_RESET_PIN, DFF_ENABLE_PIN],
  Register1: [D_PIN, CLOCK_PIN, REGISTER_RESET_PIN, REGISTER_ENABLE_PIN],
  RegisterBus: [REGISTER_WORD_PIN, CLOCK_PIN, REGISTER_RESET_PIN, REGISTER_ENABLE_PIN],
  StateBank: [REGISTER_WORD_PIN, CLOCK_PIN, REGISTER_RESET_PIN, REGISTER_ENABLE_PIN],
  TFlipFlop: [T_PIN, CLOCK_PIN, CLEAR_PIN],
  JKFlipFlop: [J_PIN, K_PIN, CLOCK_PIN, CLEAR_PIN],
};

/**
 * The level a composite part (CompositeNode.createCompositeNodeBehavior) feeds its subcircuit for
 * an input that nothing drives.
 */
export const COMPOSITE_UNCONNECTED_INPUT_LEVEL = 0;

/** Roles of the built-in composite parts' pins that are not data (their active level is 1). */
const COMPOSITE_PIN_ROLES: Readonly<Record<string, Readonly<Record<string, InputPinRole>>>> = {
  DLatch: { EN: 'enable' },
  RSLatch: { R: 'reset' },
};

/** How a built-in behaviour treats one of its input pins (see describeInputPin). */
export interface InputPinDescription {
  readonly role: InputPinRole;
  /**
   * False when the node's configuration disables the pin: the behaviour does not read it, wired
   * or not (a register's EN without Clock enable, its RST with Reset mode none).
   */
  readonly used: boolean;
  /** The level the behaviour reads when nothing drives the pin. */
  readonly unconnectedLevel: 0 | 1;
  /** For a reset or an enable: the level that asserts it under this configuration. */
  readonly activeLevel: 0 | 1 | null;
}

function registerFamilyWidth(nodeType: string, config: Record<string, unknown>): number {
  return normalizeWidth(config.width, nodeType === 'Register1' ? 1 : 8);
}

/**
 * The one description of what a built-in part reads from an input pin, taken from the specs its
 * behaviour executes: its role, whether the configuration lets the behaviour read it, the level
 * it reads when nothing drives it, and for a reset or enable the level that asserts it. `pin` is
 * the port name exactly as a connection carries it. Null for a pin the behaviour does not read,
 * for a part the support registry does not simulate (the Counter4Bit stub ignores its clock) and
 * for parts this package does not define (module instances, custom components): callers then
 * claim no value.
 */
export function describeInputPin(
  nodeType: string,
  pin: string,
  config: Record<string, unknown> | null | undefined = {},
): InputPinDescription | null {
  if (getComponentSupport(nodeType)?.capabilities.simulation === false) return null;
  const settings = config ?? {};
  const specs = BUILTIN_INPUT_PINS[nodeType];
  if (specs) {
    const width = registerFamilyWidth(nodeType, settings);
    const spec = specs.find((entry) => entry.names.includes(pin)
      || (entry.bitNames !== undefined && Array.from({ length: width }, (_value, index) => index)
        .some((index) => entry.bitNames!(index).includes(pin))));
    if (!spec) return null;
    return {
      role: spec.role,
      used: isPinUsed(spec, settings),
      unconnectedLevel: spec.unconnected,
      activeLevel: spec.activeLevel ? spec.activeLevel(settings) : null,
    };
  }
  const composite = BUILTIN_COMPOSITE_DEFS.find((definition) => definition.name === nodeType);
  if (!composite || !Object.prototype.hasOwnProperty.call(composite.inputMapping, pin)) return null;
  const role = COMPOSITE_PIN_ROLES[nodeType]?.[pin] ?? 'data';
  return {
    role,
    used: true,
    unconnectedLevel: COMPOSITE_UNCONNECTED_INPUT_LEVEL,
    activeLevel: role === 'reset' || role === 'enable' ? 1 : null,
  };
}

function sequentialOutputs(q: number): NodeOutputs {
  const qInv = q === 0 ? 1 : 0;
  return {
    Q: q as Signal,
    q: q as Signal,
    out: q as Signal,
    Q_inv: qInv as Signal,
    qn: qInv as Signal,
  };
}

type RegisterResetKind =
  | 'none'
  | 'async_clear'
  | 'async_preset'
  | 'sync_reset'
  | 'sync_set';

type ActivePolarity = 'active_high' | 'active_low';
type ClockEdge = 'rising_edge' | 'falling_edge';

function toBit(value: number): 0 | 1 {
  return value === 0 ? 0 : 1;
}

function normalizeWidth(raw: unknown, fallback: number): number {
  const width = Number.isFinite(raw) ? Math.floor(raw as number) : fallback;
  if (!Number.isFinite(width) || width < 1) return fallback;
  return Math.min(width, 32);
}

function maskForWidth(width: number): number {
  if (width >= 31) return 0x7fffffff;
  return (1 << width) - 1;
}

function resolveResetKind(config: Record<string, unknown>): RegisterResetKind {
  const raw = String(config.resetKind ?? 'none').toLowerCase();
  if (
    raw === 'async_clear' ||
    raw === 'async_preset' ||
    raw === 'sync_reset' ||
    raw === 'sync_set'
  ) {
    return raw;
  }
  return 'none';
}

function resolvePolarity(
  raw: unknown,
  fallback: ActivePolarity = 'active_high'
): ActivePolarity {
  const token = String(raw ?? fallback).toLowerCase();
  return token === 'active_low' ? 'active_low' : 'active_high';
}

function resolveClockEdge(config: Record<string, unknown>): ClockEdge {
  const token = String(config.clockPolarity ?? 'rising_edge').toLowerCase();
  return token === 'falling_edge' ? 'falling_edge' : 'rising_edge';
}

function readPackedInput(
  inputs: NodeInputs,
  width: number,
  pin: InputPinSpec
): number {
  const direct = inputs[pin.names[0]];
  if (typeof direct === 'number') {
    return (Math.floor(direct) & maskForWidth(width)) >>> 0;
  }

  let packed = 0;
  for (let index = 0; index < width; index += 1) {
    const bit = readFirstNumber(inputs, pin.bitNames?.(index) ?? [], pin.unconnected);
    if (toBit(bit) === 1) packed |= (1 << index);
  }
  return packed & maskForWidth(width);
}

function buildRegisterOutputs(q: number, width: number, scalarCompatibility: boolean): NodeOutputs {
  const mask = maskForWidth(width);
  const normalizedQ = q & mask;
  const inv = (~normalizedQ) & mask;
  const outputs: NodeOutputs = {
    Q: normalizedQ as Signal,
    q: normalizedQ as Signal,
    out: normalizedQ as Signal,
    Q_inv: inv as Signal,
    qn: inv as Signal,
    value: normalizedQ as Signal,
    width: width as Signal,
  };

  for (let index = 0; index < width; index += 1) {
    const bit = ((normalizedQ >> index) & 1) as 0 | 1;
    const bitInv = bit === 0 ? 1 : 0;
    outputs[`Q${index}`] = bit as Signal;
    outputs[`q${index}`] = bit as Signal;
    outputs[`Q[${index}]`] = bit as Signal;
    outputs[`q[${index}]`] = bit as Signal;
    outputs[`Q_inv${index}`] = bitInv as Signal;
  }

  if (scalarCompatibility) {
    outputs.Q = (normalizedQ & 1) as Signal;
    outputs.q = (normalizedQ & 1) as Signal;
    outputs.out = (normalizedQ & 1) as Signal;
    outputs.Q_inv = ((inv & 1) as Signal);
    outputs.qn = ((inv & 1) as Signal);
  }
  return outputs;
}

/** Publish held state without evaluating a device or creating a clock edge.
 * Used to establish the common read boundary before native clock capture. */
export function readClockedStateOutputs(
  nodeType: string,
  state: Record<string, unknown>,
  config: Record<string, unknown>,
): NodeOutputs {
  if (nodeType === 'Register1' || nodeType === 'RegisterBus' || nodeType === 'StateBank') {
    const width = normalizeWidth(config.width, nodeType === 'Register1' ? 1 : 8);
    return buildRegisterOutputs(Number(state.q ?? 0), width, nodeType === 'Register1');
  }
  return sequentialOutputs(Number(state.q ?? 0));
}

function evaluateRegisterFamily(
  inputs: NodeInputs,
  state: Record<string, any>,
  config: Record<string, any>,
  nodeType: 'Register1' | 'RegisterBus' | 'StateBank'
): { outputs: NodeOutputs; state: Record<string, any> } {
  const widthDefault = nodeType === 'Register1' ? 1 : nodeType === 'RegisterBus' ? 8 : 8;
  const width = normalizeWidth(config.width, widthDefault);
  const mask = maskForWidth(width);

  const clk = readPin(inputs, CLOCK_PIN);
  const dPacked =
    nodeType === 'Register1'
      ? toBit(readPin(inputs, D_PIN))
      : readPackedInput(inputs, width, REGISTER_WORD_PIN);
  const lastClk = toBit(Number(state.lastClk ?? 0));
  let q = (Number(state.q ?? 0) & mask) >>> 0;

  const resetKind = resolveResetKind(config);
  const resetPolarity = resolvePolarity(config.resetPolarity, 'active_high');
  const enablePolarity = resolvePolarity(config.enablePolarity, 'active_high');
  const clockEdge = resolveClockEdge(config);

  // The configuration is the authority for EN and RST, as in the exported VHDL
  // (emitRegisterVhdl): a pin it disables is not read, wired or not. Without Clock enable the
  // register captures at every active edge whatever EN carries and whatever its polarity says.
  const resetActive = isPinUsed(REGISTER_RESET_PIN, config)
    && toBit(readPin(inputs, REGISTER_RESET_PIN)) === REGISTER_RESET_PIN.activeLevel!(config);
  const enableActive = !isPinUsed(REGISTER_ENABLE_PIN, config)
    || toBit(readPin(inputs, REGISTER_ENABLE_PIN)) === REGISTER_ENABLE_PIN.activeLevel!(config);
  const clkBit = toBit(clk);
  const edgeDetected =
    clockEdge === 'rising_edge'
      ? lastClk === 0 && clkBit === 1
      : lastClk === 1 && clkBit === 0;

  if (resetKind === 'async_clear' && resetActive) {
    q = 0;
  } else if (resetKind === 'async_preset' && resetActive) {
    q = mask;
  } else if (edgeDetected) {
    if (resetKind === 'sync_reset' && resetActive) {
      q = 0;
    } else if (resetKind === 'sync_set' && resetActive) {
      q = mask;
    } else if (enableActive) {
      q = dPacked & mask;
    }
  }

  const outputs = buildRegisterOutputs(q, width, nodeType === 'Register1');
  const bankBits = Array.from({ length: width }, (_value, index) => ((q >> index) & 1) as 0 | 1);

  return {
    outputs,
    state: {
      ...state,
      q,
      width,
      lastClk: clkBit,
      bankBits,
      bankValue: q,
      resetKind,
      resetPolarity,
      clockPolarity: clockEdge,
      enablePolarity,
    },
  };
}

/**
 * D Flip-Flop - edge-triggered storage element
 * Inputs: D, CLK, optional EN, optional RST/CLR/RESET
 * Outputs: Q, Q_inv (plus compatibility aliases)
 */
export const DFlipFlopBehavior: NodeBehavior = {
  evaluate(inputs, state) {
    const d = readPin(inputs, D_PIN);
    const clk = readPin(inputs, CLOCK_PIN);
    const rst = readPin(inputs, DFF_RESET_PIN);
    const en = readPin(inputs, DFF_ENABLE_PIN);
    const lastClk = (state.lastClk ?? 0) as number;
    let q = (state.q ?? 0) as number;

    if (rst === 1) {
      q = 0;
    } else if (lastClk === 0 && clk === 1 && en === 1) {
      q = d === 0 ? 0 : 1;
    }

    return {
      outputs: sequentialOutputs(q),
      state: { q, lastClk: clk },
    };
  },
};

/**
 * Register-family aliases:
 * - Register1: scalar register primitive
 * - RegisterBus / StateBank: width/grouping metadata variants that currently
 *   share DFF runtime semantics per bit.
 */
export const Register1Behavior: NodeBehavior = {
  evaluate(inputs, state, config) {
    return evaluateRegisterFamily(inputs, state, config, 'Register1');
  },
};
export const RegisterBusBehavior: NodeBehavior = {
  evaluate(inputs, state, config) {
    return evaluateRegisterFamily(inputs, state, config, 'RegisterBus');
  },
};
export const StateBankBehavior: NodeBehavior = {
  evaluate(inputs, state, config) {
    return evaluateRegisterFamily(inputs, state, config, 'StateBank');
  },
};

/**
 * T Flip-Flop - edge-triggered toggle flip-flop
 * Inputs: T, CLK, optional CLR
 * Outputs: Q, Q_inv (plus compatibility aliases)
 */
export const TFlipFlopBehavior: NodeBehavior = {
  evaluate(inputs, state) {
    const t = readPin(inputs, T_PIN);
    const clk = readPin(inputs, CLOCK_PIN);
    const clr = readPin(inputs, CLEAR_PIN);
    const lastClk = (state.lastClk ?? 0) as number;
    let q = (state.q ?? 0) as number;

    if (clr === 1) {
      q = 0;
    } else if (lastClk === 0 && clk === 1 && t === 1) {
      q = q === 0 ? 1 : 0;
    }

    return {
      outputs: sequentialOutputs(q),
      state: { q, lastClk: clk },
    };
  },
};

/**
 * JK Flip-Flop - edge-triggered JK storage element
 * Inputs: J, K, CLK, optional CLR
 * Outputs: Q, Q_inv (plus compatibility aliases)
 */
export const JKFlipFlopBehavior: NodeBehavior = {
  evaluate(inputs, state) {
    const j = readPin(inputs, J_PIN);
    const k = readPin(inputs, K_PIN);
    const clk = readPin(inputs, CLOCK_PIN);
    const clr = readPin(inputs, CLEAR_PIN);
    const lastClk = (state.lastClk ?? 0) as number;
    let q = (state.q ?? 0) as number;

    if (clr === 1) {
      q = 0;
    } else if (lastClk === 0 && clk === 1) {
      if (j === 1 && k === 0) q = 1;
      else if (j === 0 && k === 1) q = 0;
      else if (j === 1 && k === 1) q = q === 0 ? 1 : 0;
    }

    return {
      outputs: sequentialOutputs(q),
      state: { q, lastClk: clk },
    };
  },
};

/**
 * INPUT - external input source (state-based)
 */
export const INPUTBehavior: NodeBehavior = {
  evaluate(_inputs, state) {
    const isOn = state.isOn ?? 0;
    return {
      outputs: { out: isOn as Signal },
      state: { isOn },
    };
  },
};

/**
 * OUTPUT - terminal sink (stores input in state)
 */
export const OUTPUTBehavior: NodeBehavior = {
  evaluate(inputs) {
    const input = inputs.in ?? 0;
    return {
      outputs: {},
      state: { isOn: input },
    };
  },
};
