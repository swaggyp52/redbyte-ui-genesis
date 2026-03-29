import { describe, expect, it } from 'vitest';

describe('gate harness contract', () => {
  it('exports loadStarterProject for gate modules that rely on shared starter setup', async () => {
    const gateHarness = await import('../../../../../../scripts/gates/_gateHarness.mjs');

    expect(typeof gateHarness.loadStarterProject).toBe('function');
  });
});