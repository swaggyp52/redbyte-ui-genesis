// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { RuntimeVerifyRun } from '../projectRuntime';
import { VerifySurface } from '../surfaces/VerifySurface';

if (!HTMLElement.prototype.scrollIntoView) {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
}

const vectors = [
  { id: 'v0', tick: 0, inputs: { sw0: 0 }, expected: {} },
  { id: 'v1', tick: 1, inputs: { sw0: 1 }, expected: {} },
];

function makeTraceRun(): RuntimeVerifyRun {
  return {
    scenarioId: 'scenario',
    scenarioName: 'No-check scenario',
    runKind: 'trace',
    status: 'pass',
    simulationStatus: 'complete',
    assertionStatus: 'not-configured',
    deterministicHash: 'hash',
    reportHash: 'report',
    generatedAtIso: '2026-07-26T00:00:00.000Z',
    schedule: 'combinational',
    meta: {
      circuitKind: 'combinational',
      clockingProtocol: null,
      samplePoint: 'steady-state',
      tick0Meaning: null,
      clockSignalName: null,
    },
    report: {
      vectors,
      inputsAtTick: { 0: { sw0: 0 }, 1: { sw0: 1 } },
      inputsByVectorId: { v0: { sw0: 0 }, v1: { sw0: 1 } },
      signalRoles: { sw0: 'input', ld0: 'output' },
      rows: [],
    } as RuntimeVerifyRun['report'],
    waveform: [
      { tick: 0, signals: { sw0: '0', ld0: '0' }, mismatches: [] },
      { tick: 1, signals: { sw0: '1', ld0: '1' }, mismatches: [] },
    ],
  };
}

const baseProps = {
  deterministicHash: 'hash',
  hasVectors: true,
  vectors,
  mappedInputs: [{ id: 'sw0', label: 'SW0' }],
  mappedSignals: [
    { id: 'sw0', label: 'SW0', direction: 'in' as const },
    { id: 'ld0', label: 'LD0', direction: 'out' as const },
  ],
  onOpenProjectVectors: vi.fn(),
};

describe('Verify Simulation Studio', () => {
  afterEach(cleanup);

  it('runs no-check stimulus through trace mode and keeps checks optional', () => {
    const onRunVerification = vi.fn();
    const view = render(
      <VerifySurface {...baseProps} onRunVerification={onRunVerification} />
    );

    expect(view.getByTestId('ide-vcb-run').textContent).toContain('Run simulation');
    expect(view.getByTestId('ide-vcb-workspace-checks').textContent).toBe('Checks');
    fireEvent.click(view.getByTestId('ide-vcb-run'));

    expect(onRunVerification).toHaveBeenCalledWith(expect.objectContaining({
      runKind: 'trace',
      assertionMode: false,
    }));
  });

  it('shows completed simulation and no checks without a fail state', () => {
    const view = render(
      <VerifySurface {...baseProps} lastRun={makeTraceRun()} onGoToDesign={vi.fn()} />
    );

    expect(view.getByTestId('ide-verify-results-summary-headline').textContent).toBe('Simulation complete');
    expect(view.getByTestId('ide-verify-results-summary-subline').textContent).toContain('No checks configured');
    expect(view.getByTestId('ide-verify-summary-status').textContent).toBe('Simulation complete · No checks configured');
    expect(view.getByTestId('ide-verify-results-summary').getAttribute('data-kind')).toBe('observe-done');
    expect(view.getByTestId('ide-vcb-workspace-replay').getAttribute('aria-selected')).toBe('true');
    expect(view.getByTestId('ide-verify-open-circuit-replay')).toBeTruthy();
  });

  it('moves expected-output authoring into the optional Checks workspace', () => {
    const view = render(<VerifySurface {...baseProps} />);

    expect(view.getByTestId('ide-verify-stimulus-summary').textContent).toContain('Run the scenario');
    fireEvent.click(view.getByTestId('ide-vcb-workspace-checks'));
    expect(view.getByTestId('ide-verify-stimulus-summary').textContent).toContain('Add optional expected outputs');
  });
});
