// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import type { RuntimeVerifyRun } from '../projectRuntime';
import { VerifySurface } from '../surfaces/VerifySurface';

if (!HTMLElement.prototype.scrollIntoView) {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
}

function makeTraceRun(): RuntimeVerifyRun {
  return {
    scenarioId: 'trace-scenario',
    scenarioName: 'Trace Scenario',
    status: 'pass',
    deterministicHash: 'abc123',
    reportHash: 'rep-trace',
    generatedAtIso: '2026-04-09T00:00:00.000Z',
    schedule: 'combinational',
    meta: {
      circuitKind: 'combinational',
      clockingProtocol: null,
      samplePoint: 'steady-state',
      tick0Meaning: null,
      clockSignalName: null,
    },
    report: {
      vectors: [
        { id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: {}, caseIndex: 0 },
        { id: 'vec-02', tick: 1, inputs: { sw0: 1 }, expected: {}, caseIndex: 1 },
      ],
      inputsAtTick: {
        0: { sw0: 0 },
        1: { sw0: 1 },
      },
      inputsByVectorId: {
        'vec-01': { sw0: 0 },
        'vec-02': { sw0: 1 },
      },
      signalRoles: { sw0: 'input', ld0: 'output' },
      rows: [
        { tick: 0, signal: 'ld0', expected: null, actual: '0', status: 'trace', vectorId: 'vec-01', caseIndex: 0 },
        { tick: 1, signal: 'ld0', expected: null, actual: '1', status: 'trace', vectorId: 'vec-02', caseIndex: 1 },
      ],
    } as RuntimeVerifyRun['report'],
    waveform: [
      { tick: 0, signals: { sw0: '0', ld0: '0' }, mismatches: [] },
      { tick: 1, signals: { sw0: '1', ld0: '1' }, mismatches: [] },
    ],
  };
}

function makeFailRun(): RuntimeVerifyRun {
  return {
    scenarioId: 'fail-scenario',
    scenarioName: 'Fail Scenario',
    status: 'fail',
    deterministicHash: 'abc123',
    reportHash: 'rep-fail',
    firstFailingTick: 1,
    generatedAtIso: '2026-04-09T00:00:00.000Z',
    schedule: 'combinational',
    meta: {
      circuitKind: 'combinational',
      clockingProtocol: null,
      samplePoint: 'steady-state',
      tick0Meaning: null,
      clockSignalName: null,
    },
    report: {
      vectors: [
        { id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 }, caseIndex: 0 },
        { id: 'vec-02', tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1 }, caseIndex: 1 },
      ],
      inputsAtTick: {
        0: { sw0: 0 },
        1: { sw0: 1 },
      },
      inputsByVectorId: {
        'vec-01': { sw0: 0 },
        'vec-02': { sw0: 1 },
      },
      signalRoles: { sw0: 'input', ld0: 'output' },
      rows: [
        { tick: 0, signal: 'ld0', expected: '0', actual: '0', status: 'pass', vectorId: 'vec-01', caseIndex: 0 },
        { tick: 1, signal: 'ld0', expected: '1', actual: '0', status: 'fail', vectorId: 'vec-02', caseIndex: 1 },
      ],
    } as RuntimeVerifyRun['report'],
    waveform: [
      { tick: 0, signals: { sw0: '0', ld0: '0' }, mismatches: [] },
      { tick: 1, signals: { sw0: '1', ld0: '0' }, mismatches: [{ signal: 'ld0', expected: '1', actual: '0' }] },
    ],
    evidence: {
      circuitHash: 'circuit-hash',
      ioRows: [
        { id: 'sw0', label: 'sw0', direction: 'in', nodeId: 'sw0_node' },
        { id: 'ld0', label: 'ld0', direction: 'out', nodeId: 'ld0_node' },
      ],
      vectors: [
        { id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 }, caseIndex: 0 },
        { id: 'vec-02', tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1 }, caseIndex: 1 },
      ],
      normalizationMap: [
        { role: 'expected', rawKey: 'ld0', normalizedKey: 'ld0', matchedSignal: 'ld0' },
        { role: 'output', rawKey: 'ld0', normalizedKey: 'ld0', matchedSignal: 'ld0_node.in' },
      ],
      preflight: [],
      failures: [
        {
          tick: 1,
          signal: 'ld0',
          expected: '1',
          actual: '0',
          vectorId: 'vec-02',
          caseIndex: 1,
          expectedSourceKey: 'ld0',
          expectedMatchedSignal: 'ld0',
          actualSourceKey: 'ld0_node.in',
          actualReason: 'matched',
        },
      ],
    },
  };
}

