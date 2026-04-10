// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, within } from '@testing-library/react';
import type { RuntimeVerifyRun } from '../projectRuntime';
import { VerifySurface } from '../surfaces/VerifySurface';

type WaveformCase = {
  tick: number;
  inputs: { sw0: 0 | 1; sw1: 0 | 1 };
  expected: { carry: string; sum: string; flag: string };
  actual: { carry: string; sum: string; flag: string; tap: string; noise: string };
};

function makeWaveformPriorityRun(): RuntimeVerifyRun {
  const cases: WaveformCase[] = [
    {
      tick: 0,
      inputs: { sw0: 0, sw1: 0 },
      expected: { carry: '0', sum: '0', flag: '0' },
      actual: { carry: '0', sum: '0', flag: '0', tap: '0', noise: '0' },
    },
    {
      tick: 1,
      inputs: { sw0: 0, sw1: 1 },
      expected: { carry: '1', sum: '1', flag: '0' },
      actual: { carry: '0', sum: '0', flag: '0', tap: '1', noise: '0' },
    },
    {
      tick: 2,
      inputs: { sw0: 1, sw1: 0 },
      expected: { carry: '0', sum: '1', flag: '0' },
      actual: { carry: '0', sum: '1', flag: '0', tap: '1', noise: '1' },
    },
    {
      tick: 3,
      inputs: { sw0: 1, sw1: 1 },
      expected: { carry: '1', sum: '0', flag: '1' },
      actual: { carry: '1', sum: '0', flag: '1', tap: '0', noise: '1' },
    },
    {
      tick: 4,
      inputs: { sw0: 0, sw1: 0 },
      expected: { carry: '0', sum: '0', flag: '1' },
      actual: { carry: '0', sum: '0', flag: '1', tap: '0', noise: '0' },
    },
    {
      tick: 5,
      inputs: { sw0: 0, sw1: 1 },
      expected: { carry: '1', sum: '1', flag: '1' },
      actual: { carry: '1', sum: '1', flag: '1', tap: '1', noise: '0' },
    },
    {
      tick: 6,
      inputs: { sw0: 1, sw1: 0 },
      expected: { carry: '0', sum: '1', flag: '0' },
      actual: { carry: '0', sum: '1', flag: '0', tap: '0', noise: '1' },
    },
    {
      tick: 7,
      inputs: { sw0: 1, sw1: 1 },
      expected: { carry: '1', sum: '0', flag: '1' },
      actual: { carry: '1', sum: '0', flag: '1', tap: '1', noise: '1' },
    },
    {
      tick: 8,
      inputs: { sw0: 1, sw1: 1 },
      expected: { carry: '0', sum: '1', flag: '1' },
      actual: { carry: '1', sum: '0', flag: '1', tap: '1', noise: '0' },
    },
  ];

  return {
    scenarioId: 'waveform-priority',
    scenarioName: 'Waveform Priority Scenario',
    status: 'fail',
    deterministicHash: 'det_wave_priority',
    reportHash: 'rep_wave_priority',
    firstFailingTick: 1,
    generatedAtIso: '2026-03-08T20:45:00.000Z',
    schedule: 'combinational',
    meta: {
      circuitKind: 'combinational',
      clockingProtocol: null,
      samplePoint: 'steady-state',
      tick0Meaning: null,
      clockSignalName: null,
    },
    report: {
      vectors: cases.map((entry) => ({
        id: `vec-${String(entry.tick).padStart(2, '0')}`,
        tick: entry.tick,
        inputs: entry.inputs,
        expected: {
          carry: entry.expected.carry === '1' ? 1 : 0,
          sum: entry.expected.sum === '1' ? 1 : 0,
          flag: entry.expected.flag === '1' ? 1 : 0,
        },
      })),
      inputsAtTick: Object.fromEntries(cases.map((entry) => [entry.tick, entry.inputs])),
      signalRoles: {
        sw0: 'input',
        sw1: 'input',
        carry: 'output',
        sum: 'output',
        flag: 'output',
      },
      rows: cases.flatMap((entry) => [
        {
          tick: entry.tick,
          signal: 'carry',
          expected: entry.expected.carry,
          actual: entry.actual.carry,
          status: entry.expected.carry === entry.actual.carry ? 'pass' : 'fail',
        },
        {
          tick: entry.tick,
          signal: 'flag',
          expected: entry.expected.flag,
          actual: entry.actual.flag,
          status: entry.expected.flag === entry.actual.flag ? 'pass' : 'fail',
        },
        {
          tick: entry.tick,
          signal: 'sum',
          expected: entry.expected.sum,
          actual: entry.actual.sum,
          status: entry.expected.sum === entry.actual.sum ? 'pass' : 'fail',
        },
      ]),
    } as RuntimeVerifyRun['report'],
    waveform: cases.map((entry) => ({
      tick: entry.tick,
      signals: {
        sw0: String(entry.inputs.sw0),
        sw1: String(entry.inputs.sw1),
        carry: entry.actual.carry,
        sum: entry.actual.sum,
        flag: entry.actual.flag,
      },
      mismatches: [
        ...(entry.expected.carry !== entry.actual.carry
          ? [{ signal: 'carry', expected: entry.expected.carry, actual: entry.actual.carry }]
          : []),
        ...(entry.expected.sum !== entry.actual.sum
          ? [{ signal: 'sum', expected: entry.expected.sum, actual: entry.actual.sum }]
          : []),
        ...(entry.expected.flag !== entry.actual.flag
          ? [{ signal: 'flag', expected: entry.expected.flag, actual: entry.actual.flag }]
          : []),
      ],
    })),
  };
}

