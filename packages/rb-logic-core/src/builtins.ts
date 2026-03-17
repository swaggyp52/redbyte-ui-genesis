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
