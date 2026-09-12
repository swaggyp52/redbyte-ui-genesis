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

const vectorsWithChecks = [
  { id: 'v0', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
  { id: 'v1', tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1 } },
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

    expect(view.getByTestId('ide-vcb-run').textContent).toBe('Run');
    expect(view.getByTestId('ide-vcb-check-count').textContent).toContain('0 optional checks');
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

    expect(view.getByTestId('ide-run-check-result').textContent).toBe('No checks · outputs recorded');
    expect(view.getByTestId('ide-run-check-result').getAttribute('data-check-status')).toBe('not-configured');
    expect(view.getByTestId('ide-verify-inspect-circuit')).toBeTruthy();
  });

  it('distinguishes authored checks from checks that an observation run did not evaluate', () => {
    const view = render(
      <VerifySurface
        {...baseProps}
        vectors={vectorsWithChecks}
        lastRun={{ ...makeTraceRun(), assertionStatus: 'not-evaluated' }}
        onGoToDesign={vi.fn()}
      />
    );

    expect(view.getByTestId('ide-vcb-check-count').textContent).toContain('2');
    expect(view.getByTestId('ide-run-check-result').textContent).toBe('Checks not evaluated');
    expect(view.getByTestId('ide-run-check-result').getAttribute('data-check-status')).toBe('not-evaluated');
  });

  it('keeps expected-output authoring optional and cell-level in the Case Lab', () => {
    const view = render(<VerifySurface {...baseProps} />);

    expect(view.getByTestId('ide-case-lab')).toBeTruthy();
    // No check authored yet: the expected cell is an empty slot, not a requirement.
    expect(view.getByTestId('ide-case-lab-exp-0-ld0').textContent?.trim()).toBe('\u00b7');
  });
});
