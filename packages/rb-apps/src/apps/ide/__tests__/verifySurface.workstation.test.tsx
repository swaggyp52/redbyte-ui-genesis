// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { RuntimeVerifyRun } from '../projectRuntime';
import { VerifySurface } from '../surfaces/VerifySurface';

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

describe('VerifySurface workstation controls', () => {
  afterEach(() => { cleanup(); });

  it('shows a single first-run CTA before any verification evidence exists', () => {
    const { getAllByText, getByTestId } = render(
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

    expect(getByTestId('ide-verify-empty-state').textContent).toContain('Click cells to edit');
    expect(getByTestId('ide-verify-reference-mode').textContent?.toLowerCase()).toContain('comparing against project vectors');
    expect(getByTestId('ide-verify-session-status').textContent).toContain('DRAFT');
    expect(getByTestId('ide-verify-session-mode').textContent).toContain('ASSERTION MODE');
    expect(getByTestId('ide-verify-session-title').textContent).toContain('Ready to verify');
    expect(getByTestId('ide-verify-empty-run').textContent).toContain('Run Verification');
    expect(getByTestId('ide-verify-empty-open-vectors').textContent).toContain('Import');
    expect(getByTestId('ide-verify-run').textContent).toContain('Run Verification');
    expect(getByTestId('ide-verify-run').className).toContain('ide-button-primary');
  });

  it('labels trace-only verification as observation mode when no expected outputs are loaded', () => {
    const { getByTestId } = render(
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
    expect(getByTestId('ide-verify-session-mode').textContent).toContain('SIMULATION MODE');
    expect(getByTestId('ide-verify-session-title').textContent).toContain('Ready to simulate');
  });

  it('shows capture mode with assertions incomplete after a trace-only run', () => {
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

    const { getByTestId } = render(
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

    expect(getByTestId('ide-verify-session-status').textContent).toContain('ASSERTIONS INCOMPLETE');
    expect(getByTestId('ide-verify-session-mode').textContent).toContain('CAPTURE MODE');
    expect(getByTestId('ide-verify-session-title').textContent).toContain('assertions are incomplete');
    expect(getByTestId('ide-verify-set-oracle').textContent).toContain('Capture outputs as expected');
    expect(getByTestId('ide-verify-set-oracle').className).toContain('ide-button-primary');
    expect(getByTestId('ide-verify-run-secondary').className).toContain('ide-button-secondary');
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

    fireEvent.click(getByTestId('ide-verify-set-oracle'));
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

    expect(getByTestId('ide-verify-assertion-mode-toggle').textContent).toContain('Check Expected Outputs');
  });

  it('populates truth table rows for a passing run', () => {
    const { getAllByText, getByTestId, queryByTestId } = render(
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
    fireEvent.click(getAllByText('Truth Table')[0]);
    expect(getByTestId('ide-verify-truth-table-title').textContent).toContain('TRUTH TABLE');
    expect(getByTestId('ide-truth-table-row-0-ld0')).toBeTruthy();
    expect(getByTestId('ide-truth-table-row-1-ld0')).toBeTruthy();
  });

  it('shows mismatch navigation and cursor controls on fail runs', () => {
    const { getAllByText, getByTestId } = render(
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

    expect(getByTestId('ide-verify-jump-first-failure')).toBeTruthy();
    expect(getByTestId('ide-verify-fail-nav-first')).toBeTruthy();
    expect(getByTestId('ide-verify-set-cursor-a')).toBeTruthy();
    expect(getByTestId('ide-verify-set-cursor-b')).toBeTruthy();
    expect(getByTestId('ide-verify-cursor-readout')).toBeTruthy();
    expect(getByTestId('ide-verify-failure-explainer')).toBeTruthy();
    expect(getByTestId('ide-verify-right-tick').textContent).toContain('t1');
    expect(getByTestId('ide-verify-right-signal-key').textContent).toContain('ld0');
    expect(getByTestId('ide-verify-right-expected').textContent).toContain('1');
    expect(getByTestId('ide-verify-right-actual').textContent).toContain('0');
    expect(getByTestId('ide-verify-right-likely-reason').textContent).toContain('ld0');
    expect(getByTestId('ide-verify-right-likely-reason').textContent).toContain('t1');
    expect(getByTestId('ide-verify-right-next-step').textContent).toContain('ld0');
    expect(getByTestId('ide-verify-advanced-debug').hasAttribute('open')).toBe(false);

    fireEvent.click(getByTestId('ide-verify-drawer-toggle'));
    fireEvent.click(getAllByText('Mismatches')[0]);
    expect(getByTestId('ide-verify-mismatch-case-id').textContent).toContain('vec-02');
    expect(getByTestId('ide-verify-mismatch-sampled-key').textContent).toContain('ld0_node.in');
    expect(getByTestId('ide-verify-mismatch-expected-key').textContent).toContain('ld0');
    fireEvent.click(getByTestId('ide-verify-explainer-show-mismatches'));
    expect(getByTestId('ide-verify-signal-filter-state').textContent).toContain('mismatches');
  });

  it('shows explicit preflight diagnostics when outputs cannot be verified', () => {
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
        onOpenProjectVectors={vi.fn()}
      />
    );

    expect(getByTestId('ide-verify-preflight-guard').textContent).toContain('VPRE1002');
    expect(getByTestId('ide-verify-preflight-guard').textContent).toContain('Cannot verify: output ld0');
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

    fireEvent.click(getByTestId('ide-verify-set-oracle'));

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

    fireEvent.click(getByTestId('ide-verify-set-oracle'));

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

    fireEvent.click(getByTestId('ide-verify-set-oracle'));

    expect(onVectorsChange).toHaveBeenCalledTimes(1);
    const updatedVectors = onVectorsChange.mock.calls[0]?.[0] as Array<{
      expected: Record<string, 0 | 1>;
    }>;
    expect(updatedVectors[0]?.expected).toEqual({ ld0: 1 });
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
        hasDff={true}
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
    fireEvent.click(getAllByText('Truth Table')[0]);
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
    expect(statusPill.textContent).toContain('PASS (INCOMPLETE)');
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

    expect(getByTestId('ide-verify-pass-hero-title').textContent).toContain('All 2 vectors passed');
    expect(getByTestId('ide-verify-pass-hero-meta').textContent).toContain('ready to export');
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

    expect(getByTestId('ide-verify-summary-status').textContent).toContain('PASS (INCOMPLETE)');
    expect(getByTestId('ide-verify-pass-hero-title').textContent).toContain('mapping incomplete');
    expect(getByTestId('ide-verify-pass-hero-meta').textContent).toContain('not connected to board pins');
    expect(getByTestId('ide-verify-pass-hero').className).toContain('ide-verify-pass-hero--incomplete');
    expect(getByTestId('ide-verify-pass-hero-hardware').textContent).toContain('Finish mapping');
    expect(getByTestId('ide-verify-cta-continue').textContent).toContain('Finish mapping');
  });
});
