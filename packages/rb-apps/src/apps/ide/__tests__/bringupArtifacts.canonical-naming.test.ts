import { describe, expect, it } from 'vitest';
import type { RBProject } from '../../../export/projectFormat';
import { buildBringUpArtifacts, generateBringUpVectors } from '../bringupArtifacts';

function createProjectFixture(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-11T00:00:00.000Z',
    updatedAt: '2026-03-11T00:00:00.000Z',
    name: 'Bringup Naming Fixture',
    description: 'Naming normalization fixture',
    circuit: {
      nodes: [
        {
          id: 'sw0_node',
          type: 'INPUT',
          label: 'SW0',
          position: { x: 0, y: 0 },
          x: 0,
          y: 0,
          rotation: 0,
          config: {},
          state: {},
        },
        {
          id: 'ld0_node',
          type: 'OUTPUT',
          label: 'LD0',
          position: { x: 180, y: 0 },
          x: 180,
          y: 0,
          rotation: 0,
          config: {},
          state: {},
        },
      ],
      connections: [
        {
          from: { nodeId: 'sw0_node', portName: 'out' },
          to: { nodeId: 'ld0_node', portName: 'in' },
        },
      ],
    },
    ioMapping: {
      inputs: [
        { id: 'sw0', nodeId: 'sw0_node', port: 'out', label: 'SW0', pin: 'V17' },
      ],
      outputs: [
        { id: 'ld0', nodeId: 'ld0_node', port: 'in', label: 'LD0', pin: 'U16' },
      ],
    },
    vectors: [{ tick: 0, inputs: { sw0: 1 }, expected: { ld0: 1 } }],
    meta: {
      projectId: 'rb-bringup-naming-fixture',
    },
  };
}

