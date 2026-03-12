// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import type { RuntimeVerifyRun } from '../projectRuntime';
import { VerifySurface } from '../surfaces/VerifySurface';

function makeFailRun(): RuntimeVerifyRun {
  return {
    scenarioId: 'three-panel-fail',
    scenarioName: 'Three panel fail run',
    status: 'fail',
    deterministicHash: 'three-panel-hash',
    reportHash: 'three-panel-report',
    firstFailingTick: 1,
    generatedAtIso: '2026-03-11T12:00:00.000Z',
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
        { id: 'vec-01', tick: 1, inputs: { sw0: 0 }, expected: { ld0: 1 }, caseIndex: 0 },
        { id: 'vec-02', tick: 3, inputs: { sw0: 1 }, expected: { ld0: 0 }, caseIndex: 0 },
        { id: 'vec-03', tick: 5, inputs: { sw0: 1 }, expected: { ld0: 1, ld1: 0 }, caseIndex: 0 },
      ],
      inputsAtTick: {
        1: { sw0: 0 },
        3: { sw0: 1 },
        5: { sw0: 1 },
      },
      inputsByVectorId: {
        'vec-01': { sw0: 0 },
        'vec-02': { sw0: 1 },
        'vec-03': { sw0: 1 },
      },
      signalRoles: {
        sw0: 'input',
        ld0: 'output',
        ld1: 'output',
      },
      rows: [
        { tick: 1, signal: 'ld0', expected: '1', actual: '0', status: 'fail', vectorId: 'vec-01', caseIndex: 0 },
        { tick: 3, signal: 'ld0', expected: '0', actual: '0', status: 'pass', vectorId: 'vec-02', caseIndex: 0 },
        { tick: 5, signal: 'ld0', expected: '1', actual: '0', status: 'fail', vectorId: 'vec-03', caseIndex: 0 },
        { tick: 5, signal: 'ld1', expected: '0', actual: '1', status: 'fail', vectorId: 'vec-03', caseIndex: 1 },
      ],
    } as unknown as RuntimeVerifyRun['report'],
    waveform: [
      { tick: 1, signals: { sw0: '0', ld0: '0', ld1: '0' }, mismatches: [{ signal: 'ld0', expected: '1', actual: '0' }] },
      { tick: 3, signals: { sw0: '1', ld0: '0', ld1: '0' }, mismatches: [] },
      {
        tick: 5,
        signals: { sw0: '1', ld0: '0', ld1: '1' },
        mismatches: [
          { signal: 'ld0', expected: '1', actual: '0' },
          { signal: 'ld1', expected: '0', actual: '1' },
        ],
      },
    ],
  };
}

describe('VerifySurface three-panel workstation', () => {
  it('auto-selects first failure, responds to J navigation, and syncs right panel with row clicks', () => {
    const run = makeFailRun();
    const { getByTestId } = render(
      <VerifySurface
        deterministicHash="three-panel-hash"
        hasVectors={true}
        lastRun={run}
        vectors={run.report.vectors as never}
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', label: 'SW0', direction: 'in' },
          { id: 'ld0', label: 'LD0', direction: 'out' },
          { id: 'ld1', label: 'LD1', direction: 'out' },
        ]}
        onOpenProjectVectors={vi.fn()}
      />
    );

    expect(getByTestId('ide-verify-three-panel')).toBeTruthy();
    expect(getByTestId('ide-verify-right-signal-key').textContent).toContain('ld0');
    expect(getByTestId('ide-verify-selected-tick').textContent).toContain('t1');
    expect(getByTestId('ide-verify-vector-row-1-ld0-ld0-vec-01-0').className).toContain('is-selected');
    expect(getByTestId('ide-verify-scope-signal').textContent).toContain('ld0');

    fireEvent.keyDown(window, { key: 'J' });
    expect(getByTestId('ide-verify-selected-tick').textContent).toContain('t5');

    const ld1Row = getByTestId('ide-verify-vector-row-5-ld1-ld1-vec-03-1');
    fireEvent.click(ld1Row);
    expect(ld1Row.className).toContain('is-selected');
    expect(getByTestId('ide-verify-scope-signal').textContent).toContain('ld1');
    expect(getByTestId('ide-verify-right-signal-key').textContent).toContain('ld1');
    expect(getByTestId('ide-verify-right-tick').textContent).toContain('t5');
  });
});
