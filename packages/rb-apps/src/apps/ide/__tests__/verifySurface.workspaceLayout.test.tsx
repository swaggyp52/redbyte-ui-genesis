// @vitest-environment jsdom
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
      schemaVersion: 'rb.verify-report.v1',
      scenarioId: 'fail-scenario',
      scenarioName: 'Fail Scenario',
      status: 'fail',
      deterministicHash: 'wl-test',
      firstFailingTick: 0,
      rows: [{ tick: 0, signal: 'ld0', expected: '1', actual: '0', status: 'fail' }],
      vectors: [{ id: 'v0', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 1 }, caseIndex: 0 }],
      inputsAtTick: { 0: { sw0: 0 } },
      signalRoles: { sw0: 'input', ld0: 'output' },
      generatedAtIso: '2026-04-08T00:00:00.000Z',
      reportHash: 'rep-fail',
    },
    waveform: [],
  };
}

describe('VerifySurface workspace layout', () => {
  it('renders a dedicated workspace container for stimulus + waveform', () => {
    const { getByTestId } = render(<VerifySurface {...BASE_PROPS} />);
    expect(getByTestId('ide-verify-workspace')).toBeTruthy();
  });

  it('keeps the signal browser stable without collapse or edge toggles', () => {
    const { getByTestId, queryByTestId } = render(<VerifySurface {...BASE_PROPS} />);
    const dock = getByTestId('ide-verify-left-dock');

    expect(dock.getAttribute('data-collapsed')).toBe('false');
    expect(queryByTestId('ide-verify-signal-rail-toggle')).toBeNull();
    expect(queryByTestId('ide-workbench-dock-toggle-left')).toBeNull();
    expect(getByTestId('ide-verify-signal-list')).toBeTruthy();
  });

  it('keeps the workspace container focused on the paired lab regions without a story banner', () => {
    const { getByTestId, queryByTestId } = render(<VerifySurface {...BASE_PROPS} />);
    const workspace = getByTestId('ide-verify-workspace');
    const labGrid = getByTestId('ide-verify-lab-grid');

    expect(queryByTestId('ide-verify-workspace-story')).toBeNull();
    expect(workspace.contains(labGrid)).toBe(true);
  });

  it('places the stimulus and waveform regions inside the same lab grid', () => {
    const { getByTestId } = render(<VerifySurface {...BASE_PROPS} />);
    const labGrid = getByTestId('ide-verify-lab-grid');
    expect(labGrid).toHaveAttribute('data-verify-workflow-phase', 'pre-run');
    expect(labGrid).toHaveAttribute('data-workspace-mode', 'stimulus-focus');
    expect(labGrid.contains(getByTestId('ide-verify-region-stimulus'))).toBe(true);
    expect(labGrid.contains(getByTestId('ide-verify-region-waveform'))).toBe(true);
    expect(getByTestId('ide-verify-waveform-placeholder')).toBeTruthy();
    expect(getByTestId('ide-verify-waveform-placeholder-ready')).toBeTruthy();
  });

  it('keeps the header and result regions outside the workspace container', () => {
    const { getByTestId } = render(
      <VerifySurface {...BASE_PROPS} lastRun={makeFailRun()} />
    );
    const workspace = getByTestId('ide-verify-workspace');
    expect(workspace.contains(getByTestId('ide-verify-region-header'))).toBe(false);
    expect(workspace.contains(getByTestId('ide-verify-region-result'))).toBe(false);
  });

  it('keeps the post-run stimulus workbench expanded instead of collapsing into waveform-focus mode', () => {
    const { getByTestId, queryByTestId } = render(
      <VerifySurface {...BASE_PROPS} lastRun={makeFailRun()} />
    );

    expect(getByTestId('ide-verify-lab-grid')).toHaveAttribute('data-stimulus-layout', 'stable');
    expect(getByTestId('ide-verify-lab-grid')).toHaveAttribute('data-verify-workflow-phase', 'post-run');
    expect(getByTestId('ide-verify-lab-grid')).toHaveAttribute('data-workspace-mode', 'split');
    expect(getByTestId('ide-verify-region-stimulus')).toHaveAttribute('data-panel-state', 'stable');
    expect(getByTestId('ide-verify-workbench-body')).toBeTruthy();
    expect(queryByTestId('ide-verify-workbench-collapsed-strip')).toBeNull();
  });
});
