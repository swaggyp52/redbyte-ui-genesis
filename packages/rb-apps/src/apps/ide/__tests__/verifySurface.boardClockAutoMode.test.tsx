// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import type { VerifyScheduleContract } from '../../fpga/boards/basys3/verifySchedule';
import { VerifySurface } from '../surfaces/VerifySurface';

const liveBoardClockContract: VerifyScheduleContract = {
  schedule: 'clocked_macro',
  timingMode: 'synchronous_board_clock',
  reason: 'circuit-sequential',
  analysis: {
    hasClockedMacros: true,
    hasClockNet: true,
    sequentialNodes: [{ id: 'ff0', type: 'DFlipFlop', clockPort: 'CLK' }],
    clockSource: 'ioMapping',
    clockNetName: 'CLK100MHZ',
  },
  needsSimClockInjection: false,
  clockSignalName: 'CLK100MHZ',
  samplePoint: 'post-rising-edge',
  tick0Meaning: 'initial-state',
  resetHint: {
    signalName: 'rst',
    activeLevel: 1,
  },
  hasUnsupportedTemporal: false,
  temporalIssues: [],
};

describe('VerifySurface board clock auto mode', () => {
  it('defaults a W5 board clock to auto mode instead of rendering a manual clock row', () => {
    const onRunVerification = vi.fn();
    const view = render(
      <VerifySurface
        deterministicHash="auto-board-clock"
        hasVectors
        verifyMode="sequential"
        vectors={[]}
        mappedInputs={[
          { id: 'clk', label: 'CLK100MHZ', pin: 'W5' },
          { id: 'sw0', label: 'SW0', pin: 'V17' },
        ]}
        mappedSignals={[
          { id: 'clk', label: 'CLK100MHZ', direction: 'in', pin: 'W5' },
          { id: 'sw0', label: 'SW0', direction: 'in', pin: 'V17' },
          { id: 'rst', label: 'BTNC', direction: 'in', pin: 'U18' },
          { id: 'ld0', label: 'LD0', direction: 'out', pin: 'U16' },
        ]}
        liveSignalRoles={{ clk: 'clock', sw0: 'input', rst: 'reset', ld0: 'output' }}
        liveScheduleContract={liveBoardClockContract}
        onRunVerification={onRunVerification}
        onVectorsChange={vi.fn()}
        onOpenProjectVectors={vi.fn()}
      />
    );

    expect(view.getByTestId('ide-verify-clock-mode-summary').textContent).toContain('Auto board clock');
    expect(view.getByTestId('ide-verify-clock-policy-copy').textContent).toContain(
      'auto-toggle the Basys3 board clock'
    );
    expect(view.getByTestId('ide-verify-clock-pattern-summary').textContent).toContain(
      'Auto board clock: 8 cycles'
    );
    expect(view.queryByTestId('ide-stimulus-clock-row')).toBeNull();

    fireEvent.click(view.getByTestId('ide-vcb-run'));

    expect(onRunVerification).toHaveBeenCalledWith(
      expect.objectContaining({
        clockPolicy: expect.objectContaining({
          sourceType: 'board-clock',
          overrideMode: 'auto',
          runCycles: 8,
        }),
      })
    );
  });

  it('preserves manual pulse override as an explicit debug mode', () => {
    const onRunVerification = vi.fn();
    const view = render(
      <VerifySurface
        deterministicHash="manual-board-clock"
        hasVectors
        verifyMode="sequential"
        vectors={[]}
        mappedInputs={[
          { id: 'clk', label: 'CLK100MHZ', pin: 'W5' },
          { id: 'sw0', label: 'SW0', pin: 'V17' },
        ]}
        mappedSignals={[
          { id: 'clk', label: 'CLK100MHZ', direction: 'in', pin: 'W5' },
          { id: 'sw0', label: 'SW0', direction: 'in', pin: 'V17' },
          { id: 'rst', label: 'BTNC', direction: 'in', pin: 'U18' },
          { id: 'ld0', label: 'LD0', direction: 'out', pin: 'U16' },
        ]}
        liveSignalRoles={{ clk: 'clock', sw0: 'input', rst: 'reset', ld0: 'output' }}
        liveScheduleContract={liveBoardClockContract}
        onRunVerification={onRunVerification}
        onVectorsChange={vi.fn()}
        onOpenProjectVectors={vi.fn()}
      />
    );

    fireEvent.click(view.getByTestId('ide-verify-clock-mode-manual'));

    expect(view.getByTestId('ide-verify-clock-mode-summary').textContent).toContain('Manual pulses');
    expect(view.getByTestId('ide-verify-clock-manual-warning').textContent).toContain(
      'Manual clock source'
    );
    expect(view.getByTestId('ide-stimulus-clock-row')).toBeTruthy();

    fireEvent.click(view.getByTestId('ide-vcb-run'));

    expect(onRunVerification).toHaveBeenCalledWith(
      expect.objectContaining({
        clockPolicy: expect.objectContaining({
          overrideMode: 'manual-pulses',
          autoRunEnabled: false,
        }),
      })
    );
  });
});
