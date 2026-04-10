// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
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
  afterEach(() => { cleanup(); });

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

  it('scope label reads "Observed output" not "Waveform"', () => {
    const { queryByTestId, queryByText } = render(
      <VerifySurface
        {...BASE_PROPS}
        lastRun={makeTraceRun()}
      />
    );

    // The renamed scope label must not say "Waveform" anywhere in that element
    const label = queryByTestId('ide-verify-scope-label');
    if (label) {
      expect(label.textContent).not.toContain('Waveform');
      expect(label.textContent).toContain('Observed output');
    }
    // Also no standalone "Waveform" heading visible
    expect(queryByText('Waveform')).toBeNull();
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

    fireEvent.click(getByTestId('ide-verify-inspect-design'));

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
