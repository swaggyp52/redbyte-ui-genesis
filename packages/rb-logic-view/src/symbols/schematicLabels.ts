import type { GeometryIndexEntry } from './portGeometry';
import type { RoutedNet } from '../routing/orthogonalRouter';

export interface SchematicLabel {
  readonly x: number;
  readonly y: number;
  readonly bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

/** Move only a primitive's name within its local margin. Wires, junctions, pins and saved
 * node positions are untouched. Full names remain visible; no opaque label hides a net. */
export function placeSchematicLabels(index: ReadonlyMap<string, GeometryIndexEntry>, nets: readonly RoutedNet[]) {
  const labels = new Map<string, SchematicLabel>();
  const bodies = [...index.values()].map(entry => ({
    minX: entry.x + entry.geometry.body.minX - 3, maxX: entry.x + entry.geometry.body.maxX + 3,
    minY: entry.y + entry.geometry.body.minY - 3, maxY: entry.y + entry.geometry.body.maxY + 3,
  }));
  const overlaps = (a: SchematicLabel['bounds'], b: SchematicLabel['bounds']) =>
    a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
  for (const entry of index.values()) {
    const { geometry } = entry;
    if (!geometry.title || ['io-in', 'io-out', 'clock', 'module', 'block', 'register'].includes(geometry.kind)) continue;
    const halfWidth = geometry.title.length * 4 + 3; // conservative 12.5-unit mono glyphs
    let best: SchematicLabel | undefined;
    let bestScore = Infinity;
    for (const offset of [0, 16, 32, 48, 64]) {
      const y = geometry.body.minY - 6 - offset;
      const bounds = { minX: entry.x - halfWidth, maxX: entry.x + halfWidth, minY: entry.y + y - 13, maxY: entry.y + y + 3 };
      let collisions = bodies.filter(body => overlaps(bounds, body)).length;
      collisions += [...labels.values()].filter(label => overlaps(bounds, label.bounds)).length;
      for (const net of nets) {
        for (const wire of net.wires) for (let i = 1; i < wire.points.length; i++) {
          const a = wire.points[i - 1], b = wire.points[i];
          if (overlaps(bounds, { minX: Math.min(a.x, b.x) - 2, maxX: Math.max(a.x, b.x) + 2,
            minY: Math.min(a.y, b.y) - 2, maxY: Math.max(a.y, b.y) + 2 })) collisions++;
        }
        collisions += net.junctions.filter(point => overlaps(bounds, {
          minX: point.x - 4, maxX: point.x + 4, minY: point.y - 4, maxY: point.y + 4,
        })).length;
      }
      const score = collisions * 1000 + offset;
      if (score < bestScore) { bestScore = score; best = { x: 0, y, bounds }; }
      if (collisions === 0) break;
    }
    if (best) labels.set(entry.node.id, best);
  }
  return labels;
}
