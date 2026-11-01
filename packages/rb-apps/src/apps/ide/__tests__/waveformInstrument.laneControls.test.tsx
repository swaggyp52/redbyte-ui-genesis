// @vitest-environment jsdom
/**
 * Lane pin/hide controls: the star toggles a signal in the pinned set, the ×
 * hides a lane, and neither steals the label's select-signal click.
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { WaveformViewer, type WaveformSignalRow } from '../surfaces/verify/WaveformInstrument';

afterEach(cleanup);

const makeRow = (signal: string): WaveformSignalRow => ({
  signal,
  values: [
    { tick: 0, value: '0' },
    { tick: 1, value: '1' },
  ],
});

const BASE_PROPS = {
  ticks: [0, 1],
  failTicks: new Set<number>(),
  failingSignalKeys: new Set<string>(),
  selectedTick: null,
  cursorA: null,
  cursorB: null,
  onSelectTick: vi.fn(),
};

describe('WaveformViewer lane controls', () => {
  it('fires the pin toggle without selecting the signal', () => {
    const onTogglePinSignal = vi.fn();
    const onSelectSignal = vi.fn();
    const view = render(
      <WaveformViewer
        {...BASE_PROPS}
        signals={[makeRow('sw0'), makeRow('ld0')]}
        pinnedSignals={new Set<string>()}
        onSelectSignal={onSelectSignal}
        onTogglePinSignal={onTogglePinSignal}
      />
    );
    fireEvent.click(view.getByTestId('ide-verify-lane-pin-sw0'));
    expect(onTogglePinSignal).toHaveBeenCalledWith('sw0');
    expect(onSelectSignal).not.toHaveBeenCalled();
  });

  it('shows the filled star for pinned lanes', () => {
    const view = render(
      <WaveformViewer
        {...BASE_PROPS}
        signals={[makeRow('sw0')]}
        pinnedSignals={new Set(['sw0'])}
        onSelectSignal={vi.fn()}
        onTogglePinSignal={vi.fn()}
      />
    );
    expect(view.getByTestId('ide-verify-lane-pin-sw0').textContent).toContain('★');
  });

  it('fires the hide handler from the × control', () => {
    const onHideSignal = vi.fn();
    const view = render(
      <WaveformViewer
        {...BASE_PROPS}
        signals={[makeRow('sw0')]}
        pinnedSignals={new Set<string>()}
        onSelectSignal={vi.fn()}
        onHideSignal={onHideSignal}
      />
    );
    fireEvent.click(view.getByTestId('ide-verify-lane-hide-sw0'));
    expect(onHideSignal).toHaveBeenCalledWith('sw0');
  });

  it('renders no controls when the handlers are absent', () => {
    const view = render(
      <WaveformViewer
        {...BASE_PROPS}
        signals={[makeRow('sw0')]}
        pinnedSignals={new Set<string>()}
        onSelectSignal={vi.fn()}
      />
    );
    expect(view.queryByTestId('ide-verify-lane-pin-sw0')).toBeNull();
    expect(view.queryByTestId('ide-verify-lane-hide-sw0')).toBeNull();
  });
});
