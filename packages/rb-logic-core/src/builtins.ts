// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { NodeBehavior, Signal, NodeInputs, NodeOutputs } from './types';

const pickInput = (inputs: NodeInputs, ...candidates: string[]): Signal => {
  for (const name of candidates) {
    const value = inputs[name];
    if (value !== undefined) return value as Signal;
  }
  return 0;
};

const getBinaryInputs = (inputs: NodeInputs): [Signal, Signal] => {
  const left = pickInput(inputs, 'a', 'in1', 'inA', 'in', 'input', 'left');
  const right = pickInput(inputs, 'b', 'in2', 'inB', 'input2', 'right');
  return [left, right];
};

/**
 * INPUT - Source controlled by node.state.isOn
 */
export const INPUTBehavior: NodeBehavior = {
  evaluate(_inputs, state) {
    const isOn = (state.isOn ? 1 : 0) as Signal;
    return {
      outputs: { out: isOn },
      state: { isOn },
    };
  },
};

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
 * Switch - Toggleable input (state-based)
 */
export const SwitchBehavior: NodeBehavior = {
  evaluate(_inputs, state) {
    const isOn = state.isOn ? 1 : 0;
    return {
      outputs: { out: isOn as Signal },
      state: { isOn },
    };
  },
};

/**
 * Lamp - Displays input state (passive)
 */
export const LampBehavior: NodeBehavior = {
  evaluate(inputs) {
    const input = pickInput(inputs, 'in', 'input', 'out');
    return {
      outputs: {},
      state: { isOn: input },
    };
  },
};

/**
 * Wire - Pass-through
 */
export const WireBehavior: NodeBehavior = {
  evaluate(inputs) {
    const input = pickInput(inputs, 'in', 'input', 'out');
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
    const [a, b] = getBinaryInputs(inputs);
    return {
      outputs: { out: (a && b ? 1 : 0) as Signal },
      state: {},
    };
  },
};

/**
 * OR gate
 */
export const ORBehavior: NodeBehavior = {
  evaluate(inputs) {
    const [a, b] = getBinaryInputs(inputs);
    return {
      outputs: { out: (a || b ? 1 : 0) as Signal },
      state: {},
    };
  },
};

/**
 * NOT gate
 */
export const NOTBehavior: NodeBehavior = {
  evaluate(inputs) {
    const input = pickInput(inputs, 'in', 'input');
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
    const [a, b] = getBinaryInputs(inputs);
    return {
      outputs: { out: (a && b ? 0 : 1) as Signal },
      state: {},
    };
  },
};

/**
 * XOR gate
 */
export const XORBehavior: NodeBehavior = {
  evaluate(inputs) {
    const [a, b] = getBinaryInputs(inputs);
    return {
      outputs: { out: (a !== b ? 1 : 0) as Signal },
      state: {},
    };
  },
};

/**
 * OUTPUT - Pass-through sink that surfaces its input for inspection
 */
export const OUTPUTBehavior: NodeBehavior = {
  evaluate(inputs) {
    const input = pickInput(inputs, 'in', 'input', 'out');
    return {
      outputs: { in: input, out: input },
      state: { isOn: input },
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
