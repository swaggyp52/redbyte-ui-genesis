import { registerNode } from "../registry";
import type { LogicValue, RuntimeNode } from "../types";

// PowerSource: always outputs HIGH = 1
registerNode({
  type: "PowerSource",
  inputs: [],
  outputs: ["out"],
  update() {
    return { out: 1 as LogicValue };
  },
});

// Wire: forwards input
registerNode({
  type: "Wire",
  inputs: ["in"],
  outputs: ["out"],
  update(node, inputs) {
    return { out: inputs["in"] ?? 0 };
  },
});

// Lamp: output mirrors input
registerNode({
  type: "Lamp",
  inputs: ["in"],
  outputs: ["out"],
  update(node, inputs) {
    const v = inputs["in"] ?? 0;
    node.state.lit = v;
    return { out: v };
  },
});
