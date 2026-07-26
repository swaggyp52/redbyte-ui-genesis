import { describe, expect, it } from 'vitest';
import { exportProjectAsBasys3 } from '../fpga/boards/basys3/basys3ExportService';
import type { RBProject } from '../export/projectFormat';

function buildRegisterProject(
  type: 'Register1' | 'RegisterBus' | 'StateBank',
  config: Record<string, unknown>
): RBProject {
  return {
    name: 'register-boundary',
    circuit: {
      nodes: [
        { id: 'd', type: 'INPUT', label: 'd', x: 0, y: 0, config: {}, state: {} },
        { id: 'clk', type: 'INPUT', label: 'clk', x: 0, y: 80, config: {}, state: {} },
        { id: 'rst', type: 'INPUT', label: 'rst', x: 0, y: 160, config: {}, state: {} },
        { id: 'en', type: 'INPUT', label: 'en', x: 0, y: 240, config: {}, state: {} },
        { id: 'reg', type, label: 'state', x: 240, y: 100, config, state: {} },
        { id: 'q', type: 'OUTPUT', label: 'q', x: 440, y: 100, config: {}, state: {} },
      ],
      connections: [
        { id: 'd-reg', from: { nodeId: 'd', portName: 'out' }, to: { nodeId: 'reg', portName: 'D' } },
        { id: 'clk-reg', from: { nodeId: 'clk', portName: 'out' }, to: { nodeId: 'reg', portName: 'CLK' } },
        { id: 'rst-reg', from: { nodeId: 'rst', portName: 'out' }, to: { nodeId: 'reg', portName: 'RST' } },
        { id: 'en-reg', from: { nodeId: 'en', portName: 'out' }, to: { nodeId: 'reg', portName: 'EN' } },
        { id: 'reg-q', from: { nodeId: 'reg', portName: 'Q' }, to: { nodeId: 'q', portName: 'in' } },
      ],
    },
    ioMapping: {
      inputs: [
        { id: 'd', nodeId: 'd', port: 'out', label: 'd', pin: 'SW0' },
        { id: 'clk', nodeId: 'clk', port: 'out', label: 'clk', pin: 'CLK100MHZ' },
        { id: 'rst', nodeId: 'rst', port: 'out', label: 'rst', pin: 'BTNC' },
        { id: 'en', nodeId: 'en', port: 'out', label: 'en', pin: 'SW1' },
      ],
      outputs: [{ id: 'q', nodeId: 'q', port: 'in', label: 'q', pin: 'LD0' }],
    },
  };
}

describe('Export register-family support boundary', () => {
  it.each(['RegisterBus', 'StateBank'] as const)('blocks unsupported %s VHDL export', (type) => {
    const result = exportProjectAsBasys3(buildRegisterProject(type, { width: 8 }));

    expect(result.success).toBe(false);
    expect(result.errors.some((error) => error.message.includes(`Unsupported sequential component: ${type}`))).toBe(true);
  });

  it('blocks unsupported Register1 configuration with the same temporal reason as Verify', () => {
    const result = exportProjectAsBasys3(buildRegisterProject('Register1', {
      width: 1,
      resetKind: 'async_preset',
      resetPolarity: 'active_high',
      hasEnable: true,
      enablePolarity: 'active_high',
      clockPolarity: 'rising_edge',
    }));

    expect(result.success).toBe(false);
    expect(result.errors.some((error) => error.message.includes('asynchronous preset is not supported'))).toBe(true);
  });

  it('carries supported Register1 configuration into VHDL without hiding the current bundle blocker', () => {
    const result = exportProjectAsBasys3(buildRegisterProject('Register1', {
      width: 1,
      resetKind: 'async_clear',
      resetPolarity: 'active_high',
      hasEnable: true,
      enablePolarity: 'active_high',
      clockPolarity: 'rising_edge',
    }));

    expect(result.success).toBe(false);
    expect(result.errors.some((error) => error.message.includes('Bundle validation failed'))).toBe(true);
    expect(result.warnings.some((warning) => warning.includes('Register1') && warning.includes('not supported'))).toBe(true);
    expect(result.bundle?.topVhd).toContain("signal reg1_0 : STD_LOGIC := '0';");
    expect(result.bundle?.topVhd).toContain("signal reg1_0_inv : STD_LOGIC := '1';");
    expect(result.bundle?.topVhd).toMatch(/process \(clk, rst\)/i);
    expect(result.bundle?.topVhd).toMatch(/if rst = '1' then/i);
    expect(result.bundle?.topVhd).toMatch(/elsif rising_edge\(clk\) then/i);
    expect(result.bundle?.topVhd).toContain("if SW(1) = '1' then");
    expect(result.bundle?.topVhd).toContain('reg1_0 <= SW(0);');
  });
});
