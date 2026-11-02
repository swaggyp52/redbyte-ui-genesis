import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { buildGeometryIndex } from '../symbols/portGeometry';
import { routeCircuit } from '../routing/orthogonalRouter';

/**
 * A detour around one part must not be drawn through another, its own two parts included: a
 * search that only avoided the parts between a wire's ends put a feedback wire straight through
 * its own target, on that target's input row (independent review of 2026-11-02).
 */
const and = (id: string, x: number, y: number) => ({ id, type: 'AND', x, y, label: id, config: {}, state: {} });

function throughBody(circuit: Circuit) {
  const index = buildGeometryIndex(circuit.nodes);
  const bodies = [...index.values()].map((entry) => ({
    id: entry.node.id,
    minX: entry.x + entry.geometry.body.minX, maxX: entry.x + entry.geometry.body.maxX,
    minY: entry.y + entry.geometry.body.minY, maxY: entry.y + entry.geometry.body.maxY,
  }));
  return routeCircuit(circuit, index).flatMap((net) => net.wires.flatMap((wire) => wire.points.slice(1).flatMap((b, i) => {
    const a = wire.points[i];
    return bodies.filter((body) => Math.max(a.x, b.x) > body.minX && Math.min(a.x, b.x) < body.maxX
      && Math.max(a.y, b.y) > body.minY && Math.min(a.y, b.y) < body.maxY).map((body) => `${wire.wireId} through ${body.id}`);
  })));
}

describe('orthogonal router detours', () => {
  it('routes a feedback wire around parts in its way without crossing its own target', () => {
    const circuit = {
      nodes: [and('S', 400, 0), and('T', 100, 64), and('X1', 250, 112), and('X2', 250, 168)],
      connections: [{ id: 'w', from: { nodeId: 'S', portName: 'out' }, to: { nodeId: 'T', portName: 'b' } }],
    } as unknown as Circuit;
    expect(throughBody(circuit)).toEqual([]);
  });
});
