import { describe, expect, it } from 'vitest';
import { deriveVerifySchedule } from '../fpga/boards/basys3/verifySchedule';

function circuitWithRegister(type: 'Register1' | 'RegisterBus' | 'StateBank', config: Record<string, unknown>) {
  return {
    nodes: [
      { id: 'd', type: 'INPUT', label: 'd', x: 0, y: 0, config: {}, state: {} },
      { id: 'clk', type: 'INPUT', label: 'clk', x: 0, y: 80, config: {}, state: {} },
      { id: 'reg', type, label: 'state', x: 220, y: 40, config, state: {} },
      { id: 'q', type: 'OUTPUT', label: 'q', x: 420, y: 40, config: {}, state: {} },
    ],
    connections: [
      { from: { nodeId: 'd', portName: 'out' }, to: { nodeId: 'reg', portName: 'D' } },
      { from: { nodeId: 'clk', portName: 'out' }, to: { nodeId: 'reg', portName: 'CLK' } },
      { from: { nodeId: 'reg', portName: 'Q' }, to: { nodeId: 'q', portName: 'in' } },
    ],
  };
}

describe('Verify register-family support boundary', () => {
  it.each(['RegisterBus', 'StateBank'] as const)('blocks unsupported %s components', (type) => {
    const contract = deriveVerifySchedule(circuitWithRegister(type, { width: 8 }));

    expect(contract.hasUnsupportedTemporal).toBe(true);
    expect(contract.temporalIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'unsupported-register-family' }),
    ]));
  });

  it.each([
    ['falling edge', { clockPolarity: 'falling_edge' }, 'unsupported-falling-edge'],
    ['asynchronous preset', { resetKind: 'async_preset' }, 'unsupported-register-config'],
    ['synchronous reset', { resetKind: 'sync_reset' }, 'unsupported-register-config'],
    ['active-low reset', { resetKind: 'async_clear', resetPolarity: 'active_low' }, 'unsupported-register-config'],
    ['active-low enable', { hasEnable: true, enablePolarity: 'active_low' }, 'unsupported-register-config'],
  ] as const)('blocks Register1 %s configuration', (_label, config, code) => {
    const contract = deriveVerifySchedule(circuitWithRegister('Register1', { width: 1, ...config }));

    expect(contract.hasUnsupportedTemporal).toBe(true);
    expect(contract.temporalIssues.some((issue) => issue.code === code)).toBe(true);
  });

  it('allows the supported rising-edge active-high configuration and ignores disabled control polarities', () => {
    const contract = deriveVerifySchedule(circuitWithRegister('Register1', {
      width: 1,
      clockPolarity: 'rising_edge',
      resetKind: 'none',
      resetPolarity: 'active_low',
      hasEnable: false,
      enablePolarity: 'active_low',
    }));

    expect(contract.hasUnsupportedTemporal).toBe(false);
    expect(contract.temporalIssues).toEqual([]);
  });
});