function makeWaveformPassRun(): RuntimeVerifyRun {
  const base = makeWaveformPriorityRun();
  return {
    ...base,
    status: 'pass',
    firstFailingTick: null,
    report: {
      ...base.report,
      rows: base.report.rows.map((row) => ({
        ...row,
        expected: row.actual,
        status: 'pass' as const,
      })),
    },
    waveform: base.waveform.map((entry) => ({
      ...entry,
      mismatches: [],
    })),
  };
}

function getSignalListOrder(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('[data-testid="ide-verify-signal-list"] .ide-signal-row')).map(
    (node) => node.textContent?.trim() ?? ''
  );
}

function getWaveformOrder(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('[data-testid^="ide-verify-waveform-row-"]')).map(
    (node) => node.querySelector('title')?.textContent ?? ''
  );
}

describe('VerifySurface waveform lane priority', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('shows mapped input stimulus lanes by default on PASS runs', () => {
    const { container } = render(
      <VerifySurface
        deterministicHash="det_wave_priority_pass"
        hasVectors={true}
        lastRun={makeWaveformPassRun()}
        vectors={makeWaveformPassRun().report.vectors}
        mappedInputs={[
          { id: 'sw0', label: 'SW0' },
          { id: 'sw1', label: 'SW1' },
        ]}
        mappedSignals={[
          { id: 'sw0', label: 'SW0', direction: 'in' },
          { id: 'sw1', label: 'SW1', direction: 'in' },
          { id: 'carry', label: 'Carry', direction: 'out' },
          { id: 'sum', label: 'Sum', direction: 'out' },
          { id: 'flag', label: 'Flag', direction: 'out' },
        ]}
        onOpenProjectVectors={vi.fn()}
      />
    );

    const lanes = getWaveformOrder(container);
    expect(lanes).toContain('sw0');
    expect(lanes).toContain('sw1');
  });

  it('keeps mapped input stimulus lanes collapsed by default on FAIL runs', () => {
    const { container } = render(
      <VerifySurface
        deterministicHash="det_wave_priority_fail"
        hasVectors={true}
        lastRun={makeWaveformPriorityRun()}
        vectors={makeWaveformPriorityRun().report.vectors}
        mappedInputs={[
          { id: 'sw0', label: 'SW0' },
          { id: 'sw1', label: 'SW1' },
        ]}
        mappedSignals={[
          { id: 'sw0', label: 'SW0', direction: 'in' },
          { id: 'sw1', label: 'SW1', direction: 'in' },
          { id: 'carry', label: 'Carry', direction: 'out' },
          { id: 'sum', label: 'Sum', direction: 'out' },
          { id: 'flag', label: 'Flag', direction: 'out' },
        ]}
        onOpenProjectVectors={vi.fn()}
      />
    );

    const lanes = getWaveformOrder(container);
    expect(lanes).toContain('carry');
    expect(lanes).toContain('sum');
    expect(lanes).toContain('flag');
    expect(lanes).not.toContain('sw0');
    expect(lanes).not.toContain('sw1');
  });

  it('auto-expands mapped inputs once per PASS run and preserves manual collapse on rerender', () => {
    const passRun = makeWaveformPassRun();
    const props = {
      deterministicHash: passRun.deterministicHash,
      hasVectors: true,
      lastRun: passRun,
      vectors: passRun.report.vectors,
      mappedInputs: [
        { id: 'sw0', label: 'SW0' },
        { id: 'sw1', label: 'SW1' },
      ],
      mappedSignals: [
        { id: 'sw0', label: 'SW0', direction: 'in' as const },
        { id: 'sw1', label: 'SW1', direction: 'in' as const },
        { id: 'carry', label: 'Carry', direction: 'out' as const },
        { id: 'sum', label: 'Sum', direction: 'out' as const },
        { id: 'flag', label: 'Flag', direction: 'out' as const },
      ],
      onOpenProjectVectors: vi.fn(),
    };

    const { container, getByTestId, rerender } = render(<VerifySurface {...props} />);

    // PASS run auto-expands mapped inputs once.
    expect(getWaveformOrder(container)).toContain('sw0');
    expect(getWaveformOrder(container)).toContain('sw1');

    const leftDockToggle = container.querySelector('[data-testid="ide-workbench-dock-toggle-left"]');
    if (leftDockToggle instanceof HTMLElement) {
      fireEvent.click(leftDockToggle);
    }

    // Student manually collapses inputs.
    fireEvent.click(getByTestId('ide-verify-group-toggle-inputs'));
    expect(getWaveformOrder(container)).not.toContain('sw0');
    expect(getWaveformOrder(container)).not.toContain('sw1');

    // Re-rendering the same run should preserve student choice.
    rerender(<VerifySurface {...props} />);
    expect(getWaveformOrder(container)).not.toContain('sw0');
    expect(getWaveformOrder(container)).not.toContain('sw1');
  });

  it('prioritizes selected failures, peer failures, probes, and manual pins in one ordering model', () => {
    const { container, getAllByText, getByTestId } = render(
      <VerifySurface
        deterministicHash="det_wave_priority"
        hasVectors={true}
        lastRun={makeWaveformPriorityRun()}
        vectors={makeWaveformPriorityRun().report.vectors}
        probeSignals={[{ key: 'tap', label: 'Tap probe' }]}
        mappedInputs={[
          { id: 'sw0', label: 'SW0' },
          { id: 'sw1', label: 'SW1' },
        ]}
        mappedSignals={[
          { id: 'sw0', label: 'SW0', direction: 'in' },
          { id: 'sw1', label: 'SW1', direction: 'in' },
          { id: 'carry', label: 'Carry', direction: 'out' },
          { id: 'sum', label: 'Sum', direction: 'out' },
          { id: 'flag', label: 'Flag', direction: 'out' },
        ]}
        onOpenProjectVectors={vi.fn()}
      />
    );

    fireEvent.click(getByTestId('ide-verify-drawer-toggle'));
    fireEvent.click(getAllByText('Details')[0]);
    expect(getByTestId('ide-verify-run-context-ticks_shown').textContent).toContain('Showing t0-t6 (fail window)');
    expect(getByTestId('ide-verify-run-context-why_these_ticks').textContent).toContain('t1');

    fireEvent.click(getByTestId('ide-workbench-dock-toggle-left'));

    // Inputs group is collapsed by default; expand it so inputs appear in the signal list and waveform lanes.
    fireEvent.click(getByTestId('ide-verify-group-toggle-inputs'));

    expect(getSignalListOrder(container)).toEqual(['sw0', 'sw1', 'carry', 'sum', 'flag']);
    expect(getWaveformOrder(container).slice(0, 5)).toEqual(['carry', 'sum', 'flag', 'sw0', 'sw1']);

    fireEvent.click(getByTestId('ide-verify-pin-signal-flag'));
    expect(getSignalListOrder(container)).toEqual(['sw0', 'sw1', 'flag', 'carry', 'sum']);
    expect(getWaveformOrder(container).slice(0, 5)).toEqual(['flag', 'carry', 'sum', 'sw0', 'sw1']);

    fireEvent.click(getByTestId('ide-verify-failure-sum_8'));
    expect(getSignalListOrder(container)).toEqual(['sw0', 'sw1', 'flag', 'sum', 'carry']);
    expect(getWaveformOrder(container).slice(0, 5)).toEqual(['flag', 'sum', 'carry', 'sw0', 'sw1']);
    expect(getByTestId('ide-verify-run-context-ticks_shown').textContent).toContain('Showing t2-t8 (fail window)');
    expect(getByTestId('ide-verify-run-context-why_these_ticks').textContent).toContain('t8');
  });

  it('keeps the secondary assertion grid in sync with the fail-window waveform viewport', () => {
    const { getAllByText, getByTestId, queryByTestId } = render(
      <VerifySurface
        deterministicHash="det_wave_priority"
        hasVectors={true}
        lastRun={makeWaveformPriorityRun()}
        vectors={makeWaveformPriorityRun().report.vectors}
        probeSignals={[{ key: 'tap', label: 'Tap probe' }]}
        mappedInputs={[
          { id: 'sw0', label: 'SW0' },
          { id: 'sw1', label: 'SW1' },
        ]}
        mappedSignals={[
          { id: 'sw0', label: 'SW0', direction: 'in' },
          { id: 'sw1', label: 'SW1', direction: 'in' },
          { id: 'carry', label: 'Carry', direction: 'out' },
          { id: 'sum', label: 'Sum', direction: 'out' },
          { id: 'flag', label: 'Flag', direction: 'out' },
        ]}
        onOpenProjectVectors={vi.fn()}
      />
    );

    expect(queryByTestId('ide-assertion-canvas')).toBeNull();
    fireEvent.click(getByTestId('ide-workbench-dock-toggle-left'));
    fireEvent.click(getByTestId('ide-verify-drawer-toggle'));
    fireEvent.click(getAllByText('Details')[0]);
    fireEvent.click(getByTestId('ide-verify-failure-sum_8'));

    const assertionCanvas = getByTestId('ide-assertion-canvas');
    const assertionScope = within(assertionCanvas);
    expect(assertionScope.getByText('t2')).toBeInTheDocument();
    expect(assertionScope.getByText('t8')).toBeInTheDocument();
    expect(assertionScope.queryByText('t0')).not.toBeInTheDocument();
    expect(assertionScope.queryByText('t1')).not.toBeInTheDocument();
  });
});
