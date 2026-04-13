// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { WaveformViewer, type WaveformSignalRow } from '../surfaces/verify/WaveformInstrument';

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

const signals: WaveformSignalRow[] = [
  {
    signal: 'q0',
    values: [
      { tick: 0, value: '0' },
      { tick: 1, value: '1' },
      { tick: 2, value: '0' },
    ],
  },
];

describe('WaveformViewer layout fill', () => {
  const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');

  afterEach(() => {
    cleanup();
    if (originalClientWidth) {
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
    }
  });

  it('expands short traces to fill the available waveform viewport', async () => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return 1000;
      },
    });

    const { getByTestId } = render(
      <WaveformViewer
        {...BASE_PROPS}
        signals={signals}
      />
    );

    await waitFor(() => {
      expect(Number(getByTestId('ide-verify-waveform-svg').getAttribute('width'))).toBe(1000);
    });
  });
});
