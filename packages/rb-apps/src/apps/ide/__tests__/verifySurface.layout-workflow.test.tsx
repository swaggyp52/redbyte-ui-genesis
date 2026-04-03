// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, within } from '@testing-library/react';
import type { RuntimeVerifyRun } from '../projectRuntime';
import { VerifySurface } from '../surfaces/VerifySurface';

function makeTraceRun(): RuntimeVerifyRun {
  return {
    scenarioId: 'trace-1',
    scenarioName: 'Trace Scenario',
    status: 'pass',
    deterministicHash: 'det-trace',
    reportHash: 'rep-trace',
    generatedAtIso: '2026-04-03T00:00:00.000Z',
    schedule: 'combinational',
    meta: {
      circuitKind: 'combinational',
      clockingProtocol: null,
      samplePoint: 'steady-state',
      tick0Meaning: null,
      clockSignalName: null,
    },
    report: ({
      vectors: [{ id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: {} }],
      inputsAtTick: { 0: { sw0: 0 } },
      signalRoles: { sw0: 'input', ld0: 'output' },
      rows: [],
    } as unknown) as RuntimeVerifyRun['report'],
    waveform: [{ tick: 0, signals: { sw0: '0', ld0: '0' }, mismatches: [] }],
  };
}

function makeCompareFailRun(): RuntimeVerifyRun {
  return {
    scenarioId: 'cmp-1',
    scenarioName: 'Compare Scenario',
    status: 'fail',
    deterministicHash: 'det-compare',
    reportHash: 'rep-compare',
    generatedAtIso: '2026-04-03T00:00:00.000Z',
    schedule: 'combinational',
    meta: {
      circuitKind: 'combinational',
      clockingProtocol: null,
      samplePoint: 'steady-state',
      tick0Meaning: null,
      clockSignalName: null,
    },
    report: ({
      vectors: [{ id: 'vec-01', tick: 0, inputs: { sw0: 1 }, expected: { ld0: 1 } }],
      inputsAtTick: { 0: { sw0: 1 } },
      signalRoles: { sw0: 'input', ld0: 'output' },
      rows: [{ tick: 0, signal: 'ld0', expected: '1', actual: '0', status: 'fail', vectorId: 'vec-01', caseIndex: 0 }],
    } as unknown) as RuntimeVerifyRun['report'],
    waveform: [
      {
        tick: 0,
        signals: { sw0: '1', ld0: '0' },
        mismatches: [{ signal: 'ld0', expected: '1', actual: '0' }],
      },
    ],
  };
}

const baseProps = {
  hasVectors: true,
  vectors: [{ id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } }],
  mappedInputs: [{ id: 'sw0', label: 'SW0' }],
  mappedSignals: [
    { id: 'sw0', label: 'SW0', direction: 'in' as const },
    { id: 'ld0', label: 'LD0', direction: 'out' as const },
  ],
  onOpenProjectVectors: vi.fn(),
  onVectorsChange: vi.fn(),
};

