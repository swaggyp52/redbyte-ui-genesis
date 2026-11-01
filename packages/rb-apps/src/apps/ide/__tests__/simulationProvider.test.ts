import { describe, expect, it } from 'vitest';
import {
  BROWSER_LOGIC_PROVIDER,
  evidenceCaption,
  importedVcdProvider,
  providersComparable,
  waveformFromVcd,
} from '../simulationProvider';
import { parseVcd } from '../vcdImport';

describe('provider evidence tiers', () => {
  it('labels the browser logic provider as Browser-E0 and executing', () => {
    expect(BROWSER_LOGIC_PROVIDER).toMatchObject({
      kind: 'browser-logic',
      evidenceTier: 'browser-e0',
      executesInBrowser: true,
      external: false,
    });
  });

  it('labels an imported VCD provider as external, non-executing evidence', () => {
    const provider = importedVcdProvider('run.vcd');
    expect(provider).toMatchObject({
      kind: 'imported-vcd',
      evidenceTier: 'imported-external',
      executesInBrowser: false,
      external: true,
    });
    expect(provider.displayName).toContain('run.vcd');
    expect(evidenceCaption(provider)).toContain('outside RedByte');
  });

  it('allows honest cross-provider comparison', () => {
    expect(providersComparable(BROWSER_LOGIC_PROVIDER, importedVcdProvider('x.vcd'))).toBe(true);
  });
});

describe('waveformFromVcd', () => {
  const VCD = [
    '$timescale 1ns $end',
    '$var wire 1 ! clk $end',
    '$var wire 4 # data $end',
    '$enddefinitions $end',
    '#0',
    '0!',
    'b0000 #',
    '#5',
    '1!',
    'b1010 #',
  ].join('\n');

  it('adapts a parsed VCD into a provider waveform tagged imported-external', () => {
    const waveform = waveformFromVcd(parseVcd(VCD), 'run.vcd');
    expect(waveform.provider.evidenceTier).toBe('imported-external');
    expect(waveform.provider.executesInBrowser).toBe(false);
    expect(waveform.signals.map((s) => s.name)).toEqual(['clk', 'data']);
    expect(waveform.signals.find((s) => s.name === 'data')?.width).toBe(4);
    expect(waveform.changes.filter((c) => c.key === '!')).toEqual([
      { time: 0, key: '!', value: '0' },
      { time: 5, key: '!', value: '1' },
    ]);
    expect(waveform.endTime).toBe(5);
  });

  it('carries non-info diagnostics forward as notes', () => {
    const waveform = waveformFromVcd(parseVcd('$enddefinitions $end\n#0\n1!'), 'bad.vcd');
    // no signals → an error diagnostic surfaces as a note
    expect(waveform.notes.some((n) => /No \$var/.test(n))).toBe(true);
  });
});