function makeWaveformOnlyRun(): RuntimeVerifyRun {
  return {
    scenarioId: 'waveform-only-scenario',
    scenarioName: 'Waveform Only Scenario',
    status: 'pass',
    deterministicHash: 'abc123',
    reportHash: 'rep-waveform-only',
    generatedAtIso: '2026-04-10T00:00:00.000Z',
    schedule: 'combinational',
    meta: {
      circuitKind: 'combinational',
      clockingProtocol: null,
      samplePoint: 'steady-state',
      tick0Meaning: null,
      clockSignalName: null,
    },
    report: {
      vectors: [
        { id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: {}, caseIndex: 0 },
        { id: 'vec-02', tick: 1, inputs: { sw0: 1 }, expected: {}, caseIndex: 1 },
        { id: 'vec-03', tick: 2, inputs: { sw0: 1 }, expected: {}, caseIndex: 2 },
      ],
      inputsAtTick: {
        0: { sw0: 0 },
        1: { sw0: 1 },
        2: { sw0: 1 },
      },
      inputsByVectorId: {
        'vec-01': { sw0: 0 },
        'vec-02': { sw0: 1 },
        'vec-03': { sw0: 1 },
      },
      signalRoles: { sw0: 'input', ld0: 'output' },
      rows: [],
    } as RuntimeVerifyRun['report'],
    waveform: [
      { tick: 0, signals: { sw0: '0', ld0: '0' }, mismatches: [] },
      { tick: 1, signals: { sw0: '1', ld0: '0' }, mismatches: [] },
      { tick: 2, signals: { sw0: '1', ld0: '1' }, mismatches: [] },
    ],
  };
}

const BASE_PROPS = {
  deterministicHash: 'abc123',
  hasVectors: true,
  vectors: [
    { id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: {} },
    { id: 'vec-02', tick: 1, inputs: { sw0: 1 }, expected: {} },
  ],
  mappedInputs: [{ id: 'sw0', label: 'SW0' }],
  mappedSignals: [
    { id: 'sw0', direction: 'in' as const },
    { id: 'ld0', direction: 'out' as const },
  ],
  onOpenProjectVectors: vi.fn(),
};

