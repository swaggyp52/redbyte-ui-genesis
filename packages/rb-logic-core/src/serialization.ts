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
      // Handle both legacy format (from/to as strings) and new format (from/to with nodeId/portName)
      let from, to;

      if (typeof conn.from === 'string') {
        // Legacy: from is a string node ID
        from = { nodeId: conn.from, portName: (conn as any).fromPort || 'out' };
      } else if (conn.from && typeof conn.from === 'object' && 'nodeId' in conn.from) {
        // New format: from has nodeId and portName
        from = { nodeId: conn.from.nodeId, portName: conn.from.portName };
      } else {
        // Fallback for malformed data
        from = { nodeId: '', portName: 'out' };
      }

      if (typeof conn.to === 'string') {
        // Legacy: to is a string node ID
        to = { nodeId: conn.to, portName: (conn as any).toPort || 'in' };
      } else if (conn.to && typeof conn.to === 'object' && 'nodeId' in conn.to) {
        // New format: to has nodeId and portName
        to = { nodeId: conn.to.nodeId, portName: conn.to.portName };
      } else {
        // Fallback for malformed data
        to = { nodeId: '', portName: 'in' };
      }

      return { from, to };
    }),
  };
}
