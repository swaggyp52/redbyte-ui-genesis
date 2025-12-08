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

  // Normalize version to number (handle both "v1", "1", and 1)
  const version = typeof data.version === 'string'
    ? parseInt(data.version.replace(/^v/, ''), 10)
    : data.version;

  if (version !== 1 && !isNaN(version)) {
    throw new Error(`Unsupported circuit version: ${data.version}`);
  }

  // Safely handle potentially malformed data by defaulting to empty arrays
  const nodes = Array.isArray(data.nodes) ? data.nodes : [];
  const connections = Array.isArray(data.connections) ? data.connections : [];

  return {
    nodes: nodes.map(node => ({
      id: node.id,
      type: node.type,
      position: { ...node.position },
      rotation: node.rotation,
      config: { ...node.config },
      state: node.state ? { ...node.state } : undefined,
    })),
    connections: connections.map(conn => ({
      from: { ...conn.from },
      to: { ...conn.to },
    })),
  };
}
