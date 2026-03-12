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
});
