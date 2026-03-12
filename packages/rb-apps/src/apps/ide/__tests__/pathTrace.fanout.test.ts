import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { getFanoutCone, getFaninCone } from '../pathTrace';

// sw0 → and1
// and2 → and1
// and1 → ld0
const CIRCUIT: Circuit = {
  nodes: [
    { id: 'sw0', type: 'INPUT', position: { x: 0, y: 0 }, rotation: 0, config: {}, state: {} },
    { id: 'and2', type: 'INPUT', position: { x: 0, y: 100 }, rotation: 0, config: {}, state: {} },
    { id: 'and1', type: 'AND', position: { x: 120, y: 50 }, rotation: 0, config: {}, state: {} },
    { id: 'ld0', type: 'OUTPUT', position: { x: 240, y: 50 }, rotation: 0, config: {}, state: {} },
  ],
  connections: [
    { from: { nodeId: 'sw0', portName: 'out' }, to: { nodeId: 'and1', portName: 'in0' } },
    { from: { nodeId: 'and2', portName: 'out' }, to: { nodeId: 'and1', portName: 'in1' } },
    { from: { nodeId: 'and1', portName: 'out' }, to: { nodeId: 'ld0', portName: 'in' } },
  ],
};

describe('getFanoutCone', () => {
  it('returns only source node when it has no downstream connections', () => {
    const { nodeIds, wireIds } = getFanoutCone(CIRCUIT, 'ld0');
    expect(nodeIds).toEqual(new Set(['ld0']));
    expect(wireIds.size).toBe(0);
  });

  it('returns downstream nodes including intermediates from source node', () => {
    const { nodeIds, wireIds } = getFanoutCone(CIRCUIT, 'sw0');
    expect(nodeIds.has('sw0')).toBe(true);
    expect(nodeIds.has('and1')).toBe(true);
    expect(nodeIds.has('ld0')).toBe(true);
    // and2 is NOT downstream from sw0
    expect(nodeIds.has('and2')).toBe(false);
    expect(wireIds.size).toBe(2); // sw0→and1 and and1→ld0
  });

  it('includes all outgoing wire IDs', () => {
    const { wireIds } = getFanoutCone(CIRCUIT, 'sw0');
    expect(wireIds.has('sw0.out-and1.in0')).toBe(true);
    expect(wireIds.has('and1.out-ld0.in')).toBe(true);
  });

  it('fan-out from and1 reaches ld0 only', () => {
    const { nodeIds } = getFanoutCone(CIRCUIT, 'and1');
    expect(nodeIds.has('and1')).toBe(true);
    expect(nodeIds.has('ld0')).toBe(true);
    expect(nodeIds.has('sw0')).toBe(false);
    expect(nodeIds.has('and2')).toBe(false);
  });
});

describe('getFaninCone — regression after getFanoutCone addition', () => {
  it('fan-in of ld0 includes and1, sw0, and and2', () => {
    const { nodeIds } = getFaninCone(CIRCUIT, 'ld0');
    expect(nodeIds.has('ld0')).toBe(true);
    expect(nodeIds.has('and1')).toBe(true);
    expect(nodeIds.has('sw0')).toBe(true);
    expect(nodeIds.has('and2')).toBe(true);
  });

  it('fan-in of sw0 (input node) returns only itself', () => {
    const { nodeIds, wireIds } = getFaninCone(CIRCUIT, 'sw0');
    expect(nodeIds).toEqual(new Set(['sw0']));
    expect(wireIds.size).toBe(0);
  });
});
