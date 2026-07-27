import { describe, expect, it } from 'vitest';
import type { RBProject } from '../../../export/projectFormat';
import { buildVerifyDeterminismHash } from '../verifyDeterminism';

function buildProject(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-07-27T00:00:00.000Z',
    updatedAt: '2026-07-27T00:00:00.000Z',
    name: 'Layout authority',
    circuit: {
      nodes: [
        { id: 'in', type: 'INPUT', position: { x: 20, y: 30 }, config: {}, state: {} },
        { id: 'out', type: 'OUTPUT', position: { x: 220, y: 30 }, config: {}, state: {} },
      ],
      connections: [
        {
          from: { nodeId: 'in', portName: 'out' },
          to: { nodeId: 'out', portName: 'in' },
        },
      ],
    },
  };
}

describe('buildVerifyDeterminismHash', () => {
  it('ignores canvas geometry but changes for structural circuit edits', () => {
    const project = buildProject();
    const arranged: RBProject = {
      ...project,
      circuit: {
        ...project.circuit,
        nodes: project.circuit.nodes.map((node, index) => ({
          ...node,
          position: { x: 400 + index * 160, y: 240 },
          x: 400 + index * 160,
          y: 240,
        })),
      },
    };
    const disconnected: RBProject = {
      ...project,
      circuit: { ...project.circuit, connections: [] },
    };

    expect(buildVerifyDeterminismHash(arranged)).toBe(buildVerifyDeterminismHash(project));
    expect(buildVerifyDeterminismHash(disconnected)).not.toBe(buildVerifyDeterminismHash(project));
  });
});
