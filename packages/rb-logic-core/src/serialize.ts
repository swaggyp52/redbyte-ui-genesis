import type {
  Circuit,
  CircuitSchemaV1,
  CircuitSchemaV1Node,
  RuntimeNode
} from "./types";

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
    connections: circuit.connections.map((c) => ({
      id: c.id,
      from: { ...c.from },
      to: { ...c.to },
    })),
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
