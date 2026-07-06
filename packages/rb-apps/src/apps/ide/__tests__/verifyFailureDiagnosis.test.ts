import { describe, expect, it } from 'vitest';
import { diagnoseVerifyFailure } from '../verifyFailureDiagnosis';

describe('diagnoseVerifyFailure', () => {
  it('routes stale results to rerun Compare before repair decisions', () => {
    const diagnosis = diagnoseVerifyFailure({
      status: 'fail',
      staleReason: 'design',
      failure: {
        signalLabel: 'SUM',
        expected: '1',
        observed: '0',
      },
    });

    expect(diagnosis.category).toBe('stale-result');
    expect(diagnosis.primaryLane).toBe('rerun');
    expect(diagnosis.recommendedAction).toContain('Rerun Compare');
    expect(diagnosis.message).toContain('Design changed');
  });

  it('classifies no-row fail states as disconnected output recovery', () => {
    const diagnosis = diagnoseVerifyFailure({
      status: 'fail',
      runRowsCount: 0,
      outputLabels: ['OUT'],
      preflightIssues: [
        {
          kind: 'missing-output-sample',
          signal: 'OUT',
          message: 'No sampled output matched this expected signal.',
        },
      ],
    });

    expect(diagnosis.category).toBe('disconnected-output');
    expect(diagnosis.primaryLane).toBe('design');
    expect(diagnosis.message).toContain('OUT');
    expect(diagnosis.recommendedAction).toContain('connect a driver');
  });

  it('recommends design repair when a binary mismatch has a concrete driver', () => {
    const diagnosis = diagnoseVerifyFailure({
      status: 'fail',
      runRowsCount: 4,
      failure: {
        signalLabel: 'XOR_OUT',
        expected: '0',
        observed: '1',
        inputSnapshot: [
          { label: 'A', value: '1' },
          { label: 'B', value: '1' },
        ],
      },
      directDriver: {
        label: 'wrong_or_should_be_xor',
        type: 'OR gate',
        incomingWires: 2,
        outgoingWires: 1,
      },
    });

    expect(diagnosis.category).toBe('possible-wrong-gate-or-wire');
    expect(diagnosis.primaryLane).toBe('design');
    expect(diagnosis.message).toContain('XOR_OUT');
    expect(diagnosis.message).toContain('wrong_or_should_be_xor');
    expect(diagnosis.recommendedAction).toContain('Inspect Design');
  });

  it('keeps expected-value repair explicit when the circuit behavior is believed correct', () => {
    const diagnosis = diagnoseVerifyFailure({
      status: 'fail',
      runRowsCount: 4,
      failure: {
        signalLabel: 'CARRY',
        expected: '0',
        observed: '1',
      },
      studentBelievesCircuitCorrect: true,
    });

    expect(diagnosis.category).toBe('expected-value-check-needed');
    expect(diagnosis.primaryLane).toBe('expected');
    expect(diagnosis.recommendedAction).toContain('Use observed');
    expect(diagnosis.message).toContain('only if the circuit is correct');
  });
});
