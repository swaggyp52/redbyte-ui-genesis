import { describe, expect, it } from 'vitest';
import type { Node } from '@redbyte/rb-logic-core';
import { layoutBusBrackets } from '../components/SchematicBusBrackets';
import type { SymbolGeometry } from '../symbols/portGeometry';

function geometry(kind: SymbolGeometry['kind']): { geometry: SymbolGeometry } {
  return {
    geometry: {
      kind,
      body: { minX: -30, minY: -10, maxX: 30, maxY: 10 },
      bounds: { minX: -40, minY: -10, maxX: 40, maxY: 10 },
      pins: [],
      title: '',
      typeLabel: '',
    } as unknown as SymbolGeometry,
  };
}

function node(id: string, x: number, y: number): Node {
  return { id, type: 'INPUT', position: { x, y }, config: {} } as unknown as Node;
}

describe('layoutBusBrackets', () => {
  it('brackets the outer edge of every placed bit and labels the width', () => {
    const nodes = new Map([node('a0', 100, 100), node('a1', 100, 140), node('a2', 100, 180), node('a3', 100, 220)].map((n) => [n.id, n]));
    const geo = new Map(['a0', 'a1', 'a2', 'a3'].map((id) => [id, geometry('io-in')]));
    const [bracket] = layoutBusBrackets(
      [{ name: 'A', direction: 'in', bits: [{ nodeId: 'a3', bit: 3 }, { nodeId: 'a0', bit: 0 }, { nodeId: 'a1', bit: 1 }, { nodeId: 'a2', bit: 2 }] }],
      nodes,
      geo
    );
    expect(bracket.label).toBe('A[3:0]');
    expect(bracket.width).toBe(4);
    expect(bracket.x).toBe(100 - 40 - 10);
    expect(bracket.top).toBe(100);
    expect(bracket.bottom).toBe(220);
    expect(bracket.ticks.map((tick) => tick.bit)).toEqual([0, 1, 2, 3]);
    expect(bracket.lane).toBe(0);
  });

  it('brackets outputs on the right and skips groups with fewer than two placed bits', () => {
    const nodes = new Map([node('s0', 600, 100), node('s1', 600, 140), node('lonely', 600, 300)].map((n) => [n.id, n]));
    const geo = new Map(['s0', 's1', 'lonely'].map((id) => [id, geometry('io-out')]));
    const layouts = layoutBusBrackets(
      [
        { name: 'SUM', direction: 'out', bits: [{ nodeId: 's0', bit: 0 }, { nodeId: 's1', bit: 1 }] },
        { name: 'C', direction: 'out', bits: [{ nodeId: 'lonely', bit: 0 }, { nodeId: 'missing', bit: 1 }] },
      ],
      nodes,
      geo
    );
    expect(layouts).toHaveLength(1);
    expect(layouts[0].x).toBe(600 + 40 + 10);
    expect(layouts[0].label).toBe('SUM[1:0]');
  });

  it('steps buses that share a side outward so their brackets never overlap', () => {
    const nodes = new Map([node('a0', 100, 100), node('b0', 100, 140), node('a1', 100, 180), node('b1', 100, 220)].map((n) => [n.id, n]));
    const geo = new Map(['a0', 'b0', 'a1', 'b1'].map((id) => [id, geometry('io-in')]));
    const layouts = layoutBusBrackets(
      [
        { name: 'A', direction: 'in', bits: [{ nodeId: 'a0', bit: 0 }, { nodeId: 'a1', bit: 1 }] },
        { name: 'B', direction: 'in', bits: [{ nodeId: 'b0', bit: 0 }, { nodeId: 'b1', bit: 1 }] },
      ],
      nodes,
      geo
    );
    expect(layouts.map((layout) => layout.lane)).toEqual([0, 1]);
    expect(layouts[1].x).toBeLessThan(layouts[0].x);
  });
});
