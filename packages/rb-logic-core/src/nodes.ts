// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
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
