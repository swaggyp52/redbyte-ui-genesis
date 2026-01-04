// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit, Connection, PortRef } from '@redbyte/rb-logic-core';
import type { ChipMetadata } from '../components/NodeView';

/**
 * Determine if a port is an input or output based on naming convention and metadata
 */
export function isInputPort(
  nodeId: string,
  portName: string,
  circuit: Circuit,
  getChipMetadata?: (nodeType: string) => ChipMetadata | undefined
): boolean {
  const node = circuit.nodes.find(n => n.id === nodeId);
  if (!node) return false;

  // Check chip metadata first
  if (getChipMetadata) {
    const chipMeta = getChipMetadata(node.type);
    if (chipMeta) {
      return chipMeta.inputs.some(input => input.id === portName);
    }
  }

  // Fallback to naming convention
  // Most nodes use "in", "in1", "in2" for inputs and "out" for outputs
  return portName.startsWith('in');
}

/**
 * Check if a connection would be valid
 */
export function isValidConnection(
  from: PortRef,
  to: PortRef,
  circuit: Circuit,
  getChipMetadata?: (nodeType: string) => ChipMetadata | undefined
): { valid: boolean; reason?: string } {
  // Prevent self-loops
  if (from.nodeId === to.nodeId) {
    return { valid: false, reason: 'Cannot connect node to itself' };
  }

  // Check if connection already exists
  const duplicate = circuit.connections.some(
    conn =>
      (conn.from.nodeId === from.nodeId &&
        conn.from.portName === from.portName &&
        conn.to.nodeId === to.nodeId &&
        conn.to.portName === to.portName) ||
      (conn.from.nodeId === to.nodeId &&
        conn.from.portName === to.portName &&
        conn.to.nodeId === from.nodeId &&
        conn.to.portName === from.portName)
  );

  if (duplicate) {
    return { valid: false, reason: 'Connection already exists' };
  }

  // Determine port directions
  const fromIsInput = isInputPort(from.nodeId, from.portName, circuit, getChipMetadata);
  const toIsInput = isInputPort(to.nodeId, to.portName, circuit, getChipMetadata);

  // Prevent input->input or output->output connections
  if (fromIsInput === toIsInput) {
    if (fromIsInput) {
      return { valid: false, reason: 'Cannot connect input to input' };
    } else {
      return { valid: false, reason: 'Cannot connect output to output' };
    }
  }

  // Valid connection
  return { valid: true };
}

/**
 * Normalize connection to always go from output to input
 */
export function normalizeConnection(
  from: PortRef,
  to: PortRef,
  circuit: Circuit,
  getChipMetadata?: (nodeType: string) => ChipMetadata | undefined
): Connection {
  const fromIsInput = isInputPort(from.nodeId, from.portName, circuit, getChipMetadata);

  // If from is input and to is output, swap them
  if (fromIsInput) {
    return { from: to, to: from };
  }

  // Otherwise keep as-is (from is output, to is input)
  return { from, to };
}
