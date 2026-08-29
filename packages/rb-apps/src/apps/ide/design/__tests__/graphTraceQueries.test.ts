// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { getFaninCone, getFanoutCone } from '../../pathTrace';
import { fanIn, fanOut, neighbors, pathBetween } from '../graphTraceQueries';

// Deterministic fixture — a diamond with a stub input and a detached island:
//
//   sw0 ─▶ and1 ─▶ or1 ─▶ ld0
//   sw0 ─▶ not1 ─▶ or1
//   sw1 ─▶ and1
//   iso0 ─▶ iso1          (island, unreachable from the diamond)
const CIRCUIT: Circuit = {
  nodes: [
    { id: 'sw0', type: 'INPUT', position: { x: 0, y: 0 }, config: {} },
    { id: 'sw1', type: 'INPUT', position: { x: 0, y: 120 }, config: {} },
    { id: 'and1', type: 'AND', position: { x: 160, y: 60 }, config: {} },
    { id: 'not1', type: 'NOT', position: { x: 160, y: 180 }, config: {} },
    { id: 'or1', type: 'OR', position: { x: 320, y: 120 }, config: {} },
    { id: 'ld0', type: 'OUTPUT', position: { x: 480, y: 120 }, config: {} },
    { id: 'iso0', type: 'INPUT', position: { x: 0, y: 320 }, config: {} },
    { id: 'iso1', type: 'OUTPUT', position: { x: 160, y: 320 }, config: {} },
  ],
  connections: [
    { from: { nodeId: 'sw0', portName: 'out' }, to: { nodeId: 'and1', portName: 'a' } },
    { from: { nodeId: 'sw1', portName: 'out' }, to: { nodeId: 'and1', portName: 'b' } },
    { from: { nodeId: 'sw0', portName: 'out' }, to: { nodeId: 'not1', portName: 'in' } },
    { from: { nodeId: 'and1', portName: 'out' }, to: { nodeId: 'or1', portName: 'a' } },
    { from: { nodeId: 'not1', portName: 'out' }, to: { nodeId: 'or1', portName: 'b' } },
    { from: { nodeId: 'or1', portName: 'out' }, to: { nodeId: 'ld0', portName: 'in' } },
    { from: { nodeId: 'iso0', portName: 'out' }, to: { nodeId: 'iso1', portName: 'in' } },
  ],
};

describe('fanIn / fanOut — unified wrappers over the existing cone walkers', () => {
  it('fanIn returns exactly getFaninCone results (no reimplementation)', () => {
    const wrapped = fanIn(CIRCUIT, 'ld0');
    const direct = getFaninCone(CIRCUIT, 'ld0');
    expect(wrapped.nodeIds).toEqual(direct.nodeIds);
    expect(wrapped.wireIds).toEqual(direct.wireIds);
    expect(wrapped.nodeIds).toEqual(new Set(['ld0', 'or1', 'and1', 'not1', 'sw0', 'sw1']));
  });

  it('fanOut returns exactly getFanoutCone results (no reimplementation)', () => {
    const wrapped = fanOut(CIRCUIT, 'sw0');
    const direct = getFanoutCone(CIRCUIT, 'sw0');
    expect(wrapped.nodeIds).toEqual(direct.nodeIds);
    expect(wrapped.wireIds).toEqual(direct.wireIds);
    expect(wrapped.nodeIds).toEqual(new Set(['sw0', 'and1', 'not1', 'or1', 'ld0']));
    expect(wrapped.nodeIds.has('iso0')).toBe(false);
  });
});

