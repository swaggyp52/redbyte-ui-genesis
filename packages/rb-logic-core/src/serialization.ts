// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

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
    nodes: nodes.map(node => {
      // Handle both legacy format (x, y directly on node) and new format (position.x, position.y)
      const x = Number.isFinite(node.position?.x) ? node.position.x :
                Number.isFinite((node as any).x) ? (node as any).x : 0;
      const y = Number.isFinite(node.position?.y) ? node.position.y :
                Number.isFinite((node as any).y) ? (node as any).y : 0;

      return {
        id: node.id,
        type: node.type,
        position: { x, y },
        rotation: node.rotation ?? 0,
        config: node.config ? { ...node.config } : {},
        state: node.state ? { ...node.state } : undefined,
      };
    }),
    connections: connections.map(conn => {
      // Handle both legacy format (from/to as strings or objects with id) and new format (from/to with nodeId/portName)
      const from = typeof conn.from === 'string'
        ? { nodeId: conn.from, portName: (conn as any).fromPort || 'out' }
        : conn.from.nodeId
        ? { nodeId: conn.from.nodeId, portName: conn.from.portName }
        : { nodeId: (conn.from as any).id || '', portName: (conn as any).fromPort || 'out' };

      const to = typeof conn.to === 'string'
        ? { nodeId: conn.to, portName: (conn as any).toPort || 'in' }
        : conn.to.nodeId
        ? { nodeId: conn.to.nodeId, portName: conn.to.portName }
        : { nodeId: (conn.to as any).id || '', portName: (conn as any).toPort || 'in' };

      return { from, to };
    }),
  };
}
