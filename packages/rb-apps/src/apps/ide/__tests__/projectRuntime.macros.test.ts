import { beforeEach, describe, expect, it } from 'vitest';
import { createRBProject } from '../../../export/projectFormat';
import { useProjectRuntime } from '../projectRuntime';

function buildMacroProject() {
  return createRBProject({
    createdAt: '2026-03-11T00:00:00.000Z',
    name: 'runtime-macro-fixture',
    circuit: {
      nodes: [
        {
          id: 'node-v2-1',
          type: 'INPUT',
          label: 'A',
          position: { x: 0, y: 0 },
          rotation: 0,
          config: {},
          state: {},
        },
        {
          id: 'node-v2-2',
          type: 'INPUT',
          label: 'B',
          position: { x: 0, y: 80 },
          rotation: 0,
          config: {},
          state: {},
        },
        {
          id: 'node-v2-3',
          type: 'AND',
          position: { x: 140, y: 40 },
          rotation: 0,
          config: {},
          state: {},
        },
        {
          id: 'node-v2-4',
          type: 'OUTPUT',
          label: 'Q',
          position: { x: 280, y: 40 },
          rotation: 0,
          config: {},
          state: {},
        },
      ],
      connections: [
        { from: { nodeId: 'node-v2-1', portName: 'out' }, to: { nodeId: 'node-v2-3', portName: 'a' } },
        { from: { nodeId: 'node-v2-2', portName: 'out' }, to: { nodeId: 'node-v2-3', portName: 'b' } },
        { from: { nodeId: 'node-v2-3', portName: 'out' }, to: { nodeId: 'node-v2-4', portName: 'in' } },
      ],
    },
    ioMapping: {
      inputs: [
        { id: 'a', nodeId: 'node-v2-1', port: 'out', label: 'A', pin: 'V17' },
        { id: 'b', nodeId: 'node-v2-2', port: 'out', label: 'B', pin: 'V16' },
      ],
      outputs: [{ id: 'q', nodeId: 'node-v2-4', port: 'in', label: 'Q', pin: 'U16' }],
    },
    macros: [
      {
        id: 'macro-and-gate',
        name: 'AND Gate',
        createdAt: 1710000000000,
        inputs: [
          { id: 'input:node-v2-3.a', label: 'A', nodeId: 'node-v2-3', portName: 'a' },
          { id: 'input:node-v2-3.b', label: 'B', nodeId: 'node-v2-3', portName: 'b' },
        ],
        outputs: [{ id: 'output:node-v2-3.out', label: 'Q', nodeId: 'node-v2-3', portName: 'out' }],
        cluster: {
          nodes: [
            {
              originalId: 'node-v2-3',
              type: 'AND',
              x: 0,
              y: 0,
              config: {},
              state: {},
            },
          ],
          connections: [],
        },
      },
    ],
  });
}

describe('projectRuntime macros', () => {
  beforeEach(() => {
    localStorage.clear();
    useProjectRuntime.getState().resetToActiveExample();
  });

  it('loads macro libraries from saved projects and instantiates them into the circuit', () => {
    const project = buildMacroProject();
    useProjectRuntime.getState().loadFromProject(project);

    expect(useProjectRuntime.getState().macros).toHaveLength(1);

    const result = useProjectRuntime.getState().instantiateMacro('macro-and-gate', { x: 520, y: 220 });

    expect(result?.instanceLabel).toBe('AND_Gate_1');
    expect(result?.insertedNodeIds).toEqual(['node-v2-5']);
    expect(useProjectRuntime.getState().circuit.nodes).toHaveLength(5);
  });

  it('saves macros from the current circuit into the runtime library', () => {
    useProjectRuntime.getState().loadFromProject(buildMacroProject());

    const macro = useProjectRuntime.getState().saveMacro({
      selectedNodeIds: new Set(['node-v2-3']),
      name: 'Saved AND',
      description: 'Saved from runtime state',
    });

    expect(macro?.name).toBe('Saved AND');
    expect(useProjectRuntime.getState().macros.some((entry) => entry.name === 'Saved AND')).toBe(true);
  });
});