describe('pathBetween — directed BFS shortest path', () => {
  it('finds a single-hop path with its wire id', () => {
    const path = pathBetween(CIRCUIT, 'or1', 'ld0');
    expect(path).toEqual({
      nodeIds: ['or1', 'ld0'],
      wireIds: ['or1.out-ld0.in'],
    });
  });

  it('finds a multi-hop path following signal direction', () => {
    const path = pathBetween(CIRCUIT, 'sw1', 'ld0');
    expect(path).toEqual({
      nodeIds: ['sw1', 'and1', 'or1', 'ld0'],
      wireIds: ['sw1.out-and1.b', 'and1.out-or1.a', 'or1.out-ld0.in'],
    });
  });

  it('resolves diamond ties deterministically via connection order (and1 branch first)', () => {
    const path = pathBetween(CIRCUIT, 'sw0', 'ld0');
    expect(path).not.toBeNull();
    expect(path!.nodeIds).toEqual(['sw0', 'and1', 'or1', 'ld0']);
    expect(path!.wireIds).toEqual(['sw0.out-and1.a', 'and1.out-or1.a', 'or1.out-ld0.in']);
  });

  it('returns null when only a reverse-direction path exists', () => {
    expect(pathBetween(CIRCUIT, 'ld0', 'sw0')).toBeNull();
  });

  it('returns null between disconnected components', () => {
    expect(pathBetween(CIRCUIT, 'sw0', 'iso1')).toBeNull();
  });

  it('returns the trivial path for a node to itself', () => {
    expect(pathBetween(CIRCUIT, 'and1', 'and1')).toEqual({ nodeIds: ['and1'], wireIds: [] });
  });

  it('returns null when either endpoint is not in the circuit', () => {
    expect(pathBetween(CIRCUIT, 'ghost', 'ld0')).toBeNull();
    expect(pathBetween(CIRCUIT, 'sw0', 'ghost')).toBeNull();
  });

  it('keeps invariant wireIds.length === nodeIds.length - 1', () => {
    const path = pathBetween(CIRCUIT, 'sw0', 'or1');
    expect(path).not.toBeNull();
    expect(path!.wireIds.length).toBe(path!.nodeIds.length - 1);
  });
});

describe('neighbors — undirected bounded-depth neighborhood', () => {
  it('depth 0 returns only the seed node with no wires', () => {
    const hood = neighbors(CIRCUIT, 'or1', 0);
    expect(hood.nodeIds).toEqual(new Set(['or1']));
    expect(hood.wireIds.size).toBe(0);
    expect(hood.depthByNodeId.get('or1')).toBe(0);
  });

  it('depth 1 includes upstream AND downstream neighbors (direction ignored)', () => {
    const hood = neighbors(CIRCUIT, 'or1', 1);
    expect(hood.nodeIds).toEqual(new Set(['or1', 'and1', 'not1', 'ld0']));
    expect(hood.depthByNodeId.get('and1')).toBe(1);
    expect(hood.depthByNodeId.get('ld0')).toBe(1);
  });

  it('depth 1 wires are the induced subgraph (only edges between included nodes)', () => {
    const hood = neighbors(CIRCUIT, 'or1', 1);
    expect(hood.wireIds).toEqual(
      new Set(['and1.out-or1.a', 'not1.out-or1.b', 'or1.out-ld0.in']),
    );
    // sw0 -> and1 exists in the circuit but sw0 is outside the neighborhood.
    expect(hood.wireIds.has('sw0.out-and1.a')).toBe(false);
  });

  it('depth 2 reaches the whole diamond but never the island', () => {
    const hood = neighbors(CIRCUIT, 'or1', 2);
    expect(hood.nodeIds).toEqual(new Set(['or1', 'and1', 'not1', 'ld0', 'sw0', 'sw1']));
    expect(hood.depthByNodeId.get('sw0')).toBe(2);
    expect(hood.nodeIds.has('iso0')).toBe(false);
    expect(hood.nodeIds.has('iso1')).toBe(false);
  });

  it('records the shortest undirected distance for diamond nodes', () => {
    const hood = neighbors(CIRCUIT, 'sw0', 3);
    // or1 is reachable via and1 or not1 — either way distance 2.
    expect(hood.depthByNodeId.get('or1')).toBe(2);
    expect(hood.depthByNodeId.get('ld0')).toBe(3);
  });

  it('a node absent from any connection yields only itself', () => {
    const lonely: Circuit = {
      nodes: [{ id: 'solo', type: 'INPUT', position: { x: 0, y: 0 }, config: {} }],
      connections: [],
    };
    const hood = neighbors(lonely, 'solo', 5);
    expect(hood.nodeIds).toEqual(new Set(['solo']));
    expect(hood.wireIds.size).toBe(0);
  });

  it('floors negative and non-finite depths to 0', () => {
    expect(neighbors(CIRCUIT, 'or1', -3).nodeIds).toEqual(new Set(['or1']));
    expect(neighbors(CIRCUIT, 'or1', Number.NaN).nodeIds).toEqual(new Set(['or1']));
  });
});

describe('determinism', () => {
  it('repeated queries produce identical results', () => {
    expect(pathBetween(CIRCUIT, 'sw0', 'ld0')).toEqual(pathBetween(CIRCUIT, 'sw0', 'ld0'));
    const first = neighbors(CIRCUIT, 'or1', 2);
    const second = neighbors(CIRCUIT, 'or1', 2);
    expect(second.nodeIds).toEqual(first.nodeIds);
    expect(second.wireIds).toEqual(first.wireIds);
    expect([...second.depthByNodeId.entries()]).toEqual([...first.depthByNodeId.entries()]);
  });
});
