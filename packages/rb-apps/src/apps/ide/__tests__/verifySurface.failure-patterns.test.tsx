// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import type { RuntimeVerifyRun } from '../projectRuntime';
import { VerifySurface } from '../surfaces/VerifySurface';

function renderVerify(run: RuntimeVerifyRun) {
  const result = render(
    <VerifySurface
      deterministicHash={run.deterministicHash}
      hasVectors={true}
      lastRun={run}
      vectors={run.report.vectors as never}
      onOpenProjectVectors={vi.fn()}
      onFixPath={vi.fn()}
    />
  );
  // The failure explainer lives inside the analysis drawer (mismatches tab).
  // For fail+verify runs the tab auto-switches to 'mismatches'; open the drawer to render it.
  fireEvent.click(result.getByTestId('ide-verify-drawer-toggle'));
  return result;
}

function makeRepeatedFailureRun(): RuntimeVerifyRun {
  return {
    scenarioId: 'repeat-pattern',
    scenarioName: 'Repeated output failure',
    status: 'fail',
    deterministicHash: 'det_repeat_pattern',
    reportHash: 'rep_repeat_pattern',
    firstFailingTick: 2,
    generatedAtIso: '2026-03-08T18:00:00.000Z',
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
        { id: 'vec-00', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
        { id: 'vec-02', tick: 2, inputs: { sw0: 1 }, expected: { ld0: 1 } },
        { id: 'vec-04', tick: 4, inputs: { sw0: 1 }, expected: { ld0: 1 } },
      ],
      inputsAtTick: {
        0: { sw0: 0 },
        2: { sw0: 1 },
        4: { sw0: 1 },
      },
      signalRoles: {
        sw0: 'input',
        ld0: 'output',
      },
      rows: [
        { tick: 0, signal: 'ld0', expected: '0', actual: '0', status: 'pass' },
        { tick: 2, signal: 'ld0', expected: '1', actual: '0', status: 'fail' },
        { tick: 4, signal: 'ld0', expected: '1', actual: '0', status: 'fail' },
      ],
    } as RuntimeVerifyRun['report'],
    waveform: [
      { tick: 0, signals: { sw0: '0', ld0: '0' }, mismatches: [] },
      { tick: 2, signals: { sw0: '1', ld0: '0' }, mismatches: [{ signal: 'ld0', expected: '1', actual: '0' }] },
      { tick: 4, signals: { sw0: '1', ld0: '0' }, mismatches: [{ signal: 'ld0', expected: '1', actual: '0' }] },
    ],
  };
}

function makeGroupedFailureRun(): RuntimeVerifyRun {
  return {
    scenarioId: 'group-pattern',
    scenarioName: 'Grouped peer failure',
    status: 'fail',
    deterministicHash: 'det_group_pattern',
    reportHash: 'rep_group_pattern',
    firstFailingTick: 3,
    generatedAtIso: '2026-03-08T18:01:00.000Z',
    schedule: 'clocked_macro',
    meta: {
      circuitKind: 'sequential',
      clockingProtocol: 'clocked_macro',
      samplePoint: 'post-rising-edge',
      tick0Meaning: 'initial-state',
      clockSignalName: 'clk',
    },
    report: {
      vectors: [
        { id: 'vec-00', tick: 0, inputs: { clk: 0, en: 0 }, expected: { ld0: 0, ld1: 0 } },
        { id: 'vec-03', tick: 3, inputs: { clk: 1, en: 1 }, expected: { ld0: 1, ld1: 0 } },
      ],
      inputsAtTick: {
        0: { clk: 0, en: 0 },
        3: { clk: 1, en: 1 },
      },
      signalRoles: {
        clk: 'clock',
        en: 'input',
        ld0: 'output',
        ld1: 'output',
      },
      rows: [
        { tick: 0, signal: 'ld0', expected: '0', actual: '0', status: 'pass' },
        { tick: 0, signal: 'ld1', expected: '0', actual: '0', status: 'pass' },
        { tick: 3, signal: 'ld0', expected: '1', actual: '0', status: 'fail' },
        { tick: 3, signal: 'ld1', expected: '0', actual: '1', status: 'fail' },
      ],
    } as RuntimeVerifyRun['report'],
    waveform: [
      { tick: 0, signals: { clk: '0', en: '0', ld0: '0', ld1: '0' }, mismatches: [] },
      {
        tick: 3,
        signals: { clk: '1', en: '1', ld0: '0', ld1: '1' },
        mismatches: [
          { signal: 'ld0', expected: '1', actual: '0' },
          { signal: 'ld1', expected: '0', actual: '1' },
        ],
      },
    ],
  };
}

function makeDelayedFailureRun(): RuntimeVerifyRun {
  return {
    scenarioId: 'delayed-pattern',
    scenarioName: 'Delayed divergence',
    status: 'fail',
    deterministicHash: 'det_delayed_pattern',
    reportHash: 'rep_delayed_pattern',
    firstFailingTick: 5,
    generatedAtIso: '2026-03-08T18:02:00.000Z',
    schedule: 'clocked_macro',
    meta: {
      circuitKind: 'sequential',
      clockingProtocol: 'clocked_macro',
      samplePoint: 'post-rising-edge',
      tick0Meaning: 'initial-state',
      clockSignalName: 'clk',
    },
    report: {
      vectors: [
        { id: 'vec-00', tick: 0, inputs: { clk: 0, en: 0 }, expected: { ld0: 0 } },
        { id: 'vec-02', tick: 2, inputs: { clk: 1, en: 1 }, expected: { ld0: 1 } },
        { id: 'vec-05', tick: 5, inputs: { clk: 1, en: 1 }, expected: { ld0: 0 } },
      ],
      inputsAtTick: {
        0: { clk: 0, en: 0 },
        2: { clk: 1, en: 1 },
        5: { clk: 1, en: 1 },
      },
      signalRoles: {
        clk: 'clock',
        en: 'input',
        ld0: 'output',
      },
      rows: [
        { tick: 0, signal: 'ld0', expected: '0', actual: '0', status: 'pass' },
        { tick: 2, signal: 'ld0', expected: '1', actual: '1', status: 'pass' },
        { tick: 5, signal: 'ld0', expected: '0', actual: '1', status: 'fail' },
      ],
    } as RuntimeVerifyRun['report'],
    waveform: [
      { tick: 0, signals: { clk: '0', en: '0', ld0: '0' }, mismatches: [] },
      { tick: 2, signals: { clk: '1', en: '1', ld0: '1' }, mismatches: [] },
      { tick: 5, signals: { clk: '1', en: '1', ld0: '1' }, mismatches: [{ signal: 'ld0', expected: '0', actual: '1' }] },
    ],
  };
}

