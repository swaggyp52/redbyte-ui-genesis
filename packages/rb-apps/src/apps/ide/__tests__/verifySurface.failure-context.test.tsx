// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import type { RuntimeVerifyRun } from '../projectRuntime';
import { VerifySurface } from '../surfaces/VerifySurface';

afterEach(() => {
  cleanup();
});

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
        { tick: 1, signal: 'ld0', expected: '1', actual: '0', status: 'fail', vectorId: 'vec-01' },
        { tick: 1, signal: 'ld1', expected: '0', actual: '0', status: 'pass', vectorId: 'vec-01' },
        { tick: 5, signal: 'ld0', expected: '0', actual: '1', status: 'fail', vectorId: 'vec-02' },
        { tick: 5, signal: 'ld1', expected: '1', actual: '0', status: 'fail', vectorId: 'vec-02' },
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

    fireEvent.click(getByTestId('ide-verify-drawer-toggle'));

    expect(getByTestId('ide-verify-explainer-first-tick').textContent).toContain('t1');
    expect(getByTestId('ide-verify-explainer-signal').textContent?.toLowerCase()).toContain('ld0');

    fireEvent.click(within(getByTestId('ide-verify-analysis-tab-nav')).getByText('Checks'));
    fireEvent.click(getByTestId('ide-verify-mismatch-row-ld0_5'));
    expect(getByTestId('ide-verify-explainer-first-tick').textContent).toContain('t5');
    expect(getByTestId('ide-verify-explainer-signal').textContent?.toLowerCase()).toContain('ld0');
    expect(getByTestId('ide-verify-explainer-expected').textContent).toContain('0');
    expect(getByTestId('ide-verify-explainer-observed').textContent).toContain('1');
    expect(getByTestId('ide-verify-related-failure-ld1_5').textContent).toContain('LD1');

    fireEvent.click(getByTestId('ide-verify-related-failure-ld1_5'));
    expect(getByTestId('ide-verify-explainer-first-tick').textContent).toContain('t5');
    expect(getByTestId('ide-verify-explainer-signal').textContent?.toLowerCase()).toContain('ld1');
    expect(getByTestId('ide-verify-explainer-expected').textContent).toContain('1');
    expect(getByTestId('ide-verify-explainer-observed').textContent).toContain('0');

    fireEvent.click(getByTestId('ide-verify-fail-nav-first'));
    expect(getByTestId('ide-verify-explainer-first-tick').textContent).toContain('t1');
    expect(getByTestId('ide-verify-explainer-signal').textContent?.toLowerCase()).toContain('ld0');
  });

  it('keeps the default fix path in Verify and only opens Design on an explicit secondary action', () => {
    const onFixPath = vi.fn();
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
        onFixPath={onFixPath}
      />
    );

    fireEvent.click(getByTestId('ide-verify-drawer-toggle'));
    fireEvent.click(within(getByTestId('ide-verify-analysis-tab-nav')).getByText('Details'));
    fireEvent.click(getByTestId('ide-verify-right-fix-action'));
    expect(onFixPath).not.toHaveBeenCalled();
    fireEvent.click(within(getByTestId('ide-verify-analysis-tab-nav')).getByText('Details'));
    expect(getByTestId('ide-verify-vectors-table')).toBeTruthy();

    fireEvent.click(getByTestId('ide-verify-right-open-design'));
    expect(onFixPath).toHaveBeenCalledWith({
      signal: 'ld0',
      tick: 1,
      expected: '1',
      actual: '0',
      vectorId: 'vec-01',
      caseIndex: undefined,
    });
  });
});
