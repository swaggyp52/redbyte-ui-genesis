// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { mergePersistedRuntimeState, useProjectRuntime, type RuntimeVerifyRun } from '../projectRuntime';
import { BROWSER_ENGINE_VERSION, compactNativeTrace, firstRecordingDifference, outputDigest, summarizeRepetitions } from '../runDeterminism';

function execute(reproduceRunId?: string) {
  const state = useProjectRuntime.getState();
  return state.runVerification({ scenarioId: state.activeScenarioId, scenarioName: 'Experiment',
    deterministicHash: 'irrelevant-display-hash', rows: [], reproduceRunId,
    ranAtIso: '2026-09-12T00:00:00.000Z' });
}

describe('visible determinism at the recording owner', () => {
  beforeEach(() => {
    localStorage.clear();
    useProjectRuntime.getState().loadExample('full-adder');
  });

  it('executes four times, retains distinct recordings even with identical wall time, and exposes one identity and output digest', () => {
    const first = execute();
    expect(first.identity?.engine).toBe(BROWSER_ENGINE_VERSION);
    expect(first.outputDigest).toMatch(/^[a-f0-9]+$/);
    const repeats = [execute(first.runId), execute(first.runId), execute(first.runId)];
    expect(new Set([first, ...repeats].map(run => run.runId)).size).toBe(4);
    for (const repeat of repeats) {
      expect(repeat.identity).toEqual(first.identity);
      expect(repeat.outputDigest).toBe(first.outputDigest);
      expect(repeat.waveform).toEqual(first.waveform);
      expect(repeat.reproducedFromRunId).toBe(first.runId);
    }
    const summary = summarizeRepetitions(repeats[2], useProjectRuntime.getState().verifyRunArchive);
    expect(summary.runs).toHaveLength(4);
    expect(summary.identical).toBe(4);
    expect(summary.difference).toBeNull();
  });

  it('reproduces the retained topology and stimulus after edits without replacing or approving the current design', () => {
    const original = execute();
    const originalBytes = JSON.stringify(useProjectRuntime.getState().verifyRunArchive[0]);
    const state = useProjectRuntime.getState();
    const edited = structuredClone(state.circuit);
    const gate = edited.nodes.find(node => node.type === 'XOR')!;
    expect(gate).toBeDefined();
    gate.type = 'OR';
    state.applyCircuitMutation(edited);
    const vectors = useProjectRuntime.getState().projectVectors.map(vector => ({ ...vector, inputs: { ...vector.inputs } }));
    const input = Object.keys(vectors[0].inputs)[0];
    vectors[0].inputs[input] = vectors[0].inputs[input] === 1 ? 0 : 1;
    useProjectRuntime.getState().setVectors(vectors);
    const currentBytes = JSON.stringify({ circuit: useProjectRuntime.getState().circuit, vectors: useProjectRuntime.getState().projectVectors });
    const repeat = execute(original.runId);
    expect(repeat.identity).toEqual(original.identity);
    expect(repeat.outputDigest).toBe(original.outputDigest);
    expect(useProjectRuntime.getState().projectHealthCore.dirtySinceVerify).toBe(true);
    expect(JSON.stringify({ circuit: useProjectRuntime.getState().circuit, vectors: useProjectRuntime.getState().projectVectors })).toBe(currentBytes);
    expect(JSON.stringify(useProjectRuntime.getState().verifyRunArchive[0])).toBe(originalBytes);
    const current = execute();
    expect(current.identity?.design).not.toBe(original.identity?.design);
    expect(current.identity?.stimulus).not.toBe(original.identity?.stimulus);
  });

  it('retains identity, replay inputs and sequence across reload; rejects unavailable engines and foreign identities', () => {
    const first = execute();
    const persisted = JSON.parse(JSON.stringify(useProjectRuntime.getState()));
    const restored = mergePersistedRuntimeState(persisted, useProjectRuntime.getState());
    expect(restored.verifyRunArchive[0].identity).toEqual(first.identity);
    expect(restored.verifyRunArchive[0].executionInput).toEqual(first.executionInput);
    expect(restored.verifyRunHistory[0].outputDigest).toBe(first.outputDigest);
    useProjectRuntime.setState(restored);
    expect(execute(first.runId).sequence).toBe(2);
    expect(() => execute('another-project-run')).toThrow(/cannot be reproduced/);
    useProjectRuntime.setState({ verifyRunArchive: [{ ...first, identity: { ...first.identity!, engine: 'unavailable-v0' } }] });
    expect(() => execute(first.runId)).toThrow(/engine version/);
  });

  it('reports the exact first divergent value and distinguishes an absent sample from zero', () => {
    const baseline = { waveform: [{ tick: 5, signals: { Q: '0' }, mismatches: [] }] };
    const divergent = { waveform: [{ tick: 5, signals: { Q: '1' }, mismatches: [] }] };
    expect(outputDigest(divergent)).not.toBe(outputDigest(baseline));
    expect(firstRecordingDifference(baseline, divergent)).toEqual({ tick: 5, signal: 'Q', expected: '0', actual: '1' });
    expect(firstRecordingDifference(baseline, { waveform: [] })).toEqual({ tick: 5, signal: 'sample', expected: 'recorded', actual: 'unrecorded' });
  });

  it('does not change recorded outputs when optional checks add display aliases', () => {
    const state = useProjectRuntime.getState();
    const authored = structuredClone(state.projectVectors);
    state.setVectors(authored.map(vector => ({ ...vector, expected: {} })));
    const observed = execute();
    expect(observed.assertionStatus).toBe('not-configured');
    useProjectRuntime.getState().setVectors(authored);
    const checked = execute();
    expect(checked.report.rows.length).toBeGreaterThan(0);
    expect(checked.nativeTrace).toBeDefined();
    expect(checked.nativeTrace).toEqual(observed.nativeTrace);
    expect(checked.outputDigest).toBe(observed.outputDigest);
    expect(firstRecordingDifference(observed, checked)).toBeNull();
    expect(checked.identity?.stimulus).not.toBe(observed.identity?.stimulus);
  });

  it('compacts native endpoint names losslessly, including missing values and X/Z', () => {
    const waveform: RuntimeVerifyRun['waveform'] = [
      { tick: 0, signals: { 'u_fa0/x1.out': '0', 'u_fa1/x1.out': '1', floating: 'X' }, mismatches: [] },
      { tick: 5, signals: { 'u_fa0/x1.out': '1', floating: 'Z' }, mismatches: [] },
    ];
    const nativeTrace = JSON.parse(JSON.stringify(compactNativeTrace(waveform)));
    expect(firstRecordingDifference({ waveform }, { waveform: [], nativeTrace })).toBeNull();
    expect(outputDigest({ waveform: [], nativeTrace })).toBe(outputDigest({ waveform }));
    expect(firstRecordingDifference({ waveform }, { waveform: [], nativeTrace: { ...nativeTrace, frames: [] } })).toMatchObject({ tick: 0, actual: 'unrecorded' });
  });
});
