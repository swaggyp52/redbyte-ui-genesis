// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { getNodeDefinition } from "./registry";
import type { Circuit, Connection, LogicValue, PortRef } from "./types";

function normalizeConnection(conn: Connection): { from: PortRef; to: PortRef } {
  const fromIsString = typeof conn.from === "string";
  const toIsString = typeof conn.to === "string";

  const fromNodeId = fromIsString ? conn.from : conn.from.nodeId;
  const toNodeId = toIsString ? conn.to : conn.to.nodeId;

  const fromPortName = fromIsString
    ? conn.fromPin ?? conn.fromPort ?? "out"
    : conn.from.portName ?? conn.from.port ?? conn.fromPin ?? conn.fromPort ?? "out";

  const toPortName = toIsString
    ? conn.toPin ?? conn.toPort ?? "in"
    : conn.to.portName ?? conn.to.port ?? conn.toPin ?? conn.toPort ?? "in";

  return {
    from: { nodeId: fromNodeId, portName: fromPortName },
    to: { nodeId: toNodeId, portName: toPortName },
  };
}

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
      const normalized = normalizeConnection(conn);
      const src = this.signals.get(normalized.from.nodeId);
      const v = src?.get(normalized.from.portName) ?? 0;

      if (!inputMap[normalized.to.nodeId]) {
        inputMap[normalized.to.nodeId] = {};
      }
      inputMap[normalized.to.nodeId][normalized.to.portName] = v;
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
