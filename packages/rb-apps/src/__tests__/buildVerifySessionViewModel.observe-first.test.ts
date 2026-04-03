import { describe, it, expect } from 'vitest';
import {
  buildVerifySessionViewModel,
  type BuildVerifySessionViewModelInput,
} from '../apps/ide/viewmodels/buildVerifySessionViewModel';

// Minimal passing input with no last run.
function baseInput(overrides: Partial<BuildVerifySessionViewModelInput> = {}): BuildVerifySessionViewModelInput {
  return {
    totalVectorCount: 3,
    totalExpectedCaseCount: 0,
    runState: 'idle',
    lastRun: undefined,
    nextRunUsesAssertions: false,
    isRunStale: false,
    isTraceOnly: false,
    hasResults: false,
    canSetOracle: false,
    failingRowCount: 0,
    ...overrides,
  };
}

// ─── Observe-first mode semantics ────────────────────────────────────────────

describe('buildVerifySessionViewModel — observe-first model', () => {
  it('defaults to "simulation" mode (observe) when nextRunUsesAssertions is false, even with expected cells', () => {
    const vm = buildVerifySessionViewModel(
      baseInput({ totalExpectedCaseCount: 5, nextRunUsesAssertions: false })
    );
    expect(vm.mode).toBe('simulation');
  });

  it('switches to "assertion" mode only when nextRunUsesAssertions is true AND expected cells exist', () => {
    const vm = buildVerifySessionViewModel(
      baseInput({ totalExpectedCaseCount: 5, nextRunUsesAssertions: true })
    );
    expect(vm.mode).toBe('assertion');
  });

  it('stays in "simulation" mode when nextRunUsesAssertions is true but NO expected cells exist', () => {
    const vm = buildVerifySessionViewModel(
      baseInput({ totalExpectedCaseCount: 0, nextRunUsesAssertions: true })
    );
    expect(vm.mode).toBe('simulation');
  });

  it('status is "stimulus-only" when observe run completes (isTraceOnly=true)', () => {
    const vm = buildVerifySessionViewModel(
      baseInput({
        nextRunUsesAssertions: false,
        isTraceOnly: true,
        hasResults: true,
        lastRun: { status: 'pass', kind: 'trace' } as never,
      })
    );
    expect(vm.status).toBe('stimulus-only');
  });

  it('no assertion-differ status when observe run completes even with expected cells authored', () => {
    const vm = buildVerifySessionViewModel(
      baseInput({
        totalExpectedCaseCount: 3,
        nextRunUsesAssertions: false,
        isTraceOnly: true,
        hasResults: true,
        lastRun: { status: 'pass', kind: 'trace' } as never,
      })
    );
    expect(vm.status).not.toBe('assertions-differ');
  });
});

// ─── Compare mode semantics ───────────────────────────────────────────────────

describe('buildVerifySessionViewModel — compare mode', () => {
  it('shows assertions-match when compare run passes', () => {
    const vm = buildVerifySessionViewModel(
      baseInput({
        totalExpectedCaseCount: 4,
        nextRunUsesAssertions: true,
        isTraceOnly: false,
        hasResults: true,
        failingRowCount: 0,
        lastRun: { status: 'pass', kind: 'verify' } as never,
      })
    );
    expect(vm.status).toBe('assertions-match');
  });

  it('shows assertions-differ when compare run fails', () => {
    const vm = buildVerifySessionViewModel(
      baseInput({
        totalExpectedCaseCount: 4,
        nextRunUsesAssertions: true,
        isTraceOnly: false,
        hasResults: false,
        failingRowCount: 2,
        lastRun: { status: 'fail', kind: 'verify' } as never,
      })
    );
    expect(vm.status).toBe('assertions-differ');
  });
});

// ─── Label changes ────────────────────────────────────────────────────────────

describe('buildVerifySessionViewModel — updated labels', () => {
  it('runLabel is "Run circuit" for first observe run', () => {
    const vm = buildVerifySessionViewModel(baseInput({ nextRunUsesAssertions: false }));
    expect(vm.runLabel).toBe('Run circuit');
  });

  it('runLabel is "Run circuit again" after an observe run', () => {
    const vm = buildVerifySessionViewModel(
      baseInput({
        nextRunUsesAssertions: false,
        lastRun: { status: 'pass', kind: 'trace' } as never,
        isTraceOnly: true,
        hasResults: true,
      })
    );
    expect(vm.runLabel).toBe('Run circuit again');
  });

  it('runLabel is "Compare" for first compare run', () => {
    const vm = buildVerifySessionViewModel(
      baseInput({ nextRunUsesAssertions: true, totalExpectedCaseCount: 2 })
    );
    expect(vm.runLabel).toBe('Compare');
  });

  it('runLabel is "Compare again" after a compare run', () => {
    const vm = buildVerifySessionViewModel(
      baseInput({
        nextRunUsesAssertions: true,
        totalExpectedCaseCount: 2,
        lastRun: { status: 'pass', kind: 'verify' } as never,
        isTraceOnly: false,
        hasResults: true,
      })
    );
    expect(vm.runLabel).toBe('Compare again');
  });

  it('modeLabel is "OBSERVE" in simulation mode', () => {
    const vm = buildVerifySessionViewModel(baseInput({ nextRunUsesAssertions: false }));
    expect(vm.modeLabel).toBe('OBSERVE');
  });

  it('modeLabel is "COMPARE" in assertion mode', () => {
    const vm = buildVerifySessionViewModel(
      baseInput({ nextRunUsesAssertions: true, totalExpectedCaseCount: 2 })
    );
    expect(vm.modeLabel).toBe('COMPARE');
  });

  it('modeLabel never returns "SIMULATION" (removed jargon)', () => {
    const observe = buildVerifySessionViewModel(baseInput({ nextRunUsesAssertions: false }));
    const compare = buildVerifySessionViewModel(
      baseInput({ nextRunUsesAssertions: true, totalExpectedCaseCount: 2 })
    );
    expect(observe.modeLabel).not.toBe('SIMULATION');
    expect(compare.modeLabel).not.toBe('SIMULATION');
  });

  it('runLabel never contains "Testbench" (removed jargon)', () => {
    const first = buildVerifySessionViewModel(baseInput());
    const reload = buildVerifySessionViewModel(
      baseInput({ lastRun: { status: 'pass', kind: 'trace' } as never, isTraceOnly: true, hasResults: true })
    );
    expect(first.runLabel).not.toMatch(/testbench/i);
    expect(reload.runLabel).not.toMatch(/testbench/i);
  });
});

// ─── Stale run label ──────────────────────────────────────────────────────────

describe('buildVerifySessionViewModel — stale run label', () => {
  it('runLabel is "Re-run for current circuit" when run is stale', () => {
    const vm = buildVerifySessionViewModel(
      baseInput({
        isRunStale: true,
        lastRun: { status: 'pass', kind: 'trace' } as never,
      })
    );
    expect(vm.runLabel).toBe('Re-run for current circuit');
  });
});
