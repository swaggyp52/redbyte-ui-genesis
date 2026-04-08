// @vitest-environment jsdom
// B-14 Slice 2 — Desktop composition: unified header, compressed result zone
// Contract: one command bar (not two), no redundant IO text above canvas,
// result evidence collapsed into compact strip.
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
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
  it('renders exactly one VerifyCommandBar (ide-verify-command-bar)', () => {
    const { container } = render(<VerifySurface {...BASE_PROPS} />);
    const commandBars = container.querySelectorAll('[data-testid="ide-verify-command-bar"]');
    expect(commandBars.length).toBe(1);
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

  it('VerifyCommandBar shows pass/fail metrics post-run via evidence strip', () => {
    const { getByTestId } = render(
      <VerifySurface {...BASE_PROPS} lastRun={makePassRun()} />
    );
    // Evidence strip renders compact metrics in the command bar area
    expect(getByTestId('ide-vcb-evidence')).toBeTruthy();
  });

  it('result region collapse: pass hero is demoted post-run', () => {
    const { queryByTestId } = render(
      <VerifySurface {...BASE_PROPS} lastRun={makePassRun()} />
    );
    // Pass hero should be inside a collapsible details or absent from dominant position
    // For this slice: pass hero moves inside a <details> so it doesn't dominate
    const passHero = queryByTestId('ide-verify-pass-hero');
    if (passHero) {
      // If it exists, it should be inside a details element (collapsed by default)
      const parentDetails = passHero.closest('details');
      expect(parentDetails).toBeTruthy();
    }
    // Either absent or inside details is acceptable
  });
});
