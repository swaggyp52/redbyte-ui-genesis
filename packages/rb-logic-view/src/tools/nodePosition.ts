import type { Node, Position } from '@redbyte/rb-logic-core';

/** Match the canvas's origin fallback without changing the source circuit. */
export function getNodePosition(node: Node): Position {
  return node.position ?? { x: 0, y: 0 };
}
