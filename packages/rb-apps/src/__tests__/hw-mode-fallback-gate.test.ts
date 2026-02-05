import { describe, expect, it } from 'vitest';
import { decideExecutionSourceOnHardwareState } from '../hardware/hardwareModeFallback';

describe('Hardware mode fallback gate', () => {
  it('falls back to sim when bridge disconnects while in hardware mode', () => {
    const decision = decideExecutionSourceOnHardwareState('hardware', 'disconnected');
    expect(decision.shouldFallback).toBe(true);
    expect(decision.nextSource).toBe('sim');
    expect(decision.toast?.message).toMatch(/returned to Simulation/i);
  });

  it('does not force fallback while connecting', () => {
    const decision = decideExecutionSourceOnHardwareState('hardware', 'connecting');
    expect(decision.shouldFallback).toBe(false);
    expect(decision.nextSource).toBe('hardware');
  });

  it('does not change sim/replay sources', () => {
    expect(decideExecutionSourceOnHardwareState('sim', 'disconnected').nextSource).toBe('sim');
    expect(decideExecutionSourceOnHardwareState('replay', 'error').nextSource).toBe('replay');
  });
});

