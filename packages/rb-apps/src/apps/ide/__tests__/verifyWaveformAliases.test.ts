import { describe, expect, it } from 'vitest';
import { buildCanonicalWaveformSignalAliases } from '../surfaces/VerifySurface';

describe('Verify waveform signal aliases', () => {
  it('uses authored logical labels for boundary and internal circuit nodes', () => {
    const aliases = buildCanonicalWaveformSignalAliases({
      inputFields: [{ id: 'a', label: 'A' }],
      outputFields: [{ id: 'sum', label: 'SUM' }],
      mappedSignals: [
        { id: 'a', label: 'A', nodeId: 'input-a' },
        { id: 'sum', label: 'SUM', nodeId: 'output-sum' },
      ],
      circuitNodes: [
        { id: 'input-a', type: 'INPUT', label: 'Student A' },
        { id: 'xor-sum', type: 'XOR', label: 'A XOR B' },
        { id: 'output-sum', type: 'OUTPUT', label: 'Student SUM' },
      ],
    });

    expect(aliases.get('xor_sum_out')).toBe('A XOR B');
    expect(aliases.get('xor_sum')).toBe('A XOR B');
    expect(aliases.get('input_a_out')).toBe('A');
    expect(aliases.get('output_sum_in')).toBe('SUM');
  });

  it('uses run evidence to replace generated sequential ids with unique authored names', () => {
    const aliases = buildCanonicalWaveformSignalAliases({
      inputFields: [
        { id: 'd', label: 'D' },
        { id: 'd_2', label: 'CLK' },
        { id: 'reset', label: 'RESET' },
      ],
      outputFields: [{ id: 'q', label: 'Q' }],
      lastRun: {
        evidence: {
          ioRows: [
            { id: 'd', label: 'D', nodeId: 'input-d', direction: 'in' },
            { id: 'd_2', label: 'CLK', nodeId: 'input-clk', direction: 'in' },
            { id: 'reset', label: 'RESET', nodeId: 'input-reset', direction: 'in' },
            { id: 'q', label: 'Q', nodeId: 'output-q', direction: 'out' },
          ],
        },
      } as Parameters<typeof buildCanonicalWaveformSignalAliases>[0]['lastRun'],
    });

    expect(aliases.get('d')).toBe('D');
    expect(aliases.get('d_2')).toBe('CLK');
    expect(aliases.get('reset')).toBe('RESET');
    expect(aliases.get('q')).toBe('Q');
    expect(aliases.get('input_clk_out')).toBe('CLK');
  });
});
