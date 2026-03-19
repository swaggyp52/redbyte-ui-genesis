import { describe, expect, it } from 'vitest';
import { buildVerifyReport, buildVerifyWaveSamples } from '../verifyReport';
import type { RuntimeSimTraceSample } from '../sim/simTypes';
import {
  buildCanonicalVerifyWaveSamples,
  normalizeSimulationTrace,
} from '../sim/traceContract';

describe('traceContract.normalizeSimulationTrace', () => {
  it('normalizes ticks, deduplicates by tick, and sorts signal keys', () => {
    const trace: RuntimeSimTraceSample[] = [
      { tick: 2, signals: { z: 1, a: 0 } },
      { tick: Number.NaN, signals: { q: 1 } },
      { tick: 1, signals: { a: 1, c: 1 } },
      { tick: 1, signals: { b: 0, c: 1 } },
    ];

    const canonical = normalizeSimulationTrace(trace);

    expect(canonical.schemaVersion).toBe('rb.sim-trace.v1');
    expect(canonical.ticks).toEqual([0, 1, 2]);
    expect(canonical.frames.map((frame) => frame.tick)).toEqual([0, 1, 2]);
    expect(canonical.frames[0]?.signals).toEqual({ q: '1' });
    expect(canonical.frames[1]?.signals).toEqual({ a: '1', b: '0', c: '1' });
    expect(canonical.frames[2]?.signals).toEqual({ a: '0', z: '1' });
    expect(canonical.signalOrder).toEqual(['a', 'b', 'c', 'q', 'z']);
  });
});

describe('traceContract.buildCanonicalVerifyWaveSamples', () => {
  it('merges dense trace ticks with report mismatches', () => {
    const report = buildVerifyReport({
      scenarioId: 'trace-merge',
      scenarioName: 'Trace Merge',
      status: 'fail',
      deterministicHash: 'trace-merge-hash',
      rows: [
        { tick: 1, signal: 'out', expected: '1', actual: '0' },
        { tick: 3, signal: 'out', expected: '1', actual: '1' },
      ],
      vectors: [
        { id: 'vec-01', tick: 1, inputs: { in: 1 }, expected: { out: 1 } },
        { id: 'vec-02', tick: 3, inputs: { in: 1 }, expected: { out: 1 } },
      ],
      generatedAtIso: '2026-03-17T00:00:00.000Z',
    });

    const trace: RuntimeSimTraceSample[] = [
      { tick: 0, signals: { in: 0, out: 0 } },
      { tick: 1, signals: { in: 1, out: 0 } },
      { tick: 2, signals: { in: 1, out: 1 } },
      { tick: 3, signals: { in: 1, out: 1 } },
    ];

    const waveform = buildCanonicalVerifyWaveSamples(report, trace);

    expect(waveform.map((sample) => sample.tick)).toEqual([0, 1, 2, 3]);
    expect(waveform.find((sample) => sample.tick === 1)?.mismatches).toEqual([
      { signal: 'out', expected: '1', actual: '0' },
    ]);
    expect(waveform.find((sample) => sample.tick === 2)?.mismatches).toEqual([]);
    expect(waveform.find((sample) => sample.tick === 1)?.signals.in).toBe('1');
    expect(waveform.find((sample) => sample.tick === 1)?.signals.out).toBe('0');
  });

  it('falls back to report waveform when trace is empty', () => {
    const report = buildVerifyReport({
      scenarioId: 'report-only',
      scenarioName: 'Report Only',
      status: 'pass',
      deterministicHash: 'report-only-hash',
      rows: [{ tick: 0, signal: 'out', expected: '1', actual: '1' }],
      vectors: [{ id: 'vec-01', tick: 0, inputs: { in: 1 }, expected: { out: 1 } }],
      generatedAtIso: '2026-03-17T00:00:00.000Z',
    });

    const waveform = buildCanonicalVerifyWaveSamples(report, []);

    expect(waveform).toEqual(buildVerifyWaveSamples(report));
  });
});