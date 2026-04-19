// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { RuntimeVerifyRun } from '../projectRuntime';
import { VerifySurface } from '../surfaces/VerifySurface';

function makeFailRun(): RuntimeVerifyRun {
  return {
    scenarioId: 'test',
    scenarioName: 'Test Vectors',
    status: 'fail',
    deterministicHash: 'abc123',
    reportHash: 'rep456',
    firstFailingTick: 0,
    generatedAtIso: new Date().toISOString(),
    schedule: 'combinational',
    meta: {
      circuitKind: 'combinational',
      clockingProtocol: null,
      samplePoint: 'steady-state',
      tick0Meaning: null,
      clockSignalName: null,
    },
    report: {
      rows: [{ tick: 0, signal: 'out_led', expected: '1', actual: '0', status: 'fail' }],
    } as RuntimeVerifyRun['report'],
    waveform: [],
  };
}

afterEach(() => {
  cleanup();
});

describe('VerifySurface FAIL state (PR14 regression guard)', () => {
  it('renders the focused FAIL workspace when lastRun is fail', () => {
    const { getByTestId, queryByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        lastRun={makeFailRun()}
        onOpenProjectVectors={vi.fn()}
        onFixPath={vi.fn()}
      />
    );

    expect(getByTestId('ide-verify-summary-status').textContent).toContain('Checks failed');
    expect(getByTestId('ide-left-dock')).toBeTruthy();
    expect(queryByTestId('ide-workbench-dock-toggle-left')).toBeNull();
    expect(queryByTestId('ide-verify-run-proof')).toBeNull();
    expect(queryByTestId('ide-verify-failure-explainer')).toBeNull();
    expect(queryByTestId('ide-verify-fail-summary-inline')).toBeNull();
  });

  it('keeps detailed fail analysis collapsed by default while leaving the first mismatch jump visible', () => {
    const { getAllByTestId, queryByTestId, container } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        lastRun={makeFailRun()}
        onOpenProjectVectors={vi.fn()}
        onFixPath={vi.fn()}
      />
    );

    expect(getAllByTestId('ide-verify-fail-nav-first').length).toBeGreaterThan(0);
    expect(getAllByTestId('ide-verify-drawer-toggle')[0]?.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('[data-testid="ide-verify-jump-to-failure-card"]')).toBeNull();
    expect(queryByTestId('ide-verify-jump-to-failure')).toBeNull();
  });

  it('keeps fail evidence visible after switching the next-run toggle back to trace intent', () => {
    const { getByTestId, queryByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        lastRun={makeFailRun()}
        onOpenProjectVectors={vi.fn()}
        onFixPath={vi.fn()}
      />
    );

    fireEvent.click(getByTestId('ide-vcb-mode-observe'));

    expect(getByTestId('ide-vcb-mode-observe').className).toContain('is-active');
    expect(getByTestId('ide-verify-summary-status').textContent).toContain('Checks failed');
    expect(queryByTestId('ide-verify-run-proof')).toBeNull();
    expect(queryByTestId('ide-verify-failure-explainer')).toBeNull();
  });
});
