// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { VerifySurface } from '../surfaces/VerifySurface';

/**
 * Field identity contract: the Simulate surface keys cases by the project
 * io-row id, byte for byte. A hyphenated scalar row (`carry-out`, the
 * hierarchical adder's carry) must survive the surface → runtime round trip;
 * the runtime prunes any other spelling as an unknown output, which silently
 * erased authored carry expectations.
 */
const SIGNALS = [
  { id: 'a_0', label: 'A[0]', direction: 'in' as const, nodeId: 'a0' },
  { id: 'carry-out', label: 'CARRY', direction: 'out' as const, nodeId: 'carry-out' },
  { id: 'sum_0', label: 'SUM[0]', direction: 'out' as const, nodeId: 'sum0' },
];

function renderSurface(vectors: Array<{ id: string; tick: number; inputs: Record<string, 0 | 1>; expected: Record<string, 0 | 1> }>) {
  const onVectorsChange = vi.fn();
  const utils = render(
    <VerifySurface
      hasVectors={vectors.length > 0}
      vectors={vectors}
      mappedInputs={[{ id: 'a_0', label: 'A[0]' }]}
      mappedSignals={SIGNALS}
      onOpenProjectVectors={vi.fn()}
      onVectorsChange={onVectorsChange}
      deterministicHash="field-identity"
      verifyMode="combinational"
    />
  );
  return { ...utils, onVectorsChange };
}

describe('Simulate field identity', () => {
  it('shows an authored expectation keyed by a hyphenated row id in that row\'s column', () => {
    const { getByTestId } = renderSurface([
      { id: 'v0', tick: 0, inputs: { a_0: 1 }, expected: { 'carry-out': 1, sum_0: 0 } },
    ]);
    expect(getByTestId('ide-case-lab-exp-0-carry-out').textContent?.trim()).toBe('1');
    expect(getByTestId('ide-case-lab-exp-0-sum_0').textContent?.trim()).toBe('0');
  });

  it('writes the expectation back under the row id, never a rewritten spelling', () => {
    const { getByTestId, onVectorsChange } = renderSurface([
      { id: 'v0', tick: 0, inputs: { a_0: 1 }, expected: { 'carry-out': 1 } },
    ]);
    fireEvent.click(getByTestId('ide-case-lab-exp-0-carry-out'));
    expect(onVectorsChange).toHaveBeenCalled();
    const written = onVectorsChange.mock.calls.at(-1)?.[0] as Array<{ expected?: Record<string, 0 | 1> }>;
    const expected = written[0]?.expected ?? {};
    expect(expected).toHaveProperty('carry-out', 0);
    expect(expected).not.toHaveProperty('carry_out');
  });

  it('still reads a legacy underscore-spelled key into the same column', () => {
    const { getByTestId } = renderSurface([
      { id: 'v0', tick: 0, inputs: { a_0: 0 }, expected: { carry_out: 1 } },
    ]);
    expect(getByTestId('ide-case-lab-exp-0-carry-out').textContent?.trim()).toBe('1');
  });
});
