// @vitest-environment jsdom
import { act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mergePersistedRuntimeState, useProjectRuntime } from '../projectRuntime';
import { IDE_EXAMPLES } from '../examplesCatalog';

/**
 * P2.5H P0 — a freshly loaded starter must already be in the form rehydration
 * produces. Otherwise the first reload rewrites io-row order, mapping labels and
 * vector keys without any user edit, and the run recorded before the reload
 * honestly reads as "the pin mapping and the scenario changed".
 *
 * Contract: rehydrating a fresh starter is a no-op for every input the run
 * hashes are built from.
 */
describe('projectRuntime canonical starter load', () => {
  for (const example of IDE_EXAMPLES) {
    it(`rehydration is a no-op for the fresh starter "${example.id}"`, () => {
      act(() => {
        useProjectRuntime.getState().replaceWithBlankProject();
        useProjectRuntime.getState().loadExample(example.id);
      });
      const fresh = useProjectRuntime.getState();
      expect(fresh.activeExampleId).toBe(example.id);
      const rehydrated = mergePersistedRuntimeState({ ...fresh }, fresh);

      expect(rehydrated.projectIoRows).toEqual(fresh.projectIoRows);
      expect(rehydrated.hardwareMappingV2).toEqual(fresh.hardwareMappingV2);
      expect(rehydrated.projectVectors).toEqual(fresh.projectVectors);
      expect(rehydrated.scenarios).toEqual(fresh.scenarios);
      expect(rehydrated.activeScenarioId).toBe(fresh.activeScenarioId);
      expect(rehydrated.circuit.nodes.map((node) => node.id)).toEqual(
        fresh.circuit.nodes.map((node) => node.id)
      );
    });
  }

  it('keys starter vectors by io-row id, never by boundary node id', () => {
    act(() => {
      useProjectRuntime.getState().replaceWithBlankProject();
      useProjectRuntime.getState().loadExample('two-bit-counter');
    });
    const state = useProjectRuntime.getState();
    const rowIds = new Set(state.projectIoRows.map((row) => row.id));
    for (const vector of state.projectVectors) {
      for (const key of [...Object.keys(vector.inputs ?? {}), ...Object.keys(vector.expected ?? {})]) {
        expect(rowIds.has(key), `vector key "${key}" is not an io-row id`).toBe(true);
      }
    }
    const scenario = state.scenarios.find((entry) => entry.id === state.activeScenarioId);
    expect(scenario?.vectors.map((vector) => Object.keys(vector.inputs))).toEqual(
      state.projectVectors.map((vector) => Object.keys(vector.inputs))
    );
  });
});
