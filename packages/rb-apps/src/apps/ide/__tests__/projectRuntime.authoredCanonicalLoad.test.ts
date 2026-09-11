import { act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mergePersistedRuntimeState, useProjectRuntime } from '../projectRuntime';
import { buildCurrentVerifyProjectHash } from '../verifyProjectHash';
import { buildCurrentVerifyReplayHash } from '../../IdeApp';
import { computeScenarioContentHash } from '../verifyScenario';

/**
 * P2.5H — rehydration must be a no-op for an AUTHORED project, not only a fresh starter.
 * The canonical-load work proved a freshly loaded starter survives a reload unchanged; a student
 * who then authors an expectation must get the same guarantee, otherwise reopening the project
 * silently changes the verify hash and a current run (and a downloaded package built from it)
 * reads stale for no reason the student can see.
 */
function authorExpectation(tick: number, signalId: string, value: 0 | 1) {
  const state = useProjectRuntime.getState();
  const vectors = state.projectVectors.map((vector) =>
    vector.tick === tick
      ? { ...vector, expected: { ...(vector.expected ?? {}), [signalId]: value } }
      : vector
  );
  act(() => {
    useProjectRuntime.getState().setVectors(vectors);
  });
}

function verifyHash() {
  const state = useProjectRuntime.getState();
  return buildCurrentVerifyProjectHash({
    circuit: state.circuit,
    projectVectors: state.projectVectors,
    customVectors: state.customVectors,
    projectIoRows: state.projectIoRows,
  });
}

describe('projectRuntime — an authored project rehydrates unchanged', () => {
  it('keeps vectors, scenarios and the verify hash identical across a reload of the full adder', () => {
    act(() => {
      useProjectRuntime.getState().replaceWithBlankProject();
      useProjectRuntime.getState().loadExample('full-adder');
    });
    const outputId = useProjectRuntime
      .getState()
      .projectIoRows.find((row) => row.direction === 'out')?.id;
    expect(outputId, 'the full adder must expose an output row to author against').toBeTruthy();

    const lastTick = Math.max(...useProjectRuntime.getState().projectVectors.map((vector) => vector.tick));
    authorExpectation(lastTick, outputId as string, 0);
    authorExpectation(lastTick, outputId as string, 1);

    const authored = useProjectRuntime.getState();
    const hashBefore = verifyHash();
    const rehydrated = mergePersistedRuntimeState({ ...authored }, authored);

    expect(rehydrated.projectVectors).toEqual(authored.projectVectors);
    expect(rehydrated.scenarios).toEqual(authored.scenarios);
    expect(rehydrated.activeScenarioId).toBe(authored.activeScenarioId);
    expect(rehydrated.projectIoRows).toEqual(authored.projectIoRows);

    const hashAfter = buildCurrentVerifyProjectHash({
      circuit: rehydrated.circuit,
      projectVectors: rehydrated.projectVectors,
      customVectors: rehydrated.customVectors,
      projectIoRows: rehydrated.projectIoRows,
    });
    expect(hashAfter, 'the verify hash must survive a reload of an authored project').toBe(hashBefore);
  });

  it('keeps the replay hash identical through a real persisted round trip', () => {
    act(() => {
      useProjectRuntime.getState().replaceWithBlankProject();
      useProjectRuntime.getState().loadExample('full-adder');
    });
    const outputId = useProjectRuntime
      .getState()
      .projectIoRows.find((row) => row.direction === 'out')?.id as string;
    const lastTick = Math.max(...useProjectRuntime.getState().projectVectors.map((vector) => vector.tick));
    authorExpectation(lastTick, outputId, 0);

    const authored = useProjectRuntime.getState();
    const replayInput = {
      circuit: authored.circuit,
      projectVectors: authored.projectVectors,
      customVectors: authored.customVectors,
      projectIoRows: authored.projectIoRows,
    };
    const replayBefore = buildCurrentVerifyReplayHash(replayInput);

    // Persistence really does serialize: a reload parses JSON, it does not clone live objects.
    const persisted = JSON.parse(JSON.stringify(authored));
    const rehydrated = mergePersistedRuntimeState(persisted, authored);
    const replayAfter = buildCurrentVerifyReplayHash({
      circuit: rehydrated.circuit,
      projectVectors: rehydrated.projectVectors,
      customVectors: rehydrated.customVectors,
      projectIoRows: rehydrated.projectIoRows,
    });

    // Simulate compares this hash against the one stamped on the restored run: if it drifts, an
    // untouched project reads STALE after a reload while the workflow authority says current.
    expect(replayAfter, 'the replay hash must survive a serialized reload').toBe(replayBefore);
  });

  it('hashes scenario CONTENT, not authoring identity, so a dropped vector id cannot fake staleness', () => {
    act(() => {
      useProjectRuntime.getState().replaceWithBlankProject();
      useProjectRuntime.getState().loadExample('full-adder');
    });
    const state = useProjectRuntime.getState();
    const scenario = state.scenarios.find((entry) => entry.id === state.activeScenarioId);
    expect(scenario, 'the full adder must have an active scenario').toBeTruthy();
    const vectors = (scenario as { vectors: Array<Record<string, unknown>> }).vectors;
    expect(vectors.length, 'the scenario must have vectors to hash').toBeGreaterThan(0);

    // The same scenario legitimately arrives with and without vector ids depending on the path it
    // travelled: `cloneVector` rebuilds vectors without them, and persistence does not carry them.
    // Both must hash the same, or a run stamped while ids were present reports itself stale the
    // moment the project is reopened.
    const withIds = computeScenarioContentHash({
      ...(scenario as object),
      vectors: vectors.map((vector, index) => ({ ...vector, id: `event-${index + 1}` })),
    } as never);
    const withoutIds = computeScenarioContentHash({
      ...(scenario as object),
      vectors: vectors.map(({ id: _id, ...rest }) => rest),
    } as never);
    expect(withoutIds, 'an authoring id must not change the scenario content hash').toBe(withIds);
  });
});
