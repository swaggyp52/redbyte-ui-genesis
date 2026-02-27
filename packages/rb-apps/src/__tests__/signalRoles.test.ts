import { describe, it, expect } from 'vitest';
import { buildVerifyReport } from '../apps/ide/verifyReport';

describe('buildVerifyReport - signalRoles', () => {
  it('passes through explicit signal roles', () => {
    const report = buildVerifyReport({
      scenarioId: 's',
      scenarioName: 'S',
      status: 'pass',
      deterministicHash: 'h',
      rows: [],
      vectors: [],
      generatedAtIso: '2026-01-01T00:00:00.000Z',
      signalRoles: { CLK: 'clock', SW0: 'input', LD0: 'output' },
    });

    expect(report.signalRoles.CLK).toBe('clock');
    expect(report.signalRoles.SW0).toBe('input');
    expect(report.signalRoles.LD0).toBe('output');
  });

  it('defaults to an empty role map when omitted', () => {
    const report = buildVerifyReport({
      scenarioId: 's',
      scenarioName: 'S',
      status: 'pass',
      deterministicHash: 'h',
      rows: [],
      vectors: [],
      generatedAtIso: '2026-01-01T00:00:00.000Z',
    });

    expect(report.signalRoles).toEqual({});
  });

  it('reportHash is not affected by signalRoles metadata', () => {
    const base = buildVerifyReport({
      scenarioId: 's',
      scenarioName: 'S',
      status: 'pass',
      deterministicHash: 'h',
      rows: [],
      vectors: [],
      generatedAtIso: '2026-01-01T00:00:00.000Z',
    });
    const withRoles = buildVerifyReport({
      scenarioId: 's',
      scenarioName: 'S',
      status: 'pass',
      deterministicHash: 'h',
      rows: [],
      vectors: [],
      generatedAtIso: '2026-01-01T00:00:00.000Z',
      signalRoles: { CLK: 'clock' },
    });

    expect(base.reportHash).toBe(withRoles.reportHash);
  });

  it('supports reset-oriented role labels', () => {
    const report = buildVerifyReport({
      scenarioId: 's',
      scenarioName: 'S',
      status: 'pass',
      deterministicHash: 'h',
      rows: [],
      vectors: [],
      generatedAtIso: '2026-01-01T00:00:00.000Z',
      signalRoles: { rst: 'reset', btnc: 'reset', reset_n: 'reset' },
    });

    expect(report.signalRoles.rst).toBe('reset');
    expect(report.signalRoles.btnc).toBe('reset');
    expect(report.signalRoles.reset_n).toBe('reset');
  });
});
