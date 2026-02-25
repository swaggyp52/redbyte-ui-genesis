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

/**
 * T Flip-Flop - edge-triggered toggle flip-flop
 * Inputs: T (toggle), CLK (clock)
 * Output: Q (and out for compatibility)
 * Rising edge: if T=1, Q toggles; if T=0, Q holds
 *
 * Implemented as a behavioral node (not structural composite) to avoid
 * the oscillation/race condition inherent in a level-triggered T latch.
 */
export const TFlipFlopBehavior: NodeBehavior = {
  evaluate(inputs, state) {
    const t       = (inputs.T   ?? 0) as number;
    const clk     = (inputs.CLK ?? 0) as number;
    const lastClk = (state.lastClk ?? 0) as number;
    let q         = (state.q     ?? 0) as number;

    // Rising edge: lastClk=0 → clk=1
    if (lastClk === 0 && clk === 1) {
      if (t === 1) q = q === 0 ? 1 : 0;
    }

    return {
      outputs: { Q: q as Signal, out: q as Signal },
      state: { q, lastClk: clk },
    };
  },
};

/**
 * JK Flip-Flop (level-triggered latch)
 * Inputs: J, K, CLK
 * Output: Q (and out for compatibility)
 * When CLK=1: J=1 K=0 → SET, J=0 K=1 → RESET, J=K=1 → TOGGLE, J=K=0 → HOLD
 * When CLK=0: always HOLD
 */
export const JKFlipFlopBehavior: NodeBehavior = {
  evaluate(inputs, state) {
    const j   = (inputs.J   ?? 0) as number;
    const k   = (inputs.K   ?? 0) as number;
    const clk = (inputs.CLK ?? 0) as number;
    let q     = (state.q    ?? 0) as number;

    if (clk === 1) {
      if      (j === 1 && k === 0) q = 1;
      else if (j === 0 && k === 1) q = 0;
      else if (j === 1 && k === 1) q = q === 0 ? 1 : 0;
      // j=0, k=0: hold
    }

    return {
      outputs: { Q: q as Signal, out: q as Signal },
      state: { q },
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
