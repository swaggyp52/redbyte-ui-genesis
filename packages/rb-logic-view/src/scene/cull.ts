import type { Point } from '../routing/orthogonalRouter';
import type { Box, CircuitScene } from './circuitScene';

/**
 * Viewport culling by geometry, not by endpoint. A net is visible when any of its segments
 * crosses the view, so a long wire whose two ends are both off-screen is still drawn (the
 * legacy canvas kept a connection only when one of its endpoint nodes was visible).
 */

export function boxesOverlap(a: Box, b: Box): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

/** Liang-Barsky segment/box test; exact for the orthogonal segments the router emits. */
export function segmentIntersectsBox(a: Point, b: Point, box: Box): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  return (
    clip(-dx, a.x - box.minX) &&
    clip(dx, box.maxX - a.x) &&
    clip(-dy, a.y - box.minY) &&
    clip(dy, box.maxY - a.y) &&
    t0 <= t1
  );
}

export interface VisibleScene {
  readonly symbolIds: ReadonlySet<string>;
  readonly netIds: ReadonlySet<string>;
}

export function cullScene(scene: CircuitScene, view: Box, margin = 0): VisibleScene {
  const expanded: Box = { minX: view.minX - margin, minY: view.minY - margin, maxX: view.maxX + margin, maxY: view.maxY + margin };
  const symbolIds = new Set<string>();
  for (const symbol of scene.symbols) if (boxesOverlap(symbol.bounds, expanded)) symbolIds.add(symbol.nodeId);
  const netIds = new Set<string>();
  for (const net of scene.nets) {
    if (net.bounds && !boxesOverlap(net.bounds, expanded)) continue;
    const crosses = net.wires.some((wire) => {
      for (let i = 1; i < wire.points.length; i += 1) if (segmentIntersectsBox(wire.points[i - 1], wire.points[i], expanded)) return true;
      return wire.points.length === 1 && segmentIntersectsBox(wire.points[0], wire.points[0], expanded);
    });
    if (crosses) netIds.add(net.netId);
  }
  return { symbolIds, netIds };
}
