// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import type { RuntimeVerifyRun } from '../projectRuntime';
import { VerifySurface } from '../surfaces/VerifySurface';

function makeComboFailureRun(): RuntimeVerifyRun {
  return {
    scenarioId: 'combo-kmap-fail',
    scenarioName: 'Combo provenance fail case',
    status: 'fail',
    deterministicHash: 'det_combo_kmap',
    reportHash: 'rep_combo_kmap',
    firstFailingTick: 1,
    generatedAtIso: '2026-03-08T18:30:00.000Z',
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
        { id: 'vec-00', tick: 0, inputs: { sw0: 0, sw1: 0 }, expected: { ld0: 0, ld1: 0 } },
        { id: 'vec-01', tick: 1, inputs: { sw0: 0, sw1: 1 }, expected: { ld0: 1, ld1: 0 } },
        { id: 'vec-10', tick: 2, inputs: { sw0: 1, sw1: 0 }, expected: { ld0: 1, ld1: 0 } },
      ],
      inputsAtTick: {
        0: { sw0: 0, sw1: 0 },
        1: { sw0: 0, sw1: 1 },
        2: { sw0: 1, sw1: 0 },
      },
      signalRoles: {
        sw0: 'input',
        sw1: 'input',
        ld0: 'output',
        ld1: 'output',
      },
      rows: [
        { tick: 0, signal: 'ld0', expected: '0', actual: '0', status: 'pass' },
        { tick: 0, signal: 'ld1', expected: '0', actual: '0', status: 'pass' },
        { tick: 1, signal: 'ld0', expected: '1', actual: '0', status: 'fail' },
        { tick: 1, signal: 'ld1', expected: '0', actual: '0', status: 'pass' },
        { tick: 2, signal: 'ld0', expected: '1', actual: '1', status: 'pass' },
        { tick: 2, signal: 'ld1', expected: '0', actual: '1', status: 'fail' },
      ],
    } as RuntimeVerifyRun['report'],
    waveform: [
      { tick: 0, signals: { sw0: '0', sw1: '0', ld0: '0', ld1: '0' }, mismatches: [] },
      {
        tick: 1,
        signals: { sw0: '0', sw1: '1', ld0: '0', ld1: '0' },
        mismatches: [{ signal: 'ld0', expected: '1', actual: '0' }],
      },
      {
        tick: 2,
        signals: { sw0: '1', sw1: '0', ld0: '1', ld1: '1' },
        mismatches: [{ signal: 'ld1', expected: '0', actual: '1' }],
      },
    ],
  };
}

describe('VerifySurface combo and K-map provenance', () => {
  it('K-map cells in the K-Map tab identify the correct expected value for failing combos', () => {
    // Truth-table contract (K-map half): K-map cells in the kmap tab correctly identify failures.
    // Per ADR-002, clicking a cell does NOT auto-switch verifyTab to 'mismatches'.
    //
    // Note: combo row elements (ide-truth-table-combo-fail-*) live in a section that requires
    // displaySection="auto", which VerifySurface never passes — those are tested at the
    // TruthTablePane unit level, not here.
    const { getByTestId, getAllByText } = render(
      <VerifySurface
        deterministicHash="det_combo_kmap"
        hasVectors={true}
        lastRun={makeComboFailureRun()}
        vectors={[
          { id: 'vec-00', tick: 0, inputs: { sw0: 0, sw1: 0 }, expected: { ld0: 0, ld1: 0 } },
          { id: 'vec-01', tick: 1, inputs: { sw0: 0, sw1: 1 }, expected: { ld0: 1, ld1: 0 } },
          { id: 'vec-10', tick: 2, inputs: { sw0: 1, sw1: 0 }, expected: { ld0: 1, ld1: 0 } },
        ]}
        mappedInputs={[
          { id: 'sw0', label: 'SW0' },
          { id: 'sw1', label: 'SW1' },
        ]}
        mappedSignals={[
          { id: 'sw0', label: 'SW0', direction: 'in' },
          { id: 'sw1', label: 'SW1', direction: 'in' },
          { id: 'ld0', label: 'LD0', direction: 'out' },
          { id: 'ld1', label: 'LD1', direction: 'out' },
        ]}
        onOpenProjectVectors={vi.fn()}
      />
    );

    // Open drawer and navigate to the Details tab (K-Map is now consolidated inside Details).
    fireEvent.click(getByTestId('ide-verify-drawer-toggle'));
    fireEvent.click(getAllByText('Details')[0]);

    // ld1 at input bits '10' (sw0=1, sw1=0) fails: expected 0, observed 1.
    expect(getByTestId('ide-truth-table-kmap-cell-ld1_10').textContent).toContain('exp 0');
  });
});
