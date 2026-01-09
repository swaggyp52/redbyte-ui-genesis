// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Node, Circuit, Connection } from '@redbyte/rb-logic-core';

/**
 * Creates a test node with required fields populated with defaults.
 * This ensures TypeScript compatibility with the Node interface.
 */
export function createTestNode(
  id: string,
  type: string,
  position: { x: number; y: number } = { x: 0, y: 0 },
  overrides: Partial<Omit<Node, 'id' | 'type' | 'position'>> = {}
): Node {
  return {
    id,
    type,
    position,
    rotation: overrides.rotation ?? 0,
    config: overrides.config ?? {},
    ...(overrides.state !== undefined ? { state: overrides.state } : {}),
  };
}

/**
 * Creates a test circuit with nodes that have all required fields.
 */
export function createTestCircuit(
  nodes: Array<{ id: string; type: string; position?: { x: number; y: number } }>,
  connections: Connection[] = []
): Circuit {
  return {
    nodes: nodes.map((n) =>
      createTestNode(n.id, n.type, n.position ?? { x: 0, y: 0 })
    ),
    connections,
  };
}