describe('bringupArtifacts canonical naming', () => {
  it('normalizes bracketed labels to canonical signal keys', () => {
    const artifacts = buildBringUpArtifacts({
      project: createProjectFixture(),
      ioRows: [
        {
          id: 'ld0_internal',
          nodeId: 'ld0_node',
          label: 'LD[0]',
          direction: 'out',
          pin: 'U16',
          required: true,
        },
      ],
      expectedBehavior: 'LED follows switch',
      verifyRows: [{ tick: 0, signal: 'LD[0]', expected: '1', actual: '1' }],
    });

    const parsed = JSON.parse(artifacts.expectedIoJson) as {
      signals?: Array<{ signal?: string }>;
    };

    expect(parsed.signals?.[0]?.signal).toBe('ld');
  });

  it('keeps duplicate normalized output labels distinct in EXPECTED_IO', () => {
    const artifacts = buildBringUpArtifacts({
      project: createProjectFixture(),
      ioRows: [
        {
          id: 'leda',
          nodeId: 'leda_node',
          label: 'LED-A',
          direction: 'out',
          pin: 'U16',
          required: true,
        },
        {
          id: 'leda_2',
          nodeId: 'leda_2_node',
          label: 'LEDA',
          direction: 'out',
          pin: 'V16',
          required: true,
        },
      ],
      expectedBehavior: 'Both LEDs follow the same switch',
      verifyRows: [
        { tick: 0, signal: 'leda', expected: '1', actual: '1' },
        { tick: 0, signal: 'leda_2', expected: '1', actual: '1' },
      ],
    });

    const parsed = JSON.parse(artifacts.expectedIoJson) as {
      signals?: Array<{ signal?: string; pin?: string }>;
    };

    expect(parsed.signals?.map((row) => ({ signal: row.signal, pin: row.pin }))).toEqual([
      { signal: 'leda', pin: 'U16' },
      { signal: 'leda_2', pin: 'V16' },
    ]);
  });

  it('simulates combinational starter vectors for a half-adder instead of defaulting outputs to zero', () => {
    const vectors = generateBringUpVectors({
      circuit: {
        nodes: [
          {
            id: 'a_node',
            type: 'INPUT',
            label: 'A',
            position: { x: 0, y: 0 },
            x: 0,
            y: 0,
            rotation: 0,
            config: {},
            state: {},
          },
          {
            id: 'b_node',
            type: 'INPUT',
            label: 'B',
            position: { x: 0, y: 120 },
            x: 0,
            y: 120,
            rotation: 0,
            config: {},
            state: {},
          },
          {
            id: 'xor_node',
            type: 'XOR',
            label: 'SUM',
            position: { x: 220, y: 20 },
            x: 220,
            y: 20,
            rotation: 0,
            config: {},
            state: {},
          },
          {
            id: 'and_node',
            type: 'AND',
            label: 'CARRY',
            position: { x: 220, y: 150 },
            x: 220,
            y: 150,
            rotation: 0,
            config: {},
            state: {},
          },
          {
            id: 'sum_node',
            type: 'OUTPUT',
            label: 'SUM',
            position: { x: 420, y: 20 },
            x: 420,
            y: 20,
            rotation: 0,
            config: {},
            state: {},
          },
          {
            id: 'carry_node',
            type: 'OUTPUT',
            label: 'CARRY',
            position: { x: 420, y: 150 },
            x: 420,
            y: 150,
            rotation: 0,
            config: {},
            state: {},
          },
        ],
        connections: [
          {
            from: { nodeId: 'a_node', portName: 'out' },
            to: { nodeId: 'xor_node', portName: 'a' },
          },
          {
            from: { nodeId: 'b_node', portName: 'out' },
            to: { nodeId: 'xor_node', portName: 'b' },
          },
          {
            from: { nodeId: 'a_node', portName: 'out' },
            to: { nodeId: 'and_node', portName: 'a' },
          },
          {
            from: { nodeId: 'b_node', portName: 'out' },
            to: { nodeId: 'and_node', portName: 'b' },
          },
          {
            from: { nodeId: 'xor_node', portName: 'out' },
            to: { nodeId: 'sum_node', portName: 'in' },
          },
          {
            from: { nodeId: 'and_node', portName: 'out' },
            to: { nodeId: 'carry_node', portName: 'in' },
          },
        ],
      },
      ioRows: [
        {
          id: 'a',
          nodeId: 'a_node',
          port: 'out',
          label: 'A',
          direction: 'in',
          pin: 'SW0',
          required: true,
        },
        {
          id: 'b',
          nodeId: 'b_node',
          port: 'out',
          label: 'B',
          direction: 'in',
          pin: 'SW1',
          required: true,
        },
        {
          id: 'sum',
          nodeId: 'sum_node',
          port: 'in',
          label: 'SUM',
          direction: 'out',
          pin: 'LD0',
          required: true,
        },
        {
          id: 'carry',
          nodeId: 'carry_node',
          port: 'in',
          label: 'CARRY',
          direction: 'out',
          pin: 'LD1',
          required: true,
        },
      ],
    });

    expect(vectors.map((vector) => ({
      inputs: vector.inputs,
      expected: vector.expected,
    }))).toEqual([
      { inputs: { a: 0, b: 0 }, expected: { sum: 0, carry: 0 } },
      { inputs: { a: 1, b: 0 }, expected: { sum: 1, carry: 0 } },
      { inputs: { a: 0, b: 1 }, expected: { sum: 1, carry: 0 } },
      { inputs: { a: 1, b: 1 }, expected: { sum: 0, carry: 1 } },
    ]);
  });

  it('drives the semantic clock input in sequential bring-up vectors even when its label is not clock-shaped', () => {
    const vectors = generateBringUpVectors({
      circuit: {
        nodes: [
          {
            id: 'data_node',
            type: 'INPUT',
            label: 'data_in',
            position: { x: 0, y: 0 },
            x: 0,
            y: 0,
            rotation: 0,
            config: {},
            state: {},
          },
          {
            id: 'phase_driver_node',
            type: 'INPUT',
            label: 'phase_driver',
            position: { x: 0, y: 100 },
            x: 0,
            y: 100,
            rotation: 0,
            config: {},
            state: {},
          },
          {
            id: 'ff_node',
            type: 'DFlipFlop',
            label: 'ff0',
            position: { x: 220, y: 40 },
            x: 220,
            y: 40,
            rotation: 0,
            config: {},
            state: {},
          },
          {
            id: 'q_node',
            type: 'OUTPUT',
            label: 'q',
            position: { x: 420, y: 40 },
            x: 420,
            y: 40,
            rotation: 0,
            config: {},
            state: {},
          },
        ],
        connections: [
          {
            from: { nodeId: 'data_node', portName: 'out' },
            to: { nodeId: 'ff_node', portName: 'D' },
          },
          {
            from: { nodeId: 'phase_driver_node', portName: 'out' },
            to: { nodeId: 'ff_node', portName: 'CLK' },
          },
          {
            from: { nodeId: 'ff_node', portName: 'Q' },
            to: { nodeId: 'q_node', portName: 'in' },
          },
        ],
      },
      ioRows: [
        {
          id: 'data_in',
          nodeId: 'data_node',
          port: 'out',
          label: 'data_in',
          direction: 'in',
          pin: 'SW0',
          required: true,
        },
        {
          id: 'phase_driver',
          nodeId: 'phase_driver_node',
          port: 'out',
          label: 'phase_driver',
          direction: 'in',
          pin: 'CLK100MHZ',
          required: true,
        },
        {
          id: 'q',
          nodeId: 'q_node',
          port: 'in',
          label: 'q',
          direction: 'out',
          pin: 'LD0',
          required: true,
        },
      ],
    });

    expect(vectors[0]?.inputs.phase_driver).toBe(0);
    expect(vectors[1]?.inputs.phase_driver).toBe(1);
    expect(vectors[0]?.inputs.data_in).toBe(0);
    expect(vectors[1]?.inputs.data_in).toBe(0);
    expect(vectors[2]?.inputs.data_in).toBe(1);
    expect(vectors[3]?.expected.q).toBe(1);
  });

  it('simulates expected outputs for sequential designs it cannot classify semantically', () => {
    const vectors = generateBringUpVectors({
      circuit: {
        nodes: [
          {
            id: 'j_node',
            type: 'INPUT',
            label: 'j',
            position: { x: 0, y: 0 },
            x: 0,
            y: 0,
            rotation: 0,
            config: {},
            state: {},
          },
          {
            id: 'k_node',
            type: 'INPUT',
            label: 'k',
            position: { x: 0, y: 100 },
            x: 0,
            y: 100,
            rotation: 0,
            config: {},
            state: {},
          },
          {
            id: 'clk_node',
            type: 'INPUT',
            label: 'clk',
            position: { x: 0, y: 200 },
            x: 0,
            y: 200,
            rotation: 0,
            config: {},
            state: {},
          },
          {
            id: 'jk_node',
            type: 'JKFlipFlop',
            label: 'jk0',
            position: { x: 220, y: 80 },
            x: 220,
            y: 80,
            rotation: 0,
            config: {},
            state: {},
          },
          {
            id: 'q_node',
            type: 'OUTPUT',
            label: 'q',
            position: { x: 420, y: 80 },
            x: 420,
            y: 80,
            rotation: 0,
            config: {},
            state: {},
          },
        ],
        connections: [
          {
            from: { nodeId: 'j_node', portName: 'out' },
            to: { nodeId: 'jk_node', portName: 'J' },
          },
          {
            from: { nodeId: 'k_node', portName: 'out' },
            to: { nodeId: 'jk_node', portName: 'K' },
          },
          {
            from: { nodeId: 'clk_node', portName: 'out' },
            to: { nodeId: 'jk_node', portName: 'CLK' },
          },
          {
            from: { nodeId: 'jk_node', portName: 'Q' },
            to: { nodeId: 'q_node', portName: 'in' },
          },
        ],
      },
      ioRows: [
        {
          id: 'j',
          nodeId: 'j_node',
          port: 'out',
          label: 'j',
          direction: 'in',
          pin: 'SW0',
          required: true,
        },
        {
          id: 'k',
          nodeId: 'k_node',
          port: 'out',
          label: 'k',
          direction: 'in',
          pin: 'SW1',
          required: true,
        },
        {
          id: 'clk',
          nodeId: 'clk_node',
          port: 'out',
          label: 'clk',
          direction: 'in',
          pin: 'CLK100MHZ',
          required: true,
        },
        {
          id: 'q',
          nodeId: 'q_node',
          port: 'in',
          label: 'q',
          direction: 'out',
          pin: 'LD0',
          required: true,
        },
      ],
    });

    expect(vectors).toHaveLength(8);
    expect(vectors[0]?.inputs.clk).toBe(0);
    expect(vectors[1]?.inputs.clk).toBe(1);
    expect(vectors.every((vector) => Object.keys(vector.expected ?? {}).length === 1)).toBe(true);
    expect(vectors[0]?.expected.q).toBe(0);
    expect(vectors.some((vector) => vector.expected?.q === 1)).toBe(true);
  });

  it('simulates generic D flip-flop outputs even when the output labels are plain board LEDs', () => {
    const vectors = generateBringUpVectors({
      circuit: {
        nodes: [
          {
            id: 'data_node',
            type: 'INPUT',
            label: 'sw0',
            position: { x: 0, y: 0 },
            x: 0,
            y: 0,
            rotation: 0,
            config: {},
            state: {},
          },
          {
            id: 'clock_node',
            type: 'Clock',
            label: 'clk100mhz',
            position: { x: 0, y: 100 },
            x: 0,
            y: 100,
            rotation: 0,
            config: {},
            state: {},
          },
          {
            id: 'ff_node',
            type: 'DFlipFlop',
            label: 'ff0',
            position: { x: 220, y: 40 },
            x: 220,
            y: 40,
            rotation: 0,
            config: {},
            state: {},
          },
          {
            id: 'ld0_node',
            type: 'OUTPUT',
            label: 'ld0',
            position: { x: 420, y: 0 },
            x: 420,
            y: 0,
            rotation: 0,
            config: {},
            state: {},
          },
          {
            id: 'ld1_node',
            type: 'OUTPUT',
            label: 'ld1',
            position: { x: 420, y: 80 },
            x: 420,
            y: 80,
            rotation: 0,
            config: {},
            state: {},
          },
        ],
        connections: [
          {
            from: { nodeId: 'data_node', portName: 'out' },
            to: { nodeId: 'ff_node', portName: 'D' },
          },
          {
            from: { nodeId: 'clock_node', portName: 'out' },
            to: { nodeId: 'ff_node', portName: 'CLK' },
          },
          {
            from: { nodeId: 'ff_node', portName: 'Q' },
            to: { nodeId: 'ld0_node', portName: 'in' },
          },
          {
            from: { nodeId: 'ff_node', portName: 'Q_inv' },
            to: { nodeId: 'ld1_node', portName: 'in' },
          },
        ],
      },
      ioRows: [
        {
          id: 'sw0',
          nodeId: 'data_node',
          port: 'out',
          label: 'sw0',
          direction: 'in',
          pin: 'SW0',
          required: true,
        },
        {
          id: 'clk100mhz',
          nodeId: 'clock_node',
          port: 'out',
          label: 'clk100mhz',
          direction: 'in',
          pin: 'CLK100MHZ',
          required: true,
        },
        {
          id: 'ld0',
          nodeId: 'ld0_node',
          port: 'in',
          label: 'ld0',
          direction: 'out',
          pin: 'LD0',
          required: true,
        },
        {
          id: 'ld1',
          nodeId: 'ld1_node',
          port: 'in',
          label: 'ld1',
          direction: 'out',
          pin: 'LD1',
          required: true,
        },
      ],
    });

    expect(vectors).toHaveLength(8);
    expect(vectors[0]?.expected).toEqual({ ld0: 0, ld1: 1 });
    expect(vectors.every((vector) => Object.keys(vector.expected ?? {}).sort().join(',') === 'ld0,ld1')).toBe(true);
    expect(vectors.every((vector) => vector.expected?.ld0 !== undefined && vector.expected?.ld1 !== undefined)).toBe(true);
  });
});
