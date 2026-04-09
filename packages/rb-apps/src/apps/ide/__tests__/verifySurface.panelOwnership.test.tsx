// @vitest-environment jsdom
// B-14 Panel Ownership — behavioral contracts for analysis drawer + signals dock
//
// Structural guarantees:
// 1. Analysis drawer is default-closed after every run (progressive disclosure)
// 2. Analysis drawer opens when user explicitly clicks the toggle
// 3. Signals dock (ide-left-dock aside) is absent when session shows match (collapsed mode)
// 4. Signals dock is present when session shows failure (visible mode — need the list for debugging)
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
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
  deterministicHash: 'po-test',
  verifyMode: 'combinational' as const,
};

function makePassRun(): RuntimeVerifyRun {
  return {
    scenarioId: 'pass-scenario',
    scenarioName: 'Pass Scenario',
    status: 'pass',
    deterministicHash: 'po-test',
    reportHash: 'rep-pass',
    generatedAtIso: '2026-04-08T00:00:00.000Z',
    schedule: 'combinational',
    meta: {
      circuitKind: 'combinational',
      clockingProtocol: null,
      samplePoint: 'steady-state',
      tick0Meaning: null,
      clockSignalName: null,
    },
    report: {
      vectors: [{ id: 'vec-01', tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 }, caseIndex: 0 }],
      inputsAtTick: { 0: { sw0: 0 } },
      inputsByVectorId: { 'vec-01': { sw0: 0 } },
      signalRoles: { sw0: 'input', ld0: 'output' },
      rows: [{ tick: 0, signal: 'ld0', expected: '0', actual: '0', status: 'pass', vectorId: 'vec-01', caseIndex: 0 }],
    } as RuntimeVerifyRun['report'],
    waveform: [{ tick: 0, signals: { sw0: '0', ld0: '0' }, mismatches: [] }],
  };
}

function makeFailRun(): RuntimeVerifyRun {
  return {
    scenarioId: 'fail-scenario',
    scenarioName: 'Fail Scenario',
    status: 'fail',
    deterministicHash: 'po-test',
    reportHash: 'rep-fail',
    generatedAtIso: '2026-04-08T01:00:00.000Z',
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
    waveform: [{ tick: 0, signals: { sw0: '0', ld0: '0' }, mismatches: [{ signal: 'ld0', expected: '1', actual: '0' }] }],
  };
}

describe('B-14 Panel Ownership — analysis drawer progressive disclosure', () => {
  it('analysis tab nav is absent immediately after a run (drawer default-closed)', () => {
    // The drawer body should not be present by default — progressive disclosure
    const { queryByTestId } = render(
      <VerifySurface {...BASE_PROPS} lastRun={makePassRun()} />
    );
    expect(queryByTestId('ide-verify-analysis-tab-nav')).toBeNull();
  });

  it('analysis drawer toggle button is present after a run', () => {
    const { getByTestId } = render(
      <VerifySurface {...BASE_PROPS} lastRun={makePassRun()} />
    );
    expect(getByTestId('ide-verify-drawer-toggle')).toBeTruthy();
  });

  it('analysis tab nav appears after clicking the drawer toggle', () => {
    const { getByTestId, queryByTestId } = render(
      <VerifySurface {...BASE_PROPS} lastRun={makePassRun()} />
    );
    // Confirm it's absent before clicking
    expect(queryByTestId('ide-verify-analysis-tab-nav')).toBeNull();
    // Open the drawer
    fireEvent.click(getByTestId('ide-verify-drawer-toggle'));
    // Now it should be present
    expect(getByTestId('ide-verify-analysis-tab-nav')).toBeTruthy();
  });

  it('drawer toggle has aria-expanded=false when closed and aria-expanded=true when open', () => {
    const { getByTestId } = render(
      <VerifySurface {...BASE_PROPS} lastRun={makePassRun()} />
    );
    const toggle = getByTestId('ide-verify-drawer-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('B-14 Panel Ownership — signals dock layout policy', () => {
  it('signals dock aside is absent (collapsed to rail) in draft Verify sessions', () => {
    const { queryByTestId, getByTestId } = render(
      <VerifySurface {...BASE_PROPS} />
    );
    expect(queryByTestId('ide-left-dock')).toBeNull();
    expect(getByTestId('ide-workbench-dock-toggle-left')).toBeTruthy();
  });

  it('signals dock aside is absent (collapsed to rail) after a pass run', () => {
    // Pass → leftDockMode: 'collapsed' → no ide-left-dock aside in DOM
    const { queryByTestId } = render(
      <VerifySurface {...BASE_PROPS} lastRun={makePassRun()} />
    );
    expect(queryByTestId('ide-left-dock')).toBeNull();
  });

  it('signals dock rail toggle is present after a pass run (collapsed, not hidden)', () => {
    // Pass → leftDockMode: 'collapsed' → rail toggle button visible so user can expand
    const { getByTestId } = render(
      <VerifySurface {...BASE_PROPS} lastRun={makePassRun()} />
    );
    expect(getByTestId('ide-workbench-dock-toggle-left')).toBeTruthy();
  });

  it('signals dock aside is collapsed to a rail during a fail run', () => {
    // Fail → leftDockMode: 'collapsed' → no ide-left-dock aside in DOM by default
    const { getByTestId } = render(
      <VerifySurface {...BASE_PROPS} lastRun={makeFailRun()} />
    );
    expect(() => getByTestId('ide-left-dock')).toThrow();
    expect(getByTestId('ide-workbench-dock-toggle-left')).toBeTruthy();
  });

  it('signals dock can still be reopened from the collapsed fail-state rail', () => {
    const { getByTestId } = render(
      <VerifySurface {...BASE_PROPS} lastRun={makeFailRun()} />
    );
    fireEvent.click(getByTestId('ide-workbench-dock-toggle-left'));
    const dock = getByTestId('ide-left-dock');
    const verifyDock = dock.querySelector('[data-testid="ide-verify-left-dock"]');
    expect(verifyDock).toBeTruthy();
  });

  it('verify keeps secondary analysis out of the shell rails during fail runs', () => {
    const { queryByTestId } = render(
      <VerifySurface {...BASE_PROPS} lastRun={makeFailRun()} />
    );
    expect(queryByTestId('ide-workbench-dock-toggle-right')).toBeNull();
  });
});
