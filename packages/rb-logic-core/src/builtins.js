// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * PowerSource - Always outputs 1
 */
export const PowerSourceBehavior = {
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
export const SwitchBehavior = {
    evaluate(_inputs, state) {
        const isOn = state.isOn ?? 0;
        return {
            outputs: { out: isOn },
            state: { isOn },
        };
    },
};
/**
 * Lamp - Displays input state (passive)
 */
export const LampBehavior = {
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
export const WireBehavior = {
    evaluate(inputs) {
        const input = inputs.in ?? 0;
        return {
            outputs: { out: input },
            state: {},
        };
    },
};
/**
 * AND gate
 */
export const ANDBehavior = {
    evaluate(inputs) {
        // Support both 'a'/'b' and 'in1'/'in2' naming conventions
        const in1 = inputs.in1 ?? inputs.a ?? 0;
        const in2 = inputs.in2 ?? inputs.b ?? 0;
        return {
            outputs: { out: (in1 && in2 ? 1 : 0) },
            state: {},
        };
    },
};
/**
 * OR gate
 */
export const ORBehavior = {
    evaluate(inputs) {
        // Support both 'a'/'b' and 'in1'/'in2' naming conventions
        const in1 = inputs.in1 ?? inputs.a ?? 0;
        const in2 = inputs.in2 ?? inputs.b ?? 0;
        return {
            outputs: { out: (in1 || in2 ? 1 : 0) },
            state: {},
        };
    },
};
/**
 * NOT gate
 */
export const NOTBehavior = {
    evaluate(inputs) {
        const input = inputs.in ?? 0;
        return {
            outputs: { out: (input ? 0 : 1) },
            state: {},
        };
    },
};
/**
 * NAND gate
 */
export const NANDBehavior = {
    evaluate(inputs) {
        // Support both 'a'/'b' and 'in1'/'in2' naming conventions
        const in1 = inputs.in1 ?? inputs.a ?? 0;
        const in2 = inputs.in2 ?? inputs.b ?? 0;
        return {
            outputs: { out: (in1 && in2 ? 0 : 1) },
            state: {},
        };
    },
};
/**
 * XOR gate
 */
export const XORBehavior = {
    evaluate(inputs) {
        // Support both 'a'/'b' and 'in1'/'in2' naming conventions
        const in1 = inputs.in1 ?? inputs.a ?? 0;
        const in2 = inputs.in2 ?? inputs.b ?? 0;
        return {
            outputs: { out: (in1 !== in2 ? 1 : 0) },
            state: {},
        };
    },
};
/**
 * Clock - Periodic oscillator
 * config.period: number of ticks per cycle (default 10)
 */
export const ClockBehavior = {
    evaluate(_inputs, state, config) {
        const period = config.period ?? 10;
        const tickCount = state.tickCount ?? 0;
        const halfPeriod = Math.floor(period / 2);
        const isHigh = (tickCount % period) < halfPeriod;
        return {
            outputs: { out: (isHigh ? 1 : 0) },
            state: { tickCount: tickCount + 1 },
        };
    },
};
/**
 * Delay - Fixed tick buffer
 * config.delay: number of ticks to delay (default 1)
 */
export const DelayBehavior = {
    evaluate(inputs, state, config) {
        const delay = config.delay ?? 1;
        const input = inputs.in ?? 0;
        const buffer = state.buffer ?? [];
        // Output is the oldest value (or 0 if buffer not full yet)
        const output = buffer.length >= delay ? buffer[0] : 0;
        // Add current input to buffer
        buffer.push(input);
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
 * INPUT - external input source (state-based)
 */
export const INPUTBehavior = {
    evaluate(_inputs, state) {
        const isOn = state.isOn ?? 0;
        return {
            outputs: { out: isOn },
            state: { isOn },
        };
    },
};
/**
 * OUTPUT - terminal sink (stores input in state)
 */
export const OUTPUTBehavior = {
    evaluate(inputs) {
        const input = inputs.in ?? 0;
        return {
            outputs: {},
            state: { isOn: input },
        };
    },
};
