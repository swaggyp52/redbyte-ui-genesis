// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import type { VerifyScheduleContract } from '../../fpga/boards/basys3/verifySchedule';
import { VerifySurface } from '../surfaces/VerifySurface';
import type { RuntimeVerifyRun } from '../projectRuntime';
import {
  computeScenarioContentHash,
  computeScenarioStimulusHash,
  createDefaultScenario,
} from '../verifyScenario';

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

afterEach(() => {
  cleanup();
});

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
          { id: 'rst', label: 'BTNC', pin: 'U18' },
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
    expect(view.getByTestId('ide-verify-stimulus-summary').textContent).toContain('runs automatically');
    expect(view.getByTestId('ide-verify-stimulus-title').textContent).toContain('Testbench cases');
    expect(view.getByTestId('ide-verify-clock-detected').textContent).toContain('CLK100MHZ');
    expect(view.getByTestId('ide-verify-clock-detected').textContent).toContain('W5');
    expect(view.getByTestId('ide-verify-clock-reset-summary').textContent).toContain('reset sequence applied');
    expect(view.getByTestId('ide-verify-clock-run-cycles')).toBeTruthy();
    expect(view.getByTestId('ide-verify-clock-policy-copy').textContent).toContain(
      'Auto mode generates the board clock'
    );
    expect(view.getByTestId('ide-verify-clock-pattern-summary').textContent).toContain(
      'Auto board clock: 8 cycles'
    );
    expect(view.queryByTestId('ide-stimulus-clock-row')).toBeNull();
    expect(view.queryByTestId('ide-stimulus-row-select-rst')).toBeNull();

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
    const onUpdateScenarioSequentialPolicy = vi.fn();
    const onVectorsChange = vi.fn();
    const view = render(
      <VerifySurface
        deterministicHash="manual-board-clock"
        hasVectors
        verifyMode="sequential"
        vectors={[]}
        mappedInputs={[
          { id: 'clk', label: 'CLK100MHZ', pin: 'W5' },
          { id: 'sw0', label: 'SW0', pin: 'V17' },
          { id: 'rst', label: 'BTNC', pin: 'U18' },
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
        onUpdateScenarioSequentialPolicy={onUpdateScenarioSequentialPolicy}
        onVectorsChange={onVectorsChange}
        onOpenProjectVectors={vi.fn()}
      />
    );

    fireEvent.click(view.getByTestId('ide-verify-clock-mode-manual'));

    expect(view.getByTestId('ide-verify-clock-mode-summary').textContent).toContain('Manual pulses');
    expect(view.getByTestId('ide-verify-stimulus-summary').textContent).toContain('Manual pulses');
    expect(view.getByTestId('ide-verify-clock-manual-warning').textContent).toContain(
      'Manual clock source'
    );
    expect(view.getByTestId('ide-stimulus-clock-row')).toBeTruthy();
    expect(view.getByTestId('ide-stimulus-clock-row').contains(view.getByTestId('ide-stimulus-clock-tools'))).toBe(false);
    fireEvent.click(view.getByTestId('ide-stimulus-clock-behavior-rising'));
    expect(onVectorsChange).toHaveBeenCalledWith([
      expect.objectContaining({ tick: 0, inputs: expect.objectContaining({ clk: 0 }) }),
      expect.objectContaining({ tick: 1, inputs: expect.objectContaining({ clk: 1 }) }),
    ]);
    expect(view.getByTestId('ide-stimulus-row-select-rst')).toBeTruthy();
    expect(onUpdateScenarioSequentialPolicy).toHaveBeenCalledWith(
      expect.objectContaining({
        overrideMode: 'manual-pulses',
        runCycles: 8,
        signalId: 'clk',
        sourceType: 'board-clock',
        executionModel: 'manual',
        resetBehavior: 'custom',
      })
    );

    fireEvent.click(view.getByTestId('ide-vcb-run'));

    expect(onRunVerification).toHaveBeenCalledWith(
      expect.objectContaining({
        clockPolicy: expect.objectContaining({
          overrideMode: 'manual-pulses',
          autoRunEnabled: false,
        }),
      })
    );

    fireEvent.click(view.getByTestId('ide-verify-clock-mode-custom'));
    expect(onUpdateScenarioSequentialPolicy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        overrideMode: 'custom-pattern',
        executionModel: 'manual',
        resetBehavior: 'custom',
      })
    );

    fireEvent.click(view.getByTestId('ide-verify-clock-mode-auto'));
    expect(onUpdateScenarioSequentialPolicy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        overrideMode: 'auto',
        sourceType: 'board-clock',
        executionModel: 'external-input-auto-toggle',
        resetBehavior: 'auto-sequence',
        signalId: 'clk',
        startLevel: 0,
        activeEdge: 'rising',
      })
    );
  });

  it('uses authored row count as Manual run length instead of exposing a no-op cycle input', async () => {
    const onRunVerification = vi.fn();
    const activeScenario = createDefaultScenario([
      { tick: 0, inputs: { clk: 0, rst: 0 }, expected: { ld0: 0 } },
      { tick: 1, inputs: { clk: 1, rst: 0 }, expected: { ld0: 1 } },
    ], {
      overrideMode: 'manual-pulses',
      runCycles: 3,
      activeEdge: 'falling',
      resetBehavior: 'custom',
      sourceType: 'board-clock',
      executionModel: 'external-input-auto-toggle',
      signalId: 'clk',
      signalLabel: 'CLK100MHZ',
      resetSignalName: 'rst',
      startLevel: 1,
    });
    const view = render(
      <VerifySurface
        deterministicHash="saved-board-clock-policy"
        hasVectors
        verifyMode="sequential"
        vectors={activeScenario.vectors}
        activeScenario={activeScenario}
        mappedInputs={[
          { id: 'clk', label: 'CLK100MHZ', pin: 'W5' },
          { id: 'rst', label: 'BTNC', pin: 'U18' },
        ]}
        mappedSignals={[
          { id: 'clk', label: 'CLK100MHZ', direction: 'in', pin: 'W5' },
          { id: 'rst', label: 'BTNC', direction: 'in', pin: 'U18' },
          { id: 'ld0', label: 'LD0', direction: 'out', pin: 'U16' },
        ]}
        liveSignalRoles={{ clk: 'clock', rst: 'reset', ld0: 'output' }}
        liveScheduleContract={liveBoardClockContract}
        onRunVerification={onRunVerification}
        onVectorsChange={vi.fn()}
        onOpenProjectVectors={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(view.getByTestId('ide-verify-clock-mode-summary').textContent).toContain('Manual pulses');
      expect(view.getByTestId('ide-verify-clock-authored-run-length').textContent)
        .toContain('2 authored rows');
      expect(view.queryByTestId('ide-verify-clock-run-cycles-input')).toBeNull();
    });
    fireEvent.click(view.getByTestId('ide-vcb-run'));
    expect(onRunVerification).toHaveBeenCalledWith(
      expect.objectContaining({
        clockPolicy: expect.objectContaining({
          overrideMode: 'manual-pulses',
          runCycles: 2,
          autoRunEnabled: false,
          activeEdge: 'rising',
          startLevel: 1,
          resetBehavior: 'custom',
          sourceType: 'board-clock',
          executionModel: 'manual',
          signalId: 'clk',
          resetSignalName: 'BTNC',
        }),
      })
    );
  });

  it('preserves saved Auto settings while rebinding execution to live signal identities', async () => {
    const onRunVerification = vi.fn();
    const onUpdateScenarioSequentialPolicy = vi.fn();
    const activeScenario = createDefaultScenario([
      { tick: 0, inputs: { clk: 0, rst: 0 }, expected: { ld0: 0 } },
      { tick: 1, inputs: { clk: 1, rst: 0 }, expected: { ld0: 1 } },
    ], {
      overrideMode: 'auto',
      runCycles: 12,
      activeEdge: 'rising',
      resetBehavior: 'custom',
      sourceType: 'inferred',
      executionModel: 'external-input-auto-toggle',
      signalId: 'saved_clk',
      signalLabel: 'Saved clock',
      resetSignalName: 'saved_reset',
      startLevel: 1,
    });
    const view = render(
      <VerifySurface
        deterministicHash="saved-auto-detection-transition"
        hasVectors
        verifyMode="sequential"
        vectors={activeScenario.vectors}
        activeScenario={activeScenario}
        mappedInputs={[
          { id: 'detected_clk', label: 'CLK100MHZ', pin: 'W5' },
          { id: 'detected_reset', label: 'BTNC', pin: 'U18' },
        ]}
        mappedSignals={[
          { id: 'detected_clk', label: 'CLK100MHZ', direction: 'in', pin: 'W5' },
          { id: 'detected_reset', label: 'BTNC', direction: 'in', pin: 'U18' },
          { id: 'ld0', label: 'LD0', direction: 'out', pin: 'U16' },
        ]}
        liveSignalRoles={{ detected_clk: 'clock', detected_reset: 'reset', ld0: 'output' }}
        liveScheduleContract={liveBoardClockContract}
        onRunVerification={onRunVerification}
        onUpdateScenarioSequentialPolicy={onUpdateScenarioSequentialPolicy}
        onVectorsChange={vi.fn()}
        onOpenProjectVectors={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(view.getByTestId('ide-verify-clock-detected').textContent).toContain('CLK100MHZ');
      expect(view.getByTestId('ide-verify-clock-reset-summary').textContent).toContain('custom reset');
      expect((view.getByTestId('ide-verify-clock-run-cycles-input') as HTMLInputElement).value)
        .toBe('12');
    });

    fireEvent.change(view.getByTestId('ide-verify-clock-run-cycles-input'), {
      target: { value: '14' },
    });
    expect(onUpdateScenarioSequentialPolicy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        overrideMode: 'auto',
        runCycles: 14,
        sourceType: 'board-clock',
        executionModel: 'external-input-auto-toggle',
        signalId: 'detected_clk',
        signalLabel: 'CLK100MHZ',
        resetSignalName: 'detected_reset',
        resetBehavior: 'custom',
        startLevel: 1,
      })
    );

    fireEvent.click(view.getByTestId('ide-vcb-run'));
    expect(onRunVerification).toHaveBeenLastCalledWith(
      expect.objectContaining({
        clockPolicy: expect.objectContaining({
          overrideMode: 'auto',
          runCycles: 14,
          autoRunEnabled: true,
          sourceType: 'board-clock',
          executionModel: 'external-input-auto-toggle',
          signalId: 'detected_clk',
          signalLabel: 'CLK100MHZ',
          resetSignalName: 'BTNC',
          resetBehavior: 'custom',
          startLevel: 1,
        }),
      })
    );
  });

  it('marks a prior PASS stale immediately when sequential execution mode changes', async () => {
    const activeScenario = createDefaultScenario(
      [{ tick: 0, inputs: { clk: 0, rst: 0 }, expected: { ld0: 0 } }],
      {
        overrideMode: 'auto',
        runCycles: 8,
        activeEdge: 'rising',
        resetBehavior: 'auto-sequence',
        sourceType: 'board-clock',
        executionModel: 'external-input-auto-toggle',
        signalId: 'clk',
        signalLabel: 'CLK100MHZ',
        resetSignalName: 'rst',
        startLevel: 0,
      }
    );
    const reportVectors = Array.from({ length: 8 }, (_, tick) => ({
      id: `auto-${tick}`,
      tick,
      inputs: { clk: 1, rst: tick === 0 ? 1 : 0 },
      expected: tick === 0 ? { ld0: 0 } : {},
    }));
    const lastRun: RuntimeVerifyRun = {
      scenarioId: activeScenario.id,
      scenarioName: activeScenario.name,
      scenarioVersion: activeScenario.version,
      scenarioContentHash: computeScenarioContentHash(activeScenario),
      scenarioStimulusHash: computeScenarioStimulusHash(activeScenario),
      status: 'pass',
      deterministicHash: 'policy-stale-hash',
      reportHash: 'policy-stale-report',
      generatedAtIso: '2026-07-22T00:00:00.000Z',
      schedule: 'clocked_macro',
      scheduleContract: liveBoardClockContract,
      clockPolicy: {
        signalId: 'clk',
        signalLabel: 'CLK100MHZ',
        sourceType: 'board-clock',
        executionModel: 'external-input-auto-toggle',
        overrideMode: 'auto',
        autoRunEnabled: true,
        activeEdge: 'rising',
        startLevel: 0,
        dutyCycle: 0.5,
        runCycles: 8,
        resetSignalName: 'rst',
        resetBehavior: 'auto-sequence',
      },
      meta: {
        circuitKind: 'sequential',
        clockingProtocol: 'clocked_macro',
        samplePoint: 'post-rising-edge',
        tick0Meaning: 'initial-state',
        clockSignalName: 'CLK100MHZ',
      },
      report: {
        vectors: reportVectors,
        inputsAtTick: Object.fromEntries(reportVectors.map((vector) => [vector.tick, vector.inputs])),
        inputsByVectorId: Object.fromEntries(reportVectors.map((vector) => [vector.id, vector.inputs])),
        signalRoles: { clk: 'clock', rst: 'reset', ld0: 'output' },
        rows: [{ tick: 0, signal: 'ld0', expected: '0', actual: '0', status: 'pass' }],
      } as RuntimeVerifyRun['report'],
      waveform: [{ tick: 0, signals: { clk: '0', rst: '0', ld0: '0' }, mismatches: [] }],
    };
    const view = render(
      <VerifySurface
        deterministicHash="policy-stale-hash"
        hasVectors
        verifyMode="sequential"
        vectors={activeScenario.vectors}
        activeScenario={activeScenario}
        lastRun={lastRun}
        mappedInputs={[
          { id: 'clk', label: 'CLK100MHZ', pin: 'W5' },
          { id: 'rst', label: 'BTNC', pin: 'U18' },
        ]}
        mappedSignals={[
          { id: 'clk', label: 'CLK100MHZ', direction: 'in', pin: 'W5' },
          { id: 'rst', label: 'BTNC', direction: 'in', pin: 'U18' },
          { id: 'ld0', label: 'LD0', direction: 'out', pin: 'U16' },
        ]}
        liveSignalRoles={{ clk: 'clock', rst: 'reset', ld0: 'output' }}
        liveScheduleContract={liveBoardClockContract}
        onUpdateScenarioSequentialPolicy={vi.fn()}
        onVectorsChange={vi.fn()}
        onOpenProjectVectors={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(view.getByTestId('ide-verify-results-summary').getAttribute('data-kind')).toBe('pass');
    });
    fireEvent.click(view.getByTestId('ide-verify-clock-mode-manual'));
    await waitFor(() => {
      expect(view.getByTestId('ide-verify-results-summary').getAttribute('data-kind')).toBe('stale');
    });
  });

  it('marks Auto PASS stale after an expected-only edit when runCycles expanded the report', async () => {
    const activeScenario = createDefaultScenario(
      [{ tick: 0, inputs: { clk: 0, rst: 0 }, expected: { ld0: 0 } }],
      {
        overrideMode: 'auto',
        runCycles: 4,
        activeEdge: 'rising',
        resetBehavior: 'auto-sequence',
        sourceType: 'board-clock',
        executionModel: 'external-input-auto-toggle',
        signalId: 'clk',
        signalLabel: 'CLK100MHZ',
        resetSignalName: 'rst',
        startLevel: 0,
      }
    );
    const reportVectors = Array.from({ length: 4 }, (_, tick) => ({
      id: `auto-${tick}`,
      tick,
      inputs: { clk: 1, rst: tick === 0 ? 1 : 0 },
      expected: tick === 0 ? { ld0: 0 } : {},
    }));
    const lastRun: RuntimeVerifyRun = {
      scenarioId: activeScenario.id,
      scenarioName: activeScenario.name,
      scenarioVersion: activeScenario.version,
      scenarioContentHash: computeScenarioContentHash(activeScenario),
      scenarioStimulusHash: computeScenarioStimulusHash(activeScenario),
      status: 'pass',
      deterministicHash: 'auto-expected-edit',
      reportHash: 'auto-expected-edit-report',
      generatedAtIso: '2026-07-22T00:10:00.000Z',
      schedule: 'clocked_macro',
      scheduleContract: liveBoardClockContract,
      clockPolicy: {
        signalId: 'clk',
        signalLabel: 'CLK100MHZ',
        sourceType: 'board-clock',
        executionModel: 'external-input-auto-toggle',
        overrideMode: 'auto',
        autoRunEnabled: true,
        activeEdge: 'rising',
        startLevel: 0,
        dutyCycle: 0.5,
        runCycles: 4,
        resetSignalName: 'rst',
        resetBehavior: 'auto-sequence',
      },
      meta: {
        circuitKind: 'sequential',
        clockingProtocol: 'clocked_macro',
        samplePoint: 'post-rising-edge',
        tick0Meaning: 'initial-state',
        clockSignalName: 'CLK100MHZ',
      },
      report: {
        vectors: reportVectors,
        inputsAtTick: Object.fromEntries(reportVectors.map((vector) => [vector.tick, vector.inputs])),
        inputsByVectorId: Object.fromEntries(reportVectors.map((vector) => [vector.id, vector.inputs])),
        signalRoles: { clk: 'clock', rst: 'reset', ld0: 'output' },
        rows: [{ tick: 0, signal: 'ld0', expected: '0', actual: '0', status: 'pass' }],
      } as RuntimeVerifyRun['report'],
      waveform: [{ tick: 0, signals: { clk: '0', rst: '1', ld0: '0' }, mismatches: [] }],
    };
    const sharedProps = {
      deterministicHash: 'auto-expected-edit',
      hasVectors: true,
      verifyMode: 'sequential' as const,
      lastRun,
      mappedInputs: [
        { id: 'clk', label: 'CLK100MHZ', pin: 'W5' },
        { id: 'rst', label: 'BTNC', pin: 'U18' },
      ],
      mappedSignals: [
        { id: 'clk', label: 'CLK100MHZ', direction: 'in' as const, pin: 'W5' },
        { id: 'rst', label: 'BTNC', direction: 'in' as const, pin: 'U18' },
        { id: 'ld0', label: 'LD0', direction: 'out' as const, pin: 'U16' },
      ],
      liveSignalRoles: { clk: 'clock' as const, rst: 'reset' as const, ld0: 'output' as const },
      liveScheduleContract: liveBoardClockContract,
      onVectorsChange: vi.fn(),
      onOpenProjectVectors: vi.fn(),
    };
    const view = render(
      <VerifySurface
        {...sharedProps}
        vectors={activeScenario.vectors}
        activeScenario={activeScenario}
      />
    );

    await waitFor(() => {
      expect(view.getByTestId('ide-verify-results-summary').getAttribute('data-kind')).toBe('pass');
    });
    const editedScenario = {
      ...activeScenario,
      vectors: activeScenario.vectors.map((vector) => ({
        ...vector,
        expected: { ...(vector.expected ?? {}), ld0: 1 as const },
      })),
    };
    view.rerender(
      <VerifySurface
        {...sharedProps}
        vectors={editedScenario.vectors}
        activeScenario={editedScenario}
      />
    );

    await waitFor(() => {
      expect(view.getByTestId('ide-verify-results-summary').getAttribute('data-kind')).toBe('stale');
    });
  });

  it('keeps an exact custom-row execution current when legacy run metadata has no document hash', async () => {
    const activeScenario = createDefaultScenario(
      [{ tick: 0, inputs: { clk: 0, rst: 0 }, expected: { ld0: 0 } }],
      {
        overrideMode: 'manual-pulses',
        runCycles: 8,
        activeEdge: 'rising',
        resetBehavior: 'custom',
        sourceType: 'board-clock',
        executionModel: 'manual',
        signalId: 'clk',
        signalLabel: 'CLK100MHZ',
        resetSignalName: 'rst',
        startLevel: 0,
      }
    );
    const customVectors = [
      {
        id: 'custom-1',
        tick: 1,
        inputs: { clk: 1 as const, rst: 0 as const },
        expected: { ld0: 1 as const },
      },
    ];
    const reportVectors = [
      { id: 'vec-01', tick: 0, inputs: { clk: 0, rst: 0 }, expected: { ld0: 0 } },
      { id: 'vec-02', tick: 1, inputs: { clk: 1, rst: 0 }, expected: { ld0: 1 } },
    ];
    const lastRun: RuntimeVerifyRun = {
      scenarioId: activeScenario.id,
      scenarioName: activeScenario.name,
      scenarioVersion: activeScenario.version,
      status: 'pass',
      deterministicHash: 'custom-exact-plan',
      reportHash: 'custom-exact-plan-report',
      generatedAtIso: '2026-07-22T00:20:00.000Z',
      schedule: 'clocked_macro',
      scheduleContract: liveBoardClockContract,
      clockPolicy: {
        signalId: 'clk',
        signalLabel: 'CLK100MHZ',
        sourceType: 'board-clock',
        executionModel: 'manual',
        overrideMode: 'manual-pulses',
        autoRunEnabled: false,
        activeEdge: 'rising',
        startLevel: 0,
        dutyCycle: 0.5,
        runCycles: 2,
        resetSignalName: 'rst',
        resetBehavior: 'custom',
      },
      meta: {
        circuitKind: 'sequential',
        clockingProtocol: 'clocked_macro',
        samplePoint: 'post-rising-edge',
        tick0Meaning: 'initial-state',
        clockSignalName: 'CLK100MHZ',
      },
      report: {
        vectors: reportVectors,
        inputsAtTick: Object.fromEntries(reportVectors.map((vector) => [vector.tick, vector.inputs])),
        inputsByVectorId: Object.fromEntries(reportVectors.map((vector) => [vector.id, vector.inputs])),
        signalRoles: { clk: 'clock', rst: 'reset', ld0: 'output' },
        rows: reportVectors.map((vector) => ({
          tick: vector.tick,
          signal: 'ld0',
          expected: String(vector.expected.ld0),
          actual: String(vector.expected.ld0),
          status: 'pass' as const,
        })),
      } as RuntimeVerifyRun['report'],
      waveform: reportVectors.map((vector) => ({
        tick: vector.tick,
        signals: { clk: String(vector.inputs.clk), rst: '0', ld0: String(vector.expected.ld0) },
        mismatches: [],
      })),
    };
    const view = render(
      <VerifySurface
        deterministicHash="custom-exact-plan"
        hasVectors
        verifyMode="sequential"
        vectors={activeScenario.vectors}
        customVectors={customVectors}
        activeScenario={activeScenario}
        lastRun={lastRun}
        mappedInputs={[
          { id: 'clk', label: 'CLK100MHZ', pin: 'W5' },
          { id: 'rst', label: 'BTNC', pin: 'U18' },
        ]}
        mappedSignals={[
          { id: 'clk', label: 'CLK100MHZ', direction: 'in', pin: 'W5' },
          { id: 'rst', label: 'BTNC', direction: 'in', pin: 'U18' },
          { id: 'ld0', label: 'LD0', direction: 'out', pin: 'U16' },
        ]}
        liveSignalRoles={{ clk: 'clock', rst: 'reset', ld0: 'output' }}
        liveScheduleContract={liveBoardClockContract}
        onVectorsChange={vi.fn()}
        onOpenProjectVectors={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(view.getByTestId('ide-verify-results-summary').getAttribute('data-kind')).toBe('pass');
    });
  });

  it('does not describe an imported sim-only Clock component as a board clock', () => {
    const onRunVerification = vi.fn();
    const simClockContract: VerifyScheduleContract = {
      ...liveBoardClockContract,
      clockSignalName: 'CLK',
      resetHint: undefined,
      analysis: {
        ...liveBoardClockContract.analysis,
        clockNetName: 'CLK',
      },
    };
    const view = render(
      <VerifySurface
        deterministicHash="imported-sim-clock"
        hasVectors
        verifyMode="sequential"
        vectors={[]}
        mappedInputs={[
          { id: 'clk', label: 'CLK100MHZ', pin: 'W5', nodeId: 'clk_node' },
          { id: 'd', label: 'D', pin: 'V17', nodeId: 'd_node' },
        ]}
        mappedSignals={[
          { id: 'clk', label: 'CLK100MHZ', direction: 'in', pin: 'W5', nodeId: 'clk_node' },
          { id: 'd', label: 'D', direction: 'in', pin: 'V17', nodeId: 'd_node' },
          { id: 'q', label: 'Q', direction: 'out', pin: 'U16', nodeId: 'q_node' },
        ]}
        liveSignalRoles={{ clk: 'clock', d: 'input', q: 'output' }}
        liveScheduleContract={simClockContract}
        circuitGraph={{
          nodes: [
            {
              id: 'clk_node',
              type: 'Clock',
              label: 'CLK',
              config: { role: 'sim', period: 2 },
            },
          ],
          connections: [],
        }}
        onRunVerification={onRunVerification}
        onVectorsChange={vi.fn()}
        onOpenProjectVectors={vi.fn()}
      />
    );

    expect(view.queryByTestId('ide-verify-board-clock-source')).toBeNull();
    expect(view.getByTestId('ide-verify-clock-detected').textContent).toContain('CLK');
    expect(view.getByTestId('ide-verify-clock-detected').textContent).not.toContain('W5');
    expect(view.getByTestId('ide-verify-clock-mode-summary').textContent).toContain('Manual pulses');
    expect(view.getByTestId('ide-verify-clock-policy-copy').textContent).toContain(
      'Sim Clock components are import-only'
    );
    expect(view.getByTestId('ide-verify-clock-manual-warning').textContent).toContain(
      'Sim Clock components are import-only'
    );
    expect(view.getByTestId('ide-verify-clock-mode-auto')).toBeDisabled();

    fireEvent.click(view.getByTestId('ide-vcb-run'));

    const clockPolicy = onRunVerification.mock.calls.at(-1)?.[0].clockPolicy;
    expect(clockPolicy).toMatchObject({
      sourceType: 'explicit-clock-component',
      overrideMode: 'manual-pulses',
      autoRunEnabled: false,
    });
    expect(clockPolicy).not.toHaveProperty('boardAlias');
    expect(clockPolicy).not.toHaveProperty('packagePin');
  });
});
