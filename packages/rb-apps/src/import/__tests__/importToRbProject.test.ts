import { describe, expect, it } from 'vitest';
import type { ParsedHDL } from '../hdlToCircuit.js';
import type { XdcParseResult } from '../xdcImport.js';
import { importToRbProject } from '../importToRbProject.js';

describe('importToRbProject', () => {
  it('converts ParsedHDL to a circuit-backed RBProject wrapper', () => {
    const hdl: ParsedHDL = {
      entityName: 'AND_GATE',
      ports: [
        { name: 'a', direction: 'in', typeName: 'STD_LOGIC' },
        { name: 'b', direction: 'in', typeName: 'STD_LOGIC' },
        { name: 'y', direction: 'out', typeName: 'STD_LOGIC' },
      ],
      instances: [],
      signals: [],
      warnings: [],
      lang: 'vhdl',
    };

    const result = importToRbProject(hdl);

    expect(result.circuit.nodes.map((node) => node.id).sort()).toEqual([
      'port_a',
      'port_b',
      'port_out_y',
    ]);
    expect(result.circuit.connections).toEqual([]);
    expect(result.ioMapping).toBeUndefined();
  });

  it('merges XDC pin mapping into the compatibility ioMapping record', () => {
    const hdl: ParsedHDL = {
      entityName: 'DEMO',
      ports: [
        { name: 'SW0', direction: 'in', typeName: 'STD_LOGIC' },
        { name: 'SW1', direction: 'in', typeName: 'STD_LOGIC' },
        { name: 'LD0', direction: 'out', typeName: 'STD_LOGIC' },
      ],
      instances: [],
      signals: [],
      warnings: [],
      lang: 'vhdl',
    };

    const xdc: XdcParseResult = {
      pinMap: {
        SW0: 'V17',
        SW1: 'V16',
        LD0: 'U16',
      },
      warnings: [],
    };

    const result = importToRbProject(hdl, xdc);

    expect(result.ioMapping).toEqual({
      SW0: 'V17',
      SW1: 'V16',
      LD0: 'U16',
    });
  });

  it('omits compatibility ioMapping if XDC matches no parsed ports', () => {
    const hdl: ParsedHDL = {
      entityName: 'TEST',
      ports: [
        { name: 'in1', direction: 'in', typeName: 'STD_LOGIC' },
        { name: 'out1', direction: 'out', typeName: 'STD_LOGIC' },
      ],
      instances: [],
      signals: [],
      warnings: [],
      lang: 'vhdl',
    };

    const xdc: XdcParseResult = {
      pinMap: {
        unmatched_port: 'V17',
      },
      warnings: [],
    };

    const result = importToRbProject(hdl, xdc);

    expect(result.ioMapping).toBeUndefined();
  });
});