describe('VerifySurface layout workflow architecture', () => {
  it('renders explicit header/stimulus/waveform/inspector regions', () => {
    const { getByTestId } = render(
      <VerifySurface
        {...baseProps}
        deterministicHash="det-trace"
        lastRun={makeTraceRun()}
      />
    );

    expect(getByTestId('ide-verify-region-header')).toBeTruthy();
    expect(getByTestId('ide-verify-region-stimulus')).toBeTruthy();
    expect(getByTestId('ide-verify-region-waveform')).toBeTruthy();
    expect(getByTestId('ide-verify-region-inspector')).toBeTruthy();
  });

  it('hides mismatches tab in Observe mode and shows it in Compare mode', () => {
    const traceView = render(
      <VerifySurface
        {...baseProps}
        deterministicHash="det-trace"
        lastRun={makeTraceRun()}
      />
    );

    fireEvent.click(traceView.getByTestId('ide-verify-drawer-toggle'));
    const traceTabs = traceView.getByTestId('ide-verify-analysis-tab-nav');
    expect(within(traceTabs).queryByText('Mismatches')).toBeNull();

    traceView.unmount();

    const compareView = render(
      <VerifySurface
        {...baseProps}
        deterministicHash="det-compare"
        lastRun={makeCompareFailRun()}
      />
    );

    fireEvent.click(compareView.getByTestId('ide-verify-drawer-toggle'));
    const compareTabs = compareView.getByTestId('ide-verify-analysis-tab-nav');
    expect(within(compareTabs).getByText('Mismatches')).toBeTruthy();
  });

  it('does not render legacy stacked top banners when primary status is active', () => {
    const staleRun = makeCompareFailRun();
    const { getAllByTestId, queryByTestId } = render(
      <VerifySurface
        {...baseProps}
        deterministicHash="det-new-build"
        lastRun={staleRun}
        mappingComplete={false}
      />
    );

    expect(getAllByTestId('ide-verify-primary-status').length).toBe(1);
    expect(queryByTestId('ide-verify-incomplete-mapping-banner')).toBeNull();
    expect(queryByTestId('ide-verify-scenario-stale-banner')).toBeNull();
    expect(queryByTestId('ide-verify-wrong-scenario-banner')).toBeNull();
    expect(queryByTestId('ide-verify-stale-banner')).toBeNull();
  });

  it('keeps waveform region present in both Observe and Compare modes', () => {
    const observe = render(
      <VerifySurface
        {...baseProps}
        deterministicHash="det-trace"
        lastRun={makeTraceRun()}
      />
    );
    expect(observe.getByTestId('ide-verify-region-waveform')).toBeTruthy();
    expect(observe.getByTestId('ide-verify-workspace-waveform')).toBeTruthy();
    observe.unmount();

    const compare = render(
      <VerifySurface
        {...baseProps}
        deterministicHash="det-compare"
        lastRun={makeCompareFailRun()}
      />
    );
    expect(compare.getByTestId('ide-verify-region-waveform')).toBeTruthy();
    expect(compare.getByTestId('ide-verify-workspace-waveform')).toBeTruthy();
  });

  it('shows clock helper strip for sequential circuits', () => {
    const { getByTestId } = render(
      <VerifySurface
        {...baseProps}
        deterministicHash="det-seq"
        hasDff={true}
      />
    );

    expect(getByTestId('ide-verify-sequential-helper')).toBeTruthy();
    expect(getByTestId('ide-verify-insert-clock-pattern')).toBeTruthy();
    expect(getByTestId('ide-verify-insert-clock-pulse')).toBeTruthy();
  });

  it('applies hold-low clock preset without manual waveform painting', () => {
    const onVectorsChange = vi.fn();
    const { getByTestId } = render(
      <VerifySurface
        deterministicHash="det-seq"
        hasVectors={true}
        vectors={[]}
        hasDff={true}
        liveSignalRoles={{ clk: 'clock', d: 'input', q: 'output' }}
        mappedInputs={[{ id: 'clk', label: 'CLK' }, { id: 'd', label: 'D' }]}
        mappedSignals={[
          { id: 'clk', label: 'CLK', direction: 'in' },
          { id: 'd', label: 'D', direction: 'in' },
          { id: 'q', label: 'Q', direction: 'out' },
        ]}
        onOpenProjectVectors={vi.fn()}
        onVectorsChange={onVectorsChange}
      />
    );

    fireEvent.click(getByTestId('ide-verify-insert-clock-hold-low'));

    expect(onVectorsChange).toHaveBeenCalledTimes(1);
    const generated = onVectorsChange.mock.calls[0]?.[0] as Array<{ tick: number; inputs: Record<string, 0 | 1> }>;
    expect(generated.length).toBe(4);
    expect(generated.map((row) => row.tick)).toEqual([0, 1, 2, 3]);
    expect(generated.every((row) => row.inputs.clk === 0)).toBe(true);
  });

  it('does not allow expected-output authoring widgets in Observe mode', () => {
    const { queryByTestId } = render(
      <VerifySurface
        {...baseProps}
        deterministicHash="det-trace"
        lastRun={makeTraceRun()}
      />
    );

    expect(queryByTestId('ide-verify-add-vector-expected-ld0')).toBeNull();
    expect(queryByTestId('ide-stimulus-expected-ld0-t0')).toBeNull();
  });
});
