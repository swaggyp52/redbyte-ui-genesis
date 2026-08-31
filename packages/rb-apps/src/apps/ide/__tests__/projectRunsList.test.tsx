// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { ProjectRunsList } from '../components/ProjectRunsList';
import type { VerifyRunLedgerEntry } from '../projectRuntime';

afterEach(cleanup);

function run(partial: Partial<VerifyRunLedgerEntry>): VerifyRunLedgerEntry {
  return {
    runId: 'r1',
    ranAtIso: new Date().toISOString(),
    status: 'pass',
    passedRows: 4,
    failedRows: 0,
    firstFailure: null,
    circuitHash: 'c',
    vectorsHash: 'v',
    mappingHash: 'm',
    projectHash: 'p',
    didCircuitChangeSinceLast: false,
    didVectorsChangeSinceLast: false,
    didMappingChangeSinceLast: false,
    ...partial,
  };
}

describe('ProjectRunsList — runHistory projection', () => {
  it('shows an empty state with no runs', () => {
    const { getByTestId } = render(<ProjectRunsList runs={[]} />);
    expect(getByTestId('ide-project-runs-empty')).toBeTruthy();
    expect(getByTestId('ide-project-runs-count').textContent).toBe('None yet');
  });

  it('lists runs newest-first with pass/fail status and row counts', () => {
    const runs = [
      run({ runId: 'old', status: 'pass', passedRows: 4, failedRows: 0 }),
      run({ runId: 'new', status: 'fail', passedRows: 3, failedRows: 1 }),
    ];
    const { getByTestId } = render(<ProjectRunsList runs={runs} />);
    expect(getByTestId('ide-project-runs-count').textContent).toBe('2 recorded');
    // Newest first: index 0 is the FAIL.
    expect(getByTestId('ide-project-run-status-0').textContent).toBe('FAIL');
    expect(getByTestId('ide-project-run-status-1').textContent).toBe('PASS');
  });

  it('shows the first failing case for a failed run', () => {
    const runs = [
      run({
        runId: 'f',
        status: 'fail',
        passedRows: 2,
        failedRows: 2,
        firstFailure: { tick: 3, signal: 'SUM', expected: '1', actual: '0' },
      }),
    ];
    const { getByTestId } = render(<ProjectRunsList runs={runs} />);
    const failure = getByTestId('ide-project-run-failure-0').textContent ?? '';
    expect(failure).toContain('t3');
    expect(failure).toContain('SUM');
    expect(failure).toContain('1');
    expect(failure).toContain('0');
  });

  it('surfaces what changed since the previous run', () => {
    const runs = [
      run({ runId: 'a' }),
      run({ runId: 'b', didCircuitChangeSinceLast: true, didMappingChangeSinceLast: true }),
    ];
    const { getByTestId } = render(<ProjectRunsList runs={runs} />);
    const changes = getByTestId('ide-project-run-changes-0').textContent ?? '';
    expect(changes).toContain('circuit');
    expect(changes).toContain('mapping');
    expect(changes).not.toContain('scenario');
  });

  it('invokes onOpenVerify', () => {
    const onOpen = vi.fn();
    const { getByTestId } = render(<ProjectRunsList runs={[run({})]} onOpenVerify={onOpen} />);
    fireEvent.click(getByTestId('ide-project-runs-open-verify'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('bounds the visible rows to the limit', () => {
    const runs = Array.from({ length: 20 }, (_v, i) => run({ runId: `r${i}` }));
    const { queryByTestId } = render(<ProjectRunsList runs={runs} limit={5} />);
    expect(queryByTestId('ide-project-run-4')).toBeTruthy();
    expect(queryByTestId('ide-project-run-5')).toBeNull();
    // Count still reflects the full ring.
    expect(queryByTestId('ide-project-runs-count')?.textContent).toBe('20 recorded');
  });
});
