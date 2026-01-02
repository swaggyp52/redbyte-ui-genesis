// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { getNodeDefinition } from "./registry";
import type { Circuit, LogicValue } from "./types";

/**
 * Simple tick-based logic engine:
 * - Collect input signals for each node
 * - Call its update() method
 * - Store produced outputs
 */
export class LogicEngine {
  circuit: Circuit;
  signals: Map<string, Map<string, LogicValue>> = new Map();

  constructor(circuit: Circuit) {
    // Ensure circuit has valid arrays (defensive programming)
    this.circuit = {
      nodes: Array.isArray(circuit.nodes) ? circuit.nodes : [],
      connections: Array.isArray(circuit.connections) ? circuit.connections : [],
    };

    // Initialize signal storage for each node
    for (const node of this.circuit.nodes) {
      this.signals.set(node.id, new Map());
    }
  }

  /** Read output value for testing */
  getSignal(nodeId: string, port: string): LogicValue {
    return this.signals.get(nodeId)?.get(port) ?? 0;
  }

  /** Perform one tick */
  tick(dt = 1, tickIndex = 0) {
    const inputMap: Record<string, Record<string, LogicValue>> = {};

    // Build input maps from connections
    for (const conn of this.circuit.connections) {
      const src = this.signals.get(conn.from.nodeId);
      const v = src?.get(conn.from.portName) ?? 0;

      if (!inputMap[conn.to.nodeId]) {
        inputMap[conn.to.nodeId] = {};
      }
      inputMap[conn.to.nodeId][conn.to.portName] = v;
    }

    // Update each node
    for (const node of this.circuit.nodes) {
      const def = getNodeDefinition(node.type);
      const inputs = inputMap[node.id] ?? {};

      const outputs = def.update(node, inputs, dt, tickIndex) ?? {};

      // Store produced outputs
      const sig = this.signals.get(node.id)!;
      for (const [port, value] of Object.entries(outputs)) {
        sig.set(port, value);
      }
    }
  }

  /** Alias required by tests */
  step(dt = 1) {
    this.tick(dt, 0);
  }
}
