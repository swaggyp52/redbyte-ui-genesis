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

    expect(getByTestId('ide-verify-summary-status').textContent).toMatch(/Checks failed|Checks need review/i);
    expect(getByTestId('ide-left-dock')).toBeTruthy();
    expect(getByTestId('ide-verify-left-dock')).toHaveAttribute('data-collapsed', 'false');
    expect(queryByTestId('ide-workbench-dock-toggle-left')).toBeNull();
    expect(queryByTestId('ide-verify-signal-rail-toggle')).toBeNull();
    expect(queryByTestId('ide-verify-run-proof')).toBeNull();
    expect(queryByTestId('ide-verify-failure-explainer')).toBeNull();
    expect(queryByTestId('ide-verify-fail-summary-inline')).toBeNull();
  });

  it('keeps the first mismatch and repair path visible without a disclosure', () => {
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
    expect(getAllByTestId('ide-verify-drawer-toggle')[0]?.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector('[data-testid="ide-verify-jump-to-failure-card"]')).toBeNull();
    expect(queryByTestId('ide-verify-jump-to-failure')).toBeNull();
    expect(container.querySelector('details')).toBeNull();
    expect(container.querySelector('summary')).toBeNull();
  });

  it('keeps fail evidence visible after switching the next-run toggle back to trace intent', () => {
    const { getByTestId, queryByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        lastRun={makeFailRun()}
        vectors={[
          { id: 'vec-01', tick: 0, inputs: {}, expected: { out_led: 1 } },
        ]}
        mappedInputs={[]}
        mappedSignals={[{ id: 'out_led', label: 'LED', direction: 'out' }]}
        onOpenProjectVectors={vi.fn()}
        onFixPath={vi.fn()}
      />
    );

    const observe = queryByTestId('ide-vcb-observe-only');
    if (observe) {
      fireEvent.click(observe);
      expect(observe.className).toContain('is-active');
    }
    expect(getByTestId('ide-verify-summary-status').textContent).toMatch(/Checks failed|Checks need review/i);
    expect(queryByTestId('ide-verify-run-proof')).toBeNull();
    expect(queryByTestId('ide-verify-failure-explainer')).toBeNull();
  });
});
