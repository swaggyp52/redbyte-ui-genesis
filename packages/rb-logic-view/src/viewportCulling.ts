import type { Node } from '@redbyte/rb-logic-core';
import type { Camera } from './useLogicViewStore';
import type { GeometryIndexEntry } from './symbols/portGeometry';
import { getNodePosition } from './tools/nodePosition';

/** World-space rendering bounds; selection still uses the full circuit. */
export function getCanvasViewBounds(
  camera: Pick<Camera, 'x' | 'y' | 'zoom'>,
  width: number,
  height: number,
  margin = 200
) {
  const left = (-camera.x) / camera.zoom - margin;
  const top = (-camera.y) / camera.zoom - margin;
  const right = (width - camera.x) / camera.zoom + margin;
  const bottom = (height - camera.y) / camera.zoom + margin;
  return { left, top, right, bottom };
}

/** The canvas's render-only projection; never removes nodes from the source. */
export function getVisibleCanvasNodes(
  nodes: Node[],
  bounds: ReturnType<typeof getCanvasViewBounds>,
  geometryIndex?: ReadonlyMap<string, GeometryIndexEntry> | null
): Node[] {
  return nodes.map((node) => {
    // Preserve the canvas's origin fallback without changing the source node.
    if (!node.position) return { ...node, position: { x: 0, y: 0 } };
    return node;
  }).filter((node) => {
    const x = getNodePosition(node).x;
    const y = getNodePosition(node).y;
    const entry = geometryIndex?.get(node.id);
    if (entry) {
      // A wide module remains visible while any part of its symbol is on screen.
      const b = entry.geometry.bounds;
      return x + b.maxX >= bounds.left && x + b.minX <= bounds.right && y + b.maxY >= bounds.top && y + b.minY <= bounds.bottom;
    }
    return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
  });
}
