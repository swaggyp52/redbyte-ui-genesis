// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Circuit Adapter — Boundary Module
 *
 * CRITICAL: ONLY this file is allowed to translate between legacy circuit types
 * and CircuitV1. This prevents "conversion code everywhere" and ensures a clean
 * migration path.
 *
 * Rule: No other file may perform circuit type conversions.
 */

import type { Circuit, Node, Connection as LegacyConnection } from '@redbyte/rb-logic-core';
import type { CircuitV1, CircuitNode, CircuitConnection } from '@redbyte/rb-utils/labProjectSchema';

// ============================================================================
// Legacy → CircuitV1 Conversion
// ============================================================================

/**
 * Convert legacy Circuit to canonical CircuitV1.
 * Used when migrating old projects to lab engine.
 */
export function fromLegacyCircuit(legacy: Circuit): CircuitV1 {
  return {
    schemaVersion: '1.0',
    nodes: legacy.nodes.map(fromLegacyNode),
    connections: legacy.connections.map(fromLegacyConnection),
    customChips: [], // Legacy doesn't have custom chips
  };
}

function fromLegacyNode(node: Node): CircuitNode {
  return {
    id: node.id,
    type: node.type,
    x: node.position.x,
    y: node.position.y,
    rotation: node.rotation ?? 0,
    params: node.config ?? {},
    label: undefined, // Legacy doesn't have labels
    state: node.state ?? {},
  };
}

function fromLegacyConnection(conn: LegacyConnection): CircuitConnection {
  return {
    id: `${conn.from.nodeId}:${conn.from.portName}->${conn.to.nodeId}:${conn.to.portName}`,
    fromNodeId: conn.from.nodeId,
    fromPin: conn.from.portName,
    toNodeId: conn.to.nodeId,
    toPin: conn.to.portName,
  };
}

// ============================================================================
// CircuitV1 → Legacy Conversion (Temporary — Remove after full migration)
// ============================================================================

/**
 * Convert CircuitV1 back to legacy Circuit.
 * ONLY use this during migration period when legacy code still exists.
 * Remove this function once all apps use CircuitV1 directly.
 */
export function toLegacyCircuit(circuit: CircuitV1): Circuit {
  return {
    nodes: circuit.nodes.map(toLegacyNode),
    connections: circuit.connections.map(toLegacyConnection),
  };
}

function toLegacyNode(node: CircuitNode): Node {
  return {
    id: node.id,
    type: node.type,
    position: { x: node.x, y: node.y },
    rotation: node.rotation ?? 0,
    config: (node.params ?? {}) as Record<string, any>,
    state: (node.state ?? {}) as Record<string, any>,
  };
}

function toLegacyConnection(conn: CircuitConnection): LegacyConnection {
  return {
    from: {
      nodeId: conn.fromNodeId,
      portName: conn.fromPin,
    },
    to: {
      nodeId: conn.toNodeId,
      portName: conn.toPin,
    },
  };
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate CircuitV1 structure.
 * Returns true if circuit is valid, throws Error otherwise.
 */
export function validateCircuitV1(circuit: CircuitV1): boolean {
  if (circuit.schemaVersion !== '1.0') {
    throw new Error(`Unsupported circuit schema version: ${circuit.schemaVersion}`);
  }

  if (!Array.isArray(circuit.nodes)) {
    throw new Error('Circuit nodes must be an array');
  }

  if (!Array.isArray(circuit.connections)) {
    throw new Error('Circuit connections must be an array');
  }

  // Validate node IDs are unique
  const nodeIds = new Set<string>();
  for (const node of circuit.nodes) {
    if (nodeIds.has(node.id)) {
      throw new Error(`Duplicate node ID: ${node.id}`);
    }
    nodeIds.add(node.id);
  }

  // Validate connections reference existing nodes
  for (const conn of circuit.connections) {
    if (!nodeIds.has(conn.fromNodeId)) {
      throw new Error(`Connection references non-existent node: ${conn.fromNodeId}`);
    }
    if (!nodeIds.has(conn.toNodeId)) {
      throw new Error(`Connection references non-existent node: ${conn.toNodeId}`);
    }
  }

  return true;
}
