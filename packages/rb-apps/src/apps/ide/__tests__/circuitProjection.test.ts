// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { buildCurrentVerifyProjectHash } from '../../IdeApp';
import { useCircuitStore } from '../../../stores/circuitStore';
import { digestValue } from '../../../utils/digest';
import { projectRuntimeCircuitToEditorStore } from '../circuitProjection';
import { useProjectRuntime } from '../projectRuntime';

function buildCircuit(seed: string): Circuit {
  return {
    nodes: [
      {
        id: `${seed}-input`,
        type: 'INPUT',
        label: `${seed}-in`,
        position: { x: 0, y: 0 },
        x: 0,
        y: 0,
        rotation: 0,
        config: {},
        state: {},
      },
      {
        id: `${seed}-output`,
        type: 'OUTPUT',
        label: `${seed}-out`,
        position: { x: 160, y: 0 },
        x: 160,
        y: 0,
        rotation: 0,
        config: {},
        state: {},
      },
    ],
    connections: [
      {
        from: { nodeId: `${seed}-input`, portName: 'out' },
        to: { nodeId: `${seed}-output`, portName: 'in' },
      },
    ],
  };
}

describe('circuitProjection', () => {
  beforeEach(() => {
    localStorage.clear();
    useCircuitStore.getState().reset();
    useProjectRuntime.getState().resetToActiveExample();
  });

  it('projects runtime authority into the editor store and clears local editor history', () => {
    useCircuitStore.getState().updateCircuit(buildCircuit('stale'), {
      skipHistory: false,
      enforceLimits: false,
    });
    expect(useCircuitStore.getState().past.length).toBeGreaterThan(0);

    const runtimeCircuit = buildCircuit('runtime');
    const changed = projectRuntimeCircuitToEditorStore(runtimeCircuit);

    expect(changed).toBe(true);
    expect(digestValue(useCircuitStore.getState().circuit)).toBe(digestValue(runtimeCircuit));
    expect(useCircuitStore.getState().past).toHaveLength(0);
    expect(useCircuitStore.getState().future).toHaveLength(0);
  });

  it('is a no-op when the editor store already matches runtime authority', () => {
    const runtimeCircuit = buildCircuit('runtime');

    expect(projectRuntimeCircuitToEditorStore(runtimeCircuit)).toBe(true);
    expect(projectRuntimeCircuitToEditorStore(structuredClone(runtimeCircuit))).toBe(false);
    expect(digestValue(useCircuitStore.getState().circuit)).toBe(digestValue(runtimeCircuit));
    expect(useCircuitStore.getState().past).toHaveLength(0);
    expect(useCircuitStore.getState().future).toHaveLength(0);
  });

  it('keeps runtime unchanged when the editor store drifts locally', () => {
    const runtimeCircuitBefore = structuredClone(useProjectRuntime.getState().circuit);

    useCircuitStore.getState().updateCircuit(buildCircuit('editor-only'), {
      skipHistory: true,
      enforceLimits: false,
    });

    expect(digestValue(useProjectRuntime.getState().circuit)).toBe(
      digestValue(runtimeCircuitBefore)
    );
  });

  it('keeps verify and export hashes tied to runtime state when the editor store drifts', () => {
    const buildRuntimeHash = () =>
      buildCurrentVerifyProjectHash({
        circuit: useProjectRuntime.getState().circuit,
        projectVectors: useProjectRuntime.getState().projectVectors,
        projectIoRows: useProjectRuntime.getState().projectIoRows,
      });

    const runtimeHashBefore = buildRuntimeHash();

    useCircuitStore.getState().updateCircuit(buildCircuit('editor-drift'), {
      skipHistory: true,
      enforceLimits: false,
    });

    expect(buildRuntimeHash()).toBe(runtimeHashBefore);
  });
});