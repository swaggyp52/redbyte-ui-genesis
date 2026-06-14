import { describe, expect, it } from 'vitest';
import type { HardwareMappingDocumentV2 } from '@redbyte/rb-utils';
import { exportProjectAsBasys3 } from '../../fpga/boards/basys3/basys3ExportService';
import type { RBProject } from '../projectFormat';

function buildMinimalMappedProject(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    name: 'hw-map-v2-export',
    circuit: {
      nodes: [
        { id: 'sw0_node', type: 'INPUT', x: 120, y: 120, label: 'sw0', config: {}, state: {} },
        { id: 'ld0_node', type: 'OUTPUT', x: 320, y: 120, label: 'ld0', config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'sw0_node', portName: 'out' }, to: { nodeId: 'ld0_node', portName: 'in' } },
      ],
    },
    hdl: {
      top: 'top',
      sources: [
        {
          path: 'top.vhd',
          language: 'vhdl',
          text: [
            'library IEEE;',
            'use IEEE.STD_LOGIC_1164.ALL;',
            '',
            'entity top is',
            '  port (',
            '    sw0 : in std_logic;',
            '    ld0 : out std_logic',
            '  );',
            'end top;',
            '',
            'architecture rtl of top is',
            'begin',
            '  ld0 <= sw0;',
            'end rtl;',
          ].join('\n'),
        },
      ],
    },
    fpga: { board: 'basys3', top: 'top' },
  };
}

describe('Basys3 export with hardwareMappingV2', () => {
  it('exports using materialized IoMapping when only hardwareMappingV2 is set', () => {
    const hardwareMappingV2: HardwareMappingDocumentV2 = {
      schemaVersion: '2.0',
      boardId: 'basys3',
      entries: [
        {
          kind: 'scalar',
          id: 'sw0',
          direction: 'in',
          width: 1,
          portName: 'sw0',
          nodeId: 'sw0_node',
          port: 'out',
          label: 'sw0',
          pin: 'V17',
        },
        {
          kind: 'scalar',
          id: 'ld0',
          direction: 'out',
          width: 1,
          portName: 'ld0',
          nodeId: 'ld0_node',
          port: 'in',
          label: 'ld0',
          pin: 'U16',
        },
      ],
    };

    const project: RBProject = {
      ...buildMinimalMappedProject(),
      ioMapping: undefined,
      hardwareMappingV2,
    };

    const result = exportProjectAsBasys3(project);
    expect(result.success).toBe(true);
    expect(result.bundle?.topVhd.length).toBeGreaterThan(0);
    expect(result.bundle?.topXdc).toMatch(/V17/);
    expect(result.bundle?.topXdc).toMatch(/U16/);
  });

  function buildStructuredBusSliceProject(): RBProject {
    return {
      ...buildMinimalMappedProject(),
      ioMapping: undefined,
      hardwareMappingV2: {
        schemaVersion: '2.0',
        boardId: 'basys3',
        entries: [
          {
            kind: 'bus',
            id: 'sw_bus',
            direction: 'in',
            portName: 'sw_bus',
            width: 1,
            boardResourceType: 'switch',
            bits: [
              {
                id: 'sw0',
                bitIndex: 0,
                nodeId: 'sw0_node',
                port: 'out',
                pin: 'V17',
              },
            ],
          },
          {
            kind: 'slice',
            id: 'ld_bus',
            direction: 'out',
            portName: 'ld_bus',
            nodeId: 'ld0_node',
            port: 'in',
            msb: 0,
            lsb: 0,
            pins: ['U16'],
          },
        ],
      },
    };
  }

  it('exports structured bus/slice rows when node boundary aliases match entity ports', () => {
    const result = exportProjectAsBasys3(buildStructuredBusSliceProject());

    expect(result.success).toBe(true);
    expect(result.errors.filter((error) => error.severity === 'error')).toHaveLength(0);
    expect(result.bundle?.topXdc).toMatch(/V17/);
    expect(result.bundle?.topXdc).toMatch(/U16/);
  });

  it('reports required-port gaps when no materialized row aliases the entity port', () => {
    const project: RBProject = {
      ...buildStructuredBusSliceProject(),
      hdl: {
        top: 'top',
        sources: [
          {
            path: 'top.vhd',
            language: 'vhdl',
            text: [
              'library IEEE;',
              'use IEEE.STD_LOGIC_1164.ALL;',
              '',
              'entity top is',
              '  port (',
              '    sw0 : in std_logic;',
              '    ld_missing : out std_logic',
              '  );',
              'end top;',
              '',
              'architecture rtl of top is',
              'begin',
              '  ld_missing <= sw0;',
              'end rtl;',
            ].join('\n'),
          },
        ],
      },
    };

    const result = exportProjectAsBasys3(project);
    expect(result.success).toBe(false);
    expect(result.errors.some((error) => /ld_missing/i.test(error.message))).toBe(true);
  });
});