function makeStartupFailureRun(): RuntimeVerifyRun {
  return {
    scenarioId: 'startup-pattern',
    scenarioName: 'Startup failure',
    status: 'fail',
    deterministicHash: 'det_startup_pattern',
    reportHash: 'rep_startup_pattern',
    firstFailingTick: 0,
    generatedAtIso: '2026-03-08T18:03:00.000Z',
    schedule: 'clocked_macro',
    meta: {
      circuitKind: 'sequential',
      clockingProtocol: 'clocked_macro',
      samplePoint: 'post-rising-edge',
      tick0Meaning: 'initial-state',
      clockSignalName: 'clk',
    },
    report: {
      vectors: [
        { id: 'vec-00', tick: 0, inputs: { clk: 0, rst: 1 }, expected: { ld0: 0 } },
        { id: 'vec-01', tick: 1, inputs: { clk: 1, rst: 0 }, expected: { ld0: 1 } },
      ],
      inputsAtTick: {
        0: { clk: 0, rst: 1 },
        1: { clk: 1, rst: 0 },
      },
      signalRoles: {
        clk: 'clock',
        rst: 'reset',
        ld0: 'output',
      },
      rows: [
        { tick: 0, signal: 'ld0', expected: '0', actual: '1', status: 'fail' },
        { tick: 1, signal: 'ld0', expected: '1', actual: '1', status: 'pass' },
      ],
    } as RuntimeVerifyRun['report'],
    waveform: [
      { tick: 0, signals: { clk: '0', rst: '1', ld0: '1' }, mismatches: [{ signal: 'ld0', expected: '0', actual: '1' }] },
      { tick: 1, signals: { clk: '1', rst: '0', ld0: '1' }, mismatches: [] },
    ],
  };
}

function makePassRun(): RuntimeVerifyRun {
  return {
    scenarioId: 'pass-pattern',
    scenarioName: 'Pass run',
    status: 'pass',
    deterministicHash: 'det_pass_pattern',
    reportHash: 'rep_pass_pattern',
    generatedAtIso: '2026-03-08T18:04:00.000Z',
    schedule: 'combinational',
    meta: {
      circuitKind: 'combinational',
      clockingProtocol: null,
      samplePoint: 'steady-state',
      tick0Meaning: null,
      clockSignalName: null,
    },
    report: {
      vectors: [{ id: 'vec-00', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } }],
      inputsAtTick: { 0: { sw0: 0 } },
      signalRoles: { sw0: 'input', ld0: 'output' },
      rows: [{ tick: 0, signal: 'ld0', expected: '0', actual: '0', status: 'pass' }],
    } as RuntimeVerifyRun['report'],
    waveform: [{ tick: 0, signals: { sw0: '0', ld0: '0' }, mismatches: [] }],
  };
}

describe('VerifySurface failure pattern explainer', () => {
  it('describes repeated single-output failures as localized and repeated', () => {
    const { getByTestId } = renderVerify(makeRepeatedFailureRun());

    expect(getByTestId('ide-verify-explainer-pattern-summary').textContent).toContain(
      'localized to ld0'
    );
    expect(getByTestId('ide-verify-explainer-pattern-summary').textContent).toContain(
      'repeatedly across 2 ticks'
    );
    expect(getByTestId('ide-verify-explainer-pattern-next').textContent).toContain(
      'Trace the logic driving ld0'
    );
  });

  it('describes same-tick grouped failures as shared-control style patterns', () => {
    const { getByTestId } = renderVerify(makeGroupedFailureRun());

    expect(getByTestId('ide-verify-explainer-pattern-summary').textContent).toContain(
      'occur together at t3'
    );
    expect(getByTestId('ide-verify-explainer-pattern-summary').textContent).toContain(
      'shared control, state, or decode path'
    );
  });

  it('describes later first failures as delayed divergence', () => {
    const { getByTestId } = renderVerify(makeDelayedFailureRun());

    expect(getByTestId('ide-verify-explainer-pattern-summary').textContent).toContain(
      'passes at first, then diverges later at t5'
    );
    expect(getByTestId('ide-verify-explainer-pattern-next').textContent).toContain(
      'Compare the last passing tick to t5'
    );
  });

  it('mentions startup and reset only when supported by sequential meta and signal roles', () => {
    const { getByTestId } = renderVerify(makeStartupFailureRun());

    expect(getByTestId('ide-verify-explainer-pattern-summary').textContent).toContain(
      'appears immediately at startup'
    );
    expect(getByTestId('ide-verify-explainer-pattern-next').textContent).toContain(
      'Inspect reset level/polarity'
    );
  });

  it('does not render a failure pattern summary on pass runs', () => {
    const { queryByTestId } = renderVerify(makePassRun());

    expect(queryByTestId('ide-verify-explainer-pattern')).toBeNull();
  });
});
