import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CE_EXAMPLE_PACK, getExampleById, getExamplesByWeek } from './ceExamples';

describe('legacy CE example data contract', () => {
  it('preserves all six original example values and ordering', () => {
    // Captured before relocating the historical metadata type and typing its
    // actual flat helpers. Includes labels, descriptions, props, every endpoint,
    // placement and the explicitly simplified historical 4:1 MUX data.
    expect(createHash('sha256').update(JSON.stringify(CE_EXAMPLE_PACK)).digest('hex'))
      .toBe('5b839cd9d9b1f83d27695c203a7e6d2cbac8154bb2c0050ef17f071a00170e6e');
  });

  it('retains week filters and ID lookup object identity', () => {
    expect(getExamplesByWeek(0).map((example) => example.id)).toEqual(['w0-hello-gates', 'w0-xor-demo']);
    expect(getExamplesByWeek(1).map((example) => example.id)).toEqual(['w1-half-adder', 'w1-full-adder']);
    expect(getExamplesByWeek(2).map((example) => example.id)).toEqual(['w2-2to1-mux', 'w2-4to1-mux']);
    for (const example of CE_EXAMPLE_PACK) expect(getExampleById(example.id)).toBe(example);
    expect(getExampleById('missing-example')).toBeUndefined();
  });

  it('keeps flat legacy endpoints and props explicit without masquerading as runtime Circuit', () => {
    for (const example of CE_EXAMPLE_PACK) {
      const ids = new Set(example.circuit.nodes.map((node) => node.id));
      for (const node of example.circuit.nodes) {
        expect(Object.keys(node).sort()).toEqual(['id', 'props', 'type', 'x', 'y']);
        expect(Number.isFinite(node.x) && Number.isFinite(node.y)).toBe(true);
      }
      for (const connection of example.circuit.connections) {
        expect(Object.keys(connection).sort()).toEqual(['fromNodeId', 'fromPort', 'toNodeId', 'toPort']);
        expect(ids.has(connection.fromNodeId)).toBe(true);
        expect(ids.has(connection.toNodeId)).toBe(true);
      }
    }
  });
});
