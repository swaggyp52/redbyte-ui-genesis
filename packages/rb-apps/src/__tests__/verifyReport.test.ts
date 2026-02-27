import { describe, it, expect } from 'vitest';
import { buildVerifyReport } from '../apps/ide/verifyReport';

describe('buildVerifyReport - inputsAtTick', () => {
  it('joins vectors inputs into inputsAtTick by tick number', () => {
    const report = buildVerifyReport({
      scenarioId: 'test',
      scenarioName: 'Test',
      status: 'pass',
      deterministicHash: 'abc',
      rows: [
        { tick: 0, signal: 'out', expected: '0', actual: '0' },
        { tick: 1, signal: 'out', expected: '1', actual: '1' },
      ],
      vectors: [
        { id: 'v1', tick: 0, inputs: { a: 0, b: 0 }, expected: { out: 0 } },
        { id: 'v2', tick: 1, inputs: { a: 1, b: 0 }, expected: { out: 1 } },
      ],
      generatedAtIso: '2026-01-01T00:00:00.000Z',
    });

    expect(report.inputsAtTick[0]).toEqual({ a: 0, b: 0 });
    expect(report.inputsAtTick[1]).toEqual({ a: 1, b: 0 });
  });

  it('inputsAtTick is empty when no vectors are provided', () => {
    const report = buildVerifyReport({
      scenarioId: 'test',
      scenarioName: 'Test',
      status: 'pass',
      deterministicHash: 'abc',
      rows: [],
      vectors: [],
      generatedAtIso: '2026-01-01T00:00:00.000Z',
    });

    expect(report.inputsAtTick).toEqual({});
  });

  it('reportHash is stable for identical report inputs', () => {
    const base = buildVerifyReport({
      scenarioId: 's1',
      scenarioName: 'S1',
      status: 'pass',
      deterministicHash: 'h1',
      rows: [{ tick: 0, signal: 'q', expected: '1', actual: '1' }],
      vectors: [{ id: 'v1', tick: 0, inputs: { a: 1 }, expected: { q: 1 } }],
      generatedAtIso: '2026-01-01T00:00:00.000Z',
    });
    const again = buildVerifyReport({
      scenarioId: 's1',
      scenarioName: 'S1',
      status: 'pass',
      deterministicHash: 'h1',
      rows: [{ tick: 0, signal: 'q', expected: '1', actual: '1' }],
      vectors: [{ id: 'v1', tick: 0, inputs: { a: 1 }, expected: { q: 1 } }],
      generatedAtIso: '2026-01-01T00:00:00.000Z',
    });

    expect(base.reportHash).toBe(again.reportHash);
  });
});
