import { describe, it, expect } from 'vitest';
import { parsedHdlToCircuit, type ParsedHDL } from '../hdlToCircuit';

/**
 * Helper: build a minimal ParsedHDL with given ports and instances.
 */
function makeParsed(opts: {
  inputs: string[];
  outputs: string[];
  instances?: Array<{
    id: string;
    componentType: string;
    portMap: Record<string, string>;
  }>;
}): ParsedHDL {
  return {
    entityName: 'test',
    ports: [
      ...opts.inputs.map((name) => ({ name, direction: 'in' as const, typeName: 'std_logic' })),
      ...opts.outputs.map((name) => ({ name, direction: 'out' as const, typeName: 'std_logic' })),
    ],
    instances: opts.instances ?? [],
    signals: [],
    warnings: [],
    lang: 'vhdl',
  };
}

describe('assignPositions — vertical centering', () => {
  it('single-column circuit: input and output are vertically centred at the same Y', () => {
    // 1 input → direct pass-through → 1 output (no gates), both should be at same Y
    const parsed = makeParsed({ inputs: ['a'], outputs: ['y'] });
    const result = parsedHdlToCircuit(parsed);
    const inputNode = result.circuit.nodes.find((n) => n.type === 'INPUT');
    const outputNode = result.circuit.nodes.find((n) => n.type === 'OUTPUT');
    expect(inputNode!.y).toBe(outputNode!.y);
  });

  it('two-input one-output: inputs are symmetrically placed around output Y', () => {
    // 2 inputs → AND gate → 1 output
    const parsed = makeParsed({
      inputs: ['a', 'b'],
      outputs: ['y'],
      instances: [
        { id: 'u0', componentType: 'AND', portMap: { in0: 'a', in1: 'b', out: 'y' } },
      ],
    });
    const result = parsedHdlToCircuit(parsed);
    const inputs = result.circuit.nodes.filter((n) => n.type === 'INPUT');
    const outputNode = result.circuit.nodes.find((n) => n.type === 'OUTPUT');
    expect(inputs).toHaveLength(2);
    const inputCenterY = (inputs[0].y! + inputs[1].y!) / 2;
    expect(outputNode?.y).toBeDefined();
    // Input column center Y should equal output column Y (both centered on same globalCenterY)
    expect(Math.abs(inputCenterY - outputNode!.y!)).toBeLessThan(2);
  });

  it('three-input one-output: middle input is at output Y', () => {
    const parsed = makeParsed({
      inputs: ['a', 'b', 'c'],
      outputs: ['y'],
      instances: [
        { id: 'u0', componentType: 'AND', portMap: { in0: 'a', in1: 'b', out: 'mid' } },
        { id: 'u1', componentType: 'AND', portMap: { in0: 'mid', in1: 'c', out: 'y' } },
      ],
    });
    const result = parsedHdlToCircuit(parsed);
    const inputs = result.circuit.nodes
      .filter((n) => n.type === 'INPUT')
      .sort((a, b) => (a.y ?? 0) - (b.y ?? 0));
    const outputNode = result.circuit.nodes.find((n) => n.type === 'OUTPUT');
    expect(inputs).toHaveLength(3);
    // Middle input (index 1) Y should equal output Y (both are tallest column = 3, centered)
    const middleInputY = inputs[1].y!;
    expect(Math.abs(middleInputY - outputNode!.y!)).toBeLessThan(2);
  });
});

describe('assignPositions — no overlapping nodes', () => {
  it('produces no two nodes at the same (x, y) for a 4-input OR tree', () => {
    // 4 inputs → OR tree → 1 output
    const parsed = makeParsed({
      inputs: ['a', 'b', 'c', 'd'],
      outputs: ['y'],
      instances: [
        { id: 'u0', componentType: 'OR', portMap: { in0: 'a', in1: 'b', out: 'ab' } },
        { id: 'u1', componentType: 'OR', portMap: { in0: 'c', in1: 'd', out: 'cd' } },
        { id: 'u2', componentType: 'OR', portMap: { in0: 'ab', in1: 'cd', out: 'y' } },
      ],
    });
    const result = parsedHdlToCircuit(parsed);
    const positions = result.circuit.nodes.map((n) => `${n.x},${n.y}`);
    const unique = new Set(positions);
    expect(unique.size).toBe(positions.length);
  });

  it('all nodes have positive x and y', () => {
    const parsed = makeParsed({
      inputs: ['a'],
      outputs: ['y'],
      instances: [{ id: 'u0', componentType: 'NOT', portMap: { in: 'a', out: 'y' } }],
    });
    const result = parsedHdlToCircuit(parsed);
    expect(result.circuit.nodes).not.toHaveLength(0);
    for (const node of result.circuit.nodes) {
      expect(node.x).toBeGreaterThan(0);
      expect(node.y).toBeGreaterThan(0);
    }
  });
});

describe('assignPositions — x spread', () => {
  it('3-stage pipeline: nodes are spread across at least 3 distinct x values', () => {
    // a → NOT → AND → output
    const parsed = makeParsed({
      inputs: ['a', 'b'],
      outputs: ['y'],
      instances: [
        { id: 'u0', componentType: 'NOT', portMap: { in: 'a', out: 'na' } },
        { id: 'u1', componentType: 'AND', portMap: { in0: 'na', in1: 'b', out: 'y' } },
      ],
    });
    const result = parsedHdlToCircuit(parsed);
    const xValues = new Set(result.circuit.nodes.map((n) => n.x));
    expect(xValues.size).toBeGreaterThanOrEqual(3);
  });
});
