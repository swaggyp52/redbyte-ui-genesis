// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { RuntimeVerifyRun } from '../projectRuntime';
import type { VerifyScheduleContract } from '../../fpga/boards/basys3/verifySchedule';
import { VerifySurface } from '../surfaces/VerifySurface';

const manualLabContract: VerifyScheduleContract = {
  schedule: 'clocked_macro',
  timingMode: 'manual_event_driven_lab',
  reason: 'circuit-sequential',
  analysis: {
    hasClockedMacros: true,
    hasClockNet: false,
    sequentialNodes: [{ id: 'ff1', type: 'Register1', clockPort: 'CLK' }],
    clockSource: undefined,
    clockNetName: undefined,
  },
  needsSimClockInjection: true,
  clockSignalName: '__sim_clk__',
  samplePoint: 'post-rising-edge',
  tick0Meaning: 'initial-state',
  hasUnsupportedTemporal: false,
  temporalIssues: [],
};

function makeTwoTickManualLabRun(): RuntimeVerifyRun {
  const cases = [
    {
      tick: 0,
      inputs: { sw0: 0 as const },
      expected: { ld0: '0' },
      actual: { ld0: '0' },
    },
    {
      tick: 1,
      inputs: { sw0: 1 as const },
      expected: { ld0: '1' },
      actual: { ld0: '1' },
    },
  ];
  return {
    scenarioId: 'lab-step',
    scenarioName: 'Lab Step',
    status: 'pass',
    deterministicHash: 'det_manual_lab_step',
    reportHash: 'rep_manual_lab_step',
    generatedAtIso: '2026-04-15T12:00:00.000Z',
    schedule: 'clocked_macro',
    scheduleContract: manualLabContract,
    meta: {
      circuitKind: 'sequential',
      clockingProtocol: 'clocked_macro',
      samplePoint: 'post-rising-edge',
      tick0Meaning: 'initial-state',
      clockSignalName: '__sim_clk__',
    },
    report: {
      vectors: cases.map((c) => ({
        id: `vec-${c.tick}`,
        tick: c.tick,
        inputs: c.inputs,
        expected: { ld0: c.expected.ld0 === '1' ? 1 : 0 },
      })),
      inputsAtTick: Object.fromEntries(cases.map((c) => [c.tick, c.inputs])),
      signalRoles: { sw0: 'input', ld0: 'output' },
      rows: cases.flatMap((c) => [
        {
          tick: c.tick,
          signal: 'ld0',
          expected: c.expected.ld0,
          actual: c.actual.ld0,
          status: 'pass' as const,
        },
      ]),
    } as RuntimeVerifyRun['report'],
    waveform: cases.map((c) => ({
      tick: c.tick,
      signals: {
        sw0: String(c.inputs.sw0),
        ld0: c.actual.ld0,
        reg_q0: c.tick === 0 ? '0' : '1',
        state_bank_s0: c.tick === 0 ? '0' : '1',
      },
      mismatches: [],
    })),
  };
}

