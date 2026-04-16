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
});
