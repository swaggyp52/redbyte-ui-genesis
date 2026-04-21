// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { NodeBehavior, Signal, NodeInputs, NodeOutputs } from './types';

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
 * AND3 gate — 3-input AND
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

function isActive(level: number, polarity: ActivePolarity): boolean {
  const bit = toBit(level);
  return polarity === 'active_high' ? bit === 1 : bit === 0;
}

function readPackedInput(
  inputs: NodeInputs,
  width: number,
  base: string
): number {
  const direct = inputs[base];
  if (typeof direct === 'number') {
    return (Math.floor(direct) & maskForWidth(width)) >>> 0;
  }

  let packed = 0;
  for (let index = 0; index < width; index += 1) {
    const bit = readFirstNumber(
      inputs,
      [
        `${base}[${index}]`,
        `${base}${index}`,
        `${base}_${index}`,
      ],
      0
    );
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

function evaluateRegisterFamily(
  inputs: NodeInputs,
  state: Record<string, any>,
  config: Record<string, any>,
  nodeType: 'Register1' | 'RegisterBus' | 'StateBank'
): { outputs: NodeOutputs; state: Record<string, any> } {
  const widthDefault = nodeType === 'Register1' ? 1 : nodeType === 'RegisterBus' ? 8 : 8;
  const width = normalizeWidth(config.width, widthDefault);
  const mask = maskForWidth(width);

  const clk = readFirstNumber(inputs, ['CLK', 'clk', 'clock', 'C']);
  const rst = readFirstNumber(inputs, ['RST', 'rst', 'RESET', 'reset', 'CLR', 'clr', 'SET', 'set'], 0);
  const enFallback = config.hasEnable === true ? 0 : 1;
  const en = readFirstNumber(inputs, ['EN', 'en', 'ENABLE', 'enable', 'CE', 'ce'], enFallback);
  const dPacked =
    nodeType === 'Register1'
      ? toBit(readFirstNumber(inputs, ['D', 'd', 'in']))
      : readPackedInput(inputs, width, 'D');
  const lastClk = toBit(Number(state.lastClk ?? 0));
  let q = (Number(state.q ?? 0) & mask) >>> 0;

  const resetKind = resolveResetKind(config);
  const resetPolarity = resolvePolarity(config.resetPolarity, 'active_high');
  const enablePolarity = resolvePolarity(config.enablePolarity, 'active_high');
  const clockEdge = resolveClockEdge(config);

  const resetActive = isActive(rst, resetPolarity);
  const enableActive = isActive(en, enablePolarity);
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
    const d = readFirstNumber(inputs, ['D', 'd', 'in']);
    const clk = readFirstNumber(inputs, ['CLK', 'clk', 'clock', 'C']);
    const rst = readFirstNumber(inputs, ['RST', 'rst', 'RESET', 'reset', 'CLR', 'clr'], 0);
    const en = readFirstNumber(inputs, ['EN', 'en', 'ENABLE', 'enable'], 1);
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
    const t = readFirstNumber(inputs, ['T', 't', 'in']);
    const clk = readFirstNumber(inputs, ['CLK', 'clk', 'clock', 'C']);
    const clr = readFirstNumber(inputs, ['CLR', 'clr', 'RST', 'rst', 'RESET', 'reset'], 0);
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
    const j = readFirstNumber(inputs, ['J', 'j'], 0);
    const k = readFirstNumber(inputs, ['K', 'k'], 0);
    const clk = readFirstNumber(inputs, ['CLK', 'clk', 'clock', 'C']);
    const clr = readFirstNumber(inputs, ['CLR', 'clr', 'RST', 'rst', 'RESET', 'reset'], 0);
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
 