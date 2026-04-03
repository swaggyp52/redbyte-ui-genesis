/**
 * WaveformInstrument extraction contract tests.
 *
 * Phase 1 deliverable: verify the WaveformViewer extraction is structurally
 * sound — correct exports, type shape, no broken re-exports.
 */
import { describe, expect, it } from 'vitest';
import {
  WaveformViewer,
  type WaveformSignalRow,
  type SignalLaneGroup,
  type WaveformViewerProps,
} from '../surfaces/verify/WaveformInstrument';

describe('WaveformInstrument extraction contract', () => {
  it('exports WaveformViewer as a function component', () => {
    expect(typeof WaveformViewer).toBe('function');
    expect(WaveformViewer.name).toBeTruthy();
  });

  it('WaveformSignalRow type accepts canonical signal shape', () => {
    const row: WaveformSignalRow = {
      signal: 'sw0',
      values: [{ tick: 0, value: '0' }, { tick: 1, value: '1' }],
    };
    expect(row.signal).toBe('sw0');
    expect(row.values).toHaveLength(2);
  });

  it('SignalLaneGroup type covers all three groups', () => {
    const groups: SignalLaneGroup[] = ['Inputs', 'Outputs', 'Internal'];
    expect(groups).toHaveLength(3);
  });

  it('WaveformViewerProps requires core waveform fields', () => {
    // Type-level test — if this compiles, the interface is correct.
    // Runtime: construct a minimal props object that satisfies the required fields.
    const props: WaveformViewerProps = {
      signals: [],
      ticks: [0, 1, 2],
      failTicks: new Set<number>(),
      failingSignalKeys: new Set<string>(),
      selectedTick: null,
      cursorA: null,
      cursorB: null,
      pinnedSignals: new Set<string>(),
      onSelectTick: () => {},
      onSelectSignal: () => {},
    };
    expect(props.signals).toEqual([]);
    expect(props.ticks).toHaveLength(3);
  });

  it('WaveformViewerProps accepts optional fields without error', () => {
    const props: WaveformViewerProps = {
      signals: [{ signal: 'clk', values: [{ tick: 0, value: '0' }] }],
      ticks: [0],
      failTicks: new Set(),
      failingSignalKeys: new Set(),
      selectedTick: 0,
      cursorA: null,
      cursorB: null,
      pinnedSignals: new Set(),
      onSelectTick: () => {},
      onSelectSignal: () => {},
      rowHeight: 44,
      tickWidth: 54,
      emptyMessage: 'No waveforms',
      isSequential: true,
      clockSignals: new Set(['clk']),
      selectedSignal: 'clk',
      signalGroups: new Map([['clk', 'Inputs' as const]]),
      ghostSignals: [{ signal: 'clk', direction: 'in' as const }],
      onHoverSignal: () => {},
      signalMeta: new Map([['clk', { direction: 'in' as const, pin: 'V17' }]]),
    };
    expect(props.isSequential).toBe(true);
    expect(props.clockSignals?.has('clk')).toBe(true);
  });
});
