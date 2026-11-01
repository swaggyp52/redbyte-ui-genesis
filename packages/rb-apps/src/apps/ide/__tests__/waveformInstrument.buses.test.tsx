// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { WaveformViewer, type WaveformSignalRow } from '../surfaces/verify/WaveformInstrument';

/**
 * P2.5H Waveform depth — the instrument renders bus lanes (a composed word per
 * tick with transition marks), a wider value slot for them, and draws the saved
 * expected value over the observed trace only where they differ.
 */
const TICKS = [0, 1, 2];
const BUS: WaveformSignalRow = {
  signal: 'SUM[1:0]',
  kind: 'bus',
  width: 2,
  members: ['SUM[1]', 'SUM[0]'],
  values: [
    { tick: 0, value: '0' },
    { tick: 1, value: '3' },
    { tick: 2, value: '3' },
  ],
};
const SCALAR: WaveformSignalRow = {
  signal: 'CARRY',
  values: [
    { tick: 0, value: '0' },
    { tick: 1, value: '0' },
    { tick: 2, value: '1' },
  ],
};

function renderViewer(extra: Partial<React.ComponentProps<typeof WaveformViewer>> = {}) {
  return render(
    <WaveformViewer
      signals={[BUS, SCALAR]}
      ticks={TICKS}
      failTicks={new Set([1])}
      failingSignalKeys={new Set(['carry'])}
      selectedTick={1}
      cursorA={null}
      cursorB={null}
      pinnedSignals={new Set()}
      onSelectTick={vi.fn()}
      onSelectSignal={vi.fn()}
      signalGroups={new Map([['SUM[1:0]', 'Outputs'], ['CARRY', 'Outputs']])}
      {...extra}
    />
  );
}

describe('WaveformViewer — bus lanes and expected overlay', () => {
  it('renders a bus lane with one composed value per tick and a wider value slot', () => {
    const { getByTestId } = renderViewer();
    const row = getByTestId('ide-verify-waveform-row-sum_1_0_');
    expect(row.getAttribute('data-kind')).toBe('bus');
    expect(getByTestId('ide-verify-bus-point-sum_1_0_-1').getAttribute('data-value')).toBe('3');
    expect(getByTestId('ide-verify-lane-value-sum_1_0_').getAttribute('data-value')).toBe('3');
    expect(getByTestId('ide-verify-bus-toggle-sum_1_0_').textContent).toContain('▸');
  });

  it('toggles the bus through its label instead of selecting it', () => {
    const onToggleBus = vi.fn();
    const onSelectSignal = vi.fn();
    const { getByTestId } = renderViewer({ onToggleBus, onSelectSignal, expandedBuses: new Set(['SUM[1:0]']) });
    expect(getByTestId('ide-verify-bus-toggle-sum_1_0_').textContent).toContain('▾');
    fireEvent.click(getByTestId('ide-verify-bus-toggle-sum_1_0_'));
    expect(onToggleBus).toHaveBeenCalledWith('SUM[1:0]');
    expect(onSelectSignal).not.toHaveBeenCalled();
  });

  it('draws the expected value only where it differs from the observed one', () => {
    const expectedValues = new Map<string, Map<number, string>>([
      ['CARRY', new Map([[1, '1'], [2, '1']])],
      ['SUM[1:0]', new Map([[1, '2'], [2, '3']])],
    ]);
    const shown = renderViewer({ expectedValues });
    expect(shown.getByTestId('ide-verify-expected-carry-1')).toBeTruthy();
    expect(shown.queryByTestId('ide-verify-expected-carry-2')).toBeNull();
    expect(shown.getByTestId('ide-verify-expected-sum_1_0_-1').textContent).toBe('exp 2');
    expect(shown.queryByTestId('ide-verify-expected-sum_1_0_-2')).toBeNull();
    // Queries are bound to document.body; unmount before rendering the hidden variant.
    shown.unmount();
    const hidden = renderViewer({ expectedValues, showExpected: false });
    expect(hidden.queryByTestId('ide-verify-expected-carry-1')).toBeNull();
    expect(hidden.queryByTestId('ide-verify-expected-sum_1_0_-1')).toBeNull();
  });
});
