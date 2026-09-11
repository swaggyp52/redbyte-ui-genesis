// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { VerifySurface } from '../surfaces/VerifySurface';
import { workspacePreferencesStore } from '../workspacePreferences';
import type { RuntimeVerifyRun } from '../projectRuntime';

/**
 * One experiment has one primary working area.
 *
 * This replaces the Cases/Evidence deck composition (P2.5H Wave One): a resizable splitter, a
 * persisted share, collapse, and maximize-either-pane. That composition existed because two
 * instruments were on screen at once and had to be given room at each other's expense. There is
 * one instrument now — the timeline, the case table, or the recorded trace, whichever the reader
 * chose — with a run line under it that is as tall as the sentence it has to say, so there is
 * nothing left to split, collapse or maximize.
 *
 * What is asserted here is the contract that replaced it: exactly one primary region, a switch
 * that names what fills it, a choice remembered per scenario, and a run line that says what the
 * last run did — including when there has not been one.
 */
const SIGNALS = [
  { id: 'a_0', label: 'A[0]', direction: 'in' as const, nodeId: 'a0' },
  { id: 'sum_0', label: 'SUM[0]', direction: 'out' as const, nodeId: 'sum0' },
];
const VECTORS = [
  { id: 'v0', tick: 0, inputs: { a_0: 0 as const }, expected: { sum_0: 0 as const } },
  { id: 'v1', tick: 1, inputs: { a_0: 1 as const }, expected: { sum_0: 1 as const } },
];

function makeRun(): RuntimeVerifyRun {
  const rows = [
    { tick: 0, signal: 'sum_0', expected: '0', actual: '0', status: 'pass' as const },
    { tick: 1, signal: 'sum_0', expected: '1', actual: '1', status: 'pass' as const },
  ];
  return {
    projectId: 'rb-test',
    scenarioId: 'one-area',
    scenarioName: 'One Area',
    runKind: 'verify',
    status: 'pass',
    firstFailingTick: null,
    deterministicHash: 'evidence-deck',
    reportHash: 'one-area-report',
    generatedAtIso: '2026-09-07T07:00:00.000Z',
    schedule: 'combinational',
    meta: {} as RuntimeVerifyRun['meta'],
    report: {
      schemaVersion: 'rb.verify-report.v1',
      scenarioId: 'one-area',
      scenarioName: 'One Area',
      status: 'pass',
      deterministicHash: 'evidence-deck',
      firstFailingTick: null,
      rows,
      vectors: VECTORS.map((vector) => ({ ...vector })),
      inputsAtTick: { 0: { a_0: 0 }, 1: { a_0: 1 } },
      signalRoles: { a_0: 'input', sum_0: 'output' },
      generatedAtIso: '2026-09-07T07:00:00.000Z',
      reportHash: 'one-area-report',
    },
    waveform: [
      { tick: 0, signals: { a_0: '0', sum_0: '0' }, mismatches: [] },
      { tick: 1, signals: { a_0: '1', sum_0: '1' }, mismatches: [] },
    ],
  } as unknown as RuntimeVerifyRun;
}

function renderSurface(lastRun?: RuntimeVerifyRun) {
  return render(
    <VerifySurface
      hasVectors
      vectors={VECTORS}
      mappedInputs={[{ id: 'a_0', label: 'A[0]' }]}
      mappedSignals={SIGNALS}
      onOpenProjectVectors={vi.fn()}
      onVectorsChange={vi.fn()}
      deterministicHash="evidence-deck"
      verifyMode="combinational"
      lastRun={lastRun}
    />
  );
}

