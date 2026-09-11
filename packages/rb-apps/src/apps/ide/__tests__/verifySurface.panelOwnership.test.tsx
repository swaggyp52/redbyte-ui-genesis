// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, fireEvent } from '@testing-library/react';
import type { RuntimeVerifyRun } from '../projectRuntime';
import { VerifySurface } from '../surfaces/VerifySurface';

const BASE_PROPS = {
  hasVectors: true,
  vectors: [{ id: 'v0', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } }],
  mappedInputs: [{ id: 'sw0', label: 'SW0' }],
  mappedSignals: [
    { id: 'sw0', label: 'SW0', direction: 'in' as const },
    { id: 'ld0', label: 'LD0', direction: 'out' as const },
  ],
  onOpenProjectVectors: vi.fn(),
  onVectorsChange: vi.fn(),
  deterministicHash: 'po-test',
  verifyMode: 'combinational' as const,
};

afterEach(() => {
  cleanup();
});

function makePassRun(): RuntimeVerifyRun {
  return {
    scenarioId: 'pass-scenario',
    scenarioName: 'Pass Scenario',
    status: 'pass',
    deterministicHash: 'po-test',
    reportHash: 'rep-pass',
    generatedAtIso: '2026-04-08T00:00:00.000Z',
    schedule: 'combinational',
    meta: {
      circuitKind: 'combinational',
      clockingProtocol: null,
      samplePoint: 'steady-state',
      tick0Meaning: null,
      clockSignalName: null,
    },
    report: {
      vectors: [{ id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 }, caseIndex: 0 }],
      inputsAtTick: { 0: { sw0: 0 } },
      inputsByVectorId: { 'vec-01': { sw0: 0 } },
      signalRoles: { sw0: 'input', ld0: 'output' },
      rows: [{ tick: 0, signal: 'ld0', expected: '0', actual: '0', status: 'pass', vectorId: 'vec-01', caseIndex: 0 }],
    } as RuntimeVerifyRun['report'],
    waveform: [{ tick: 0, signals: { sw0: '0', ld0: '0' }, mismatches: [] }],
  };
}

function makeFailRun(): RuntimeVerifyRun {
  return {
    scenarioId: 'fail-scenario',
    scenarioName: 'Fail Scenario',
    status: 'fail',
    deterministicHash: 'po-test',
    reportHash: 'rep-fail',
    generatedAtIso: '2026-04-08T01:00:00.000Z',
    firstFailingTick: 0,
    schedule: 'combinational',
    meta: {
      circuitKind: 'combinational',
      clockingProtocol: null,
      samplePoint: 'steady-state',
      tick0Meaning: null,
      clockSignalName: null,
    },
    report: {
      vectors: [{ id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 1 }, caseIndex: 0 }],
      inputsAtTick: { 0: { sw0: 0 } },
      inputsByVectorId: { 'vec-01': { sw0: 0 } },
      signalRoles: { sw0: 'input', ld0: 'output' },
      rows: [{ tick: 0, signal: 'ld0', expected: '1', actual: '0', status: 'fail', vectorId: 'vec-01', caseIndex: 0 }],
    } as RuntimeVerifyRun['report'],
    waveform: [{ tick: 0, signals: { sw0: '0', ld0: '0' }, mismatches: [{ signal: 'ld0', expected: '1', actual: '0' }] }],
  };
}

describe('VerifySurface panel ownership', () => {
  it('keeps the lower details tray closed by default after a run', () => {
    const { queryByTestId } = render(
      <VerifySurface {...BASE_PROPS} lastRun={makePassRun()} />
    );
    expect(queryByTestId('ide-verify-analysis-tab-nav')).toBeNull();
  });

  it('opens the lower details tray only when the toggle is clicked', () => {
    const { getByTestId, queryByTestId } = render(
      <VerifySurface {...BASE_PROPS} lastRun={makePassRun()} />
    );

    expect(queryByTestId('ide-verify-analysis-tab-nav')).toBeNull();
    fireEvent.click(getByTestId('ide-verify-drawer-toggle'));
    expect(getByTestId('ide-verify-analysis-tab-nav')).toBeTruthy();
  });

  it('keeps the signal legend visible in the integrated workbench shelf', () => {
    const { getByTestId, queryByTestId } = render(
      <VerifySurface {...BASE_PROPS} lastRun={makeFailRun()} />
    );
    expect(getByTestId('ide-left-dock')).toBeTruthy();
    expect(getByTestId('ide-verify-left-dock')).toBeTruthy();
    expect(getByTestId('ide-verify-signal-list')).toBeTruthy();
    expect(queryByTestId('ide-workbench-dock-toggle-left')).toBeNull();
  });

  it('does not require a toggle to expose the signal legend', () => {
    const { getByTestId, queryByTestId } = render(
      <VerifySurface {...BASE_PROPS} lastRun={makePassRun()} />
    );

    expect(getByTestId('ide-left-dock')).toBeTruthy();
    expect(getByTestId('ide-verify-left-dock')).toBeTruthy();
    expect(getByTestId('ide-verify-signal-list')).toBeTruthy();
    expect(queryByTestId('ide-workbench-dock-toggle-left')).toBeNull();
  });

  it('exposes the selected signal as semantic button state', () => {
    const { getByTestId } = render(
      <VerifySurface {...BASE_PROPS} lastRun={makePassRun()} />
    );
    const inputSignal = getByTestId('ide-verify-signal-sw0');

    expect(inputSignal).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(inputSignal);
    expect(inputSignal).toHaveAttribute('aria-pressed', 'true');
  });

  it('removes the right shell inspector rail from Verify', () => {
    const { queryByTestId } = render(
      <VerifySurface {...BASE_PROPS} lastRun={makeFailRun()} />
    );
    expect(queryByTestId('ide-inspector')).toBeNull();
    expect(queryByTestId('ide-workbench-dock-toggle-right')).toBeNull();
  });
});
