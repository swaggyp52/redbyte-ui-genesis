import { describe, expect, it } from 'vitest';

describe('gate harness contract', () => {
  it('exports loadStarterProject for gate modules that rely on shared starter setup', async () => {
    const gateHarness = await import('../../../../../../scripts/gates/_gateHarness.mjs');

    const functionNames = [
      'assert', 'visible', 'openDesignBoardPalette', 'designInputIds',
      'selectDesignInput', 'assertBuildFreshReplacementDialog',
      'assertBuildFreshReplacementModal', 'loadStarterProject',
      'ensureVerifyVectorsReady', 'clickVerifyRun', 'setVerifyRunMode',
      'saveObservedOutputs', 'runIdeGate',
    ] as const;
    expect(Object.keys(gateHarness).sort()).toEqual([...functionNames].sort());
    for (const name of functionNames) expect(typeof gateHarness[name]).toBe('function');
    expect(() => gateHarness.assert(false, 'runtime contract failure')).toThrow('runtime contract failure');
    expect(() => gateHarness.assert(true, 'runtime contract success')).not.toThrow();
  });
});