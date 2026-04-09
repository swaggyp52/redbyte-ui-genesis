// @vitest-environment jsdom
/**
 * Contract tests for WaveformViewer signal-group visual differentiation.
 * Verifies:
 *  - Group headers have testid attributes (CSS-targetable + test-queryable)
 *  - Signal rows carry data-direction attributes
 *  - Input and Output rows are distinguishable without relying on computed style
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { WaveformViewer, type WaveformSignalRow } from '../surfaces/verify/WaveformInstrument';

function makeSignalRow(signal: string, values: Array<{ tick: number; value: string }>): WaveformSignalRow {
  return { signal, values };
}

const BASE_PROPS = {
  ticks: [0, 1, 2],
  failTicks: new Set<number>(),
  failingSignalKeys: new Set<string>(),
  selectedTick: null,
  cursorA: null,
  cursorB: null,
  pinnedSignals: new Set<string>(),
  onSelectTick: vi.fn(),
  onSelectSignal: vi.fn(),
};

const signalGroups = new Map([
  ['sw0', 'Inputs' as const],
  ['sw1', 'Inputs' as const],
  ['ld0', 'Outputs' as const],
  ['ld1', 'Outputs' as const],
]);

const signals: WaveformSignalRow[] = [
  makeSignalRow('sw0', [{ tick: 0, value: '0' }, { tick: 1, value: '1' }, { tick: 2, value: '1' }]),
  makeSignalRow('sw1', [{ tick: 0, value: '1' }, { tick: 1, value: '0' }, { tick: 2, value: '0' }]),
  makeSignalRow('ld0', [{ tick: 0, value: '0' }, { tick: 1, value: '1' }, { tick: 2, value: '0' }]),
  makeSignalRow('ld1', [{ tick: 0, value: '1' }, { tick: 1, value: '1' }, { tick: 2, value: '0' }]),
];

describe('WaveformViewer signal-group visual differentiation', () => {
  afterEach(() => { cleanup(); });

  it('renders a testid for the Inputs group header', () => {
    const { getByTestId } = render(
      <WaveformViewer {...BASE_PROPS} signals={signals} signalGroups={signalGroups} />
    );
    expect(getByTestId('ide-verify-waveform-group-inputs')).toBeTruthy();
  });

  it('renders a testid for the Outputs group header', () => {
    const { getByTestId } = render(
      <WaveformViewer {...BASE_PROPS} signals={signals} signalGroups={signalGroups} />
    );
    expect(getByTestId('ide-verify-waveform-group-outputs')).toBeTruthy();
  });

  it('input signal rows carry data-direction="inputs"', () => {
    const { getByTestId } = render(
      <WaveformViewer {...BASE_PROPS} signals={signals} signalGroups={signalGroups} />
    );
    const sw0Row = getByTestId('ide-verify-waveform-row-sw0');
    const sw1Row = getByTestId('ide-verify-waveform-row-sw1');
    expect(sw0Row.getAttribute('data-direction')).toBe('inputs');
    expect(sw1Row.getAttribute('data-direction')).toBe('inputs');
  });

  it('output signal rows carry data-direction="outputs"', () => {
    const { getByTestId } = render(
      <WaveformViewer {...BASE_PROPS} signals={signals} signalGroups={signalGroups} />
    );
    const ld0Row = getByTestId('ide-verify-waveform-row-ld0');
    const ld1Row = getByTestId('ide-verify-waveform-row-ld1');
    expect(ld0Row.getAttribute('data-direction')).toBe('outputs');
    expect(ld1Row.getAttribute('data-direction')).toBe('outputs');
  });

  it('signal rows without known group carry data-direction="unknown"', () => {
    const noGroupSignals = [
      makeSignalRow('mystery', [{ tick: 0, value: '0' }]),
    ];
    const { getByTestId } = render(
      <WaveformViewer {...BASE_PROPS} signals={noGroupSignals} ticks={[0]} />
    );
    const row = getByTestId('ide-verify-waveform-row-mystery');
    expect(row.getAttribute('data-direction')).toBe('unknown');
  });

  it('renders both group headers when both input and output signals are present', () => {
    const { getByTestId } = render(
      <WaveformViewer {...BASE_PROPS} signals={signals} signalGroups={signalGroups} />
    );
    expect(getByTestId('ide-verify-waveform-group-inputs')).toBeTruthy();
    expect(getByTestId('ide-verify-waveform-group-outputs')).toBeTruthy();
  });
});
