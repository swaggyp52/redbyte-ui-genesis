import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { IoMapping } from '@redbyte/rb-utils';
import { buildBasys3ExportModel } from './basys3ExportModel';
import { exportBasys3Bundle } from './basys3Bundle';

describe('direct Basys3 export register contract', () => {
  it('retains asynchronous reset and clock enable in a direct bundle export', () => {
    const config = { resetKind: 'async_clear', hasEnable: true };
    const circuit: Circuit = {
      nodes: [
        ...['d', 'clk', 'rst', 'en'].map((id) => ({ id, type: 'INPUT', label: id })),
        { id: 'reg', type: 'Register1', config },
        { id: 'q', type: 'OUTPUT', label: 'q' },
      ],
      connections: [
        ...['d', 'clk', 'rst', 'en'].map((id) => ({
          id: `${id}-reg`, from: { nodeId: id, portName: 'out' },
          to: { nodeId: 'reg', portName: id.toUpperCase() },
        })),
        { id: 'reg-q', from: { nodeId: 'reg', portName: 'Q' }, to: { nodeId: 'q', portName: 'in' } },
      ],
    };
    const mapping: IoMapping = {
      inputs: [
        { id: 'd', nodeId: 'd', port: 'out', label: 'd', pin: 'SW0' },
        { id: 'clk', nodeId: 'clk', port: 'out', label: 'clk', pin: 'CLK100MHZ' },
        { id: 'rst', nodeId: 'rst', port: 'out', label: 'rst', pin: 'SW1' },
        { id: 'en', nodeId: 'en', port: 'out', label: 'en', pin: 'SW2' },
      ],
      outputs: [{ id: 'q', nodeId: 'q', port: 'in', label: 'q', pin: 'LD0' }],
    };
    const model = buildBasys3ExportModel(circuit, mapping);
    const node = model.netlist.nodes.find((entry) => entry.id === 'reg');
    expect(node?.config).toEqual(config);
    expect(node?.config).not.toBe(config);
    const bundle = exportBasys3Bundle(circuit, mapping, { exportModel: model });
    expect(bundle.valid).toBe(true);
    expect(bundle.warnings).toContain('Unsupported node: reg (Register1)');
    expect(bundle.topVhd).toContain(`  process (clk, SW(1))
  begin
    if SW(1) = '1' then
      reg1_0 <= '0';
    elsif rising_edge(clk) then
      if SW(2) = '1' then
        reg1_0 <= SW(0);
      end if;
    end if;
  end process;`);
    expect(bundle.topXdc).toContain('PACKAGE_PIN V16 [get_ports {SW[1]}]');
    expect(bundle.topXdc).toContain('PACKAGE_PIN W16 [get_ports {SW[2]}]');
  });
});