describe('Simulate composition — one experiment, one primary working area', () => {
  beforeEach(() => {
    workspacePreferencesStore.resetSimulateLayout();
    try {
      window.sessionStorage.clear();
    } catch {
      /* jsdom without storage */
    }
    cleanup();
  });

  it('has one primary region and one run line, and no deck to divide between them', () => {
    const { getByTestId, queryByTestId } = renderSurface();

    expect(getByTestId('ide-verify-lab-grid')).toBeTruthy();
    expect(getByTestId('ide-verify-run-line')).toBeTruthy();

    // The splitter, the collapse, the two maximize buttons and the collapsed strip went out
    // with the deck they divided. None of them has a replacement.
    expect(queryByTestId('ide-verify-deck-handle')).toBeNull();
    expect(queryByTestId('ide-verify-deck-collapse')).toBeNull();
    expect(queryByTestId('ide-verify-deck-maximize-cases')).toBeNull();
    expect(queryByTestId('ide-verify-deck-maximize-waveform')).toBeNull();
    expect(queryByTestId('ide-verify-deck-reset')).toBeNull();
    expect(queryByTestId('ide-verify-evidence-strip')).toBeNull();
  });

  it('names what fills the primary area, and the circuit chooses the default', () => {
    const { getByTestId } = renderSurface();

    // A combinational circuit is read as a table; a clocked one on a time axis. This one has
    // no clock, so the table is what the reader gets without asking.
    expect(getByTestId('ide-verify-lab-grid').getAttribute('data-representation')).toBe('table');
    expect(getByTestId('ide-verify-view-table').getAttribute('aria-pressed')).toBe('true');
    expect(getByTestId('ide-verify-view-timeline').getAttribute('aria-pressed')).toBe('false');
  });

  it('offers the recorded trace only once there is one, and says so before then', () => {
    const withoutRun = renderSurface();
    expect(withoutRun.getByTestId('ide-verify-view-waveform').hasAttribute('disabled')).toBe(true);
    expect(withoutRun.getByTestId('ide-verify-representation-note').textContent).toContain(
      'no recorded run yet'
    );
    // Unrecorded is not zero: the run line says which it is.
    expect(withoutRun.getByTestId('ide-verify-run-line-empty').textContent).toContain(
      'No run recorded yet'
    );
    cleanup();

    const withRun = renderSurface(makeRun());
    expect(withRun.getByTestId('ide-verify-view-waveform').hasAttribute('disabled')).toBe(false);
    expect(withRun.queryByTestId('ide-verify-run-line-empty')).toBeNull();
    expect(withRun.getByTestId('ide-verify-results-summary')).toBeTruthy();
  });

  it('draws exactly one representation at a time, and the trace tools go with the trace', () => {
    const { getByTestId, queryByTestId } = renderSurface(makeRun());

    expect(getByTestId('ide-case-lab')).toBeTruthy();
    expect(queryByTestId('ide-timing-lanes')).toBeNull();
    expect(queryByTestId('ide-verify-waveform-preview')).toBeNull();
    // Case stepping, the tick range, the radix, the expected overlay and the scrubber all
    // describe a drawn trace, so none of them is on screen while the table is.
    expect(queryByTestId('ide-verify-waveform-cmd')).toBeNull();
    expect(queryByTestId('ide-verify-tick-scrubber')).toBeNull();

    act(() => {
      fireEvent.click(getByTestId('ide-verify-view-timeline'));
    });
    expect(getByTestId('ide-verify-lab-grid').getAttribute('data-representation')).toBe('timeline');
    expect(getByTestId('ide-timing-lanes')).toBeTruthy();
    expect(queryByTestId('ide-case-lab')).toBeNull();
    expect(queryByTestId('ide-verify-waveform-preview')).toBeNull();

    act(() => {
      fireEvent.click(getByTestId('ide-verify-view-waveform'));
    });
    expect(getByTestId('ide-verify-lab-grid').getAttribute('data-representation')).toBe('waveform');
    expect(getByTestId('ide-verify-waveform-preview')).toBeTruthy();
    expect(getByTestId('ide-verify-waveform-cmd')).toBeTruthy();
    expect(queryByTestId('ide-timing-lanes')).toBeNull();
    expect(queryByTestId('ide-case-lab')).toBeNull();

    // The switch is in the primary region whichever representation fills it, so the way back
    // is where the way in was.
    act(() => {
      fireEvent.click(getByTestId('ide-verify-view-table'));
    });
    expect(getByTestId('ide-verify-lab-grid').getAttribute('data-representation')).toBe('table');
    expect(getByTestId('ide-case-lab')).toBeTruthy();
  });

  it('keeps the run line in every representation, because it is what the run did', () => {
    const { getByTestId } = renderSurface(makeRun());

    expect(getByTestId('ide-verify-run-line')).toBeTruthy();
    act(() => {
      fireEvent.click(getByTestId('ide-verify-view-timeline'));
    });
    expect(getByTestId('ide-verify-run-line')).toBeTruthy();
    act(() => {
      fireEvent.click(getByTestId('ide-verify-view-waveform'));
    });
    expect(getByTestId('ide-verify-run-line')).toBeTruthy();
    expect(getByTestId('ide-verify-results-summary')).toBeTruthy();
  });
});
