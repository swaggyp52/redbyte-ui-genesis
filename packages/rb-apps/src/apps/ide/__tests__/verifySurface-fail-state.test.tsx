// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
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
    report: {
      rows: [
        { tick: 0, signal: 'out_led', expected: '1', actual: '0', status: 'fail' },
      ],
    } as RuntimeVerifyRun['report'],
    waveform: [],
  };
}

describe('VerifySurface FAIL state (PR14 regression guard)', () => {
  it('renders the FAIL summary card when lastRun is fail', () => {
    const { getByTestId } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        lastRun={makeFailRun()}
        onOpenProjectVectors={vi.fn()}
        onFixPath={vi.fn()}
      />
    );
    expect(getByTestId('ide-verify-fail-card')).toBeTruthy();
  });

  it('has exactly one Jump CTA: in fail card, not in strip', () => {
    const { queryByTestId, container } = render(
      <VerifySurface
        deterministicHash="abc123"
        hasVectors={true}
        lastRun={makeFailRun()}
        onOpenProjectVectors={vi.fn()}
        onFixPath={vi.fn()}
      />
    );
    // Canonical — must exist (in fail card)
    expect(container.querySelector('[data-testid="ide-verify-jump-to-failure-card"]')).toBeTruthy();
    // Strip duplicate — must NOT exist (removed in PR14 Task 1)
    expect(queryByTestId('ide-verify-jump-to-failure')).toBeNull();
  });
});