describe('VerifySurface observe-first model', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows Open in Design button in command bar when lastRun exists and onGoToDesign provided', () => {
    const onGoToDesign = vi.fn();
    const { getByTestId } = render(
      <VerifySurface
        {...BASE_PROPS}
        lastRun={makeTraceRun()}
        onGoToDesign={onGoToDesign}
      />
    );

    expect(getByTestId('ide-verify-inspect-design')).toBeTruthy();
  });

  it('hides Open in Design button when no lastRun (draft state)', () => {
    const onGoToDesign = vi.fn();
    const { queryByTestId } = render(
      <VerifySurface
        {...BASE_PROPS}
        onGoToDesign={onGoToDesign}
      />
    );

    expect(queryByTestId('ide-verify-inspect-design')).toBeNull();
  });

  it('hides Open in Design button when neither onGoToDesign nor onGoToDesignWithInputs provided', () => {
    const { queryByTestId } = render(
      <VerifySurface
        {...BASE_PROPS}
        lastRun={makeTraceRun()}
      />
    );

    expect(queryByTestId('ide-verify-inspect-design')).toBeNull();
  });

  it('shows Open in Design button when onGoToDesignWithInputs provided even without onGoToDesign', () => {
    const onGoToDesignWithInputs = vi.fn();
    const { getByTestId } = render(
      <VerifySurface
        {...BASE_PROPS}
        lastRun={makeTraceRun()}
        onGoToDesignWithInputs={onGoToDesignWithInputs}
      />
    );

    expect(getByTestId('ide-verify-inspect-design')).toBeTruthy();
  });

  it('calls onGoToDesign when Open in Design clicked', () => {
    const onGoToDesign = vi.fn();
    const { getByTestId } = render(
      <VerifySurface
        {...BASE_PROPS}
        lastRun={makeTraceRun()}
        onGoToDesign={onGoToDesign}
      />
    );

    fireEvent.click(getByTestId('ide-verify-inspect-design'));
    expect(onGoToDesign).toHaveBeenCalledOnce();
  });

  it('scope header stays concise after a run and avoids the old narrative summary block', () => {
    const { queryByTestId, queryByText } = render(
      <VerifySurface
        {...BASE_PROPS}
        lastRun={makeTraceRun()}
      />
    );

    const label = queryByTestId('ide-verify-scope-label');
    if (label) {
      expect(label.textContent).toContain('Waveform truth');
    }
    expect(queryByTestId('ide-verify-scope-summary')).toBeNull();
    expect(queryByText('Observed output')).toBeNull();
  });

  it('prefers debug handoff over input injection when tick evidence is available', () => {
    const onGoToDesign = vi.fn();
    const onGoToDesignWithInputs = vi.fn();
    const onDebugTickSelected = vi.fn();
    const { getByTestId } = render(
      <VerifySurface
        {...BASE_PROPS}
        lastRun={makeTraceRun()}
        onGoToDesign={onGoToDesign}
        onGoToDesignWithInputs={onGoToDesignWithInputs}
        onDebugTickSelected={onDebugTickSelected}
      />
    );

    fireEvent.click(getByTestId('ide-verify-inspect-design'));

    expect(onDebugTickSelected).toHaveBeenCalledOnce();
    expect(onDebugTickSelected).toHaveBeenCalledWith(
      0,
      { sw0: 0, ld0: 0 },
      null
    );
    expect(onGoToDesignWithInputs).not.toHaveBeenCalled();
    expect(onGoToDesign).not.toHaveBeenCalled();
  });

  it('keeps waveform tick selection and signal focus authoritative when opening Design from observation-only runs', () => {
    const onGoToDesign = vi.fn();
    const onGoToDesignWithInputs = vi.fn();
    const onDebugTickSelected = vi.fn();
    const onSignalSelected = vi.fn();
    const { getByTestId } = render(
      <VerifySurface
        {...BASE_PROPS}
        lastRun={makeWaveformOnlyRun()}
        onGoToDesign={onGoToDesign}
        onGoToDesignWithInputs={onGoToDesignWithInputs}
        onDebugTickSelected={onDebugTickSelected}
        onSignalSelected={onSignalSelected}
      />
    );

    fireEvent.click(getByTestId('ide-verify-signal-ld0'));
    fireEvent.change(getByTestId('ide-verify-tick-scrubber'), { target: { value: '2' } });
    expect(getByTestId('ide-verify-selected-tick').textContent).toContain('t2');

    fireEvent.click(getByTestId('ide-verify-open-circuit-replay'));

    expect(onSignalSelected).toHaveBeenLastCalledWith('ld0');
    expect(onDebugTickSelected).toHaveBeenCalledOnce();
    expect(onDebugTickSelected).toHaveBeenCalledWith(
      2,
      { sw0: 1, ld0: 1 },
      null
    );
    expect(onGoToDesignWithInputs).not.toHaveBeenCalled();
    expect(onGoToDesign).not.toHaveBeenCalled();
  });

  it('publishes the auto-selected observed signal so Design can track observation-only runs live', async () => {
    const onSignalSelected = vi.fn();
    const { getByTestId } = render(
      <VerifySurface
        {...BASE_PROPS}
        lastRun={makeWaveformOnlyRun()}
        mappedSignals={[{ id: 'ld0', label: 'LD0', direction: 'out' }]}
        onSignalSelected={onSignalSelected}
      />
    );

    expect(getByTestId('ide-verify-scope-signal').textContent?.toLowerCase()).toContain('ld0');

    await waitFor(() => {
      expect(onSignalSelected).toHaveBeenLastCalledWith('ld0');
    });
  });

  it('uses the Stimulus-selected case as the Design handoff tick when the waveform has not been touched', () => {
    const onGoToDesign = vi.fn();
    const onGoToDesignWithInputs = vi.fn();
    const onDebugTickSelected = vi.fn();
    const { getByTestId } = render(
      <VerifySurface
        {...BASE_PROPS}
        lastRun={makeWaveformOnlyRun()}
        onVectorsChange={vi.fn()}
        onGoToDesign={onGoToDesign}
        onGoToDesignWithInputs={onGoToDesignWithInputs}
        onDebugTickSelected={onDebugTickSelected}
      />
    );

    fireEvent.change(getByTestId('ide-stimulus-tick-target'), { target: { value: '1' } });
    expect(getByTestId('ide-stimulus-selected-case-chip').textContent).toContain('Case 2');
    expect(getByTestId('ide-verify-selected-tick').textContent).toContain('t1');

    fireEvent.click(getByTestId('ide-verify-inspect-design'));

    expect(onDebugTickSelected).toHaveBeenCalledOnce();
    expect(onDebugTickSelected).toHaveBeenCalledWith(
      1,
      { sw0: 1, ld0: 0 },
      null
    );
    expect(onGoToDesignWithInputs).not.toHaveBeenCalled();
    expect(onGoToDesign).not.toHaveBeenCalled();
  });

  it('follows an external selected tick override so Design and Verify can stay synchronized', async () => {
    const view = render(
      <VerifySurface
        {...BASE_PROPS}
        lastRun={makeWaveformOnlyRun()}
        selectedTickOverride={1}
      />
    );

    await waitFor(() => {
      expect(view.getByTestId('ide-verify-selected-tick').textContent).toContain('t1');
    });

    view.rerender(
      <VerifySurface
        {...BASE_PROPS}
        lastRun={makeWaveformOnlyRun()}
        selectedTickOverride={0}
      />
    );

    await waitFor(() => {
      expect(view.getByTestId('ide-verify-selected-tick').textContent).toContain('t0');
    });
  });

  it('carries failure context into the debug handoff when the selected tick is failing', () => {
    const onGoToDesign = vi.fn();
    const onGoToDesignWithInputs = vi.fn();
    const onDebugTickSelected = vi.fn();
    const { getByTestId } = render(
      <VerifySurface
        {...BASE_PROPS}
        lastRun={makeFailRun()}
        onGoToDesign={onGoToDesign}
        onGoToDesignWithInputs={onGoToDesignWithInputs}
        onDebugTickSelected={onDebugTickSelected}
      />
    );

    fireEvent.click(getByTestId('ide-verify-open-circuit-replay'));

    expect(onDebugTickSelected).toHaveBeenCalledOnce();
    expect(onDebugTickSelected).toHaveBeenCalledWith(
      1,
      { sw0: 1, ld0: 0 },
      expect.objectContaining({
        signal: 'ld0',
        tick: 1,
        expected: '1',
        actual: '0',
      })
    );
    expect(onGoToDesignWithInputs).not.toHaveBeenCalled();
    expect(onGoToDesign).not.toHaveBeenCalled();
  });

  it('falls back to plain onGoToDesign when onGoToDesignWithInputs not provided', () => {
    const onGoToDesign = vi.fn();
    const { getByTestId } = render(
      <VerifySurface
        {...BASE_PROPS}
        lastRun={makeTraceRun()}
        onGoToDesign={onGoToDesign}
      />
    );

    fireEvent.click(getByTestId('ide-verify-inspect-design'));
    expect(onGoToDesign).toHaveBeenCalledOnce();
  });
});
