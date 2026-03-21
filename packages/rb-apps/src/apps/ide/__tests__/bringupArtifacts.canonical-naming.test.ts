import { describe, expect, it } from 'vitest';
import type { RBProject } from '../../../export/projectFormat';
import { buildBringUpArtifacts } from '../bringupArtifacts';

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
});
