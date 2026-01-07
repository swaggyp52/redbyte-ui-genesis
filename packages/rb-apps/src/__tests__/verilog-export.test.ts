// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { netlistFromCircuit } from '../export/netlistExport';
import { verilogFromNetlist } from '../export/verilogExport';

describe('verilog export', () => {
  it('renders a deterministic structural netlist', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'lamp', type: 'Lamp', position: { x: 0, y: 0 }, rotation: 0, config: {} },
        {
          id: 'switch',
          type: 'Switch',
          position: { x: 0, y: 0 },
          rotation: 0,
          config: {},
          state: { isOn: 0 },
        },
      ],
      connections: [
        { from: { nodeId: 'switch', portName: 'out' }, to: { nodeId: 'lamp', portName: 'in' } },
      ],
    };

    const netlist = netlistFromCircuit(circuit);
    const verilog = verilogFromNetlist(netlist);

    expect(verilog).toContain('module top();');
    expect(verilog).toContain('wire w_switch_out__lamp_in;');
    expect(verilog).toContain('Switch u_switch');
    expect(verilog).toContain('Lamp u_lamp');
    expect(verilog).toContain('module Switch');
    expect(verilog).toContain('module Lamp');
  });
});
