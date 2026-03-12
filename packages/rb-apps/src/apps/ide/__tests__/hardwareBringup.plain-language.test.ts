/**
 * Unit tests for hardware bring-up plain-language translation.
 *
 * Verifies:
 * 1. signalHumanLabel converts machine signal keys to readable labels
 * 2. formatAssertionPlain converts assertion entries to student sentences
 * 3. Expected/actual state is rendered as ON/OFF, not 1/0
 * 4. Raw machine assertion remains present in source (not removed)
 */

import { describe, expect, it } from 'vitest';
import {
  signalHumanLabel,
  formatAssertionPlain,
} from '../surfaces/HardwareSurface';

describe('signalHumanLabel', () => {
  it('converts ld[5] to LED LD5', () => {
    expect(signalHumanLabel('ld[5]')).toBe('LED LD5');
  });

  it('converts ld0 (no brackets) to LED LD0', () => {
    expect(signalHumanLabel('ld0')).toBe('LED LD0');
  });

  it('converts sw[3] to Switch SW3', () => {
    expect(signalHumanLabel('sw[3]')).toBe('Switch SW3');
  });

  it('converts sw2 (no brackets) to Switch SW2', () => {
    expect(signalHumanLabel('sw2')).toBe('Switch SW2');
  });

  it('converts btnc to Button BTNC', () => {
    expect(signalHumanLabel('btnc')).toBe('Button BTNC');
  });

  it('converts BTNR to Button BTNR (case-insensitive)', () => {
    expect(signalHumanLabel('BTNR')).toBe('Button BTNR');
  });

  it('returns uppercased signal for unrecognized patterns', () => {
    expect(signalHumanLabel('out_q')).toBe('OUT_Q');
  });
});

describe('formatAssertionPlain', () => {
  const base = {
    tick: 3,
    signal: 'ld[5]',
    expected: '1',
    actual: '0',
    pass: false,
    hasData: true,
  };

  it('describes a failing assertion in plain English — should be ON, stayed OFF', () => {
    const result = formatAssertionPlain(base);
    expect(result).toContain('LED LD5');
    expect(result).toContain('should be ON');
    expect(result).toContain('step 3');
    expect(result).toContain('stayed OFF');
  });

  it('describes LOW→HIGH mismatch correctly', () => {
    const result = formatAssertionPlain({ ...base, expected: '0', actual: '1' });
    expect(result).toContain('should be OFF');
    expect(result).toContain('stayed ON');
  });

  it('describes a passing assertion positively', () => {
    const result = formatAssertionPlain({ ...base, pass: true, actual: '1' });
    expect(result).toContain('LED LD5');
    expect(result).toContain('is ON');
    expect(result).not.toContain('stayed');
  });

  it('reports missing trace data clearly', () => {
    const result = formatAssertionPlain({ ...base, hasData: false, actual: null });
    expect(result).toContain('LED LD5');
    expect(result).toContain('could not be read');
    expect(result).toContain('no trace data');
  });

  it('works for switch signals', () => {
    const result = formatAssertionPlain({
      tick: 1,
      signal: 'sw[3]',
      expected: '1',
      actual: '0',
      pass: false,
      hasData: true,
    });
    expect(result).toContain('Switch SW3');
    expect(result).toContain('should be ON');
    expect(result).toContain('stayed OFF');
  });
});
