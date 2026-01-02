// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { LogicValue, RuntimeNode, NodeDefinition } from "./types";
import type { NodeRegistry } from "./registry";

/**
 * Register all builtin node definitions into a registry
 * This function is called by createDefaultNodeRegistry() and should not trigger side effects on import
 */
export function registerBuiltinNodeDefinitions(registry: NodeRegistry): void {
  /** Power source: always outputs 1 */
  registry.register({
    type: "PowerSource",
    update() {
      return { out: 1 };
    },
  });

  /** POWER: alias for PowerSource */
  registry.register({
    type: "POWER",
    update() {
      return { out: 1 };
    },
  });

  /** Wire: forwards input to output */
  registry.register({
    type: "Wire",
    update(_node, inputs) {
      return { out: inputs["in"] ?? 0 };
    },
  });

  /** Lamp: same behavior as wire (UI handles display) */
  registry.register({
    type: "Lamp",
    update(_node, inputs) {
      return { out: inputs["in"] ?? 0 };
    },
  });

  /** LAMP: alias for Lamp */
  registry.register({
    type: "LAMP",
    update(_node, inputs) {
      return { out: inputs["in"] ?? 0 };
    },
  });

  /** Clock: outputs pattern 1,1,0,0 repeating */
  registry.register({
    type: "Clock",
    update(_node, _inputs, _dt, tickIndex) {
      const phase = tickIndex % 4;
      return { out: phase < 2 ? 1 : 0 };
    },
  });

  /** Delay: shift register behavior */
  registry.register({
    type: "Delay",
    update(node, inputs) {
      const steps = (node.config?.steps ?? 2) | 0;
      if (!node.state) node.state = new Array(steps).fill(0);

      const input = inputs["in"] ?? 0;

      // shift: pop last → output, push new input at front
      const oldOutput = node.state[steps - 1];
      for (let i = steps - 1; i > 0; i--) {
        node.state[i] = node.state[i - 1];
      }
      node.state[0] = input;

      return { out: oldOutput };
    },
  });

  /** Switch: toggleable input (state-based) */
  registry.register({
    type: "Switch",
    update(node) {
      const isOn = node.state?.isOn ?? 0;
      return { out: isOn as LogicValue };
    },
  });

  /** SWITCH: alias for Switch */
  registry.register({
    type: "SWITCH",
    update(node) {
      const isOn = node.state?.isOn ?? 0;
      return { out: isOn as LogicValue };
    },
  });

  /** AND gate: outputs 1 only if both inputs are 1 */
  registry.register({
    type: "AND",
    update(_node, inputs) {
      const a = inputs["a"] ?? inputs["in1"] ?? 0;
      const b = inputs["b"] ?? inputs["in2"] ?? 0;
      return { out: (a && b ? 1 : 0) as LogicValue };
    },
  });

  /** OR gate: outputs 1 if either input is 1 */
  registry.register({
    type: "OR",
    update(_node, inputs) {
      const a = inputs["a"] ?? inputs["in1"] ?? 0;
      const b = inputs["b"] ?? inputs["in2"] ?? 0;
      return { out: (a || b ? 1 : 0) as LogicValue };
    },
  });

  /** NOT gate: inverts the input */
  registry.register({
    type: "NOT",
    update(_node, inputs) {
      const input = inputs["in"] ?? 0;
      return { out: (input ? 0 : 1) as LogicValue };
    },
  });

  /** NAND gate: NOT AND */
  registry.register({
    type: "NAND",
    update(_node, inputs) {
      const a = inputs["a"] ?? inputs["in1"] ?? 0;
      const b = inputs["b"] ?? inputs["in2"] ?? 0;
      return { out: (a && b ? 0 : 1) as LogicValue };
    },
  });

  /** NOR gate: NOT OR */
  registry.register({
    type: "NOR",
    update(_node, inputs) {
      const a = inputs["a"] ?? inputs["in1"] ?? 0;
      const b = inputs["b"] ?? inputs["in2"] ?? 0;
      return { out: (a || b ? 0 : 1) as LogicValue };
    },
  });

  /** XOR gate: outputs 1 if inputs are different */
  registry.register({
    type: "XOR",
    update(_node, inputs) {
      const a = inputs["a"] ?? inputs["in1"] ?? 0;
      const b = inputs["b"] ?? inputs["in2"] ?? 0;
      return { out: (a !== b ? 1 : 0) as LogicValue };
    },
  });

  /** XNOR gate: outputs 1 if inputs are the same */
  registry.register({
    type: "XNOR",
    update(_node, inputs) {
      const a = inputs["a"] ?? inputs["in1"] ?? 0;
      const b = inputs["b"] ?? inputs["in2"] ?? 0;
      return { out: (a === b ? 1 : 0) as LogicValue };
    },
  });

  /** INPUT: same as Switch - toggleable input */
  registry.register({
    type: "INPUT",
    update(node) {
      const isOn = node.state?.isOn ?? 0;
      return { out: isOn as LogicValue };
    },
  });

  /** OUTPUT: same as Lamp - displays input state */
  registry.register({
    type: "OUTPUT",
    update(_node, inputs) {
      return { out: inputs["in"] ?? 0 };
    },
  });

  /** D_FLIP_FLOP: edge-triggered memory element */
  registry.register({
    type: "D_FLIP_FLOP",
    update(node, inputs) {
      const d = inputs["d"] ?? inputs["D"] ?? 0;
      const clk = inputs["clk"] ?? inputs["clock"] ?? inputs["CLK"] ?? 0;
      const prevClk = node.state?.prevClk ?? 0;

      // Rising edge detection
      if (clk === 1 && prevClk === 0) {
        node.state = { q: d, prevClk: clk };
        return { q: d, qBar: d ? 0 : 1 };
      }

      // No edge, maintain state
      const q = node.state?.q ?? 0;
      node.state = { ...node.state, prevClk: clk };
      return { q, qBar: q ? 0 : 1 };
    },
  });
}
