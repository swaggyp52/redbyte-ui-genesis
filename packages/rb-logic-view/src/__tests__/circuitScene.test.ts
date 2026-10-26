import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { buildCircuitScene, cullScene, netValue, netsOfNode, sceneFingerprint, segmentIntersectsBox } from '../scene';

const circuit: Circuit = {
  nodes: [
    { id: 'a', type: 'INPUT', label: 'A', position: { x: 0, y: 0 } },
    { id: 'b', type: 'INPUT', label: 'B', position: { x: 0, y: 96 } },
    { id: 'g', type: 'AND', label: 'G', position: { x: 192, y: 48 } },
    { id: 'n', type: 'NOT', label: 'N', position: { x: 192, y: 192 } },
    { id: 'y', type: 'OUTPUT', label: 'Y', position: { x: 400, y: 48 } },
    { id: 'z', type: 'OUTPUT', label: 'Z', position: { x: 2000, y: 192 } },
  ] as Circuit['nodes'],
  connections: [
    { from: { nodeId: 'a', portName: 'out' }, to: { nodeId: 'g', portName: 'a' } },
    { from: { nodeId: 'b', portName: 'out' }, to: { nodeId: 'g', portName: 'b' } },
    { from: { nodeId: 'a', portName: 'out' }, to: { nodeId: 'n', portName: 'in' } },
    { from: { nodeId: 'g', portName: 'out' }, to: { nodeId: 'y', portName: 'in' } },
    { from: { nodeId: 'n', portName: 'out' }, to: { nodeId: 'z', portName: 'in' } },
  ],
};

describe('CircuitScene', () => {
  it('is deterministic: input order does not change the scene', () => {
    const shuffled: Circuit = { nodes: [...circuit.nodes].reverse(), connections: [...circuit.connections].reverse() };
    expect(sceneFingerprint(buildCircuitScene(shuffled))).toBe(sceneFingerprint(buildCircuitScene(circuit)));
  });

  it('names nets by driver endpoint and indexes every endpoint to its net', () => {
    const scene = buildCircuitScene(circuit);
    expect(scene.nets.map((net) => net.netId)).toEqual(['a.out', 'b.out', 'g.out', 'n.out']);
    expect(scene.netByEndpoint.get('g.a')).toBe('a.out');
    expect(scene.netByEndpoint.get('n.in')).toBe('a.out');
    expect(scene.netByEndpoint.get('y.in')).toBe('g.out');
    expect(netsOfNode(scene, 'g')).toMatchObject({ drives: [{ netId: 'g.out' }], reads: [{ netId: 'a.out' }, { netId: 'b.out' }] });
    // Renaming a label never renames a net.
    const renamed = { ...circuit, nodes: circuit.nodes.map((node) => (node.id === 'a' ? { ...node, label: 'Renamed' } : node)) };
    expect(buildCircuitScene(renamed).nets.map((net) => net.netId)).toEqual(['a.out', 'b.out', 'g.out', 'n.out']);
  });

  it('reads a net value from its driver, else a load, and leaves absent values absent', () => {
    const scene = buildCircuitScene(circuit);
    const net = scene.netById.get('g.out')!;
    expect(netValue(net, new Map([['g.out', 1]]))).toBe(1);
    expect(netValue(net, new Map([['y.in', 0]]))).toBe(0);
    expect(netValue(net, new Map())).toBeUndefined();
  });

  it('culls by segment geometry: a long wire whose two ends are off-screen stays visible', () => {
    const scene = buildCircuitScene(circuit);
    const n = scene.symbolById.get('n')!;
    const z = scene.symbolById.get('z')!;
    // A window strictly between the NOT gate and its distant load: neither endpoint symbol is inside.
    const view = { minX: n.bounds.maxX + 200, maxX: z.bounds.minX - 200, minY: -1000, maxY: 1000 };
    const visible = cullScene(scene, view);
    expect(visible.symbolIds.has('n')).toBe(false);
    expect(visible.symbolIds.has('z')).toBe(false);
    expect(visible.netIds.has('n.out')).toBe(true);
    expect(visible.netIds.has('b.out')).toBe(false);
  });

  it('routes a net around a symbol body its horizontal leg would otherwise cross, only when asked', () => {
    // A clock-like net: the driver sits left of a gate at the same height and loads lie far right.
    const crossing: Circuit = {
      nodes: [
        { id: 'clk', type: 'INPUT', label: 'CLK', position: { x: 0, y: 0 } },
        { id: 'gate', type: 'XOR', label: 'G', position: { x: 224, y: 0 } },
        { id: 'r0', type: 'NOT', label: 'R0', position: { x: 640, y: 48 } },
        { id: 'r1', type: 'NOT', label: 'R1', position: { x: 640, y: 304 } },
      ] as Circuit['nodes'],
      connections: [
        { from: { nodeId: 'clk', portName: 'out' }, to: { nodeId: 'r0', portName: 'in' } },
        { from: { nodeId: 'clk', portName: 'out' }, to: { nodeId: 'r1', portName: 'in' } },
      ],
    };
    const crossesGate = (scene: ReturnType<typeof buildCircuitScene>) => {
      const gate = scene.symbolById.get('gate')!.geometry.body;
      const box = { minX: 224 + gate.minX, maxX: 224 + gate.maxX, minY: gate.minY, maxY: gate.maxY };
      return scene.netById.get('clk.out')!.wires.some((wire) => wire.points.some((point, i) => i > 0
        && point.y === wire.points[i - 1].y && point.y > box.minY && point.y < box.maxY
        && Math.max(point.x, wire.points[i - 1].x) > box.minX && Math.min(point.x, wire.points[i - 1].x) < box.maxX));
    };
    expect(crossesGate(buildCircuitScene(crossing, undefined, {}))).toBe(true); // legacy routes, unchanged
    const avoided = buildCircuitScene(crossing);
    expect(crossesGate(avoided)).toBe(false);
    expect(sceneFingerprint(avoided)).toBe(sceneFingerprint(buildCircuitScene(crossing)));
  });

  it('intersects segments exactly', () => {
    const box = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    expect(segmentIntersectsBox({ x: -5, y: 5 }, { x: 15, y: 5 }, box)).toBe(true);
    expect(segmentIntersectsBox({ x: -5, y: 15 }, { x: 15, y: 15 }, box)).toBe(false);
    expect(segmentIntersectsBox({ x: 5, y: -20 }, { x: 5, y: -1 }, box)).toBe(false);
  });
});
