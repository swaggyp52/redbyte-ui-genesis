// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, within } from '@testing-library/react';
import type { RuntimeVerifyRun } from '../projectRuntime';
import { VerifySurface } from '../surfaces/VerifySurface';

function makeObserveRun(): RuntimeVerifyRun {
  return {
    scenarioId: 'obs-1',
    scenarioName: 'Observe',
    status: 'pass',
    deterministicHash: 'det-obs',
    reportHash: 'rep-obs',
    generatedAtIso: '2026-04-10T00:00:00.000Z',
    schedule: 'combinational',
    meta: {
      circuitKind: 'combinational',
      clockingProtocol: null,
      samplePoint: 'steady-state',
      tick0Meaning: null,
      clockSignalName: null,
    },
    report: ({
      vectors: [{ id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: {} }],
      inputsAtTick: { 0: { sw0: 0 } },
      signalRoles: { sw0: 'input', ld0: 'output' },
      rows: [],
    } as unknown) as RuntimeVerifyRun['report'],
    waveform: [{ tick: 0, signals: { sw0: '0', ld0: '0' }, mismatches: [] }],
  };
}

function makeCompareRun(): RuntimeVerifyRun {
  return {
    scenarioId: 'cmp-1',
    scenarioName: 'Compare',
    status: 'fail',
    deterministicHash: 'det-cmp',
    reportHash: 'rep-cmp',
    generatedAtIso: '2026-04-10T00:00:00.000Z',
    schedule: 'combinational',
    meta: {
      circuitKind: 'combinational',
      clockingProtocol: null,
      samplePoint: 'steady-state',
      tick0Meaning: null,
      clockSignalName: null,
    },
    report: ({
      vectors: [{ id: 'vec-01', tick: 0, inputs: { sw0: 1 }, expected: { ld0: 1 } }],
      inputsAtTick: { 0: { sw0: 1 } },
      signalRoles: { sw0: 'input', ld0: 'output' },
      rows: [{ tick: 0, signal: 'ld0', expected: '1', actual: '0', status: 'fail', vectorId: 'vec-01', caseIndex: 0 }],
    } as unknown) as RuntimeVerifyRun['report'],
    waveform: [
      { tick: 0, signals: { sw0: '1', ld0: '0' }, mismatches: [{ signal: 'ld0', expected: '1', actual: '0' }] },
    ],
  };
}

const baseProps = {
  hasVectors: true,
  vectors: [{ id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } }],
  mappedInputs: [{ id: 'sw0', label: 'SW0' }],
  mappedSignals: [
    { id: 'sw0', label: 'SW0', direction: 'in' as const },
    { id: 'ld0', label: 'LD0', direction: 'out' as const },
  ],
  onOpenProjectVectors: vi.fn(),
  onVectorsChange: vi.fn(),
};

describe('VerifySurface drawer consolidation', () => {
  it('shows a Vectors tab in Observe mode', () => {
    const { getByTestId } = render(
      <VerifySurface {...baseProps} deterministicHash="det-obs" lastRun={makeObserveRun()} />
    );
    fireEvent.click(getByTestId('ide-verify-drawer-toggle'));
    const nav = getByTestId('ide-verify-analysis-tab-nav');
    expect(within(nav).getByText('Vectors')).toBeTruthy();
  });

  it('does not show a Truth Table tab in Observe mode', () => {
    const { getByTestId } = render(
      <VerifySurface {...baseProps} deterministicHash="det-obs" lastRun={makeObserveRun()} />
    );
    fireEvent.click(getByTestId('ide-verify-drawer-toggle'));
    const nav = getByTestId('ide-verify-analysis-tab-nav');
    expect(within(nav).queryByText('Truth Table')).toBeNull();
  });

  it('does not show a K-Map tab in Observe mode', () => {
    const { getByTestId } = render(
      <VerifySurface {...baseProps} deterministicHash="det-obs" lastRun={makeObserveRun()} />
    );
    fireEvent.click(getByTestId('ide-verify-drawer-toggle'));
    const nav = getByTestId('ide-verify-analysis-tab-nav');
    expect(within(nav).queryByText('K-Map')).toBeNull();
  });

  it('shows a Vectors tab in Compare mode', () => {
    const { getByTestId } = render(
      <VerifySurface {...baseProps} deterministicHash="det-cmp" lastRun={makeCompareRun()} />
    );
    fireEvent.click(getByTestId('ide-verify-drawer-toggle'));
    const nav = getByTestId('ide-verify-analysis-tab-nav');
    expect(within(nav).getByText('Vectors')).toBeTruthy();
  });

  it('does not show a Truth Table tab in Compare mode', () => {
    const { getByTestId } = render(
      <VerifySurface {...baseProps} deterministicHash="det-cmp" lastRun={makeCompareRun()} />
    );
    fireEvent.click(getByTestId('ide-verify-drawer-toggle'));
    const nav = getByTestId('ide-verify-analysis-tab-nav');
    expect(within(nav).queryByText('Truth Table')).toBeNull();
  });

  it('does not show a K-Map tab in Compare mode', () => {
    const { getByTestId } = render(
      <VerifySurface {...baseProps} deterministicHash="det-cmp" lastRun={makeCompareRun()} />
    );
    fireEvent.click(getByTestId('ide-verify-drawer-toggle'));
    const nav = getByTestId('ide-verify-analysis-tab-nav');
    expect(within(nav).queryByText('K-Map')).toBeNull();
  });

  it('Observe mode shows exactly: Inspect + Vectors tabs', () => {
    const { getByTestId } = render(
      <VerifySurface {...baseProps} deterministicHash="det-obs" lastRun={makeObserveRun()} />
    );
    fireEvent.click(getByTestId('ide-verify-drawer-toggle'));
    const nav = getByTestId('ide-verify-analysis-tab-nav');
    expect(within(nav).getByText('Inspect')).toBeTruthy();
    expect(within(nav).getByText('Vectors')).toBeTruthy();
    // Checks only appears in Compare mode
    expect(within(nav).queryByText('Checks')).toBeNull();
  });

  it('Compare mode shows exactly: Inspect + Checks + Vectors tabs', () => {
    const { getByTestId } = render(
      <VerifySurface {...baseProps} deterministicHash="det-cmp" lastRun={makeCompareRun()} />
    );
    fireEvent.click(getByTestId('ide-verify-drawer-toggle'));
    const nav = getByTestId('ide-verify-analysis-tab-nav');
    expect(within(nav).getByText('Inspect')).toBeTruthy();
    expect(within(nav).getByText('Checks')).toBeTruthy();
    expect(within(nav).getByText('Vectors')).toBeTruthy();
  });

  it('clicking Vectors tab shows the vectors table', () => {
    const { getByTestId } = render(
      <VerifySurface {...baseProps} deterministicHash="det-obs" lastRun={makeObserveRun()} />
    );
    fireEvent.click(getByTestId('ide-verify-drawer-toggle'));
    const nav = getByTestId('ide-verify-analysis-tab-nav');
    fireEvent.click(within(nav).getByText('Vectors'));
    expect(getByTestId('ide-verify-vectors-table')).toBeTruthy();
  });
});
