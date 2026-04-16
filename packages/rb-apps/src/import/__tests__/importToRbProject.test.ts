import { describe, expect, it } from 'vitest';
import { materializeIoMappingFromHardwareMappingV2 } from '@redbyte/rb-utils';
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
    expect(result.hardwareMappingV2?.entries).toHaveLength(3);
    const materialized = materializeIoMappingFromHardwareMappingV2(result.hardwareMappingV2!);
    expect(materialized.inputs).toHaveLength(2);
    expect(materialized.outputs).toHaveLength(1);
  });

  it('merges XDC pin mapping into ioMapping and hardwareMappingV2', () => {
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

    expect(result.ioMapping?.inputs).toHaveLength(2);
    expect(result.ioMapping?.outputs).toHaveLength(1);
    expect(result.hardwareMappingV2?.entries).toHaveLength(3);
    const materialized = materializeIoMappingFromHardwareMappingV2(result.hardwareMappingV2!);
    const byLabel = (dir: 'in' | 'out') =>
      new Map(
        (dir === 'in' ? materialized.inputs : materialized.outputs).map((row) => [
          row.label ?? row.id,
          row.pin,
        ])
      );
    const ins = byLabel('in');
    const outs = byLabel('out');
    expect(ins.get('SW0')).toBe('V17');
    expect(ins.get('SW1')).toBe('V16');
    expect(outs.get('LD0')).toBe('U16');
  });

  it('omits pin strings when XDC matches no parsed ports', () => {
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

    expect(result.hardwareMappingV2?.entries).toHaveLength(2);
    const materialized = materializeIoMappingFromHardwareMappingV2(result.hardwareMappingV2!);
    expect(materialized.inputs?.every((r) => !r.pin?.trim())).toBe(true);
    expect(materialized.outputs?.every((r) => !r.pin?.trim())).toBe(true);
  });
});
