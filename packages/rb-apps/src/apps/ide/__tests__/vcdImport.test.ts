import { describe, expect, it } from 'vitest';
import { parseVcd, signalByReference, signalTimeline, valueAtTime } from '../vcdImport';

const VCD = [
  '$date Mon $end',
  '$version testsim $end',
  '$timescale 1ns $end',
  '$scope module top $end',
  '$var wire 1 ! clk $end',
  '$var wire 1 " rst $end',
  '$var wire 4 # data $end',
  '$upscope $end',
  '$enddefinitions $end',
  '$dumpvars',
  '0!',
  '1"',
  'b0000 #',
  '$end',
  '#0',
  '0!',
  '#5',
  '1!',
  'b1010 #',
  '#10',
  '0!',
  '0"',
].join('\n');

describe('parseVcd', () => {
  it('parses the timescale, scoped signals, and widths', () => {
    const wave = parseVcd(VCD);
    expect(wave.timescale).toEqual({ magnitude: 1, unit: 'ns' });
    expect(wave.signals.map((s) => s.reference)).toEqual(['clk', 'rst', 'data']);
    const data = signalByReference(wave, 'data');
    expect(data).toMatchObject({ id: '#', width: 4, varType: 'wire', scope: ['top'] });
    expect(wave.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('records scalar and vector value changes over time', () => {
    const wave = parseVcd(VCD);
    expect(signalTimeline(wave, '!')).toEqual([
      { time: 0, value: '0' },
      { time: 0, value: '0' },
      { time: 5, value: '1' },
      { time: 10, value: '0' },
    ]);
    expect(signalTimeline(wave, '#')).toEqual([
      { time: 0, value: 'b0000' },
      { time: 5, value: 'b1010' },
    ]);
    expect(wave.endTime).toBe(10);
  });

  it('resolves the value at (or before) a given time', () => {
    const wave = parseVcd(VCD);
    expect(valueAtTime(wave, '!', 4)).toBe('0');
    expect(valueAtTime(wave, '!', 7)).toBe('1');
    expect(valueAtTime(wave, '!', 100)).toBe('0');
    expect(valueAtTime(wave, '#', 6)).toBe('b1010');
  });

  it('reports malformed content as diagnostics without throwing', () => {
    const wave = parseVcd(
      ['$timescale 1zz $end', '$var wire 1 ! a $end', '$enddefinitions $end', '#0', '1!', 'Zxq', '1%'].join('\n')
    );
    const codes = wave.diagnostics.map((d) => d.code);
    expect(codes).toContain('vcd.timescale'); // bad unit
    expect(codes).toContain('vcd.unknown-signal'); // value change for undeclared id
    // the good signal still parsed
    expect(wave.signals.map((s) => s.reference)).toEqual(['a']);
    expect(signalTimeline(wave, '!')).toEqual([{ time: 0, value: '1' }]);
  });

  it('flags a document with no signals as an error', () => {
    const wave = parseVcd('$timescale 1ns $end\n$enddefinitions $end\n#0\n');
    expect(wave.signals).toEqual([]);
    expect(wave.diagnostics.some((d) => d.code === 'vcd.no-signals' && d.severity === 'error')).toBe(true);
  });
});
