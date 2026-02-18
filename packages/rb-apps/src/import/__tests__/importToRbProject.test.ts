// Copyright (c) 2025 Connor Angiel — RedByte OS Genesis
// Tests: importToRbProject bridge

import { describe, it, expect, vi } from 'vitest';
import type { ParsedHDL } from '../hdlToCircuit.js';
import type { XdcParseResult } from '../xdcImport.js';
import { importToRbProject } from '../importToRbProject.js';
import * as hdlToCircuitModule from '../hdlToCircuit.js';

// Mock parsedHdlToCircuit to avoid full circuit generation complexity
vi.spyOn(hdlToCircuitModule, 'parsedHdlToCircuit').mockImplementation((parsed) => {
  return {
    circuit: {
      name: parsed.entityName,
      ports: parsed.ports.map((p) => ({ name: p.name })),
    } as any,
    warnings: [],
    unmappedComponents: [],
  };
});

describe('importToRbProject', () => {
  it('converts ParsedHDL to RBProject (no XDC)', () => {
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

    expect(result.circuit).toBeDefined();
    expect(result.circuit.name).toBe('AND_GATE');
    expect(result.circuit.ports).toHaveLength(3);
    expect(result.ioMapping).toBeUndefined(); // No XDC provided
  });

  it('merges XDC pin mapping into ioMapping', () => {
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

  it('omits ioMapping if XDC matches no ports', () => {
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
        unmatched_port: 'V17', // This port name doesn't exist in HDL
      },
      warnings: [],
    };

    const result = importToRbProject(hdl, xdc);

    expect(result.ioMapping).toBeUndefined();
  });
});
