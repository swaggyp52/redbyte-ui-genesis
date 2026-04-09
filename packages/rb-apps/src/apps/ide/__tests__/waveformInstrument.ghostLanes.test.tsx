// @vitest-environment jsdom
/**
 * Contract tests for WaveformViewer ghost lane (pre-run) group header rendering.
 * Verifies:
 *  - Ghost group headers have testid attributes for CSS targeting / test querying
 *  - "Stimulus" (inputs) group header is queryable
 *  - "Observed" (outputs) group header is queryable
 *  - Both group headers are present when both input and output signals are present
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { WaveformViewer } from '../surfaces/verify/WaveformInstrument';

const BASE_PROPS = {
  signals: [],
  ticks: [],
  failTicks: new Set<number>(),
  failingSignalKeys: new Set<string>(),
  selectedTick: null,
  cursorA: null,
  cursorB: null,
  pinnedSignals: new Set<string>(),
  onSelectTick: vi.fn(),
  onSelectSignal: vi.fn(),
};

const ghostSignals = [
  { signal: 'sw0', label: 'sw0', direction: 'in' as const },
  { signal: 'sw1', label: 'sw1', direction: 'in' as const },
  { signal: 'ld0', label: 'ld0', direction: 'out' as const },
  { signal: 'ld1', label: 'ld1', direction: 'out' as const },
];

describe('WaveformViewer ghost lane group headers', () => {
  afterEach(() => { cleanup(); });

  it('renders testid for Stimulus ghost group header', () => {
    const { getByTestId } = render(
      <WaveformViewer {...BASE_PROPS} ghostSignals={ghostSignals} />
    );
    expect(getByTestId('ide-verify-waveform-ghost-group-stimulus')).toBeTruthy();
  });

  it('renders testid for Observed ghost group header', () => {
    const { getByTestId } = render(
      <WaveformViewer {...BASE_PROPS} ghostSignals={ghostSignals} />
    );
    expect(getByTestId('ide-verify-waveform-ghost-group-observed')).toBeTruthy();
  });

  it('renders both ghost group headers when both inputs and outputs are present', () => {
    const { getByTestId } = render(
      <WaveformViewer {...BASE_PROPS} ghostSignals={ghostSignals} />
    );
    expect(getByTestId('ide-verify-waveform-ghost-group-stimulus')).toBeTruthy();
    expect(getByTestId('ide-verify-waveform-ghost-group-observed')).toBeTruthy();
  });

  it('only renders Stimulus ghost group header when no output ghosts', () => {
    const inputOnly = ghostSignals.filter(s => s.direction === 'in');
    const { getByTestId, queryByTestId } = render(
      <WaveformViewer {...BASE_PROPS} ghostSignals={inputOnly} />
    );
    expect(getByTestId('ide-verify-waveform-ghost-group-stimulus')).toBeTruthy();
    expect(queryByTestId('ide-verify-waveform-ghost-group-observed')).toBeNull();
  });

  it('only renders Observed ghost group header when no input ghosts', () => {
    const outputOnly = ghostSignals.filter(s => s.direction === 'out');
    const { getByTestId, queryByTestId } = render(
      <WaveformViewer {...BASE_PROPS} ghostSignals={outputOnly} />
    );
    expect(getByTestId('ide-verify-waveform-ghost-group-observed')).toBeTruthy();
    expect(queryByTestId('ide-verify-waveform-ghost-group-stimulus')).toBeNull();
  });
});
