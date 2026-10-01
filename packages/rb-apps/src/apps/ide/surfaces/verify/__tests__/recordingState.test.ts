import { describe, expect, it } from 'vitest';
import type { RuntimeVerifyRun } from '../../../projectRuntime';
import { describeRecordingState, recordingPickerLabel } from '../recordingState';

function run(overrides: Partial<RuntimeVerifyRun> & { rows?: Array<'pass' | 'fail'> }): RuntimeVerifyRun {
  const { rows = [], ...rest } = overrides;
  return {
    runId: 'r1',
    projectId: 'p',
    scenarioId: 's',
    scenarioName: 'Default',
    sequence: 1,
    status: rows.includes('fail') ? 'fail' : 'pass',
    runKind: 'verify',
    assertionStatus: rows.length === 0 ? 'not-configured' : rows.includes('fail') ? 'failing' : 'passing',
    identity: { design: 'd', stimulus: 's', engine: 'redbyte-browser-v1' },
    outputDigest: 'aaaaaaaa',
    executionInput: { ioRows: [], vectors: [], projectHash: 'h' },
    circuitSnapshot: { nodes: [], connections: [] },
    deterministicHash: 'x',
    reportHash: 'y',
    generatedAtIso: '2026-09-16T00:00:00.000Z',
    schedule: 'combinational',
    meta: {} as RuntimeVerifyRun['meta'],
    report: { rows: rows.map((status, index) => ({ tick: index, signal: 'LD0', expected: '1', actual: status === 'fail' ? '0' : '1', status })) } as unknown as RuntimeVerifyRun['report'],
    waveform: [{ tick: 0, signals: { LD0: '1' }, mismatches: [] }] as unknown as RuntimeVerifyRun['waveform'],
    ...rest,
  } as RuntimeVerifyRun;
}

