// @vitest-environment jsdom
/**
 * Contract tests for the retired tick-context chip in VerifyCommandBar.
 * Tick context now belongs to the waveform/readout surface, so the command
 * bar must not repeat a separate t{N} chip beside Open in Design.
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

describe('VerifyCommandBar retired tick-context chip', () => {
  it('does not show a tick chip when goToDesignTick is set', () => {
    const { queryByTestId } = render(
      <VerifyCommandBar {...BASE} goToDesignTick={3} />
    );
    expect(queryByTestId('ide-vcb-design-tick-chip')).toBeNull();
  });

  it('does not show a tick chip for tick 0', () => {
    const { queryByTestId } = render(
      <VerifyCommandBar {...BASE} goToDesignTick={0} />
    );
    expect(queryByTestId('ide-vcb-design-tick-chip')).toBeNull();
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

  it('renders neither a tick chip nor an in-bar Open-in-Design sibling (both retired from the command bar)', () => {
    // The command bar was simplified to workspace lenses + run intent + Run.
    // Trace-to-Design now lives on the waveform/inspector surface
    // (ide-sim-inspector-trace-design), not as a command-bar action, so the
    // command bar must repeat neither the tick chip nor an Open-in-Design button.
    const { queryByTestId } = render(
      <VerifyCommandBar {...BASE} goToDesignTick={1} />
    );
    expect(queryByTestId('ide-vcb-design-tick-chip')).toBeNull();
    expect(queryByTestId('ide-verify-inspect-design')).toBeNull();
  });

  it('hides tick chip when showGoToDesign is false even if tick is set', () => {
    const { queryByTestId } = render(
      <VerifyCommandBar {...BASE} showGoToDesign={false} goToDesignTick={2} />
    );
    expect(queryByTestId('ide-vcb-design-tick-chip')).toBeNull();
  });
});
