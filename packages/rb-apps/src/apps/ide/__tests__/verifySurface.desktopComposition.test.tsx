// @vitest-environment jsdom
// B-14 Slice 2 — Desktop composition: unified header, compressed result zone
// Contract: one command bar (not two), no redundant IO text above canvas,
// result evidence collapsed into compact strip.
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import type { RuntimeVerifyRun } from '../projectRuntime';
import { VerifySurface } from '../surfaces/VerifySurface';

const BASE_PROPS = {
  hasVectors: true,
  vectors: [{ id: 'v0', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } }],
  mappedInputs: [{ id: 'sw0', label: 'SW0' }],
  mappedSignals: [
    { id: 'sw0', label: 'SW0', direction: 'in' as const },
    { id: 'ld0', label: 'LD0', direction: 'out' as const },
  ],
  onOpenProjectVectors: vi.fn(),
  onVectorsChange: vi.fn(),
  deterministicHash: 'comp-test',
  verifyMode: 'combinational' as const,
};

function makePassRun(): RuntimeVerifyRun {
  return {
    scenarioId: 'pass-scenario',
    scenarioName: 'Pass Scenario',
    status: 'pass',
    deterministicHash: 'comp-test',
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
      ],
      inputsAtTick: { 0: { sw0: 0 } },
      inputsByVectorId: { 'vec-01': { sw0: 0 } },
      signalRoles: { sw0: 'input', ld0: 'output' },
      rows: [
        { tick: 0, signal: 'ld0', expected: '0', actual: '0', status: 'pass', vectorId: 'vec-01', caseIndex: 0 },
      ],
    } as RuntimeVerifyRun['report'],
    waveform: [
      { tick: 0, signals: { sw0: '0', ld0: '0' }, mismatches: [] },
    ],
  };
}

describe('B-14 Slice 2 — Desktop composition: unified header', () => {
  it('steps the shared verify command strip aside once authored stimulus exists', () => {
    const { getByTestId, queryByTestId } = render(<VerifySurface {...BASE_PROPS} />);

    expect(queryByTestId('ide-verify-command-strip')).toBeNull();
    expect(getByTestId('ide-verify-command-bar')).toBeTruthy();
  });

  it('guides a no-circuit cold start instead of presenting a runnable command bar', () => {
    const { queryByTestId, getByTestId } = render(
      <VerifySurface
        deterministicHash="comp-empty"
        hasVectors={false}
        vectors={[]}
        mappedInputs={[]}
        mappedSignals={[]}
        onOpenProjectVectors={vi.fn()}
        onVectorsChange={vi.fn()}
        verifyMode="combinational"
      />
    );

    expect(queryByTestId('ide-verify-command-strip')).toBeNull();
    expect(queryByTestId('ide-verify-command-bar')).toBeNull();
    expect(getByTestId('ide-verify-no-circuit-task')).toBeTruthy();
  });

  it('renders exactly one VerifyCommandBar (ide-verify-command-bar)', () => {
    const { container, queryByTestId } = render(<VerifySurface {...BASE_PROPS} />);
    const commandBars = container.querySelectorAll('[data-testid="ide-verify-command-bar"]');
    expect(commandBars.length).toBe(1);
    expect(queryByTestId('ide-verify-banner')).toBeNull();
  });

  it('does not render the old verbose status strip actions in header region', () => {
    const { queryByTestId } = render(
      <VerifySurface {...BASE_PROPS} lastRun={makePassRun()} />
    );
    // The old status strip had inline run buttons and advanced debug details
    // These must no longer appear inside the header
    expect(queryByTestId('ide-verify-advanced-debug')).toBeNull();
  });

  it('does not render redundant zone label above canvas', () => {
    const { container } = render(<VerifySurface {...BASE_PROPS} />);
    // The old "Test Vectors" zone label (h4) should not exist
    const zoneLabels = container.querySelectorAll('[data-zone="vectors"]');
    expect(zoneLabels.length).toBe(0);
  });

  it('does not render plain-text IO summary above canvas', () => {
    const { queryByTestId } = render(<VerifySurface {...BASE_PROPS} />);
    expect(queryByTestId('ide-verify-io-summary')).toBeNull();
  });

  it('does not render pre-run lanes chips above canvas', () => {
    const { queryByTestId } = render(<VerifySurface {...BASE_PROPS} />);
    expect(queryByTestId('ide-verify-prerun-lanes')).toBeNull();
  });

  it('shows pass/fail metrics in Results instead of the run command bar', () => {
    const { getByTestId } = render(
      <VerifySurface {...BASE_PROPS} lastRun={makePassRun()} />
    );
    expect(getByTestId('ide-verify-results-summary').getAttribute('role')).toBeNull();
    expect(getByTestId('ide-verify-results-summary').getAttribute('aria-live')).toBeNull();
    expect(getByTestId('ide-verify-results-summary-metrics')).toBeTruthy();
    expect(getByTestId('ide-verify-results-summary-metric-passed')).toBeTruthy();
  });

  it('keeps one dedicated announcer mounted and changes its text for distinct runs with identical outcomes', async () => {
    const view = render(<VerifySurface {...BASE_PROPS} />);
    const announcer = view.getByTestId('ide-verify-run-announcer');

    expect(announcer.getAttribute('role')).toBe('status');
    expect(announcer.getAttribute('aria-live')).toBe('polite');
    expect(announcer.textContent).toBe('');

    const firstPass = makePassRun();
    view.rerender(<VerifySurface {...BASE_PROPS} lastRun={firstPass} />);
    await waitFor(() => expect(announcer.textContent).toContain('Verification run 1. Compare passed.'));
    const firstAnnouncement = announcer.textContent;
    expect(view.getByTestId('ide-verify-run-announcer')).toBe(announcer);
    expect(view.getByTestId('ide-verify-results-summary').getAttribute('role')).toBeNull();

    view.rerender(<VerifySurface {...BASE_PROPS} lastRun={firstPass} />);
    expect(announcer.textContent).toBe(firstAnnouncement);

    view.rerender(
      <VerifySurface
        {...BASE_PROPS}
        lastRun={{ ...firstPass }}
      />
    );
    await waitFor(() => expect(announcer.textContent).toContain('Verification run 2. Compare passed.'));
    expect(view.getByTestId('ide-verify-run-announcer')).toBe(announcer);
    expect(announcer.textContent).not.toBe(firstAnnouncement);

    view.rerender(<VerifySurface {...BASE_PROPS} />);
    await waitFor(() => expect(announcer.textContent).toBe(''));
    expect(view.getByTestId('ide-verify-run-announcer')).toBe(announcer);
  });

  it('does not duplicate post-run metrics in the compact status strip once the command bar owns evidence', () => {
    const { queryByTestId } = render(
      <VerifySurface {...BASE_PROPS} lastRun={makePassRun()} />
    );

    expect(queryByTestId('ide-verify-strip-pass-count')).toBeNull();
    expect(queryByTestId('ide-verify-strip-fail-count')).toBeNull();
    expect(queryByTestId('ide-verify-coverage-meter')).toBeNull();
  });

  it('surfaces pass run evidence as the primary proof block (not hidden behind disclosure)', () => {
    const { getByTestId } = render(
      <VerifySurface {...BASE_PROPS} lastRun={makePassRun()} />
    );
    const passHero = getByTestId('ide-verify-pass-hero');
    expect(passHero.closest('details')).toBeNull();
    expect(passHero.textContent?.length ?? 0).toBeGreaterThan(20);
  });
});
