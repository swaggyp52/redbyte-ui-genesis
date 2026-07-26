import { describe, expect, it } from 'vitest';
import type { Netlist, NetlistNode } from '../netlistExport';
import { vhdlFromNetlist } from '../vhdlExport';

type ConfiguredNetlistNode = NetlistNode & {
  config: Record<string, unknown>;
};

function buildRegisterNetlist(config: Record<string, unknown>): Netlist {
  const register: ConfiguredNetlistNode = {
    id: 'reg',
    type: 'Register1',
    label: 'state',
    config,
    ports: [
      { name: 'D', direction: 'in' },
      { name: 'CLK', direction: 'in' },
      { name: 'RST', direction: 'in' },
      { name: 'EN', direction: 'in' },
      { name: 'Q', direction: 'out' },
      { name: 'Q_inv', direction: 'out' },
    ],
  };

  return {
    kind: 'rb-netlist',
    version: 1,
    createdAt: '1970-01-01T00:00:00.000Z',
    circuitDigest: 'register-parity',
    nodes: [
      { id: 'd', type: 'Switch', ports: [{ name: 'out', direction: 'out' }] },
      { id: 'clk', type: 'Switch', ports: [{ name: 'out', direction: 'out' }] },
      { id: 'rst', type: 'Switch', ports: [{ name: 'out', direction: 'out' }] },
      { id: 'en', type: 'Switch', ports: [{ name: 'out', direction: 'out' }] },
      register,
      { id: 'q', type: 'Lamp', ports: [{ name: 'in', direction: 'in' }] },
    ],
    nets: [
      { id: 'd-reg', from: { nodeId: 'd', port: 'out' }, to: { nodeId: 'reg', port: 'D' } },
      { id: 'clk-reg', from: { nodeId: 'clk', port: 'out' }, to: { nodeId: 'reg', port: 'CLK' } },
      { id: 'rst-reg', from: { nodeId: 'rst', port: 'out' }, to: { nodeId: 'reg', port: 'RST' } },
      { id: 'en-reg', from: { nodeId: 'en', port: 'out' }, to: { nodeId: 'reg', port: 'EN' } },
      { id: 'reg-q', from: { nodeId: 'reg', port: 'Q' }, to: { nodeId: 'q', port: 'in' } },
    ],
  };
}

describe('Register1 VHDL parity', () => {
  it('initializes state deterministically and emits supported async-clear/enable semantics', () => {
    const result = vhdlFromNetlist(buildRegisterNetlist({
      width: 1,
      resetKind: 'async_clear',
      resetPolarity: 'active_high',
      hasEnable: true,
      enablePolarity: 'active_high',
      clockPolarity: 'rising_edge',
    }));

    expect(result.vhd).toContain("signal reg1_0 : STD_LOGIC := '0';");
    expect(result.vhd).toContain("signal reg1_0_inv : STD_LOGIC := '1';");
    expect(result.vhd).toContain('process (SW(1), SW(2))');
    expect(result.vhd).toContain("if SW(2) = '1' then");
    expect(result.vhd).toContain('elsif rising_edge(SW(1)) then');
    expect(result.vhd).toContain("if SW(3) = '1' then");
  });

  it('ignores connected reset and enable ports when configuration disables them', () => {
    const result = vhdlFromNetlist(buildRegisterNetlist({
      width: 1,
      resetKind: 'none',
      resetPolarity: 'active_low',
      hasEnable: false,
      enablePolarity: 'active_low',
      clockPolarity: 'rising_edge',
    }));

    expect(result.vhd).toContain('process (SW(1))');
    expect(result.vhd).toContain('if rising_edge(SW(1)) then');
    expect(result.vhd).toContain('reg1_0 <= SW(0);');
    expect(result.vhd).not.toContain("if SW(2) = '1' then");
    expect(result.vhd).not.toContain("if SW(3) = '1' then");
  });
});
