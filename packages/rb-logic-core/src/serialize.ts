// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type {
  Circuit,
  CircuitSchemaV1,
  CircuitSchemaV1Node,
  Connection,
  PortRef,
  RuntimeNode
} from "./types";

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

export function serializeCircuit(circuit: Circuit): CircuitSchemaV1 {
  return {
    version: 1,
    nodes: circuit.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position ? { ...n.position } : undefined,
      rotation: n.rotation,
      config: n.config ? { ...n.config } : undefined,
    })),
    connections: circuit.connections.map((c) => {
      const normalized = normalizeConnection(c);
      return {
        id: c.id,
        from: { ...normalized.from },
        to: { ...normalized.to },
      };
    }),
  };
}

export function deserializeCircuit(schema: CircuitSchemaV1): Circuit {
  if (schema.version !== 1) {
    throw new Error(`Unsupported circuit schema version: ${schema.version}`);
  }

  const nodes: RuntimeNode[] = schema.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position ? { ...n.position } : undefined,
    rotation: n.rotation,
    config: n.config ? { ...n.config } : undefined,
    state: {},
  }));

  return {
    nodes,
    connections: schema.connections.map((c) => ({
      id: c.id,
      from: { ...c.from },
      to: { ...c.to },
    })),
  };
}
