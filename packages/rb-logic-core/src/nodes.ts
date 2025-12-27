// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { registerNode } from "./registry";
import type { LogicValue, RuntimeNode } from "./types";

/** Power source: always outputs 1 */
registerNode({
  type: "PowerSource",
  update() {
    return { out: 1 };
  },
});

/** Wire: forwards input to output */
registerNode({
  type: "Wire",
  update(_node, inputs) {
    return { out: inputs["in"] ?? 0 };
  },
});

/** Lamp: same behavior as wire (UI handles display) */
registerNode({
  type: "Lamp",
  update(_node, inputs) {
    return { out: inputs["in"] ?? 0 };
  },
});

/** Clock: outputs pattern 1,1,0,0 repeating */
registerNode({
  type: "Clock",
  update(_node, _inputs, _dt, tickIndex) {
    const phase = tickIndex % 4;
    return { out: phase < 2 ? 1 : 0 };
  },
});

/** Delay: shift register behavior */
registerNode({
  type: "Delay",
  update(node, inputs) {
    const steps = (node.config?.steps ?? 2) | 0;
    if (!node.state) node.state = new Array(steps).fill(0);

    const input = inputs["in"] ?? 0;

    // shift: pop last ? output, push new input at front
    const oldOutput = node.state[steps - 1];
    for (let i = steps - 1; i > 0; i--) {
      node.state[i] = node.state[i - 1];
    }
    node.state[0] = input;

    return { out: oldOutput };
  },
});

/** Switch: toggleable input (state-based) */
registerNode({
  type: "Switch",
  update(node) {
    const isOn = node.state?.isOn ?? 0;
    return { out: isOn as LogicValue };
  },
});

/** AND gate: outputs 1 only if both inputs are 1 */
registerNode({
  type: "AND",
  update(_node, inputs) {
    const a = inputs["a"] ?? inputs["in1"] ?? 0;
    const b = inputs["b"] ?? inputs["in2"] ?? 0;
    return { out: (a && b ? 1 : 0) as LogicValue };
  },
});

/** OR gate: outputs 1 if either input is 1 */
registerNode({
  type: "OR",
  update(_node, inputs) {
    const a = inputs["a"] ?? inputs["in1"] ?? 0;
    const b = inputs["b"] ?? inputs["in2"] ?? 0;
    return { out: (a || b ? 1 : 0) as LogicValue };
  },
});

/** NOT gate: inverts the input */
registerNode({
  type: "NOT",
  update(_node, inputs) {
    const input = inputs["in"] ?? 0;
    return { out: (input ? 0 : 1) as LogicValue };
  },
});

/** NAND gate: NOT AND */
registerNode({
  type: "NAND",
  update(_node, inputs) {
    const a = inputs["a"] ?? inputs["in1"] ?? 0;
    const b = inputs["b"] ?? inputs["in2"] ?? 0;
    return { out: (a && b ? 0 : 1) as LogicValue };
  },
});

/** NOR gate: NOT OR */
registerNode({
  type: "NOR",
  update(_node, inputs) {
    const a = inputs["a"] ?? inputs["in1"] ?? 0;
    const b = inputs["b"] ?? inputs["in2"] ?? 0;
    return { out: (a || b ? 0 : 1) as LogicValue };
  },
});

/** XOR gate: outputs 1 if inputs are different */
registerNode({
  type: "XOR",
  update(_node, inputs) {
    const a = inputs["a"] ?? inputs["in1"] ?? 0;
    const b = inputs["b"] ?? inputs["in2"] ?? 0;
    return { out: (a !== b ? 1 : 0) as LogicValue };
  },
});

/** XNOR gate: outputs 1 if inputs are the same */
registerNode({
  type: "XNOR",
  update(_node, inputs) {
    const a = inputs["a"] ?? inputs["in1"] ?? 0;
    const b = inputs["b"] ?? inputs["in2"] ?? 0;
    return { out: (a === b ? 1 : 0) as LogicValue };
  },
});

/** INPUT: same as Switch - toggleable input */
registerNode({
  type: "INPUT",
  update(node) {
    const isOn = node.state?.isOn ?? 0;
    return { out: isOn as LogicValue };
  },
});

/** OUTPUT: same as Lamp - displays input state */
registerNode({
  type: "OUTPUT",
  update(_node, inputs) {
    return { out: inputs["in"] ?? 0 };
  },
});
