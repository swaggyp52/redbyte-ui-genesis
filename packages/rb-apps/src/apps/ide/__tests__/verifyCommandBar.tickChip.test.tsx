// @vitest-environment jsdom
/**
 * Contract tests for the tick-context chip in VerifyCommandBar.
 * When a tick is selected and the Design bridge is shown, a "t{N}" chip
 * should appear inline with "Open in Design" so users know which tick's
 * inputs will be injected into the runtime sim.
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { VerifyCommandBar, type VerifyCommandBarProps } from '../surfaces/verify/VerifyCommandBar';

const BASE: VerifyCommandBarProps = {
  isCompareMode: false,
  onSetObserve: vi.fn(),
  onSetCompare: vi.fn(),
  compareAvailable: false,
  onRun: vi.fn(),
  runLabel: 'Run',
  runDisabled: false,
  onGenerate: vi.fn(),
  generateLabel: 'Initialize inputs',
  showGenerate: false,
  showSaveAsExpected: false,
  statusLabel: 'Ready',
  statusTone: 'idle',
  isSequential: false,
  showGoToDesign: true,
  onGoToDesign: vi.fn(),
};

describe('VerifyCommandBar tick-context chip', () => {
  it('shows tick chip with correct label when goToDesignTick is set', () => {
    const { getByTestId } = render(
      <VerifyCommandBar {...BASE} goToDesignTick={3} />
    );
    const chip = getByTestId('ide-vcb-design-tick-chip');
    expect(chip.textContent).toBe('t3');
  });

  it('shows tick chip for tick 0', () => {
    const { getByTestId } = render(
      <VerifyCommandBar {...BASE} goToDesignTick={0} />
    );
    const chip = getByTestId('ide-vcb-design-tick-chip');
    expect(chip.textContent).toBe('t0');
  });

  it('hides tick chip when goToDesignTick is null', () => {
    const { queryByTestId } = render(
      <VerifyCommandBar {...BASE} goToDesignTick={null} />
    );
    expect(queryByTestId('ide-vcb-design-tick-chip')).toBeNull();
  });

  it('hides tick chip when goToDesignTick is undefined (prop not passed)', () => {
    const { queryByTestId } = render(
      <VerifyCommandBar {...BASE} />
    );
    expect(queryByTestId('ide-vcb-design-tick-chip')).toBeNull();
  });

  it('tick chip is adjacent to the Open in Design button', () => {
    const { getByTestId } = render(
      <VerifyCommandBar {...BASE} goToDesignTick={1} />
    );
    const chip = getByTestId('ide-vcb-design-tick-chip');
    const btn = getByTestId('ide-verify-inspect-design');
    // chip and button should share a parent (inline in same wrapper)
    expect(chip.parentElement).toBe(btn.parentElement);
  });

  it('hides tick chip when showGoToDesign is false even if tick is set', () => {
    const { queryByTestId } = render(
      <VerifyCommandBar {...BASE} showGoToDesign={false} goToDesignTick={2} />
    );
    expect(queryByTestId('ide-vcb-design-tick-chip')).toBeNull();
  });
});
