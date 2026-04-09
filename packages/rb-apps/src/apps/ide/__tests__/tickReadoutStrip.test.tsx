// @vitest-environment jsdom
/**
 * Contract tests for TickReadoutStrip — the compact per-tick value bar
 * that appears below the waveform when a tick is selected.
 *
 * The strip must:
 *  - display the selected tick number as t{N}
 *  - show per-signal chips with their value at that tick
 *  - distinguish inputs vs outputs via CSS class
 *  - tolerate missing tick data with '?' fallback
 */
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { TickReadoutStrip } from '../surfaces/verify/TickReadoutStrip';
import type { WaveformSignalRow, SignalLaneGroup } from '../surfaces/verify/WaveformInstrument';

afterEach(() => { cleanup(); });

function row(signal: string, t0: string, t1: string, t2: string): WaveformSignalRow {
  return { signal, values: [{ tick: 0, value: t0 }, { tick: 1, value: t1 }, { tick: 2, value: t2 }] };
}

const signals: WaveformSignalRow[] = [
  row('sw0', '0', '1', '1'),
  row('sw1', '1', '0', '0'),
  row('ld0', '0', '1', '0'),
  row('ld1', '1', '1', '0'),
];

const signalGroups = new Map<string, SignalLaneGroup>([
  ['sw0', 'Inputs'],
  ['sw1', 'Inputs'],
  ['ld0', 'Outputs'],
  ['ld1', 'Outputs'],
]);

describe('TickReadoutStrip structural contracts', () => {
  it('renders with testid ide-verify-tick-readout', () => {
    const { getByTestId } = render(
      <TickReadoutStrip tick={0} signals={signals} signalGroups={signalGroups} />
    );
    expect(getByTestId('ide-verify-tick-readout')).toBeTruthy();
  });

  it('shows the tick number as t{N}', () => {
    const { getByTestId } = render(
      <TickReadoutStrip tick={2} signals={signals} signalGroups={signalGroups} />
    );
    const strip = getByTestId('ide-verify-tick-readout');
    expect(strip.textContent).toContain('t2');
  });

  it('shows correct value for each input signal at the selected tick', () => {
    const { getByTestId } = render(
      <TickReadoutStrip tick={1} signals={signals} signalGroups={signalGroups} />
    );
    const sw0 = getByTestId('ide-verify-tick-readout-chip-sw0');
    const sw1 = getByTestId('ide-verify-tick-readout-chip-sw1');
    expect(sw0.textContent).toContain('sw0');
    expect(sw0.textContent).toContain('1');
    expect(sw1.textContent).toContain('sw1');
    expect(sw1.textContent).toContain('0');
  });

  it('shows correct value for each output signal at the selected tick', () => {
    const { getByTestId } = render(
      <TickReadoutStrip tick={1} signals={signals} signalGroups={signalGroups} />
    );
    const ld0 = getByTestId('ide-verify-tick-readout-chip-ld0');
    const ld1 = getByTestId('ide-verify-tick-readout-chip-ld1');
    expect(ld0.textContent).toContain('ld0');
    expect(ld0.textContent).toContain('1');
    expect(ld1.textContent).toContain('ld1');
    expect(ld1.textContent).toContain('1');
  });

  it('input chips carry the input CSS class', () => {
    const { getByTestId } = render(
      <TickReadoutStrip tick={0} signals={signals} signalGroups={signalGroups} />
    );
    const sw0 = getByTestId('ide-verify-tick-readout-chip-sw0');
    expect(sw0.className).toContain('--input');
  });

  it('output chips carry the output CSS class', () => {
    const { getByTestId } = render(
      <TickReadoutStrip tick={0} signals={signals} signalGroups={signalGroups} />
    );
    const ld0 = getByTestId('ide-verify-tick-readout-chip-ld0');
    expect(ld0.className).toContain('--output');
  });

  it('shows ? for a signal that has no value at the selected tick', () => {
    const sparseSignals: WaveformSignalRow[] = [
      { signal: 'sw0', values: [{ tick: 0, value: '1' }] }, // tick 5 missing
    ];
    const { getByTestId } = render(
      <TickReadoutStrip tick={5} signals={sparseSignals} signalGroups={signalGroups} />
    );
    const chip = getByTestId('ide-verify-tick-readout-chip-sw0');
    expect(chip.textContent).toContain('?');
  });

  it('renders without signalGroups (all chips are ungrouped)', () => {
    const { getByTestId } = render(
      <TickReadoutStrip tick={0} signals={signals} />
    );
    expect(getByTestId('ide-verify-tick-readout')).toBeTruthy();
    expect(getByTestId('ide-verify-tick-readout-chip-sw0')).toBeTruthy();
  });

  it('renders all four signal chips when all four are present', () => {
    const { getByTestId } = render(
      <TickReadoutStrip tick={0} signals={signals} signalGroups={signalGroups} />
    );
    expect(getByTestId('ide-verify-tick-readout-chip-sw0')).toBeTruthy();
    expect(getByTestId('ide-verify-tick-readout-chip-sw1')).toBeTruthy();
    expect(getByTestId('ide-verify-tick-readout-chip-ld0')).toBeTruthy();
    expect(getByTestId('ide-verify-tick-readout-chip-ld1')).toBeTruthy();
  });
});
