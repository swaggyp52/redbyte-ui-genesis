// Copyright © 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Metadata registry for node types
 * Single authority for detecting sequential logic, clock ports, and reset ports
 */
import { getComponentSupport } from './componentSupportRegistry';

export interface NodeMeta {
  isSequential?: boolean;
  clockPort?: string;  // e.g., "clk", "CLK"
  resetPort?: string;  // e.g., "rst", "reset"
  note?: string;       // e.g., "clocked_macro v1"
}

/**
 * Get metadata for a node type
 * Returns empty object (defaults to non-sequential) if type not found
 */
export function getNodeMeta(typeString: string): NodeMeta {
  const support = getComponentSupport(typeString);
  if (!support) return {};
  return {
    isSequential: support.isSequential === true,
    clockPort: support.clockPort,
    resetPort: support.resetPort,
    note: support.note,
  };
}

/**
 * Check if a node type is sequential
 */
export function isSequentialNodeType(typeString: string): boolean {
  const meta = getNodeMeta(typeString);
  return meta.isSequential === true;
}

/**
 * Get clock port name for a sequential node type
 */
export function getClockPortName(typeString: string): string | undefined {
  const meta = getNodeMeta(typeString);
  return meta.clockPort;
}

/**
 * Get reset port name for a sequential node type (if any)
 */
export function getResetPortName(typeString: string): string | undefined {
  const meta = getNodeMeta(typeString);
  return meta.resetPort;
}
