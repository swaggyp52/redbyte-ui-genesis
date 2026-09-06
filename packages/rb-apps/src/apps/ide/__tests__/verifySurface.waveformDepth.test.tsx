// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { VerifySurface } from '../surfaces/VerifySurface';
import type { RuntimeVerifyRun, VerifyRunMeta } from '../projectRuntime';

/**
 * P2.5H Waveform depth — Simulate folds indexed lanes into a bus lane, formats
 * it in the chosen radix, expands it to its bits on request, and keys the
 * expected overlay by lane from the run's own report rows.
 */
const SIGNALS = [
  { id: 'a_0', label: 'A[0]', direction: 'in' as const, nodeId: 'a0' },
  { id: 'sum_0', label: 'SUM[0]', direction: 'out' as const, nodeId: 'sum0' },
  { id: 'sum_1', label: 'SUM[1]', direction: 'out' as const, nodeId: 'sum1' },
];
const VECTORS = [
  { id: 'v0', tick: 0, inputs: { a_0: 0 as const }, expected: { sum_0: 0 as const, sum_1: 0 as const } },
  { id: 'v1', tick: 1, inputs: { a_0: 1 as const }, expected: { sum_0: 1 as const, sum_1: 1 as const } },
];

function makeRun(): RuntimeVerifyRun {
  const rows = [
    { tick: 0, signal: 'sum_0', expected: '0', actual: '0', status: 'pass' as const },
    { tick: 0, signal: 'sum_1', expected: '0', actual: '0', status: 'pass' as const },
    { tick: 1, signal: 'sum_0', expected: '1', actual: '1', status: 'pass' as const },
    { tick: 1, signal: 'sum_1', expected: '1', actual: '0', status: 'fail' as const },
  ];
  return {
    projectId: 'rb-test',
    scenarioId: 'default',
    scenarioName: 'Default',
    runKind: 'verify',
    status: 'fail',
    firstFailingTick: 1,
    deterministicHash: 'waveform-depth',
    reportHash: 'r1',
    generatedAtIso: '2026-09-05T07:00:00.000Z',
    schedule: 'combinational',
    meta: {} as VerifyRunMeta,
    report: {
      schemaVersion: 'rb.verify-report.v1',
      scenarioId: 'default',
      scenarioName: 'Default',
      status: 'fail',
      deterministicHash: 'waveform-depth',
      firstFailingTick: 1,
      rows,
      vectors: VECTORS.map((vector) => ({ ...vector })),
      inputsAtTick: { 0: { a_0: 0 }, 1: { a_0: 1 } },
      signalRoles: { a_0: 'input', sum_0: 'output', sum_1: 'output' },
      generatedAtIso: '2026-09-05T07:00:00.000Z',
      reportHash: 'r1',
    },
    waveform: [
      { tick: 0, signals: { a_0: '0', sum_0: '0', sum_1: '0' }, mismatches: [] },
      { tick: 1, signals: { a_0: '1', sum_0: '1', sum_1: '0' }, mismatches: [{ signal: 'sum_1', expected: '1', actual: '0' }] },
    ],
  };
}

function renderSurface() {
  return render(
    <VerifySurface
      hasVectors
      vectors={VECTORS}
      mappedInputs={[{ id: 'a_0', label: 'A[0]' }]}
      mappedSignals={SIGNALS}
      onOpenProjectVectors={vi.fn()}
      onVectorsChange={vi.fn()}
      deterministicHash="waveform-depth"
      verifyMode="combinational"
      lastRun={makeRun()}
    />
  );
}

describe('Simulate waveform depth — buses, radix, expected overlay', () => {
  it('folds SUM[0] and SUM[1] into a SUM[1:0] bus lane in hex by default', () => {
    const { getByTestId, queryByTestId } = renderSurface();
    expect(getByTestId('ide-verify-waveform-row-sum_1_0_').getAttribute('data-kind')).toBe('bus');
    expect(getByTestId('ide-verify-bus-point-sum_1_0_-1').getAttribute('data-value')).toBe('1');
    expect(queryByTestId('ide-verify-waveform-row-sum_0_')).toBeNull();
    expect(getByTestId('ide-verify-radix-hex').getAttribute('aria-pressed')).toBe('true');
  });

  it('switches the radix to bits and expands the bus to its members', () => {
    const { getByTestId } = renderSurface();
    act(() => {
      fireEvent.click(getByTestId('ide-verify-radix-bin'));
    });
    expect(getByTestId('ide-verify-bus-point-sum_1_0_-1').getAttribute('data-value')).toBe('01');
    act(() => {
      fireEvent.click(getByTestId('ide-verify-bus-toggle-sum_1_0_'));
    });
    expect(getByTestId('ide-verify-waveform-row-sum_1_').getAttribute('data-kind')).toBe('bit');
    expect(getByTestId('ide-verify-waveform-row-sum_0_').getAttribute('data-kind')).toBe('bit');
  });

  it('draws the expected word over the bus where the run mismatched, and hides it on request', () => {
    const { getByTestId, queryByTestId } = renderSurface();
    expect(getByTestId('ide-verify-expected-sum_1_0_-1').textContent).toBe('exp 3');
    expect(queryByTestId('ide-verify-expected-sum_1_0_-0')).toBeNull();
    act(() => {
      fireEvent.click(getByTestId('ide-verify-expected-overlay'));
    });
    expect(queryByTestId('ide-verify-expected-sum_1_0_-1')).toBeNull();
  });
});
