// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import type { RuntimeVerifyRun } from '../projectRuntime';
import { VerifySurface } from '../surfaces/VerifySurface';
import { deriveTimingGuidance } from '../timingGuidance';

if (!HTMLElement.prototype.scrollIntoView) {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
}

function makePassRun(): RuntimeVerifyRun {
  return {
    scenarioId: 'pass-scenario',
    scenarioName: 'Pass Scenario',
    status: 'pass',
    deterministicHash: 'abc123',
    reportHash: 'rep-pass',
    generatedAtIso: '2026-02-27T00:00:00.000Z',
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
        { tick: 1, signal: 'ld0', expected: '1', actual: '1', status: 'pass', vectorId: 'vec-02', caseIndex: 1 },
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
    generatedAtIso: '2026-02-27T00:00:00.000Z',
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
    scenarioId: 'waveform-only-run',
    scenarioName: 'Waveform Only Run',
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

describe('VerifySurface workstation controls', () => {
  afterEach(() => { cleanup(); });

  it('focuses first-run compare guidance on the current vectors instead of generator tooling', () => {
    const { getByTestId, queryByTestId, queryByText } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        vectors={[
          { id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
        ]}
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', direction: 'in' },
          { id: 'ld0', direction: 'out' },
        ]}
        onOpenProjectVectors={vi.fn()}
      />
    );

    expect(getByTestId('ide-verify-empty-state').textContent).toContain(
      'Outputs are observed on the waveform'
    );
    expect(getByTestId('ide-verify-first-run-callout').textContent).toContain(
      'Compare only checks the output cells you explicitly saved'
    );
    expect(queryByTestId('ide-verify-generate-all-combos')).toBeNull();
    expect(getByTestId('ide-verify-reference-mode').textContent?.toLowerCase()).toContain('saved output checks');
    expect(getByTestId('ide-verify-session-status').textContent).toContain('DRAFT');
    expect(getByTestId('ide-verify-session-mode').textContent).toContain('SIMULATION');
    expect(getByTestId('ide-verify-session-title').textContent).toContain('Ready to run stimulus');
    // footer run button removed (B-13 Phase 3) — header Run is canonical
    expect(queryByTestId('ide-verify-empty-run')).toBeNull();
    expect(queryByTestId('ide-verify-run')).toBeNull();
    expect(getByTestId('ide-vcb-run')).toBeTruthy();
    expect(getByTestId('ide-verify-empty-open-vectors').textContent).toContain('Open vectors');
    expect(queryByTestId('ide-left-dock')).toBeNull();
    expect(queryByTestId('ide-inspector')).toBeNull();
    expect(queryByText('Advanced vector tools')).toBeNull();
  });

  it('labels trace-only verification as observation mode when no expected outputs are loaded', () => {
    const { getAllByText, getByTestId, queryByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={false}
        customVectors={[
          { id: 'cv-01', tick: 0, inputs: { sw0: 1 }, expected: {} },
        ]}
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', direction: 'in' },
          { id: 'ld0', direction: 'out' },
        ]}
        onOpenProjectVectors={vi.fn()}
      />
    );

    expect(getByTestId('ide-verify-reference-mode').textContent?.toLowerCase()).toContain('observation only');
    expect(getByTestId('ide-verify-session-status').textContent).toContain('DRAFT');
    expect(getByTestId('ide-verify-session-mode').textContent).toContain('SIMULATION');
    expect(getByTestId('ide-verify-session-title').textContent).toContain('Ready to run stimulus');
    expect(getByTestId('ide-verify-empty-message').textContent).toContain(
      'Outputs are observed on the waveform'
    );
    // footer run button removed (B-13 Phase 3) — header Run is canonical
    expect(queryByTestId('ide-verify-empty-run')).toBeNull();
    expect(getByTestId('ide-vcb-run')).toBeTruthy();
    expect(queryByTestId('ide-left-dock')).toBeNull();
    expect(queryByTestId('ide-inspector')).toBeNull();
  });

  it('does not render retired pre-run inventory panels', () => {
    const { queryByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        vectors={[
          { id: 'vec-01', tick: 0, inputs: { sw0: 0, sw1: 1 }, expected: { ld0: 1 } },
        ]}
        mappedInputs={[
          { id: 'sw0', label: 'SW0' },
          { id: 'sw1', label: 'SW1' },
        ]}
        mappedSignals={[
          { id: 'sw0', direction: 'in', label: 'SW0' },
          { id: 'sw1', direction: 'in', label: 'SW1' },
          { id: 'ld0', direction: 'out', label: 'LD0' },
        ]}
        onOpenProjectVectors={vi.fn()}
      />
    );

    expect(queryByTestId('ide-verify-io-summary')).toBeNull();
    expect(queryByTestId('ide-verify-prerun-lanes')).toBeNull();
  });

  it('describes supported latch control as EN rather than a generic clock', () => {
    const latchGuidance = deriveTimingGuidance({
      schedule: 'clocked_macro',
      reason: 'circuit-sequential',
      analysis: {
        hasClockedMacros: true,
        hasClockNet: true,
        sequentialNodes: [{ id: 'dl0', type: 'DLatch', clockPort: 'EN' }],
        clockSource: 'circuit',
        clockNetName: 'EN',
      },
      needsSimClockInjection: false,
      clockSignalName: 'EN',
      samplePoint: 'post-rising-edge',
      tick0Meaning: 'initial-state',
      hasUnsupportedTemporal: false,
      temporalIssues: [],
    });

    const { container, getByTestId, queryByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        vectors={[
          { id: 'vec-01', tick: 0, inputs: { d: 0, en: 0 }, expected: {} },
        ]}
        mappedInputs={[
          { id: 'd', label: 'D' },
          { id: 'en', label: 'EN' },
        ]}
        mappedSignals={[
          { id: 'd', direction: 'in', label: 'D' },
          { id: 'en', direction: 'in', label: 'EN' },
          { id: 'q', direction: 'out', label: 'Q' },
        ]}
        onOpenProjectVectors={vi.fn()}
        verifyMode="sequential"
        liveSignalRoles={{ d: 'input', en: 'clock', q: 'output' }}
        timingGuidance={latchGuidance}
      />
    );

    expect(queryByTestId('ide-verify-prerun-clock-chip')).toBeNull();
    expect(getByTestId('ide-verify-sequential-helper').textContent).toContain('Latch behavior detected');
    expect(getByTestId('ide-verify-insert-clock-pattern').textContent).toContain('Insert basic enable pattern');
    expect(queryByTestId('ide-verify-io-summary')).toBeNull();
    expect(getByTestId('ide-verify-first-run-callout').textContent).toContain(
      'Waveform inspection and capture tools stay available after you have real evidence'
    );
    expect(queryByTestId('ide-verify-guided-clock-pattern')).toBeNull();
    expect(getByTestId('ide-verify-sequential-context').textContent).toContain(
      'clock ticks in your stimulus'
    );
  });

  it('warns in Verify when the current design has an unsupported feedback structure', () => {
    const { container, getByTestId, queryByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={false}
        customVectors={[{ id: 'cv-01', tick: 0, inputs: { r: 0, s: 0 }, expected: {} }]}
        mappedInputs={[
          { id: 'r', label: 'R' },
          { id: 's', label: 'S' },
        ]}
        mappedSignals={[
          { id: 'r', direction: 'in', label: 'R' },
          { id: 's', direction: 'in', label: 'S' },
          { id: 'q', direction: 'out', label: 'Q' },
          { id: 'qbar', direction: 'out', label: 'Qbar' },
        ]}
        unsupportedFeedbackDiagnostic={{
          title: 'Combinational loop detected',
          message:
            'use a supported sequential primitive (DLatch/DFlipFlop/RSLatch), the exact 4-NAND D-latch topology, or remove unsupported feedback.',
        }}
        onGoToDesign={vi.fn()}
        onOpenProjectVectors={vi.fn()}
      />
    );

    expect(getByTestId('ide-verify-unsupported-feedback-banner')).toBeTruthy();
    expect(getByTestId('ide-verify-unsupported-feedback').textContent).toContain(
      'Combinational loop detected'
    );
    expect(getByTestId('ide-verify-unsupported-feedback').textContent).toContain(
      'supported stateful topologies'
    );
    expect(getByTestId('ide-verify-unsupported-feedback-design').textContent).toContain(
      'Open Design'
    );
    expect(queryByTestId('ide-verify-run-proof-edit-vectors')).toBeNull();
    expect(queryByTestId('ide-verify-mismatch-edit-vectors')).toBeNull();
  });

  it('keeps assertion mismatch recovery in Verify by opening the testbench editor from fail-state CTAs', () => {
    const onGoToDesign = vi.fn();
    const scrollIntoViewMock = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoViewMock,
    });

    const { container, getByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        lastRun={makeFailRun()}
        vectors={[
          { id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
          { id: 'vec-02', tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1 } },
        ]}
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', direction: 'in', label: 'SW0' },
          { id: 'ld0', direction: 'out', label: 'LD0' },
        ]}
        onGoToDesign={onGoToDesign}
        onOpenProjectVectors={vi.fn()}
      />
    );

    const details = container.querySelector(
      '.ide-verify-scenario-builder-details--postrun'
    ) as HTMLDetailsElement | null;

    expect(details).toBeTruthy();
    expect(details?.open).toBe(true);
    expect(getByTestId('ide-verify-workbench-body')).toBeTruthy();

    fireEvent.click(getByTestId('ide-verify-run-proof-edit-vectors'));

    expect(details?.open).toBe(true);
    expect(getByTestId('ide-verify-workbench-body')).toBeTruthy();
    expect(scrollIntoViewMock).toHaveBeenCalled();
    expect(onGoToDesign).not.toHaveBeenCalled();

    fireEvent.click(getByTestId('ide-verify-workbench-toggle'));
    expect(details?.open).toBe(false);
    fireEvent.click(getByTestId('ide-verify-drawer-toggle'));
    fireEvent.click(getByTestId('ide-verify-mismatch-edit-vectors'));

    expect(details?.open).toBe(true);
    expect(getByTestId('ide-verify-workbench-body')).toBeTruthy();
    expect(scrollIntoViewMock).toHaveBeenCalled();
    expect(onGoToDesign).not.toHaveBeenCalled();
    expect(getByTestId('ide-verify-mismatch-goto-design').textContent).toContain('Open in Design');
  });

  it('shows observation-only capture guidance after a trace-only run with no asserted outputs', () => {
    const traceRun: RuntimeVerifyRun = {
      scenarioId: 'trace-run',
      scenarioName: 'Trace Run',
      status: 'pass',
      deterministicHash: 'abc123',
      reportHash: 'rep-trace',
      generatedAtIso: '2026-03-23T00:00:00.000Z',
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
        ],
        inputsAtTick: { 0: { sw0: 0 } },
        inputsByVectorId: { 'vec-01': { sw0: 0 } },
        signalRoles: { sw0: 'input', ld0: 'output' },
        rows: [],
      } as RuntimeVerifyRun['report'],
      waveform: [{ tick: 0, signals: { sw0: '0', ld0: '0' }, mismatches: [] }],
    };

    const { container, getByTestId, queryByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        lastRun={traceRun}
        vectors={[
          { id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: {} },
        ]}
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', direction: 'in' },
          { id: 'ld0', direction: 'out' },
        ]}
        onVectorsChange={vi.fn()}
        onOpenProjectVectors={vi.fn()}
      />
    );

    expect(getByTestId('ide-verify-session-status').textContent).toContain('OBSERVATION ONLY');
    expect(getByTestId('ide-verify-session-mode').textContent).toContain('CAPTURE');
    expect(getByTestId('ide-verify-session-title').textContent).toContain('Waveform recorded — observation only');
    expect(getByTestId('ide-verify-summary-status').textContent).toContain('OBSERVATION ONLY');
    expect(queryByTestId('ide-verify-run-proof')).toBeNull();
    expect(getByTestId('ide-verify-drawer-toggle')).toBeTruthy();
    expect(getByTestId('ide-vcb-save-expected')).toBeTruthy();
    expect(getByTestId('ide-vcb-run')).toBeTruthy();
    expect(queryByTestId('ide-left-dock')).toBeNull();
    expect(queryByTestId('ide-inspector')).toBeNull();

    expect(queryByTestId('ide-stimulus-toolbar')).toBeTruthy();
    expect(queryByTestId('ide-stimulus-toolbar-advanced')).toBeNull();
  });

  it('uses waveform ticks as the active readout authority when compare rows are empty', () => {
    const waveformOnlyRun = makeWaveformOnlyRun();
    const { getByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        lastRun={waveformOnlyRun}
        vectors={waveformOnlyRun.report.vectors}
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', direction: 'in' },
          { id: 'ld0', direction: 'out' },
        ]}
        onOpenProjectVectors={vi.fn()}
      />
    );

    expect(getByTestId('ide-verify-run-state').textContent).toContain('2 signals · 3 ticks · COMPLETE');
    expect(getByTestId('ide-verify-selected-tick').textContent).toContain('t0');
    expect(getByTestId('ide-verify-tick-readout-chip-sw0').textContent).toContain('sw0:0');
    expect(getByTestId('ide-verify-tick-readout-chip-ld0').textContent).toContain('ld0:0');

    const waveformViewport = getByTestId('ide-verify-waveform-scroll');
    waveformViewport.focus();
    fireEvent.keyDown(waveformViewport, { key: 'ArrowRight' });

    expect(getByTestId('ide-verify-selected-tick').textContent).toContain('t1');
    expect(getByTestId('ide-verify-tick-readout-chip-sw0').textContent).toContain('sw0:1');
    expect(getByTestId('ide-verify-tick-readout-chip-ld0').textContent).toContain('ld0:0');

    fireEvent.change(getByTestId('ide-verify-tick-scrubber'), { target: { value: '2' } });

    expect(getByTestId('ide-verify-selected-tick').textContent).toContain('t2');
    expect(getByTestId('ide-verify-tick-readout-chip-sw0').textContent).toContain('sw0:1');
    expect(getByTestId('ide-verify-tick-readout-chip-ld0').textContent).toContain('ld0:1');
  });

  it('treats the Stimulus case selector as the same selected tick used by Verify readouts', () => {
    const waveformOnlyRun = makeWaveformOnlyRun();
    const { getByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        lastRun={waveformOnlyRun}
        vectors={waveformOnlyRun.report.vectors}
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', direction: 'in' },
          { id: 'ld0', direction: 'out' },
        ]}
        onVectorsChange={vi.fn()}
        onOpenProjectVectors={vi.fn()}
      />
    );

    expect(getByTestId('ide-verify-selected-tick').textContent).toContain('t2');
    expect(getByTestId('ide-stimulus-selected-case-chip').textContent).toContain('Case 3');

    fireEvent.change(getByTestId('ide-stimulus-tick-target'), { target: { value: '1' } });

    expect(getByTestId('ide-stimulus-selected-case-chip').textContent).toContain('Case 2');
    expect(getByTestId('ide-verify-selected-tick').textContent).toContain('t1');
    expect(getByTestId('ide-verify-tick-readout-chip-sw0').textContent).toContain('sw0:1');
    expect(getByTestId('ide-verify-tick-readout-chip-ld0').textContent).toContain('ld0:0');
  });

  it('reflects waveform scrubber selection back into the Stimulus case selector', () => {
    const waveformOnlyRun = makeWaveformOnlyRun();
    const { getByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        lastRun={waveformOnlyRun}
        vectors={waveformOnlyRun.report.vectors}
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', direction: 'in' },
          { id: 'ld0', direction: 'out' },
        ]}
        onVectorsChange={vi.fn()}
        onOpenProjectVectors={vi.fn()}
      />
    );

    fireEvent.change(getByTestId('ide-verify-tick-scrubber'), { target: { value: '2' } });

    expect(getByTestId('ide-verify-selected-tick').textContent).toContain('t2');
    expect(getByTestId('ide-stimulus-selected-case-chip').textContent).toContain('Case 3');
    expect((getByTestId('ide-stimulus-tick-target') as HTMLSelectElement).value).toBe('2');
  });

  it('arms assertion checking immediately after capturing outputs as expected', () => {
    const traceRun: RuntimeVerifyRun = {
      scenarioId: 'trace-run',
      scenarioName: 'Trace Run',
      status: 'pass',
      deterministicHash: 'abc123',
      reportHash: 'rep-trace',
      generatedAtIso: '2026-03-23T00:00:00.000Z',
      schedule: 'combinational',
      meta: {
        circuitKind: 'combinational',
        clockingProtocol: null,
        samplePoint: 'steady-state',
        tick0Meaning: null,
        clockSignalName: null,
      },
      report: {
        vectors: [{ id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: {}, caseIndex: 0 }],
        inputsAtTick: { 0: { sw0: 0 } },
        inputsByVectorId: { 'vec-01': { sw0: 0 } },
        signalRoles: { sw0: 'input', ld0: 'output' },
        rows: [],
      } as RuntimeVerifyRun['report'],
      waveform: [{ tick: 0, signals: { sw0: '0', ld0: '1' }, mismatches: [] }],
    };

    const onVectorsChange = vi.fn();
    const initialVectors = [{ id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: {} }];
    const { getByTestId, rerender } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        lastRun={traceRun}
        vectors={initialVectors}
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', direction: 'in' },
          { id: 'ld0', direction: 'out' },
        ]}
        onVectorsChange={onVectorsChange}
        onOpenProjectVectors={vi.fn()}
      />
    );

    fireEvent.click(getByTestId('ide-vcb-save-expected'));
    expect(onVectorsChange).toHaveBeenCalledTimes(1);

    const updatedVectors = onVectorsChange.mock.calls[0]?.[0] as Array<{
      id: string;
      tick: number;
      inputs: Record<string, 0 | 1>;
      expected: Record<string, 0 | 1>;
    }>;

    rerender(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        lastRun={traceRun}
        vectors={updatedVectors}
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', direction: 'in' },
          { id: 'ld0', direction: 'out' },
        ]}
        onVectorsChange={onVectorsChange}
        onOpenProjectVectors={vi.fn()}
      />
    );

    expect(getByTestId('ide-vcb-mode-compare').className).toContain('is-active');
  });

  it('reruns in trace mode after the student switches the next run intent back to simulation', async () => {
    const onRunVerification = vi.fn();
    const { getAllByText, getByTestId, queryByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        lastRun={makeFailRun()}
        vectors={[
          { id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
          { id: 'vec-02', tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1 } },
        ]}
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', direction: 'in', label: 'SW0' },
          { id: 'ld0', direction: 'out', label: 'LD0' },
        ]}
        onRunVerification={onRunVerification}
        onOpenProjectVectors={vi.fn()}
      />
    );

    fireEvent.click(getByTestId('ide-vcb-mode-observe'));
    expect(getByTestId('ide-vcb-mode-observe').className).toContain('is-active');

    fireEvent.click(getByTestId('ide-vcb-run'));

    await waitFor(() => expect(onRunVerification).toHaveBeenCalledTimes(1));
    expect(onRunVerification.mock.calls[0]?.[0]).toMatchObject({
      assertionMode: false,
      runKind: 'trace',
    });
  });

  it('describes saved assertions as inactive when the student switches back to trace mode', () => {
    const { getAllByText, getByTestId, queryByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        lastRun={makeFailRun()}
        vectors={[
          { id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
          { id: 'vec-02', tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1 } },
        ]}
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', direction: 'in', label: 'SW0' },
          { id: 'ld0', direction: 'out', label: 'LD0' },
        ]}
        onOpenProjectVectors={vi.fn()}
      />
    );

    fireEvent.click(getByTestId('ide-vcb-mode-observe'));

    expect(getByTestId('ide-verify-reference-mode').textContent?.toLowerCase()).toContain(
      'saved output checks'
    );
    expect(getByTestId('ide-verify-reference-mode').textContent?.toLowerCase()).not.toContain(
      'comparing against'
    );
    expect(getByTestId('ide-verify-reference-mode').textContent?.toLowerCase()).toContain(
      'current mode is observe'
    );
  });

  it('preserves blank assertions when capture updates an existing assertion mask', () => {
    const traceRun: RuntimeVerifyRun = {
      scenarioId: 'trace-run',
      scenarioName: 'Trace Run',
      status: 'pass',
      deterministicHash: 'abc123',
      reportHash: 'rep-trace-mask',
      generatedAtIso: '2026-03-23T00:00:00.000Z',
      schedule: 'combinational',
      meta: {
        circuitKind: 'combinational',
        clockingProtocol: null,
        samplePoint: 'steady-state',
        tick0Meaning: null,
        clockSignalName: null,
      },
      report: {
        vectors: [{ id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 1 }, caseIndex: 0 }],
        inputsAtTick: { 0: { sw0: 0 } },
        inputsByVectorId: { 'vec-01': { sw0: 0 } },
        signalRoles: { sw0: 'input', ld0: 'output', ld1: 'output' },
        rows: [],
      } as RuntimeVerifyRun['report'],
      waveform: [{ tick: 0, signals: { sw0: '0', ld0: '0', ld1: '1' }, mismatches: [] }],
      evidence: {
        circuitHash: 'circuit-hash',
        ioRows: [
          { id: 'sw0', label: 'sw0', direction: 'in', nodeId: 'sw0_node' },
          { id: 'ld0', label: 'ld0', direction: 'out', nodeId: 'ld0_node' },
          { id: 'ld1', label: 'ld1', direction: 'out', nodeId: 'ld1_node' },
        ],
        vectors: [{ id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 1 }, caseIndex: 0 }],
        normalizationMap: [
          { role: 'output', rawKey: 'ld0', normalizedKey: 'ld0', matchedSignal: 'ld0_node.in' },
          { role: 'output', rawKey: 'ld1', normalizedKey: 'ld1', matchedSignal: 'ld1_node.in' },
        ],
        preflight: [],
        failures: [],
      },
    };

    const onVectorsChange = vi.fn();
    const { container, getByTestId, queryByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        lastRun={traceRun}
        vectors={[
          { id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 1 } },
        ]}
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', direction: 'in' },
          { id: 'ld0', direction: 'out' },
          { id: 'ld1', direction: 'out' },
        ]}
        onVectorsChange={onVectorsChange}
        onOpenProjectVectors={vi.fn()}
      />
    );

    fireEvent.click(getByTestId('ide-vcb-save-expected'));

    expect(onVectorsChange).toHaveBeenCalledWith([
      { id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
    ]);
  });

  it('offers in-place compare fixes from the right panel', () => {
    const onVectorsChange = vi.fn();
    const { getAllByText, getByTestId, queryByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        lastRun={makeFailRun()}
        vectors={[
          { id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
          { id: 'vec-02', tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1 } },
        ]}
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', direction: 'in' },
          { id: 'ld0', direction: 'out' },
        ]}
        onVectorsChange={onVectorsChange}
        onOpenProjectVectors={vi.fn()}
      />
    );

    expect(queryByTestId('ide-stimulus-toolbar-advanced')).toBeNull();
    expect(getByTestId('ide-stimulus-toolbar')).toBeTruthy();
    fireEvent.click(getByTestId('ide-verify-drawer-toggle'));
    fireEvent.click(getAllByText('Details')[0]);

    fireEvent.click(getByTestId('ide-verify-right-accept-observed'));

    expect(onVectorsChange).toHaveBeenCalledWith([
      { id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
      { id: 'vec-02', tick: 1, inputs: { sw0: 1 }, expected: { ld0: 0 } },
    ]);
  });

  it('demotes stale authored compare state back to trace-first with explicit stale-reference actions', async () => {
    const onRunVerification = vi.fn();
    const onVectorsChange = vi.fn();
    const staleRun: RuntimeVerifyRun = {
      ...makePassRun(),
      deterministicHash: 'old-hash',
      reportHash: 'stale-authored-report',
      report: {
        vectors: [{ id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 1 }, caseIndex: 0 }],
        inputsAtTick: { 0: { sw0: 0 } },
        inputsByVectorId: { 'vec-01': { sw0: 0 } },
        signalRoles: { sw0: 'input', ld0: 'output' },
        rows: [{ tick: 0, signal: 'ld0', expected: '1', actual: '1', status: 'pass', vectorId: 'vec-01', caseIndex: 0 }],
      } as RuntimeVerifyRun['report'],
      waveform: [{ tick: 0, signals: { sw0: '0', ld0: '1' }, mismatches: [] }],
    };

    const { getByTestId, queryByTestId } = render(
      <VerifySurface
        deterministicHash="new-hash"
        hasVectors={true}
        lastRun={staleRun}
        vectors={[
          { id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 1 } },
        ]}
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', direction: 'in', label: 'SW0' },
          { id: 'ld0', direction: 'out', label: 'LD0' },
        ]}
        onVectorsChange={onVectorsChange}
        onRunVerification={onRunVerification}
        onOpenProjectVectors={vi.fn()}
        projectKind="custom"
        scenarioAuthority="stale"
      />
    );

    await waitFor(() => {
      expect(getByTestId('ide-verify-strip-stale-guidance').textContent).toContain('Older authored reference available');
    });
    expect(getByTestId('ide-verify-session-status').textContent).toContain('STALE');
    expect(getByTestId('ide-verify-reference-mode').textContent).toContain('stale saved checks');
    expect(getByTestId('ide-verify-stale-reference-mode').textContent).toContain('stimulus-only tracing');
    expect(queryByTestId('ide-verify-stale-banner')).toBeNull();
    expect(queryByTestId('ide-verify-prerun-inventory')).toBeNull();
    expect(queryByTestId('ide-left-dock')).toBeNull();
    expect(queryByTestId('ide-inspector')).toBeNull();
    expect(queryByTestId('ide-verify-assertion-mode-toggle')).toBeNull();
    expect(queryByTestId('ide-verify-advanced-debug')).toBeNull();
    expect(queryByTestId('ide-verify-run-proof-design')).toBeNull();
    expect(queryByTestId('ide-verify-mismatch-goto-design')).toBeNull();

    fireEvent.click(getByTestId('ide-verify-stale-keep-reference'));
    await waitFor(() => expect(onRunVerification).toHaveBeenCalledTimes(1));
    expect(onRunVerification.mock.calls[0]?.[0]).toMatchObject({
      assertionMode: true,
      runKind: 'verify',
    });

    fireEvent.click(getByTestId('ide-verify-stale-reset-stimulus'));
    expect(onVectorsChange).toHaveBeenCalledWith([
      { id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: {} },
    ]);
  });

  it('re-captures stale outputs from the current circuit and then re-runs compare', async () => {
    const onRunVerification = vi.fn();
    const onVectorsChange = vi.fn();
    const staleRun: RuntimeVerifyRun = {
      ...makePassRun(),
      deterministicHash: 'old-hash',
      reportHash: 'stale-report',
      waveform: [{ tick: 0, signals: { sw0: '0', ld0: '1' }, mismatches: [] }],
      report: {
        vectors: [{ id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 1 }, caseIndex: 0 }],
        inputsAtTick: { 0: { sw0: 0 } },
        inputsByVectorId: { 'vec-01': { sw0: 0 } },
        signalRoles: { sw0: 'input', ld0: 'output' },
        rows: [{ tick: 0, signal: 'ld0', expected: '1', actual: '1', status: 'pass', vectorId: 'vec-01', caseIndex: 0 }],
      } as RuntimeVerifyRun['report'],
      evidence: {
        circuitHash: 'old-hash',
        ioRows: [
          { id: 'sw0', label: 'sw0', direction: 'in', nodeId: 'sw0_node' },
          { id: 'ld0', label: 'ld0', direction: 'out', nodeId: 'ld0_node' },
        ],
        vectors: [{ id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 1 }, caseIndex: 0 }],
        normalizationMap: [
          { role: 'output', rawKey: 'ld0', normalizedKey: 'ld0', matchedSignal: 'ld0_node.in' },
        ],
        preflight: [],
        failures: [],
      },
    };

    const currentTraceRun: RuntimeVerifyRun = {
      ...staleRun,
      deterministicHash: 'new-hash',
      reportHash: 'current-report',
      waveform: [{ tick: 0, signals: { sw0: '0', ld0: '0' }, mismatches: [] }],
      report: {
        vectors: [{ id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 1 }, caseIndex: 0 }],
        inputsAtTick: { 0: { sw0: 0 } },
        inputsByVectorId: { 'vec-01': { sw0: 0 } },
        signalRoles: { sw0: 'input', ld0: 'output' },
        rows: [],
      } as RuntimeVerifyRun['report'],
      evidence: {
        circuitHash: 'new-hash',
        ioRows: [
          { id: 'sw0', label: 'sw0', direction: 'in', nodeId: 'sw0_node' },
          { id: 'ld0', label: 'ld0', direction: 'out', nodeId: 'ld0_node' },
        ],
        vectors: [{ id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 1 }, caseIndex: 0 }],
        normalizationMap: [
          { role: 'output', rawKey: 'ld0', normalizedKey: 'ld0', matchedSignal: 'ld0_node.in' },
        ],
        preflight: [],
        failures: [],
      },
    };

    const initialVectors = [{ id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 1 } }];
    const { getByTestId, rerender } = render(
      <VerifySurface
        deterministicHash="new-hash"
        hasVectors={true}
        lastRun={staleRun}
        vectors={initialVectors}
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', direction: 'in' },
          { id: 'ld0', direction: 'out' },
        ]}
        onVectorsChange={onVectorsChange}
        onRunVerification={onRunVerification}
        onOpenProjectVectors={vi.fn()}
      />
    );

    fireEvent.click(getByTestId('ide-verify-stale-recapture-reauthor'));
    expect(onRunVerification.mock.calls[0]?.[0]?.assertionMode).toBe(false);

    rerender(
      <VerifySurface
        deterministicHash="new-hash"
        hasVectors={true}
        lastRun={currentTraceRun}
        vectors={initialVectors}
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', direction: 'in' },
          { id: 'ld0', direction: 'out' },
        ]}
        onVectorsChange={onVectorsChange}
        onRunVerification={onRunVerification}
        onOpenProjectVectors={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(onVectorsChange).toHaveBeenCalledWith([
        { id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
      ]);
    });

    const updatedVectors = onVectorsChange.mock.calls[0]?.[0];
    rerender(
      <VerifySurface
        deterministicHash="new-hash"
        hasVectors={true}
        lastRun={currentTraceRun}
        vectors={updatedVectors}
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', direction: 'in' },
          { id: 'ld0', direction: 'out' },
        ]}
        onVectorsChange={onVectorsChange}
        onRunVerification={onRunVerification}
        onOpenProjectVectors={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(onRunVerification).toHaveBeenCalledTimes(2);
    });
    expect(onRunVerification.mock.calls[1]?.[0]?.assertionMode).toBe(true);
  });

  it('populates truth table rows for a passing run', () => {
    const { getAllByText, getAllByTestId, getByTestId, queryByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        lastRun={makePassRun()}
        vectors={[
          { id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
          { id: 'vec-02', tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1 } },
        ]}
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', direction: 'in' },
          { id: 'ld0', direction: 'out' },
        ]}
        onOpenProjectVectors={vi.fn()}
      />
    );

    expect(queryByTestId('ide-truth-table-empty')).toBeNull();
    expect(getByTestId('ide-verify-authority-note').textContent).toContain('Design trace is for debug only');
    fireEvent.click(getByTestId('ide-verify-drawer-toggle'));
    fireEvent.click(getAllByText('Details')[0]);
    expect(getByTestId('ide-verify-run-context')).toBeTruthy();
    expect(getByTestId('ide-verify-run-context-sampling').textContent).toContain('steady state');
    expect(getByTestId('ide-verify-run-context-ticks_shown').textContent).toContain('Showing all 2 ticks');
    expect(queryByTestId('ide-verify-run-deterministic')).toBeNull();
    expect(getAllByTestId('ide-verify-truth-table-title')[0].textContent).toContain('TRUTH TABLE');
    expect(getByTestId('ide-truth-table-row-0-ld0')).toBeTruthy();
    expect(getByTestId('ide-truth-table-row-1-ld0')).toBeTruthy();
  });

  it('keeps primary mismatch navigation visible while disclosing waveform tools on fail runs', () => {
    const { getAllByText, getByTestId, queryByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        lastRun={makeFailRun()}
        vectors={[
          { id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
          { id: 'vec-02', tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1 } },
        ]}
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', direction: 'in' },
          { id: 'ld0', direction: 'out' },
        ]}
        onOpenProjectVectors={vi.fn()}
      />
    );

    expect(getByTestId('ide-verify-fail-nav-first')).toBeTruthy();
    expect(getByTestId('ide-verify-fail-nav-summary').textContent).toContain('ld0');
    expect(getByTestId('ide-verify-fail-nav-summary').textContent).toContain('t1');
    expect(getByTestId('ide-verify-drawer-hint').textContent).toContain('Focus');
    expect(getByTestId('ide-verify-drawer-hint').textContent).toContain('ld0');
    expect(getByTestId('ide-verify-drawer-hint').textContent).toContain('t1');
    expect(getByTestId('ide-verify-drawer-hint').textContent).not.toContain('expected');
    expect(getByTestId('ide-verify-drawer-hint').textContent).not.toContain('observed');
    expect(getByTestId('ide-verify-waveform-tools-toggle')).toBeTruthy();
    expect(queryByTestId('ide-verify-waveform-tools-panel')).toBeNull();
    expect(queryByTestId('ide-verify-set-cursor-a')).toBeNull();
    expect(queryByTestId('ide-verify-set-cursor-b')).toBeNull();
    expect(queryByTestId('ide-verify-cursor-readout')).toBeNull();
    expect(queryByTestId('ide-verify-signal-digest')).toBeNull();
    expect(queryByTestId('ide-verify-waveform-legend')).toBeNull();
    expect(queryByTestId('ide-verify-tick-explainer')).toBeNull();
    expect(queryByTestId('ide-verify-advanced-debug')).toBeNull();

    fireEvent.click(getByTestId('ide-verify-waveform-tools-toggle'));
    expect(getByTestId('ide-verify-waveform-tools-panel')).toBeTruthy();
    expect(getByTestId('ide-verify-set-cursor-a')).toBeTruthy();
    expect(getByTestId('ide-verify-set-cursor-b')).toBeTruthy();

    fireEvent.click(getByTestId('ide-verify-drawer-toggle'));
    fireEvent.click(getAllByText('Details')[0]);
    expect(getByTestId('ide-verify-failure-explainer')).toBeTruthy();
    expect(getByTestId('ide-verify-right-tick').textContent).toContain('t1');
    expect(getByTestId('ide-verify-right-signal-key').textContent).toContain('ld0');
    expect(getByTestId('ide-verify-right-expected').textContent).toContain('1');
    expect(getByTestId('ide-verify-right-actual').textContent).toContain('0');
    expect(getByTestId('ide-verify-right-likely-reason').textContent).toContain('ld0');
    expect(getByTestId('ide-verify-right-likely-reason').textContent).toContain('t1');
    expect(getByTestId('ide-verify-right-next-step').textContent).toContain('ld0');
    fireEvent.click(getAllByText('Checks')[0]);
    expect(getByTestId('ide-verify-mismatch-case-id').textContent).toContain('vec-02');
    expect(getByTestId('ide-verify-mismatch-sampled-key').textContent).toContain('ld0_node.in');
    expect(getByTestId('ide-verify-mismatch-expected-key').textContent).toContain('ld0');
    fireEvent.click(getByTestId('ide-verify-explainer-show-mismatches'));
    fireEvent.click(getByTestId('ide-workbench-dock-toggle-left'));
    expect(getByTestId('ide-verify-signal-filter-state').textContent).toContain('mismatches');
  });

  it('shows explicit preflight diagnostics when outputs cannot be verified', () => {
    const onGoToDesign = vi.fn();
    const preflightRun: RuntimeVerifyRun = {
      ...makeFailRun(),
      reportHash: 'rep-preflight',
      status: 'fail',
      report: {
        ...makeFailRun().report,
        rows: [],
      },
      waveform: [],
      evidence: {
        ...makeFailRun().evidence!,
        preflight: [
          {
            kind: 'missing-output-node',
            signal: 'ld0',
            tick: 1,
            vectorId: 'vec-02',
            caseIndex: 1,
            message: 'Cannot verify: output ld0 is not mapped to a concrete design node.',
          },
        ],
        failures: [],
      },
    };

    const { getByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        lastRun={preflightRun}
        vectors={[
          { id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
          { id: 'vec-02', tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1 } },
        ]}
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', direction: 'in' },
          { id: 'ld0', direction: 'out' },
        ]}
        onGoToDesign={onGoToDesign}
        onOpenProjectVectors={vi.fn()}
      />
    );

    expect(getByTestId('ide-verify-preflight-guard').textContent).toContain('VPRE1002');
    expect(getByTestId('ide-verify-preflight-guard').textContent).toContain('Cannot verify: output ld0');
    expect(getByTestId('ide-verify-preflight-open-design').textContent).toContain('Open in Design');

    fireEvent.click(getByTestId('ide-verify-preflight-open-design'));

    expect(onGoToDesign).toHaveBeenCalledTimes(1);
  });


  it('generates deterministic sweep vectors from presets', () => {
    const onVectorsChange = vi.fn();
    const { getByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        lastRun={makePassRun()}
        vectors={[]}
        mappedInputs={[
          { id: 'sw0', label: 'SW0' },
          { id: 'sw1', label: 'SW1' },
        ]}
        mappedSignals={[
          { id: 'sw0', direction: 'in' },
          { id: 'sw1', direction: 'in' },
          { id: 'ld0', direction: 'out' },
        ]}
        onVectorsChange={onVectorsChange}
        onOpenProjectVectors={vi.fn()}
      />
    );

    fireEvent.change(getByTestId('ide-verify-sweep-preset'), { target: { value: 'binary-count' } });
    fireEvent.change(getByTestId('ide-verify-sweep-seed'), { target: { value: '3' } });
    fireEvent.change(getByTestId('ide-verify-sweep-hold'), { target: { value: '2' } });
    fireEvent.click(getByTestId('ide-verify-generate-sweep-vectors'));

    expect(onVectorsChange).toHaveBeenCalledTimes(1);
    const generated = onVectorsChange.mock.calls[0]?.[0] as Array<{ tick: number }>;
    expect(Array.isArray(generated)).toBe(true);
    expect(generated.length).toBeGreaterThan(0);
    expect(generated[0]?.tick).toBe(0);
  });

  it('preserves existing input keys when setting oracle expectations', () => {
    const onVectorsChange = vi.fn();
    const nodeKeyRun: RuntimeVerifyRun = {
      ...makePassRun(),
      report: {
        ...makePassRun().report,
        vectors: [
          { id: 'vec-01', tick: 0, inputs: { sw0_node: 0 }, expected: {}, caseIndex: 0 },
          { id: 'vec-02', tick: 1, inputs: { sw0_node: 1 }, expected: {}, caseIndex: 1 },
        ],
        inputsAtTick: {
          0: { sw0_node: 0 },
          1: { sw0_node: 1 },
        },
        inputsByVectorId: {
          'vec-01': { sw0_node: 0 },
          'vec-02': { sw0_node: 1 },
        },
        signalRoles: { sw0_node: 'input', ld0_node_in: 'output' },
        rows: [
          {
            tick: 0,
            signal: 'ld0_node_in',
            expected: '0',
            actual: '0',
            status: 'pass',
            vectorId: 'vec-01',
            caseIndex: 0,
          },
          {
            tick: 1,
            signal: 'ld0_node_in',
            expected: '1',
            actual: '1',
            status: 'pass',
            vectorId: 'vec-02',
            caseIndex: 1,
          },
        ],
      } as RuntimeVerifyRun['report'],
      waveform: [
        { tick: 0, signals: { sw0_node: '0', ld0_node_in: '0' }, mismatches: [] },
        { tick: 1, signals: { sw0_node: '1', ld0_node_in: '1' }, mismatches: [] },
      ],
    };

    const vectors = [
      { id: 'vec-01', tick: 0, inputs: { sw0_node: 0 }, expected: {} },
      { id: 'vec-02', tick: 1, inputs: { sw0_node: 1 }, expected: {} },
    ];

    const { getByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        lastRun={nodeKeyRun}
        vectors={vectors}
        mappedInputs={[{ id: 'sw0_node_in', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0_node_in', direction: 'in' },
          { id: 'ld0_node_in', direction: 'out' },
        ]}
        onVectorsChange={onVectorsChange}
        onOpenProjectVectors={vi.fn()}
      />
    );

    fireEvent.click(getByTestId('ide-vcb-save-expected'));

    expect(onVectorsChange).toHaveBeenCalledTimes(1);
    const updatedVectors = onVectorsChange.mock.calls[0]?.[0] as Array<{
      inputs: Record<string, 0 | 1>;
      expected: Record<string, 0 | 1>;
    }>;
    expect(updatedVectors.map((vector) => vector.inputs)).toEqual([
      { sw0_node: 0 },
      { sw0_node: 1 },
    ]);
    expect(updatedVectors.map((vector) => vector.expected)).toEqual([
      { ld0_node_in: 0 },
      { ld0_node_in: 1 },
    ]);
  });

  it('maps internal waveform output keys back to student-facing outputs when capturing expectations', () => {
    const onVectorsChange = vi.fn();
    const traceRun: RuntimeVerifyRun = {
      scenarioId: 'trace-normalized',
      scenarioName: 'Trace Normalized',
      status: 'pass',
      deterministicHash: 'abc123',
      reportHash: 'rep-trace-normalized',
      generatedAtIso: '2026-03-23T00:00:00.000Z',
      schedule: 'combinational',
      meta: {
        circuitKind: 'combinational',
        clockingProtocol: null,
        samplePoint: 'steady-state',
        tick0Meaning: null,
        clockSignalName: null,
      },
      report: {
        vectors: [{ id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: {}, caseIndex: 0 }],
        inputsAtTick: { 0: { sw0: 0 } },
        inputsByVectorId: { 'vec-01': { sw0: 0 } },
        signalRoles: { sw0: 'input', ld0: 'output' },
        rows: [],
      } as RuntimeVerifyRun['report'],
      waveform: [{ tick: 0, signals: { sw0: '0', ld0_node_in: '1' }, mismatches: [] }],
      evidence: {
        circuitHash: 'circuit-hash',
        ioRows: [
          { id: 'sw0', label: 'SW0', direction: 'in', nodeId: 'sw0_node' },
          { id: 'ld0', label: 'LD0', direction: 'out', nodeId: 'ld0_node' },
        ],
        vectors: [{ id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: {}, caseIndex: 0 }],
        normalizationMap: [
          { role: 'input', rawKey: 'sw0', normalizedKey: 'sw0', matchedSignal: 'sw0' },
          { role: 'output', rawKey: 'ld0', normalizedKey: 'ld0', matchedSignal: 'ld0_node_in' },
        ],
        preflight: [],
        failures: [],
      },
    };

    const { getByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        lastRun={traceRun}
        vectors={[{ id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: {} }]}
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', direction: 'in', label: 'SW0' },
          { id: 'ld0', direction: 'out', label: 'LD0' },
        ]}
        onVectorsChange={onVectorsChange}
        onOpenProjectVectors={vi.fn()}
      />
    );

    fireEvent.click(getByTestId('ide-vcb-save-expected'));

    expect(onVectorsChange).toHaveBeenCalledTimes(1);
    const updatedVectors = onVectorsChange.mock.calls[0]?.[0] as Array<{
      expected: Record<string, 0 | 1>;
    }>;
    expect(updatedVectors[0]?.expected).toEqual({ ld0: 1 });
  });

  it('falls back to output io-row node ids when capture sees sink-style waveform keys', () => {
    const onVectorsChange = vi.fn();
    const traceRun: RuntimeVerifyRun = {
      scenarioId: 'trace-iorow-fallback',
      scenarioName: 'Trace IO Row Fallback',
      status: 'pass',
      deterministicHash: 'abc123',
      reportHash: 'rep-trace-iorow-fallback',
      generatedAtIso: '2026-03-23T00:00:00.000Z',
      schedule: 'combinational',
      meta: {
        circuitKind: 'combinational',
        clockingProtocol: null,
        samplePoint: 'steady-state',
        tick0Meaning: null,
        clockSignalName: null,
      },
      report: {
        vectors: [{ id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: {}, caseIndex: 0 }],
        inputsAtTick: { 0: { sw0: 0 } },
        inputsByVectorId: { 'vec-01': { sw0: 0 } },
        signalRoles: { sw0: 'input', ld0: 'output' },
        rows: [],
      } as RuntimeVerifyRun['report'],
      waveform: [{ tick: 0, signals: { sw0: '0', ld0_node_in: '1' }, mismatches: [] }],
      evidence: {
        circuitHash: 'circuit-hash',
        ioRows: [
          { id: 'sw0', label: 'SW0', direction: 'in', nodeId: 'sw0_node' },
          { id: 'ld0', label: 'LD0', direction: 'out', nodeId: 'ld0_node' },
        ],
        vectors: [{ id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: {}, caseIndex: 0 }],
        normalizationMap: [],
        preflight: [],
        failures: [],
      },
    };

    const { getByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        lastRun={traceRun}
        vectors={[{ id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: {} }]}
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', direction: 'in', label: 'SW0' },
          { id: 'ld0', direction: 'out', label: 'LD0' },
        ]}
        onVectorsChange={onVectorsChange}
        onOpenProjectVectors={vi.fn()}
      />
    );

    fireEvent.click(getByTestId('ide-vcb-save-expected'));

    expect(onVectorsChange).toHaveBeenCalledTimes(1);
    const updatedVectors = onVectorsChange.mock.calls[0]?.[0] as Array<{
      expected: Record<string, 0 | 1>;
    }>;
    expect(updatedVectors[0]?.expected).toEqual({ ld0: 1 });
  });

  it('shows canonical signal lanes when waveform samples use internal node keys', () => {
    const traceRun: RuntimeVerifyRun = {
      scenarioId: 'trace-visible-lanes',
      scenarioName: 'Trace Visible Lanes',
      status: 'pass',
      deterministicHash: 'abc123',
      reportHash: 'rep-trace-visible-lanes',
      generatedAtIso: '2026-03-24T00:00:00.000Z',
      schedule: 'combinational',
      meta: {
        circuitKind: 'combinational',
        clockingProtocol: null,
        samplePoint: 'steady-state',
        tick0Meaning: null,
        clockSignalName: null,
      },
      report: {
        vectors: [{ id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: {}, caseIndex: 0 }],
        inputsAtTick: { 0: { sw0: 0 } },
        inputsByVectorId: { 'vec-01': { sw0: 0 } },
        signalRoles: { sw0: 'input', ld0: 'output' },
        rows: [],
      } as RuntimeVerifyRun['report'],
      waveform: [{ tick: 0, signals: { sw0_node_out: '0', ld0_node_in: '1', tap_probe: '1' }, mismatches: [] }],
      evidence: {
        circuitHash: 'circuit-hash',
        ioRows: [
          { id: 'sw0', label: 'SW0', direction: 'in', nodeId: 'sw0_node' },
          { id: 'ld0', label: 'LD0', direction: 'out', nodeId: 'ld0_node' },
        ],
        vectors: [{ id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: {}, caseIndex: 0 }],
        normalizationMap: [],
        preflight: [],
        failures: [],
      },
    };

    const { getByTestId, queryByText } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        lastRun={traceRun}
        vectors={[{ id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: {} }]}
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', direction: 'in', label: 'SW0' },
          { id: 'ld0', direction: 'out', label: 'LD0' },
        ]}
        onOpenProjectVectors={vi.fn()}
      />
    );

    expect(getByTestId('ide-workbench-dock-toggle-left')).toBeTruthy();
    expect(getByTestId('ide-verify-waveform-row-ld0')).toBeTruthy();
    expect(queryByText(/No signal data in the last run/i)).toBeNull();
  });

  it('keeps internal trace lanes visible when no mapped I/O lanes are available', () => {
    const traceRun: RuntimeVerifyRun = {
      scenarioId: 'trace-internal-only',
      scenarioName: 'Trace Internal Only',
      status: 'pass',
      deterministicHash: 'abc123',
      reportHash: 'rep-trace-internal-only',
      generatedAtIso: '2026-03-24T00:00:00.000Z',
      schedule: 'combinational',
      meta: {
        circuitKind: 'combinational',
        clockingProtocol: null,
        samplePoint: 'steady-state',
        tick0Meaning: null,
        clockSignalName: null,
      },
      report: {
        vectors: [],
        inputsAtTick: {},
        signalRoles: {},
        rows: [],
      } as RuntimeVerifyRun['report'],
      waveform: [{ tick: 0, signals: { ld0_node_in: '1', tap_probe: '0' }, mismatches: [] }],
      evidence: {
        circuitHash: 'circuit-hash',
        ioRows: [],
        vectors: [],
        normalizationMap: [],
        preflight: [],
        failures: [],
      },
    };

    const { getByTestId, queryByText } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={false}
        lastRun={traceRun}
        vectors={[]}
        mappedSignals={[]}
        onOpenProjectVectors={vi.fn()}
      />
    );

    expect(getByTestId('ide-workbench-dock-toggle-left')).toBeTruthy();
    expect(getByTestId('ide-verify-waveform-row-ld0_node_in')).toBeTruthy();
    expect(queryByText(/No signal data in the last run/i)).toBeNull();
  });

  it('shows explicit combos unavailability for sequential circuits', () => {
    const sequentialRun: RuntimeVerifyRun = {
      ...makePassRun(),
      schedule: 'clocked_macro',
      reportHash: 'rep-seq',
      meta: {
        circuitKind: 'sequential',
        clockingProtocol: 'clocked_macro',
        samplePoint: 'post-rising-edge',
        tick0Meaning: 'initial-state',
        clockSignalName: 'CLK',
      },
      report: {
        ...makePassRun().report,
        inputsAtTick: {
          0: { clk: 0, rst: 1, sw0: 0, sw1: 1, sw2: 0, sw3: 1 },
        },
        signalRoles: {
          clk: 'clock',
          rst: 'reset',
          sw0: 'input',
          sw1: 'input',
          sw2: 'input',
          sw3: 'input',
          ld0: 'output',
        },
      },
    };

    const { getAllByText, getByTestId, queryByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        verifyMode="sequential"
        lastRun={sequentialRun}
        vectors={[
          {
            id: 'vec-01',
            tick: 0,
            inputs: { clk: 0, rst: 1, sw0: 0, sw1: 1, sw2: 0, sw3: 1 },
            expected: { ld0: 0 },
          },
        ]}
        mappedInputs={[
          { id: 'clk', label: 'CLK' },
          { id: 'rst', label: 'RST' },
          { id: 'sw0', label: 'SW0' },
          { id: 'sw1', label: 'SW1' },
          { id: 'sw2', label: 'SW2' },
          { id: 'sw3', label: 'SW3' },
        ]}
        mappedSignals={[
          { id: 'clk', direction: 'in' },
          { id: 'rst', direction: 'in' },
          { id: 'sw0', direction: 'in' },
          { id: 'sw1', direction: 'in' },
          { id: 'sw2', direction: 'in' },
          { id: 'sw3', direction: 'in' },
          { id: 'ld0', direction: 'out' },
        ]}
        onOpenProjectVectors={vi.fn()}
      />
    );

    fireEvent.click(getByTestId('ide-verify-drawer-toggle'));
    fireEvent.click(getAllByText('Details')[0]);
    expect(getByTestId('ide-verify-truth-table-title').textContent).toContain('TRACE TABLE (TICK LOG)');
    expect(queryByTestId('ide-truth-table-mode-combos')).toBeNull();
    expect(getByTestId('ide-truth-table-inputs-0').textContent).toContain('CLK=0');
    expect(getByTestId('ide-truth-table-inputs-0').textContent).toContain('RST=1');
    expect(getByTestId('ide-truth-table-inputs-0').textContent).toContain('+2');
    fireEvent.click(getAllByText('Details')[0]);
    expect(getByTestId('ide-verify-run-context-protocol').textContent).toContain('Clocked macro');
    expect(getByTestId('ide-verify-run-context-tick_0').textContent).toContain('Initial state');
  });

  // ─── PASS (INCOMPLETE) — Commit 1 trust-model tests ─────────────────────

  it('shows incomplete-mapping pre-flight banner when mappingComplete is false and no run exists', () => {
    const { getByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        vectors={[{ id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } }]}
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', direction: 'in' },
          { id: 'ld0', direction: 'out' },
        ]}
        mappingComplete={false}
        onOpenProjectVectors={vi.fn()}
      />
    );

    const banner = getByTestId('ide-verify-incomplete-mapping-banner');
    expect(banner.textContent).toContain('not mapped to board pins');
  });

  it('shows PASS (INCOMPLETE) status label when pass run has incomplete-mapping qualification', () => {
    const incompletePassRun: RuntimeVerifyRun = {
      ...makePassRun(),
      qualification: 'incomplete-mapping',
    };

    const { getByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        lastRun={incompletePassRun}
        vectors={[
          { id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
          { id: 'vec-02', tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1 } },
        ]}
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', direction: 'in' },
          { id: 'ld0', direction: 'out' },
        ]}
        mappingComplete={false}
        onOpenProjectVectors={vi.fn()}
      />
    );

    const statusPill = getByTestId('ide-verify-summary-status');
    expect(statusPill.textContent).toContain('ASSERTIONS MATCH (MAPPING REVIEW)');
  });

  it('shows post-run incomplete-mapping notice when pass has qualification', () => {
    const incompletePassRun: RuntimeVerifyRun = {
      ...makePassRun(),
      qualification: 'incomplete-mapping',
    };

    const { getByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        lastRun={incompletePassRun}
        vectors={[
          { id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
          { id: 'vec-02', tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1 } },
        ]}
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', direction: 'in' },
          { id: 'ld0', direction: 'out' },
        ]}
        mappingComplete={false}
        onOpenProjectVectors={vi.fn()}
      />
    );

    const notice = getByTestId('ide-verify-incomplete-mapping-notice');
    expect(notice.textContent).toContain('outputs are not mapped to board pins');
  });

  it('does NOT show incomplete-mapping banner or notice on a normal PASS with mappingComplete true', () => {
    const { queryByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        lastRun={makePassRun()}
        vectors={[
          { id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
          { id: 'vec-02', tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1 } },
        ]}
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', direction: 'in' },
          { id: 'ld0', direction: 'out' },
        ]}
        mappingComplete={true}
        onOpenProjectVectors={vi.fn()}
      />
    );

    expect(queryByTestId('ide-verify-incomplete-mapping-banner')).toBeNull();
    expect(queryByTestId('ide-verify-incomplete-mapping-notice')).toBeNull();
  });

  it('shows full PASS trust milestone copy and continue CTA when mapping is complete', () => {
    const { getByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        lastRun={makePassRun()}
        vectors={[
          { id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
          { id: 'vec-02', tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1 } },
        ]}
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', direction: 'in' },
          { id: 'ld0', direction: 'out' },
        ]}
        mappingComplete={true}
        onOpenProjectVectors={vi.fn()}
      />
    );

    expect(getByTestId('ide-verify-pass-hero-title').textContent).toContain('Assertions match across 2 vectors');
    expect(getByTestId('ide-verify-pass-hero-meta').textContent).toContain('Observed outputs matched every asserted expectation');
    expect(getByTestId('ide-verify-pass-hero').className).not.toContain('ide-verify-pass-hero--incomplete');
    expect(getByTestId('ide-verify-pass-hero-hardware').textContent).toContain('Continue');
    expect(getByTestId('ide-verify-cta-continue').textContent).toContain('Continue');
  });

  it('shows PASS incomplete milestone copy and finish-mapping CTA when qualification is incomplete', () => {
    const incompletePassRun: RuntimeVerifyRun = {
      ...makePassRun(),
      qualification: 'incomplete-mapping',
    };

    const { getByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        lastRun={incompletePassRun}
        vectors={[
          { id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
          { id: 'vec-02', tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1 } },
        ]}
        mappedInputs={[{ id: 'sw0', label: 'SW0' }]}
        mappedSignals={[
          { id: 'sw0', direction: 'in' },
          { id: 'ld0', direction: 'out' },
        ]}
        mappingComplete={false}
        unmappedOutputLabels={['LD1']}
        onOpenProjectVectors={vi.fn()}
      />
    );

    expect(getByTestId('ide-verify-summary-status').textContent).toContain('ASSERTIONS MATCH (MAPPING REVIEW)');
    expect(getByTestId('ide-verify-pass-hero-title').textContent).toContain('mapping review still needed');
    expect(getByTestId('ide-verify-pass-hero-meta').textContent).toContain('not connected to board pins');
    expect(getByTestId('ide-verify-pass-hero').className).toContain('ide-verify-pass-hero--incomplete');
    expect(getByTestId('ide-verify-pass-hero-hardware').textContent).toContain('Finish mapping');
    expect(getByTestId('ide-verify-cta-continue').textContent).toContain('Finish mapping');
  });
});
