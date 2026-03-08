// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import type { RuntimeVerifyRun } from '../projectRuntime';
import { VerifySurface } from '../surfaces/VerifySurface';

function makeRepeatedFailureRun(): RuntimeVerifyRun {
  return {
    scenarioId: 'repeat-fail',
    scenarioName: 'Repeated failure case',
    status: 'fail',
    deterministicHash: 'det_repeat_fail',
    reportHash: 'rep_repeat_fail',
    firstFailingTick: 1,
    generatedAtIso: '2026-03-08T15:00:00.000Z',
    schedule: 'combinational',
    meta: {
      circuitKind: 'combinational',
      clockingProtocol: null,
      samplePoint: 'steady-state',
      tick0Meaning: null,
      clockSignalName: null,
    },
    report: {
      vectors: [
        { id: 'vec-01', tick: 1, inputs: { sw0: 0 }, expected: { ld0: 1, ld1: 0 } },
        { id: 'vec-02', tick: 5, inputs: { sw0: 1 }, expected: { ld0: 0, ld1: 1 } },
      ],
      inputsAtTick: {
        1: { sw0: 0 },
        5: { sw0: 1 },
      },
      signalRoles: {
        sw0: 'input',
        ld0: 'output',
        ld1: 'output',
      },
      rows: [
        { tick: 1, signal: 'ld0', expected: '1', actual: '0', status: 'fail' },
        { tick: 1, signal: 'ld1', expected: '0', actual: '0', status: 'pass' },
        { tick: 5, signal: 'ld0', expected: '0', actual: '1', status: 'fail' },
        { tick: 5, signal: 'ld1', expected: '1', actual: '0', status: 'fail' },
      ],
    } as RuntimeVerifyRun['report'],
    waveform: [
      {
        tick: 1,
        signals: { sw0: '0', ld0: '0', ld1: '0' },
        mismatches: [{ signal: 'ld0', expected: '1', actual: '0' }],
      },
      {
        tick: 5,
        signals: { sw0: '1', ld0: '1', ld1: '0' },
        mismatches: [
          { signal: 'ld0', expected: '0', actual: '1' },
          { signal: 'ld1', expected: '1', actual: '0' },
        ],
      },
    ],
  };
}

describe('VerifySurface failure context', () => {
  it('keeps the selected failure scoped to tick plus signal across failure interactions', () => {
    const { getByTestId } = render(
      <VerifySurface
        deterministicHash="det_repeat_fail"
        hasVectors={true}
        lastRun={makeRepeatedFailureRun()}
        vectors={[
          { id: 'vec-01', tick: 1, inputs: { sw0: 0 }, expected: { ld0: 1, ld1: 0 } },
          { id: 'vec-02', tick: 5, inputs: { sw0: 1 }, expected: { ld0: 0, ld1: 1 } },
        ]}
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', label: 'SW0', direction: 'in' },
          { id: 'ld0', label: 'LD0', direction: 'out' },
          { id: 'ld1', label: 'LD1', direction: 'out' },
        ]}
        onOpenProjectVectors={vi.fn()}
        onFixPath={vi.fn()}
      />
    );

    expect(getByTestId('ide-verify-explainer-first-tick').textContent).toContain('t1');
    expect(getByTestId('ide-verify-explainer-signal').textContent).toContain('ld0');

    fireEvent.click(getByTestId('ide-verify-mismatch-row-ld0_5'));
    expect(getByTestId('ide-verify-explainer-first-tick').textContent).toContain('t5');
    expect(getByTestId('ide-verify-explainer-signal').textContent).toContain('ld0');
    expect(getByTestId('ide-verify-explainer-expected').textContent).toContain('0');
    expect(getByTestId('ide-verify-explainer-observed').textContent).toContain('1');
    expect(getByTestId('ide-verify-related-failure-ld1_5').textContent).toContain('ld1');

    fireEvent.click(getByTestId('ide-verify-failure-ld1_5'));
    expect(getByTestId('ide-verify-explainer-first-tick').textContent).toContain('t5');
    expect(getByTestId('ide-verify-explainer-signal').textContent).toContain('ld1');
    expect(getByTestId('ide-verify-explainer-expected').textContent).toContain('1');
    expect(getByTestId('ide-verify-explainer-observed').textContent).toContain('0');

    fireEvent.click(getByTestId('ide-verify-fail-nav-first'));
    expect(getByTestId('ide-verify-explainer-first-tick').textContent).toContain('t1');
    expect(getByTestId('ide-verify-explainer-signal').textContent).toContain('ld0');
  });
});
