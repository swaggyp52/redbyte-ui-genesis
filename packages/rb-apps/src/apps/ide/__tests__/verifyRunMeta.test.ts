import { describe, it, expect } from 'vitest';
import type { VerifyRunMeta } from '../projectRuntime';

describe('VerifyRunMeta contract', () => {
  it('clocked_macro → post-rising-edge sample point', () => {
    const meta: VerifyRunMeta = {
      circuitKind: 'sequential',
      clockingProtocol: 'clocked_macro',
      samplePoint: 'post-rising-edge',
      tick0Meaning: 'initial-state',
      clockSignalName: 'CLK',
    };
    expect(meta.samplePoint).toBe('post-rising-edge');
    expect(meta.circuitKind).toBe('sequential');
    expect(meta.tick0Meaning).toBe('initial-state');
  });

  it('combinational → steady-state sample point', () => {
    const meta: VerifyRunMeta = {
      circuitKind: 'combinational',
      clockingProtocol: null,
      samplePoint: 'steady-state',
      tick0Meaning: null,
      clockSignalName: null,
    };
    expect(meta.samplePoint).toBe('steady-state');
    expect(meta.circuitKind).toBe('combinational');
    expect(meta.clockingProtocol).toBeNull();
  });
});
