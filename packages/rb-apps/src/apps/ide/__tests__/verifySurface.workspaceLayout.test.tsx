// @vitest-environment jsdom
// B-14 Slice 3 — Side-by-side workspace layout
// Contract: stimulus panel (left, fixed width) + waveform panel (right, fill)
// are co-located inside a workspace container BELOW the result/header zones.
// This guards the structural change that fixes the CSS order bug (result at order:0
// rendering before the command bar) and the single-column stacking that collapses
// the waveform to a sliver during failure debugging.
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
  deterministicHash: 'wl-test',
  verifyMode: 'combinational' as const,
};

function makeFailRun(): RuntimeVerifyRun {
  return {
    scenarioId: 'fail-scenario',
    scenarioName: 'Fail Scenario',
    status: 'fail',
    deterministicHash: 'wl-test',
    reportHash: 'rep-fail',
    generatedAtIso: '2026-04-08T00:00:00.000Z',
    firstFailingTick: 0,
    schedule: 'combinational',
    meta: {
      circuitKind: 'combinational',
      clockingProtocol: null,
      samplePoint: 'steady-state',
      tick0Meaning: null,
      clockSignalName: null,
    },
    report: {
      rows: [{ tick: 0, signal: 'ld0', expected: '1', actual: '0', status: 'fail' }],
    } as RuntimeVerifyRun['report'],
    waveform: [],
  };
}

describe('B-14 Slice 3 — Side-by-side workspace layout', () => {
  it('renders a dedicated workspace container for stimulus + waveform', () => {
    const { getByTestId } = render(<VerifySurface {...BASE_PROPS} />);
    expect(getByTestId('ide-verify-workspace')).toBeTruthy();
  });

  it('places the stimulus region inside the workspace container', () => {
    const { getByTestId } = render(<VerifySurface {...BASE_PROPS} />);
    const workspace = getByTestId('ide-verify-workspace');
    const stimulus = getByTestId('ide-verify-region-stimulus');
    expect(workspace.contains(stimulus)).toBe(true);
  });

  it('places the waveform region inside the workspace container', () => {
    const { getByTestId } = render(<VerifySurface {...BASE_PROPS} />);
    const workspace = getByTestId('ide-verify-workspace');
    const waveform = getByTestId('ide-verify-region-waveform');
    expect(workspace.contains(waveform)).toBe(true);
  });

  it('keeps the header region outside the workspace container', () => {
    const { getByTestId } = render(<VerifySurface {...BASE_PROPS} />);
    const workspace = getByTestId('ide-verify-workspace');
    const header = getByTestId('ide-verify-region-header');
    expect(workspace.contains(header)).toBe(false);
  });

  it('keeps the result region outside the workspace container', () => {
    const { getByTestId } = render(
      <VerifySurface {...BASE_PROPS} lastRun={makeFailRun()} />
    );
    const workspace = getByTestId('ide-verify-workspace');
    const result = getByTestId('ide-verify-region-result');
    expect(workspace.contains(result)).toBe(false);
  });

  it('workspace container is a sibling of the result region, not nested', () => {
    const { getByTestId } = render(
      <VerifySurface {...BASE_PROPS} lastRun={makeFailRun()} />
    );
    const workspace = getByTestId('ide-verify-workspace');
    const result = getByTestId('ide-verify-region-result');
    // Both are direct children of the same parent (the verify panel body)
    expect(workspace.parentElement).toBe(result.parentElement);
  });

  it('workspace container has the ide-verify-workspace CSS class for layout targeting', () => {
    const { getByTestId } = render(<VerifySurface {...BASE_PROPS} />);
    const workspace = getByTestId('ide-verify-workspace');
    expect(workspace.className).toContain('ide-verify-workspace');
  });
});
