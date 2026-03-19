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

  it('instantiateMacro persists circuit and dirty flags without requiring markDesignMutated', () => {
    useProjectRuntime.getState().loadFromProject(buildMacroProject());

    const result = useProjectRuntime
      .getState()
      .instantiateMacro('macro-and-gate', { x: 520, y: 220 });

    expect(result).toBeTruthy();
    expect(result?.insertedNodeIds).toEqual(['node-v2-5']);
    const state = useProjectRuntime.getState();
    expect(state.circuit.nodes).toHaveLength(5);
    expect(state.projectHealthCore.dirtySinceVerify).toBe(true);
    expect(state.projectHealthCore.dirtySinceExport).toBe(true);
  });

  it('calling markDesignMutated with a stale circuit after instantiateMacro wipes the macro (documents the bug)', () => {
    // This test documents the exact persistence mismatch.
    // DesignSurface.handleInsertMacroOnCanvas must NOT call onCircuitMutated() after
    // instantiateMacro, because circuitStore holds the pre-insertion circuit until
    // the React sync effect fires. Calling markDesignMutated(staleCircuit) reverts
    // projectRuntime.circuit to the pre-insertion state, dropping the macro silently.
    useProjectRuntime.getState().loadFromProject(buildMacroProject());

    const staleCircuit = structuredClone(useProjectRuntime.getState().circuit);

    const result = useProjectRuntime
      .getState()
      .instantiateMacro('macro-and-gate', { x: 520, y: 220 });
    expect(result).toBeTruthy();
    expect(result?.insertedNodeIds).toEqual(['node-v2-5']);
    expect(useProjectRuntime.getState().circuit.nodes).toHaveLength(5); // macro inserted

    // Simulate what the old onCircuitMutated call did: push stale circuitStore back
    useProjectRuntime.getState().markDesignMutated(staleCircuit);

    // Macro is now silently gone — this is the trust break the fix prevents
    expect(useProjectRuntime.getState().circuit.nodes).toHaveLength(4);
  });

  it('preserves instantiated macros when markDesignMutated receives the runtime-authoritative circuit', () => {
    useProjectRuntime.getState().loadFromProject(buildMacroProject());

    const result = useProjectRuntime
      .getState()
      .instantiateMacro('macro-and-gate', { x: 520, y: 220 });
    expect(result).toBeTruthy();
    expect(result?.insertedNodeIds).toEqual(['node-v2-5']);

    const authoritativeCircuit = structuredClone(useProjectRuntime.getState().circuit);
    useProjectRuntime.getState().markDesignMutated(authoritativeCircuit);

    const state = useProjectRuntime.getState();
    expect(state.circuit.nodes).toHaveLength(5);
    expect(state.circuit.nodes.some((node) => node.id === 'node-v2-5')).toBe(true);
    expect(state.projectHealthCore.dirtySinceVerify).toBe(true);
    expect(state.projectHealthCore.dirtySinceExport).toBe(true);
  });

  it('routes macro insertion through runtime history undo and redo', () => {
    useProjectRuntime.getState().loadFromProject(buildMacroProject());

    const initialNodeCount = useProjectRuntime.getState().circuit.nodes.length;

    const result = useProjectRuntime
      .getState()
      .instantiateMacro('macro-and-gate', { x: 520, y: 220 });

    expect(result?.insertedNodeIds).toEqual(['node-v2-5']);
    expect(useProjectRuntime.getState().designPast).toHaveLength(1);
    expect(useProjectRuntime.getState().circuit.nodes).toHaveLength(initialNodeCount + 1);
    expect(useProjectRuntime.getState().macroInsertionCounts['macro-and-gate']).toBe(1);

    useProjectRuntime.getState().undoProjectEdit();

    expect(useProjectRuntime.getState().circuit.nodes).toHaveLength(initialNodeCount);
    expect(useProjectRuntime.getState().designFuture).toHaveLength(1);
    expect(useProjectRuntime.getState().macroInsertionCounts['macro-and-gate']).toBeUndefined();

    useProjectRuntime.getState().redoProjectEdit();

    expect(useProjectRuntime.getState().circuit.nodes).toHaveLength(initialNodeCount + 1);
    expect(useProjectRuntime.getState().macroInsertionCounts['macro-and-gate']).toBe(1);
  });
});
