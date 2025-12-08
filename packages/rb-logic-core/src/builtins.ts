// Copyright © 2025 Connor Angel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
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
 */
export const LampBehavior: NodeBehavior = {
  evaluate(inputs) {
    const input = inputs.in ?? 0;
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
    const a = inputs.a ?? 0;
    const b = inputs.b ?? 0;
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
    const a = inputs.a ?? 0;
    const b = inputs.b ?? 0;
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
    const a = inputs.a ?? 0;
    const b = inputs.b ?? 0;
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
    const a = inputs.a ?? 0;
    const b = inputs.b ?? 0;
    return {
      outputs: { out: (a !== b ? 1 : 0) as Signal },
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
