import { describe, expect, it } from 'vitest';
import { parseVcd } from '../vcdImport';
import { waveformFromVcd } from '../simulationProvider';
import {
  DEFAULT_VCD_ANALYZER_CONFIG,
  analyzerMeasurements,
  clampCursorTime,
  defaultRadixForWidth,
  filteredSignals,
  formatVcdValue,
  normalizeVcdAnalyzerConfig,
  radixForSignal,
  valueAtTimeFromChanges,
  visibleSignals,
  visibleWaveform,
} from '../vcdAnalyzer';

const VCD = [
  '$timescale 1ns $end',
  '$var wire 1 ! clk $end',
  '$var wire 4 # data $end',
  '$var wire 4 $ addr $end',
  '$enddefinitions $end',
  '#0',
  '0!',
  'b0000 #',
  'b0001 $',
  '#5',
  '1!',
  'b1010 #',
  '#10',
  '0!',
  'b1111 $',
].join('\n');

const waveform = () => waveformFromVcd(parseVcd(VCD), 'run.vcd');

describe('formatVcdValue', () => {
  it('shows a scalar bit as-is in binary', () => {
    expect(formatVcdValue('1', 'bin', 1)).toBe('1');
    expect(formatVcdValue('0', 'bin', 1)).toBe('0');
  });

  it('formats a vector across radixes', () => {
    expect(formatVcdValue('b1010', 'bin', 4)).toBe('1010');
    expect(formatVcdValue('b1010', 'hex', 4)).toBe('0xA');
    expect(formatVcdValue('b1010', 'dec', 4)).toBe('10');
    // 1010 as signed 4-bit two's complement = -6
    expect(formatVcdValue('b1010', 'signed', 4)).toBe('-6');
  });

  it('pads binary to the declared width and never fabricates a number for x/z', () => {
    expect(formatVcdValue('b10', 'bin', 4)).toBe('0010');
    // unknown bits: no numeric conversion regardless of requested radix
    expect(formatVcdValue('b10x1', 'hex', 4)).toBe('10X1');
    expect(formatVcdValue('x', 'dec', 1)).toBe('X');
    expect(formatVcdValue('z', 'bin', 1)).toBe('Z');
  });

  it('passes real values through unchanged', () => {
    expect(formatVcdValue('r3.14', 'hex', 1)).toBe('3.14');
  });

  it('renders a missing value as an em dash', () => {
    expect(formatVcdValue(undefined, 'hex', 4)).toBe('—');
  });
});

describe('valueAtTimeFromChanges', () => {
  it('returns the most recent value at or before the cursor', () => {
    const wf = waveform();
    const dataKey = wf.signals.find((s) => s.name === 'data')!.key;
    expect(valueAtTimeFromChanges(wf.changes, dataKey, 0)).toBe('b0000');
    expect(valueAtTimeFromChanges(wf.changes, dataKey, 4)).toBe('b0000');
    expect(valueAtTimeFromChanges(wf.changes, dataKey, 5)).toBe('b1010');
    expect(valueAtTimeFromChanges(wf.changes, dataKey, 100)).toBe('b1010');
  });
});

describe('selection and filtering', () => {
  it('defaults radix by width', () => {
    expect(defaultRadixForWidth(1)).toBe('bin');
    expect(defaultRadixForWidth(4)).toBe('hex');
  });

  it('honors a per-signal radix override', () => {
    const wf = waveform();
    const data = wf.signals.find((s) => s.name === 'data')!;
    expect(radixForSignal(DEFAULT_VCD_ANALYZER_CONFIG, data)).toBe('hex');
    expect(radixForSignal({ ...DEFAULT_VCD_ANALYZER_CONFIG, radixByKey: { [data.key]: 'dec' } }, data)).toBe('dec');
  });

  it('filters signals by name (case-insensitive)', () => {
    const wf = waveform();
    expect(filteredSignals(wf, 'DA').map((s) => s.name)).toEqual(['data']);
    expect(filteredSignals(wf, '').length).toBe(3);
  });

  it('shows all signals when nothing is pinned, else only the selection', () => {
    const wf = waveform();
    expect(visibleSignals(wf, DEFAULT_VCD_ANALYZER_CONFIG).length).toBe(3);
    const dataKey = wf.signals.find((s) => s.name === 'data')!.key;
    const only = visibleSignals(wf, { ...DEFAULT_VCD_ANALYZER_CONFIG, selectedKeys: [dataKey] });
    expect(only.map((s) => s.name)).toEqual(['data']);
  });

  it('narrows the waveform to visible signals and their changes', () => {
    const wf = waveform();
    const dataKey = wf.signals.find((s) => s.name === 'data')!.key;
    const narrowed = visibleWaveform(wf, { ...DEFAULT_VCD_ANALYZER_CONFIG, selectedKeys: [dataKey] });
    expect(narrowed.signals.map((s) => s.name)).toEqual(['data']);
    expect(narrowed.changes.every((c) => c.key === dataKey)).toBe(true);
  });
});

describe('analyzerMeasurements', () => {
  it('reports each visible signal formatted at the cursor time', () => {
    const wf = waveform();
    const at5 = analyzerMeasurements(wf, { ...DEFAULT_VCD_ANALYZER_CONFIG, cursorTime: 5 });
    const data = at5.find((m) => m.name === 'data')!;
    expect(data.raw).toBe('b1010');
    expect(data.formatted).toBe('0xA'); // width 4 → hex default
    expect(data.changeCount).toBe(2);
    const clk = at5.find((m) => m.name === 'clk')!;
    expect(clk.formatted).toBe('1');
  });
});

describe('normalizeVcdAnalyzerConfig', () => {
  it('produces the default from junk', () => {
    expect(normalizeVcdAnalyzerConfig(undefined)).toEqual(DEFAULT_VCD_ANALYZER_CONFIG);
    expect(normalizeVcdAnalyzerConfig({ cursorTime: -3, selectedKeys: [1, 'a'], radixByKey: { x: 'nope', y: 'hex' } })).toEqual({
      selectedKeys: ['a'],
      radixByKey: { y: 'hex' },
      cursorTime: 0,
      search: '',
    });
  });

  it('dedupes selected keys and floors the cursor', () => {
    const config = normalizeVcdAnalyzerConfig({ selectedKeys: ['a', 'a', 'b'], cursorTime: 7.9, search: 'clk' });
    expect(config.selectedKeys).toEqual(['a', 'b']);
    expect(config.cursorTime).toBe(7);
    expect(config.search).toBe('clk');
  });
});

describe('clampCursorTime', () => {
  it('clamps into the waveform window', () => {
    const wf = waveform(); // endTime 10
    expect(clampCursorTime(wf, -5)).toBe(0);
    expect(clampCursorTime(wf, 4)).toBe(4);
    expect(clampCursorTime(wf, 99)).toBe(10);
  });
});