describe('VerifySurface manual lab step workflow', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('defaults step mode on for manual_event_driven_lab runs with multiple ticks', () => {
    const run = makeTwoTickManualLabRun();
    const onAppendScenarioStep = vi.fn();
    render(
      <VerifySurface
        deterministicHash={run.deterministicHash}
        hasVectors
        vectors={run.report.vectors}
        lastRun={run}
        verifyMode="sequential"
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', label: 'SW0', direction: 'in' },
          { id: 'ld0', label: 'LD0', direction: 'out' },
        ]}
        onOpenProjectVectors={vi.fn()}
        onAppendScenarioStep={onAppendScenarioStep}
      />
    );

    expect(screen.getByTestId('ide-verify-step-controls')).toBeTruthy();
    expect(screen.getByTestId('ide-verify-step-bar')).toBeTruthy();
    expect(screen.getByTestId('ide-verify-step-mode-toggle').textContent).toMatch(/step cases on/i);
    expect(screen.getByTestId('ide-verify-lab-sequencer')).toBeTruthy();
    expect(screen.getByTestId('ide-verify-lab-sequencer-mode').textContent).toMatch(/manual-event lab mode/i);
    expect(screen.getByTestId('ide-verify-lab-scenario-name').textContent).toContain('Lab Step');
    expect(screen.getByTestId('ide-verify-lab-step-count').textContent).toBe('4 steps');
    expect(screen.getByTestId('ide-verify-lab-step-list').textContent).toMatch(/set input/i);
    expect(screen.getByTestId('ide-verify-lab-step-list').textContent).toMatch(/capture \/ assert/i);
    expect(screen.getByTestId('ide-verify-lab-authoring-strip')).toBeTruthy();
    fireEvent.click(screen.getByTestId('ide-verify-lab-action-pulse'));
    expect(onAppendScenarioStep).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'pulse_step',
      })
    );
  });

  it('hides Prev/Next bar when step mode is toggled off but keeps the toggle', () => {
    const run = makeTwoTickManualLabRun();
    render(
      <VerifySurface
        deterministicHash={run.deterministicHash}
        hasVectors
        vectors={run.report.vectors}
        lastRun={run}
        verifyMode="sequential"
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', label: 'SW0', direction: 'in' },
          { id: 'ld0', label: 'LD0', direction: 'out' },
        ]}
        onOpenProjectVectors={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('ide-verify-step-mode-toggle'));
    expect(screen.queryByTestId('ide-verify-step-bar')).toBeNull();
    expect(screen.getByTestId('ide-verify-step-mode-toggle').textContent?.trim()).toBe('Step cases');
  });

  it('uses explicit scenario steps over derived vectors and renders state detail cards', () => {
    const run = makeTwoTickManualLabRun();
    render(
      <VerifySurface
        deterministicHash={run.deterministicHash}
        hasVectors
        vectors={run.report.vectors}
        lastRun={run}
        verifyMode="sequential"
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', label: 'SW0', direction: 'in' },
          { id: 'ld0', label: 'LD0', direction: 'out' },
        ]}
        activeScenario={{
          id: 'manual-explicit',
          name: 'Manual Explicit',
          vectors: run.report.vectors,
          steps: [
            {
              id: 'step-explicit-inspect',
              order: 0,
              kind: 'inspect_register',
              targetRef: 'reg_q0',
              origin: 'explicit',
            },
          ],
          version: 2,
          createdAt: '2026-04-15T00:00:00.000Z',
          updatedAt: '2026-04-15T00:00:00.000Z',
        }}
        onOpenProjectVectors={vi.fn()}
      />
    );

    expect(screen.getByTestId('ide-verify-lab-step-count').textContent).toBe('1 step');
    expect(screen.getByTestId('ide-verify-lab-step-list').textContent).toMatch(/inspect register/i);
    expect(screen.getByTestId('ide-verify-lab-state-detail-list').textContent).toMatch(/reg_q0/i);
    expect(screen.getByTestId('ide-verify-lab-state-detail-list').textContent).toMatch(/state_bank_s0/i);
  });

  it('renders inline step editor controls for persisted scenario steps', () => {
    const run = makeTwoTickManualLabRun();
    const onUpdateScenarioStep = vi.fn();
    const onMoveScenarioStep = vi.fn();
    const onDeleteScenarioStep = vi.fn();
    render(
      <VerifySurface
        deterministicHash={run.deterministicHash}
        hasVectors
        vectors={run.report.vectors}
        lastRun={run}
        verifyMode="sequential"
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', label: 'SW0', direction: 'in' },
          { id: 'ld0', label: 'LD0', direction: 'out' },
        ]}
        activeScenario={{
          id: 'manual-explicit',
          name: 'Manual Explicit',
          vectors: run.report.vectors,
          steps: [
            {
              id: 'step-explicit-inspect',
              order: 0,
              kind: 'inspect_register',
              targetRef: 'reg_q0',
              origin: 'explicit',
            },
          ],
          version: 2,
          createdAt: '2026-04-15T00:00:00.000Z',
          updatedAt: '2026-04-15T00:00:00.000Z',
        }}
        onOpenProjectVectors={vi.fn()}
        onUpdateScenarioStep={onUpdateScenarioStep}
        onMoveScenarioStep={onMoveScenarioStep}
        onDeleteScenarioStep={onDeleteScenarioStep}
      />
    );

    expect(screen.getByTestId('ide-verify-lab-step-editor')).toBeTruthy();
    expect(screen.getByTestId('ide-verify-lab-step-kind-step-explicit-inspect')).toBeTruthy();
    expect(screen.getByTestId('ide-verify-lab-step-target-step-explicit-inspect')).toBeTruthy();
    expect(screen.getByTestId('ide-verify-lab-step-delete-step-explicit-inspect')).toBeTruthy();
    expect(screen.getByTestId('ide-verify-lab-step-duration-step-explicit-inspect')).toBeTruthy();
    expect(screen.getByTestId('ide-verify-lab-step-pulse-step-explicit-inspect')).toBeTruthy();
    fireEvent.change(screen.getByTestId('ide-verify-lab-step-target-step-explicit-inspect'), {
      target: { value: 'reg_q1' },
    });
    fireEvent.click(screen.getByTestId('ide-verify-lab-step-up-step-explicit-inspect'));
    fireEvent.change(screen.getByTestId('ide-verify-lab-step-duration-step-explicit-inspect'), {
      target: { value: '3' },
    });
    fireEvent.click(screen.getByTestId('ide-verify-lab-step-delete-step-explicit-inspect'));
    expect(onUpdateScenarioStep).toHaveBeenCalledWith(
      'step-explicit-inspect',
      expect.objectContaining({ targetRef: 'reg_q1' })
    );
    expect(onMoveScenarioStep).toHaveBeenCalledWith('step-explicit-inspect', 'up');
    expect(onUpdateScenarioStep).toHaveBeenCalledWith(
      'step-explicit-inspect',
      expect.objectContaining({ durationTicks: 3 })
    );
    expect(onDeleteScenarioStep).toHaveBeenCalledWith('step-explicit-inspect');
  });
});
