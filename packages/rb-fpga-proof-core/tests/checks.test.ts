import { describe, it, expect } from 'vitest';
import { evaluateChecks, type LabCheck } from '../src/checks';
import type { HardwareTraceEvent } from '../src/types';

const baseEvent = (overrides: Partial<HardwareTraceEvent>): HardwareTraceEvent => ({
  hw_tick: 0,
  mono_seq: 0,
  digital: 0,
  analog: [0, 0, 0, 0, 0, 0, 0, 0],
  ts_wall: 0,
  ...overrides,
});

describe('evaluateChecks', () => {
  it('returns pass with no checks', () => {
    const result = evaluateChecks(null, []);
    expect(result.pass).toBe(true);
    expect(result.results.length).toBe(0);
  });

  it('evaluates min_events correctly', () => {
    const events = [baseEvent({ mono_seq: 0 }), baseEvent({ mono_seq: 1 }), baseEvent({ mono_seq: 2 })];
    const checks: LabCheck[] = [{ id: 'min', type: 'min_events', min: 2 }];
    const result = evaluateChecks({ checks }, events);
    expect(result.results[0].pass).toBe(true);
    expect(result.pass).toBe(true);
  });

  it('evaluates min_hw_ticks correctly', () => {
    const events = [baseEvent({ hw_tick: 5 }), baseEvent({ hw_tick: 30, mono_seq: 1 })];
    const checks: LabCheck[] = [{ id: 'span', type: 'min_hw_ticks', min: 20 }];
    const result = evaluateChecks({ checks }, events);
    expect(result.results[0].pass).toBe(true);
  });

  it('fails min_hw_ticks when span is too small', () => {
    const events = [baseEvent({ hw_tick: 10 }), baseEvent({ hw_tick: 15, mono_seq: 1 })];
    const checks: LabCheck[] = [{ id: 'span', type: 'min_hw_ticks', min: 20 }];
    const result = evaluateChecks({ checks }, events);
    expect(result.results[0].pass).toBe(false);
    expect(result.pass).toBe(false);
  });

  it('evaluates digital_toggled correctly', () => {
    const events = [
      baseEvent({ digital: 0, mono_seq: 0 }),
      baseEvent({ digital: 1, mono_seq: 1 }),
      baseEvent({ digital: 1, mono_seq: 2 }),
    ];
    const checks: LabCheck[] = [{ id: 'toggle', type: 'digital_toggled', bit: 0 }];
    const result = evaluateChecks({ checks }, events);
    expect(result.results[0].pass).toBe(true);
  });

  it('preserves check order deterministically', () => {
    const events = [baseEvent({ digital: 0 }), baseEvent({ digital: 1, mono_seq: 1, hw_tick: 2 })];
    const checks: LabCheck[] = [
      { id: 'first', type: 'min_events', min: 1 },
      { id: 'second', type: 'digital_toggled', bit: 0 },
    ];
    const result = evaluateChecks({ checks }, events);
    expect(result.results.map((r) => r.id)).toEqual(['first', 'second']);
  });
});
