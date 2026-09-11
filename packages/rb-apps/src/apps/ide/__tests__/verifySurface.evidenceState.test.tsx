// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { VerifySurface } from '../surfaces/VerifySurface';
import type { RuntimeVerifyRun, VerifyRunMeta } from '../projectRuntime';

/**
 * P2.5H — the evidence row names what the waveform is, apart from the verdict:
 * RECORDED · CURRENT for a run whose inputs are unchanged, STALE with the
 * changed input named otherwise. (RUNNING and REPLAYING are transient states of
 * the same chip; REPLAYING is covered by the playback contract.)
 */
const SIGNALS = [
  { id: 'a_0', label: 'A[0]', direction: 'in' as const, nodeId: 'a0' },
  { id: 'sum_0', label: 'SUM[0]', direction: 'out' as const, nodeId: 'sum0' },
];
const VECTORS = [
  { id: 'v0', tick: 0, inputs: { a_0: 0 as const }, expected: { sum_0: 0 as const } },
  { id: 'v1', tick: 1, inputs: { a_0: 1 as const }, expected: { sum_0: 1 as const } },
];

function makeRun(): RuntimeVerifyRun {
  const rows = [
    { tick: 0, signal: 'sum_0', expected: '0', actual: '0', status: 'pass' as const },
    { tick: 1, signal: 'sum_0', expected: '1', actual: '1', status: 'pass' as const },
  ];
  return {
    projectId: 'rb-test',
    scenarioId: 'default',
    scenarioName: 'Default',
    runKind: 'verify',
    status: 'pass',
    deterministicHash: 'evidence-state',
    reportHash: 'r1',
    generatedAtIso: '2026-09-05T07:00:00.000Z',
    schedule: 'combinational',
    meta: {} as VerifyRunMeta,
    report: {
      schemaVersion: 'rb.verify-report.v1',
      scenarioId: 'default',
      scenarioName: 'Default',
      status: 'pass',
      deterministicHash: 'evidence-state',
      rows,
      vectors: VECTORS.map((vector) => ({ ...vector })),
      inputsAtTick: { 0: { a_0: 0 }, 1: { a_0: 1 } },
      signalRoles: { a_0: 'input', sum_0: 'output' },
      generatedAtIso: '2026-09-05T07:00:00.000Z',
      reportHash: 'r1',
    },
    waveform: [
      { tick: 0, signals: { a_0: '0', sum_0: '0' }, mismatches: [] },
      { tick: 1, signals: { a_0: '1', sum_0: '1' }, mismatches: [] },
    ],
  };
}

function renderSurface(extra: Partial<React.ComponentProps<typeof VerifySurface>> = {}) {
  return render(
    <VerifySurface
      hasVectors
      vectors={VECTORS}
      mappedInputs={[{ id: 'a_0', label: 'A[0]' }]}
      mappedSignals={SIGNALS}
      onOpenProjectVectors={vi.fn()}
      onVectorsChange={vi.fn()}
      deterministicHash="evidence-state"
      verifyMode="combinational"
      lastRun={makeRun()}
      {...extra}
    />
  );
}

describe('Simulate evidence state word', () => {
  it('reads RECORDED · CURRENT for a run whose inputs are unchanged', () => {
    const { getByTestId } = renderSurface();
    const chip = getByTestId('ide-verify-evidence-state');
    expect(chip.getAttribute('data-state')).toBe('recorded');
    expect(chip.textContent).toContain('RECORDED · CURRENT');
    expect(chip.getAttribute('title')).toContain('unchanged');
  });

  it('reads STALE and names the changed input when the app marks the run stale', () => {
    const { getByTestId } = renderSurface({
      forceRunStale: true,
      runStaleDetail: 'The design changed after this run.',
    });
    const chip = getByTestId('ide-verify-evidence-state');
    expect(chip.getAttribute('data-state')).toBe('stale');
    expect(chip.textContent).toContain('STALE');
    expect(getByTestId('ide-verify-evidence-state-reason').textContent).toBe('The design changed after this run.');
  });
});
