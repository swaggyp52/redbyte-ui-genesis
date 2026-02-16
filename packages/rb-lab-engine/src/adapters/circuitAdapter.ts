// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Circuit Adapter Deprecation Notice
 *
 * RC-P2: This file is DEPRECATED.
 * 
 * All circuit conversions MUST now go through @redbyte/rb-logic-core convertCircuitV1.ts
 * These functions are kept for backward compatibility only but should NOT be used for new code.
 * 
 * Legacy functions below are convenience wrappers to the canonical converters.
 * They exist only to support existing imports in verification code.
 * 
 * RULE: No new code may create circuit converters. Use @redbyte/rb-logic-core only.
 */

import type { Circuit, Node, Connection as LegacyConnection } from '@redbyte/rb-logic-core';
import type { CircuitV1, CircuitNode, CircuitConnection } from '@redbyte/rb-utils';
// RC-P2: Import canonical converters from rb-logic-core
import { toCircuitV1 as canonicalToCircuitV1, fromCircuitV1 as canonicalFromCircuitV1 } from '@redbyte/rb-logic-core';

// ============================================================================
// DEPRECATED: Legacy functions kept for backward compatibility only
// ============================================================================

/**
 * @deprecated RC-P2: Use canonicalToCircuitV1 from @redbyte/rb-logic-core instead.
 * This function is kept for backward compatibility in verification code.
 * 
 * Convert legacy Circuit to canonical CircuitV1.
 * Used when migrating old projects to lab engine.
 */
export function fromLegacyCircuit(legacy: Circuit): CircuitV1 {
  // Wrap with toCircuitV1 since legacy circuits have both position and x/y fields
  return canonicalToCircuitV1(legacy);
}

/**
 * @deprecated RC-P2: Use canonicalFromCircuitV1 from @redbyte/rb-logic-core instead.
 * This function is kept for backward compatibility in verification code.
 * 
 * Convert CircuitV1 back to legacy Circuit.
 * ONLY use during migration period when legacy code still exists.
 * This is now a thin wrapper around the canonical converter.
 */
export function toLegacyCircuit(circuit: CircuitV1): Circuit {
  // Wrap with fromCircuitV1 to get modern position handling
  return canonicalFromCircuitV1(circuit);
}

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
