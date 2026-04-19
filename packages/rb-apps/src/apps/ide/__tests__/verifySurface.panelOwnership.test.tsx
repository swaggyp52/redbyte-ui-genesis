// @vitest-environment jsdom
// B-14 Panel Ownership - behavioral contracts for analysis drawer + signals dock
//
// Structural guarantees:
// 1. Analysis drawer is default-closed after every run (progressive disclosure)
// 2. Analysis drawer opens when user explicitly clicks the toggle
// 3. Signals dock defaults to a collapsed legend rail so the main workspace keeps the width
// 4. Failure review stays in the waveform + analysis surfaces, not a permanently open shell rail
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, fireEvent } from '@testing-library/react';
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

afterEach(() => {
  cleanup();
});

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

describe('B-14 Panel Ownership - analysis drawer progressive disclosure', () => {
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

describe('B-14 Panel Ownership - signals dock layout policy', () => {
  it('signals dock starts as a collapsed legend rail in draft Verify sessions', () => {
    const { getByTestId, queryByTestId } = render(
      <VerifySurface {...BASE_PROPS} />
    );
    expect(queryByTestId('ide-left-dock')).toBeNull();
    expect(getByTestId('ide-workbench-dock-toggle-left')).toBeTruthy();
  });

  it('signals dock collapses to a rail after a pass run', () => {
    const { getByTestId, queryByTestId } = render(
      <VerifySurface {...BASE_PROPS} lastRun={makePassRun()} />
    );
    expect(queryByTestId('ide-left-dock')).toBeNull();
    expect(getByTestId('ide-workbench-dock-toggle-left')).toBeTruthy();
    fireEvent.click(getByTestId('ide-workbench-dock-toggle-left'));
    expect(getByTestId('ide-left-dock')).toBeTruthy();
    expect(getByTestId('ide-verify-left-dock')).toBeTruthy();
  });

  it('signals dock remains collapsed by default during a fail run', () => {
    const { getByTestId, queryByTestId } = render(
      <VerifySurface {...BASE_PROPS} lastRun={makeFailRun()} />
    );
    expect(queryByTestId('ide-left-dock')).toBeNull();
    expect(getByTestId('ide-workbench-dock-toggle-left')).toBeTruthy();
  });

  it('verify keeps the right inspector demoted to a collapsed rail during fail runs', () => {
    const { getByTestId, queryByTestId } = render(
      <VerifySurface {...BASE_PROPS} lastRun={makeFailRun()} />
    );
    expect(queryByTestId('ide-inspector')).toBeNull();
    expect(getByTestId('ide-workbench-dock-toggle-right')).toBeTruthy();
  });
});
