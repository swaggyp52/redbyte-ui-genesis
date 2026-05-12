/**
 * Canonical converter between internal Circuit format and CircuitV1 (project format).
 * 
 * ✅ RC-P1: This is the ONLY place these conversions should happen.
 * ✅ RC-P2: Explicitly handles position field migration (position > x/y > safe default).
 * 
 * All apps and export paths MUST import from here, never create parallel converters.
 * 
 * CRITICAL INVARIANT: position field is never lost during serialization.
 * If you find code that reads only x/y or ignores position, it's a bug.
 */

import type { Circuit, Node, Connection, PortRef } from './types';
import type { CircuitV1 } from '@redbyte/rb-utils';

/**
 * Convert internal Circuit to CircuitV1 (project/serialization format).
 * 
 * RC-P2 IMPLEMENTATION:
 * - Reads from node.position first (modern format, preferred)
 * - Falls back to legacy node.x/y if position missing
 * - Normalizes to position.x ?? node.x ?? 0 for safe defaults
 * - This ensures positions are never lost during round-trip (RC-P2)
 */
export function toCircuitV1(src: Circuit): CircuitV1 {
  return {
    schemaVersion: '1.0',
    nodes: src.nodes.map((node) => {
      // RC-P2: Prefer position field, fall back to legacy x/y
      const x = node.position?.x ?? node.x ?? 0;
      const y = node.position?.y ?? node.y ?? 0;
      
      return {
        id: node.id,
        type: node.type,
        x,  // Always output x/y for persistence (CircuitV1 schema is x/y)
        y,
        rotation: node.rotation || 0,
        params: node.config || {},
        label: node.label,
        state: node.state || {},
      };
    }),
    connections: src.connections.map((conn, index) => {
      const fromNodeId = typeof conn.from === 'string' ? conn.from : (conn.from as PortRef).nodeId;
      const fromPin =
        conn.fromPin ||
        conn.fromPort ||
        (typeof conn.from === 'string'
          ? undefined
          : (conn.from as PortRef).portName || (conn.from as PortRef).port) ||
        'out';
      const toNodeId = typeof conn.to === 'string' ? conn.to : (conn.to as PortRef).nodeId;
      const toPin =
        conn.toPin ||
        conn.toPort ||
        (typeof conn.to === 'string'
          ? undefined
          : (conn.to as PortRef).portName || (conn.to as PortRef).port) ||
        'in';

      return {
        id: conn.id ?? `conn-${index}-${fromNodeId}-${fromPin}-${toNodeId}-${toPin}`,
        fromNodeId,
        fromPin,
        toNodeId,
        toPin,
      };
    }),
    customChips: [],
  };
}

/**
 * Convert CircuitV1 (project format) to internal Circuit.
 * 
 * RC-P2 IMPLEMENTATION:
 * - Creates position object from CircuitV1 x/y fields (modern format)
 * - Also maintains legacy x/y fields for backward compatibility with old code
 * - Ensures that reading via position OR x/y works (but preference is position)
 */
export function fromCircuitV1(src: CircuitV1): Circuit {
  return {
    nodes: src.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: { x: node.x ?? 0, y: node.y ?? 0 },  // NEW format (preferred)
      x: node.x,                                      // Legacy field (fallback only)
      y: node.y,                                      // Legacy field (fallback only)
      rotation: node.rotation,
      config: node.params || {},
      label: node.label,
      state: node.state || {},
      inputs: {},
      outputs: {},
    })),
    connections: src.connections.map((conn) => ({
      id: conn.id,
      from: { nodeId: conn.fromNodeId, portName: conn.fromPin },
      fromPin: conn.fromPin,
      to: { nodeId: conn.toNodeId, portName: conn.toPin },
      toPin: conn.toPin,
    })),
  };
}
