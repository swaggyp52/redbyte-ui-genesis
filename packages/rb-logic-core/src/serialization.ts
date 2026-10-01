// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit, Connection, PortRef, SerializedCircuitV1 } from './types';

/** Historical object endpoints may identify the port with either name. */
type ConnectionEndpointInput = string | { nodeId: string; portName?: string; port?: string };

export type ConnectionInput = Omit<Connection, 'from' | 'to'> & {
  from: ConnectionEndpointInput;
  to: ConnectionEndpointInput;
};

/** Normalize both historical connection formats with the engine/serialization precedence. */
export function normalizeConnection(conn: ConnectionInput): { from: PortRef; to: PortRef } {
  const from = conn.from;
  const to = conn.to;
  return {
    from: {
      nodeId: typeof from === 'string' ? from : from.nodeId,
      portName: typeof from === 'string'
        ? conn.fromPin ?? conn.fromPort ?? 'out'
        : from.portName ?? from.port ?? conn.fromPin ?? conn.fromPort ?? 'out',
    },
    to: {
      nodeId: typeof to === 'string' ? to : to.nodeId,
      portName: typeof to === 'string'
        ? conn.toPin ?? conn.toPort ?? 'in'
        : to.portName ?? to.port ?? conn.toPin ?? conn.toPort ?? 'in',
    },
  };
}

/**
 * Serialize a circuit to JSON format (V1)
 */
export function serialize(circuit: Circuit): SerializedCircuitV1 {
  return {
    version: 1,
    nodes: circuit.nodes.map(node => {
      const position = node.position ?? { x: 0, y: 0 };
      return {
        id: node.id,
        type: node.type,
        position: { x: position.x, y: position.y },
        rotation: node.rotation ?? 0,
        config: node.config ?? {},
        state: node.state ? { ...node.state } : undefined,
      };
    }),
    connections: circuit.connections.map(conn => {
      const normalized = normalizeConnection(conn);
      return {
        from: { ...normalized.from },
        to: { ...normalized.to },
      };
    }),
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
      const position = node.position;
      const x = position && Number.isFinite(position.x) ? position.x :
                Number.isFinite((node as any).x) ? (node as any).x : 0;
      const y = position && Number.isFinite(position.y) ? position.y :
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