describe('describeRecordingState', () => {
  it('names the five states a reader must tell apart', () => {
    expect(describeRecordingState({ run: null, archive: [], changes: [], stale: false })).toMatchObject({
      verdict: 'none', currency: 'none', label: 'No recording yet', checks: null,
    });
    const unchecked = run({ rows: [] });
    expect(describeRecordingState({ run: unchecked, archive: [unchecked], changes: [], stale: false })).toMatchObject({
      verdict: 'unchecked', currency: 'current', label: 'No checks · outputs recorded', checks: { total: 0, failed: 0 },
    });
    const passed = run({ rows: ['pass', 'pass'] });
    expect(describeRecordingState({ run: passed, archive: [passed], changes: [], stale: false })).toMatchObject({
      verdict: 'pass', label: '2 checks passed', checks: { total: 2, failed: 0 },
    });
    const failed = run({ rows: ['pass', 'fail', 'fail'] });
    expect(describeRecordingState({ run: failed, archive: [failed], changes: [], stale: false })).toMatchObject({
      verdict: 'fail', label: '2 of 3 checks failed', checks: { total: 3, failed: 2 },
    });
    const differs = describeRecordingState({ run: failed, archive: [failed], changes: ['Design changed: G XOR → OR'], stale: true });
    expect(differs.currency).toBe('differs');
    expect(differs.verdict).toBe('fail');
    expect(differs.changes).toEqual(['Design changed: G XOR → OR']);
    expect(differs.currencyLabel).toBe('Current work differs');
  });

  it('never turns a trace or an unevaluated run into a pass', () => {
    const trace = run({ rows: ['pass'], runKind: 'trace', assertionStatus: 'not-configured' });
    expect(describeRecordingState({ run: trace, archive: [trace], changes: [], stale: false }).verdict).toBe('unchecked');
    const unevaluated = run({ rows: ['pass'], assertionStatus: 'not-evaluated' });
    expect(describeRecordingState({ run: unevaluated, archive: [unevaluated], changes: [], stale: false })).toMatchObject({
      verdict: 'not-evaluated', label: 'Checks not evaluated',
    });
  });

  it('reports why a recording cannot be reproduced instead of substituting today\'s design', () => {
    const complete = run({});
    expect(describeRecordingState({ run: complete, archive: [complete], changes: [], stale: false }).reproducible).toEqual({ ok: true });
    const legacy = run({ executionInput: undefined });
    expect(describeRecordingState({ run: legacy, archive: [legacy], changes: [], stale: false }).reproducible).toEqual({
      ok: false, reason: 'This older recording did not retain reproduction inputs.',
    });
    const noTopology = run({ circuitSnapshot: undefined });
    expect(describeRecordingState({ run: noTopology, archive: [noTopology], changes: [], stale: false }).reproducible.ok).toBe(false);
    const foreignEngine = run({ identity: { design: 'd', stimulus: 's', engine: 'redbyte-browser-v0' } });
    expect(describeRecordingState({ run: foreignEngine, archive: [foreignEngine], changes: [], stale: false }).reproducible).toEqual({
      ok: false, reason: 'The recorded engine is unavailable.',
    });
  });

  it('lists only this scenario\'s recordings for the picker, oldest first, with a verdict each', () => {
    // Distinct stimulus identities: a repaired circuit or edited checks is a new configuration.
    const first = run({ runId: 'r1', sequence: 1, rows: ['fail'], identity: { design: 'd1', stimulus: 's', engine: 'redbyte-browser-v1' } });
    const second = run({ runId: 'r2', sequence: 2, rows: ['pass'], identity: { design: 'd2', stimulus: 's', engine: 'redbyte-browser-v1' } });
    const other = run({ runId: 'r3', sequence: 3, scenarioId: 'other', rows: [], identity: { design: 'd2', stimulus: 'other', engine: 'redbyte-browser-v1' } });
    const state = describeRecordingState({ run: second, archive: [first, second, other], changes: [], stale: false });
    expect(state.options.map((option) => option.runId)).toEqual(['r1', 'r2']);
    expect(state.options.map((option) => option.label)).toEqual(['Recording 1', 'Recording 2']);
    expect(state.options.map((option) => option.verdictLabel)).toEqual(['checks failed', 'checks passed']);
    expect(state.ordinal).toBe(2);
    expect(state.repetition).toBeNull();
    expect(recordingPickerLabel(run({ sequence: undefined, rows: [] }), 4)).toBe('Recording 5');
  });

  it('counts repetitions only across identical configurations and the same project', () => {
    const a = run({ runId: 'r1', sequence: 1 });
    const b = run({ runId: 'r2', sequence: 2, reproducedFromRunId: 'r1' });
    const foreign = run({ runId: 'r9', sequence: 9, projectId: 'other' });
    const state = describeRecordingState({ run: b, archive: [a, b, foreign], changes: [], stale: false });
    expect(state.repetition).toEqual({ runs: 2, identical: 2 });
  });

  it('compares PASS to FAIL to PASS and repeated runs against each selected recording\'s predecessor', () => {
    const first = run({ runId: 'r1', sequence: 1, rows: ['pass', 'pass'] });
    const second = run({ runId: 'r2', sequence: 2, rows: ['pass', 'fail'] });
    const third = run({ runId: 'r3', sequence: 3, rows: ['pass', 'pass'] });
    const fourth = run({ runId: 'r4', sequence: 4, rows: ['pass', 'pass'] });
    const archive = [first, second, third, fourth];
    const state = (selected: RuntimeVerifyRun) => describeRecordingState({ run: selected, archive, stale: false, changes: [] });
    expect(state(first).comparison).toMatchObject({ verdict: 'pass', previous: null, failedDelta: null });
    expect(state(second).comparison).toMatchObject({ verdict: 'fail', previous: { runId: 'r1' }, failedDelta: 1 });
    expect(state(third).comparison).toMatchObject({ verdict: 'pass', previous: { runId: 'r2' }, failedDelta: -1 });
    expect(state(fourth).comparison).toMatchObject({ verdict: 'pass', previous: { runId: 'r3' }, failedDelta: 0 });
    // Saving/reopening or restoring the same archive cannot reverse its chronology.
    const restored = JSON.parse(JSON.stringify(archive)) as RuntimeVerifyRun[];
    expect(describeRecordingState({ run: restored[1], archive: restored, stale: true, changes: ['Checks changed'] })).toMatchObject({
      verdict: 'fail', currency: 'differs', comparison: { runId: 'r2', previous: { runId: 'r1' }, failedDelta: 1 },
    });
  });

  it('excludes other projects, other scenarios, unchecked traces and unevaluated checks from comparison', () => {
    const first = run({ runId: 'first', rows: ['pass'] });
    const foreign = run({ runId: 'foreign', projectId: 'other-project', rows: ['fail'] });
    const other = run({ runId: 'other', scenarioId: 'other-scenario', rows: ['fail'] });
    const trace = run({ runId: 'trace', runKind: 'trace', rows: [] });
    const unevaluated = run({ runId: 'unevaluated', assertionStatus: 'not-evaluated', rows: ['fail'] });
    const selected = run({ runId: 'selected', rows: ['fail'] });
    const state = describeRecordingState({ run: selected, archive: [first, foreign, other, trace, unevaluated, selected], changes: [], stale: false });
    expect(state.options.map(option => option.runId)).toEqual(['first', 'trace', 'unevaluated', 'selected']);
    expect(state.comparison).toMatchObject({ previous: { runId: 'first' }, failedDelta: 1 });
    expect(describeRecordingState({ run: trace, archive: [first, trace], changes: [], stale: false }).comparison).toBeNull();
  });

  it('does not borrow a predecessor when the selected legacy run is missing from the archive', () => {
    const selected = run({ runId: 'legacy', rows: ['fail'] });
    const later = run({ runId: 'later', rows: ['pass'] });
    expect(describeRecordingState({ run: selected, archive: [later], stale: false, changes: [] }).comparison).toMatchObject({
      runId: 'legacy', verdict: 'fail', previous: null, failedDelta: null,
    });
  });
});
