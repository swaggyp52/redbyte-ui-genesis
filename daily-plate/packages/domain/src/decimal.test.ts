import { describe, expect, it } from 'vitest';
import { add, cmp, div, formatDisplay, isDecimal, mul, normalize, round, sub, sum } from './decimal.js';

describe('decimal', () => {
  it('multiplies exactly', () => {
    expect(mul('15', '1.5')).toBe('22.5');
    expect(mul('5', '1.5')).toBe('7.5');
    expect(mul('30', '1.5')).toBe('45');
    expect(mul('0.1', '0.2')).toBe('0.02');
    expect(mul('12', 2)).toBe('24');
  });

  it('adds and subtracts with mixed scale', () => {
    expect(add('82', '0.5')).toBe('82.5');
    expect(sub('140', '82')).toBe('58');
    expect(sub('82', '140')).toBe('-58');
    expect(sum(['1.1', '2.2', '3.3'])).toBe('6.6');
  });

  it('divides with bounded precision and rounds half-up', () => {
    expect(div('10', '4')).toBe('2.5');
    expect(div('1', '3')).toBe('0.333333');
    expect(div('2', '3')).toBe('0.666667');
    expect(div('30', '30')).toBe('1');
  });

  it('rounds only at the requested boundary', () => {
    expect(round('7.4999', 1)).toBe('7.5');
    expect(round('7.44', 1)).toBe('7.4');
    expect(round('7.45', 1)).toBe('7.5');
    expect(round('2.5', 0)).toBe('3');
    expect(round('-2.5', 0)).toBe('-3');
    expect(formatDisplay('22.50')).toBe('22.5');
  });

  it('does not accumulate rounding error across many additions', () => {
    let total = '0';
    for (let i = 0; i < 100; i += 1) total = add(total, '0.1');
    expect(total).toBe('10');
  });

  it('normalizes and compares', () => {
    expect(normalize('007.500')).toBe('7.5');
    expect(normalize('0.0')).toBe('0');
    expect(cmp('1.50', '1.5')).toBe(0);
    expect(cmp('1.4', '1.5')).toBe(-1);
    expect(isDecimal('abc')).toBe(false);
    expect(isDecimal('1e3')).toBe(false);
    expect(isDecimal('12.5')).toBe(true);
  });

  it('rejects invalid input', () => {
    expect(() => add('x', '1')).toThrow();
    expect(() => div('1', '0')).toThrow();
  });
});
