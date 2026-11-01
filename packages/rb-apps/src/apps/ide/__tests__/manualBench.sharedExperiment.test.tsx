// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { ManualBench } from '../surfaces/verify/ManualBench';
import { useProjectRuntime } from '../projectRuntime';

/**
 * P1-D — the Manual Bench is a live instrument over the ONE experiment
 * (`useProjectRuntime().sim`). These tests drive inputs through the bench and
 * read observed outputs back from the SAME store state, proving the bench and
 * the Virtual Board (which reads the identical `state.sim` through `useIoBus`)
 * share a single authority. No second store, no synchronization glue.
 */

afterEach(cleanup);

beforeEach(() => {
  useProjectRuntime.getState().loadExample('half-adder');
});

function readSignal(nodeId: string): 0 | 1 | 'X' | 'Z' | undefined {
  const sim = useProjectRuntime.getState().sim;
  const direct = sim.inputs[nodeId];
  if (direct === 0 || direct === 1) return direct;
  return sim.signals[nodeId] ?? sim.signals[`${nodeId}.out`] ?? sim.signals[`${nodeId}.in`];
}

describe('Manual Bench — shared experiment over state.sim', () => {
  it('enumerates boundary inputs to drive and outputs to measure', () => {
    const { getByTestId } = render(<ManualBench />);
    // Half Adder: SW0 (A), SW1 (B) drive; LD0 (CARRY), LD1 (SUM) measure.
    expect(getByTestId('ide-manual-bench-drive-toggle-sw0-a')).toBeTruthy();
    expect(getByTestId('ide-manual-bench-drive-toggle-sw1-b')).toBeTruthy();
    expect(getByTestId('ide-manual-bench-measure-value-ld0-carry')).toBeTruthy();
    expect(getByTestId('ide-manual-bench-measure-value-ld1-sum')).toBeTruthy();
  });

  it('drives inputs into the single experiment state and reads observed outputs back', () => {
    const { getByTestId } = render(<ManualBench />);

    // Drive A=1, B=1 through the bench toggles → the ONE store state.
    fireEvent.click(getByTestId('ide-manual-bench-drive-toggle-sw0-a'));
    fireEvent.click(getByTestId('ide-manual-bench-drive-toggle-sw1-b'));

    // The store now carries the driven inputs — the same state the Virtual
    // Board reads. SUM = A XOR B = 0, CARRY = A AND B = 1.
    expect(readSignal('sw0_node')).toBe(1);
    expect(readSignal('sw1_node')).toBe(1);
    expect(getByTestId('ide-manual-bench-measure-value-ld1-sum').textContent).toBe('0');
    expect(getByTestId('ide-manual-bench-measure-value-ld0-carry').textContent).toBe('1');

    // Toggle B back to 0 → SUM = 1, CARRY = 0. Observed values track the drive.
    fireEvent.click(getByTestId('ide-manual-bench-drive-toggle-sw1-b'));
    expect(readSignal('sw1_node')).toBe(0);
    expect(getByTestId('ide-manual-bench-measure-value-ld1-sum').textContent).toBe('1');
    expect(getByTestId('ide-manual-bench-measure-value-ld0-carry').textContent).toBe('0');
  });

  it('reflects an external drive on the same store without any bench-local mirror', () => {
    // Simulate the Virtual Board (or Design canvas) driving the shared state
    // directly through the store authority BEFORE the bench mounts. The bench
    // MEASURE must show those values on first render with no bench-side write,
    // proving it is a pure read-model over state.sim.
    const setInput = useProjectRuntime.getState().actions.sim.setInput;
    setInput('sw0_node', 1);
    setInput('sw1_node', 1);

    const { getByTestId } = render(<ManualBench />);
    expect(getByTestId('ide-manual-bench-measure-value-ld0-carry').textContent).toBe('1');
    expect(getByTestId('ide-manual-bench-measure-value-ld1-sum').textContent).toBe('0');
  });
});
