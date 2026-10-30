import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { buildGeometryIndex, routeCircuit } from '@redbyte/rb-logic-view';
import { IDE_EXAMPLES } from '../examplesCatalog';

/**
 * A schematic must not draw two different nets as one wire. Before 2026-10-30 the router gave
 * each net its own vertical trunk at the corridor's midpoint, so inputs stacked in one column and
 * feeding gates in the next laid their trunks on the same line: the Full Adder's A and B (and
 * Logic Gates' SW0 and SW1) read as one shorted net, with each net's junction dots drawn on the
 * other. Inside the hierarchical FullAdderCell a gate one grid from the next was routed as a
 * detour through that gate and along its output wire. These checks are on the drawing itself,
 * not on counts or sizes.
 */
type Point = { x: number; y: number };
type Segment = { net: string; wire: string; a: Point; b: Point };

const drawings: Array<{ name: string; circuit: Circuit }> = IDE_EXAMPLES.flatMap((example) => [
  { name: example.id, circuit: example.circuit },
  ...(example.hierarchy?.modules ?? []).map((module) => ({ name: `${example.id}/${module.name}`, circuit: module.circuit })),
]);

function segmentsOf(nets: ReturnType<typeof routeCircuit>): Segment[] {
  return nets.flatMap((net) => net.wires.filter((wire) => !wire.degenerate).flatMap((wire) =>
    wire.points.slice(1).map((b, i) => ({ net: net.netId, wire: wire.wireId, a: wire.points[i], b }))));
}

const vertical = (s: Segment) => s.a.x === s.b.x && s.a.y !== s.b.y;
const overlap = (a1: number, a2: number, b1: number, b2: number) =>
  Math.min(Math.max(a1, a2), Math.max(b1, b2)) - Math.max(Math.min(a1, a2), Math.min(b1, b2));

function sharedVerticalRuns(segments: Segment[]): string[] {
  const found: string[] = [];
  const runs = segments.filter(vertical);
  for (let i = 0; i < runs.length; i += 1) for (let j = i + 1; j < runs.length; j += 1) {
    const [p, q] = [runs[i], runs[j]];
    if (p.net === q.net || p.a.x !== q.a.x) continue;
    const length = overlap(p.a.y, p.b.y, q.a.y, q.b.y);
    if (length > 0) found.push(`${p.wire} and ${q.wire} share ${length}px at x=${p.a.x}`);
  }
  return found;
}

const horizontal = (s: Segment) => s.a.y === s.b.y && s.a.x !== s.b.x;

function sharedHorizontalRuns(segments: Segment[]): string[] {
  const found: string[] = [];
  const runs = segments.filter(horizontal);
  for (let i = 0; i < runs.length; i += 1) for (let j = i + 1; j < runs.length; j += 1) {
    const [p, q] = [runs[i], runs[j]];
    if (p.net === q.net || p.a.y !== q.a.y) continue;
    const length = overlap(p.a.x, p.b.x, q.a.x, q.b.x);
    if (length > 0) found.push(`${p.wire} and ${q.wire} share ${length}px at y=${p.a.y}`);
  }
  return found;
}

function junctionsOnOtherNets(nets: ReturnType<typeof routeCircuit>, segments: Segment[]): string[] {
  const on = (p: Point, s: Segment) =>
    (s.a.x === s.b.x && p.x === s.a.x && p.y >= Math.min(s.a.y, s.b.y) && p.y <= Math.max(s.a.y, s.b.y)) ||
    (s.a.y === s.b.y && p.y === s.a.y && p.x >= Math.min(s.a.x, s.b.x) && p.x <= Math.max(s.a.x, s.b.x));
  return nets.flatMap((net) => net.junctions.flatMap((dot) =>
    segments.filter((s) => s.net !== net.netId && on(dot, s)).map((s) => `${net.netId} dot at ${dot.x},${dot.y} lies on ${s.wire}`)));
}

describe('schematic net topology of every starter', () => {
  it.each(drawings)('$name draws no two nets along one line and no junction on another net', ({ circuit }) => {
    const nets = routeCircuit(circuit, buildGeometryIndex(circuit.nodes));
    const segments = segmentsOf(nets);
    expect(sharedVerticalRuns(segments)).toEqual([]);
    expect(sharedHorizontalRuns(segments)).toEqual([]);
    expect(junctionsOnOtherNets(nets, segments)).toEqual([]);
  });

  it('keeps the Full Adder inputs A and B on separate trunks', () => {
    const fullAdder = IDE_EXAMPLES.find((example) => example.id === 'full-adder')!.circuit;
    const nets = routeCircuit(fullAdder, buildGeometryIndex(fullAdder.nodes));
    const trunkX = (netId: string) => new Set(segmentsOf(nets).filter((s) => s.net === netId && vertical(s)).map((s) => s.a.x));
    const a = trunkX('sw0_node.out');
    const b = trunkX('sw1_node.out');
    expect(a.size).toBeGreaterThan(0);
    expect([...a].filter((x) => b.has(x))).toEqual([]);
  });
});
