// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import type { RuntimeVerifyRun } from '../projectRuntime';
import { VerifySurface } from '../surfaces/VerifySurface';

function makeFailRun(): RuntimeVerifyRun {
  return {
    scenarioId: 'hint-bridge',
    scenarioName: 'Hint Bridge',
    status: 'fail',
    deterministicHash: 'abc123',
    reportHash: 'rep456',
    firstFailingTick: 0,
    generatedAtIso: '2026-03-08T00:00:00.000Z',
    schedule: 'combinational',
    meta: {
      circuitKind: 'combinational',
      clockingProtocol: null,
      samplePoint: 'steady-state',
      tick0Meaning: null,
      clockSignalName: null,
    },
    report: {
      rows: [
        { tick: 0, signal: 'out_led', expected: '1', actual: '0', status: 'fail' },
      ],
    } as RuntimeVerifyRun['report'],
    waveform: [],
  };
}

function makeRepeatedFailRun(): RuntimeVerifyRun {
  return {
    scenarioId: 'hint-repeat',
    scenarioName: 'Hint Repeat',
    status: 'fail',
    deterministicHash: 'repeat123',
    reportHash: 'rep_repeat_123',
    firstFailingTick: 2,
    generatedAtIso: '2026-03-08T00:00:01.000Z',
    schedule: 'combinational',
    meta: {
      circuitKind: 'combinational',
      clockingProtocol: null,
      samplePoint: 'steady-state',
      tick0Meaning: null,
      clockSignalName: null,
    },
    report: {
      rows: [
        { tick: 0, signal: 'out_led', expected: '0', actual: '0', status: 'pass' },
        { tick: 2, signal: 'out_led', expected: '1', actual: '0', status: 'fail' },
        { tick: 4, signal: 'out_led', expected: '1', actual: '0', status: 'fail' },
      ],
    } as RuntimeVerifyRun['report'],
    waveform: [],
  };
}

describe('VerifySurface hint bridge', () => {
  function openAnalysisDrawer(getByTestId: (id: string) => HTMLElement) {
    const toggle = getByTestId('ide-verify-drawer-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  }

  it('surfaces the unmapped-pin hint from real mapping state', () => {
    const { getByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        lastRun={makeFailRun()}
        mappingComplete={false}
        onOpenProjectVectors={vi.fn()}
        onFixPath={vi.fn()}
      />
    );

    openAnalysisDrawer(getByTestId);
    expect(getByTestId('ide-verify-hint-callout').textContent).toContain('Some pins are not mapped');
  });

  it('surfaces the floating-output hint from compiler diagnostics', () => {
    const { getByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        lastRun={makeFailRun()}
        hasFloatingOutputWarning={true}
        onOpenProjectVectors={vi.fn()}
        onFixPath={vi.fn()}
      />
    );

    openAnalysisDrawer(getByTestId);
    expect(getByTestId('ide-verify-hint-callout').textContent).toContain('undriven');
  });

  it('surfaces the repeated-output pattern hint from the selected failure model', () => {
    const { getByTestId } = render(
      <VerifySurface
        deterministicHash="repeat123"
        hasVectors={true}
        lastRun={makeRepeatedFailRun()}
        onOpenProjectVectors={vi.fn()}
        onFixPath={vi.fn()}
      />
    );

    openAnalysisDrawer(getByTestId);
    expect(getByTestId('ide-verify-hint-callout').textContent).toContain(
      'localized to one output failing repeatedly'
    );
  });
});
