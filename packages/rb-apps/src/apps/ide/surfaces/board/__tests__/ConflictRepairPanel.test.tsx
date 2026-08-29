// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { ConflictRepairPanel, type PinConflictFacts } from '../ConflictRepairPanel';

const CONFLICT: PinConflictFacts = {
  resource: 'SW1',
  packagePin: 'V16',
  currentOwner: 'B0',
  requestedOwner: 'A1',
  reason: 'SW1 (pin V16) is already assigned to B0; A1 needs a repair decision.',
};

describe('ConflictRepairPanel', () => {
  it('renders only the facts passed in', () => {
    const { getByTestId } = render(<ConflictRepairPanel conflict={CONFLICT} />);
    expect(getByTestId('rb-pin-conflict-repair-fact-resource').textContent).toBe(
      'SW1 · pin V16'
    );
    expect(getByTestId('rb-pin-conflict-repair-fact-current-owner').textContent).toBe('B0');
    expect(getByTestId('rb-pin-conflict-repair-fact-requested-owner').textContent).toBe('A1');
    expect(getByTestId('rb-pin-conflict-repair-reason').textContent).toContain(
      'already assigned to B0'
    );
  });

  it('omits the package pin when the authority did not resolve one', () => {
    const { getByTestId } = render(
      <ConflictRepairPanel conflict={{ ...CONFLICT, packagePin: null }} />
    );
    expect(getByTestId('rb-pin-conflict-repair-fact-resource').textContent).toBe('SW1');
  });

  it('forwards each repair intent to its callback', () => {
    const onSwap = vi.fn();
    const onClear = vi.fn();
    const onNextCompatible = vi.fn();
    const onCancel = vi.fn();
    const { getByTestId } = render(
      <ConflictRepairPanel
        conflict={CONFLICT}
        onSwap={onSwap}
        onClear={onClear}
        onNextCompatible={onNextCompatible}
        onCancel={onCancel}
      />
    );
    fireEvent.click(getByTestId('rb-pin-conflict-repair-swap'));
    fireEvent.click(getByTestId('rb-pin-conflict-repair-clear'));
    fireEvent.click(getByTestId('rb-pin-conflict-repair-next-compatible'));
    fireEvent.click(getByTestId('rb-pin-conflict-repair-cancel'));
    expect(onSwap).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onNextCompatible).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables actions with a truthful reason when no authority is wired', () => {
    const { getByTestId } = render(<ConflictRepairPanel conflict={CONFLICT} />);
    const swap = getByTestId('rb-pin-conflict-repair-swap') as HTMLButtonElement;
    expect(swap.disabled).toBe(true);
    expect(swap.title).toContain('no mapping authority');
    const clear = getByTestId('rb-pin-conflict-repair-clear') as HTMLButtonElement;
    expect(clear.disabled).toBe(true);
    const next = getByTestId('rb-pin-conflict-repair-next-compatible') as HTMLButtonElement;
    expect(next.disabled).toBe(true);
  });
});
