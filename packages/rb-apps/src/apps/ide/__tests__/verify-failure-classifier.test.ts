import { describe, expect, it } from 'vitest';
import { classifyVerifyFailure } from '../surfaces/verify-failure-classifier';

describe('verify-failure-classifier', () => {
  it('classifies output mismatches for combinational failures', () => {
    const result = classifyVerifyFailure({
      expected: '1',
      actual: '0',
      isSequential: false,
    });

    expect(result.reason).toBe('output-mismatch');
    expect(result.message).toContain('expected 1, got 0');
  });

  it('classifies undefined outputs when actual is X', () => {
    const result = classifyVerifyFailure({
      expected: '1',
      actual: 'X',
    });

    expect(result.reason).toBe('undefined-output');
    expect(result.message).toContain('Undefined output');
  });

  it('classifies floating outputs when actual is empty or dash', () => {
    const emptyResult = classifyVerifyFailure({
      expected: '1',
      actual: '',
    });
    const dashResult = classifyVerifyFailure({
      expected: '1',
      actual: '-',
    });

    expect(emptyResult.reason).toBe('floating-output');
    expect(dashResult.reason).toBe('floating-output');
  });

  it('classifies timing mismatch for sequential mismatches', () => {
    const result = classifyVerifyFailure({
      expected: '1',
      actual: '0',
      isSequential: true,
      clockingProtocol: 'clocked_macro',
      samplePoint: 'post-rising-edge',
    });

    expect(result.reason).toBe('timing-mismatch');
    expect(result.message).toContain('Timing mismatch');
  });
});
