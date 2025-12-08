import type { Circuit, SerializedCircuitV1 } from './types';

/**
 * Serialize a circuit to JSON format (V1)
 */
export function serialize(circuit: Circuit): SerializedCircuitV1 {
  return {
    version: 1,
    nodes: circuit.nodes.map(node => ({
      id: node.id,
      type: node.type,
      position: { ...node.position },
      rotation: node.rotation,
      config: { ...node.config },
      state: node.state ? { ...node.state } : undefined,
    })),
    connections: circuit.connections.map(conn => ({
      from: { ...conn.from },
      to: { ...conn.to },
    })),
  };
}

/**
 * Deserialize a circuit from JSON format
 */
export function deserialize(json: SerializedCircuitV1 | string): Circuit {
  const data: SerializedCircuitV1 = typeof json === 'string' ? JSON.parse(json) : json;

  if (data.version !== 1) {
    throw new Error(`Unsupported circuit version: ${data.version}`);
  }

  // Validate that nodes and connections are arrays
  if (!Array.isArray(data.nodes)) {
    throw new Error('Invalid circuit data: nodes must be an array');
  }
  if (!Array.isArray(data.connections)) {
    throw new Error('Invalid circuit data: connections must be an array');
  }

  return {
    nodes: data.nodes.map(node => ({
      id: node.id,
      type: node.type,
      position: { ...node.position },
      rotation: node.rotation,
      config: { ...node.config },
      state: node.state ? { ...node.state } : undefined,
    })),
    connections: data.connections.map(conn => ({
      from: { ...conn.from },
      to: { ...conn.to },
    })),
  };
}
