// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { VerifySurface } from '../surfaces/VerifySurface';

/**
 * P2.5H — imported external evidence must be reachable. The Analyzer panel owns both
 * states: with nothing loaded it collapses to one compact row carrying "Load .vcd file",
 * and it only takes workspace once a file is imported. Gating the panel behind an
 * already-imported waveform made the whole capability unreachable — there is no other
 * way to bring a .vcd in — so the entry state is asserted here.
 */
const SIGNALS = [
  { id: 'a_0', label: 'A[0]', direction: 'in' as const, nodeId: 'a0' },
  { id: 'sum_0', label: 'SUM[0]', direction: 'out' as const, nodeId: 'sum0' },
];
const VECTORS = [{ id: 'v0', tick: 0, inputs: { a_0: 0 as const }, expected: { sum_0: 0 as const } }];

function renderSurface(extra: Partial<React.ComponentProps<typeof VerifySurface>> = {}) {
  return render(
    <VerifySurface
      hasVectors
      vectors={VECTORS}
      mappedInputs={[{ id: 'a_0', label: 'A[0]' }]}
      mappedSignals={SIGNALS}
      onOpenProjectVectors={vi.fn()}
      onVectorsChange={vi.fn()}
      deterministicHash="imported-evidence"
      verifyMode="combinational"
      {...extra}
    />
  );
}

describe('Simulate — imported external evidence', () => {
  it('offers the .vcd loader with nothing imported, as one compact row', () => {
    const { getByTestId } = renderSurface({ importedWaveform: null });
    const analyzer = getByTestId('ide-vcd-analyzer');
    expect(analyzer.getAttribute('data-compact')).toBe('true');
    expect(getByTestId('ide-vcd-analyzer-file-input')).toBeTruthy();
    expect(getByTestId('ide-vcd-analyzer-load').textContent).toMatch(/load .vcd/i);
  });

  it('names the boundary: imported evidence is replayed, never executed', () => {
    const { getByTestId } = renderSurface({ importedWaveform: null });
    expect(getByTestId('ide-vcd-analyzer').textContent).toMatch(/replayed, never executed/i);
  });

  it('hands the chosen file to the container rather than parsing it in the panel', async () => {
    const onImportVcd = vi.fn();
    const { getByTestId } = renderSurface({ importedWaveform: null, onImportVcd });
    const input = getByTestId('ide-vcd-analyzer-file-input') as HTMLInputElement;
    expect(input.getAttribute('type')).toBe('file');
    expect(input.getAttribute('accept')).toContain('.vcd');
  });
});
