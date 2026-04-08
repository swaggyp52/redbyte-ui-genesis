// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
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

    expect(getByTestId('ide-verify-summary-status').textContent).toContain('ASSERTIONS DIFFER');
    expect(getByTestId('ide-verify-failure-explainer')).toBeTruthy();
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
    const { getByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        lastRun={makeFailRun()}
        onOpenProjectVectors={vi.fn()}
        onFixPath={vi.fn()}
      />
    );

    fireEvent.click(getByTestId('ide-verify-assertion-mode-toggle'));

    expect(getByTestId('ide-verify-assertion-mode-toggle').textContent).toContain('Mode: Trace Only');
    expect(getByTestId('ide-verify-summary-status').textContent).toContain('ASSERTIONS DIFFER');
    expect(getByTestId('ide-verify-run-proof').className).toContain('ide-verify-run-proof--fail');
    expect(getByTestId('ide-verify-failure-explainer')).toBeTruthy();
  });
});
