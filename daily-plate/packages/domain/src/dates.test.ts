import { describe, expect, it } from 'vitest';
import { localDateFor, previousDay, shiftLocalDate, weekdayOf } from './dates.js';

describe('local dates (O05)', () => {
  it('derives the diary date from the timezone, not UTC', () => {
    const late = new Date('2026-09-19T03:30:00Z');
    expect(localDateFor(late, 'America/New_York')).toBe('2026-09-18');
    expect(localDateFor(late, 'UTC')).toBe('2026-09-19');
  });

  it('shifts across month and DST boundaries by calendar day', () => {
    expect(previousDay('2026-10-01')).toBe('2026-09-30');
    expect(shiftLocalDate('2026-11-01', 1)).toBe('2026-11-02');
    expect(shiftLocalDate('2026-03-08', 1)).toBe('2026-03-09');
    expect(shiftLocalDate('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('computes weekday deterministically', () => {
    expect(weekdayOf('2026-09-18')).toBe(5);
  });
});
