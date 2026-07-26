import { describe, expect, it } from 'vitest';
import { buildCanonicalWaveformSignalAliases } from '../surfaces/VerifySurface';

describe('Verify waveform signal aliases', () => {
  it('uses authored logical labels for internal circuit nodes without replacing boundary I/O names', () => {
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
    expect(aliases.get('input_a_out')).toBe('a');
    expect(aliases.get('output_sum_in')).toBe('sum');
  });
});
