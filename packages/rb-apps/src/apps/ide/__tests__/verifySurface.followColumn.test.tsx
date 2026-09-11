// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { VerifySurface } from '../surfaces/VerifySurface';
import { useEngineeringSelection } from '../engineeringSelection';

/**
 * Select once, follow everywhere — the Case Lab side of it. A signal selected
 * in Design lands as the followed column; clicking another column moves the
 * follow and publishes it, and the Design-origin selection must not snap the
 * follow back on the next render.
 */
const SIGNALS = [
  { id: 'a_0', label: 'A[0]', direction: 'in' as const, nodeId: 'a0' },
  { id: 'sum_0', label: 'SUM[0]', direction: 'out' as const, nodeId: 'sum0' },
  { id: 'carry-out', label: 'CARRY', direction: 'out' as const, nodeId: 'carry-out' },
];
const VECTORS = [
  { id: 'v0', tick: 0, inputs: { a_0: 0 as const }, expected: { sum_0: 0 as const } },
  { id: 'v1', tick: 1, inputs: { a_0: 1 as const }, expected: { sum_0: 1 as const } },
];

function renderSurface() {
  return render(
    <VerifySurface
      hasVectors
      vectors={VECTORS}
      mappedInputs={[{ id: 'a_0', label: 'A[0]' }]}
      mappedSignals={SIGNALS}
      onOpenProjectVectors={vi.fn()}
      onVectorsChange={vi.fn()}
      deterministicHash="follow-column"
      verifyMode="combinational"
    />
  );
}

describe('Case Lab followed column', () => {
  beforeEach(() => {
    useEngineeringSelection.getState().clear();
  });

  it('lands a signal selected in Design as the followed column', () => {
    act(() => {
      useEngineeringSelection.getState().select({ kind: 'signal', fieldId: 'sum_0', runSignal: null }, 'schematic');
    });
    const { getByTestId } = renderSurface();
    expect(getByTestId('ide-case-lab-col-sum_0').getAttribute('aria-current')).toBe('true');
    expect(getByTestId('ide-case-lab-col-carry-out').getAttribute('aria-current')).toBeNull();
  });

  it('moves the follow when another column is clicked and publishes it from Cases', () => {
    act(() => {
      useEngineeringSelection.getState().select({ kind: 'signal', fieldId: 'sum_0', runSignal: null }, 'schematic');
    });
    const { getByTestId } = renderSurface();
    act(() => {
      fireEvent.click(getByTestId('ide-case-lab-col-carry-out'));
    });
    expect(getByTestId('ide-case-lab-col-carry-out').getAttribute('aria-current')).toBe('true');
    expect(getByTestId('ide-case-lab-col-sum_0').getAttribute('aria-current')).toBeNull();
    const state = useEngineeringSelection.getState();
    expect(state.selected?.kind).toBe('signal');
    expect(state.selected && 'fieldId' in state.selected ? state.selected.fieldId : null).toBe('carry-out');
    expect(state.origin).toBe('cases');
  });
});
