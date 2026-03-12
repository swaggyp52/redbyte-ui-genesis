import { describe, expect, it } from 'vitest';
import type { RBProject } from '../../../export/projectFormat';
import { buildExportViewModel } from '../viewmodels/buildExportViewModel';

function createExportFixture(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-11T00:00:00.000Z',
    updatedAt: '2026-03-11T00:00:00.000Z',
    name: 'Export Naming Fixture',
    description: 'Export naming fallback fixture',
    circuit: {
      nodes: [
        {
          id: 'sw0_node',
          type: 'INPUT',
          label: 'SW0',
          position: { x: 0, y: 0 },
          x: 0,
          y: 0,
          rotation: 0,
          config: {},
          state: {},
        },
        {
          id: 'ld0_node',
          type: 'OUTPUT',
          label: 'LD0',
          position: { x: 180, y: 0 },
          x: 180,
          y: 0,
          rotation: 0,
          config: {},
          state: {},
        },
      ],
      connections: [
        {
          from: { nodeId: 'sw0_node', portName: 'out' },
          to: { nodeId: 'ld0_node', portName: 'in' },
        },
      ],
    },
    hdl: {
      top: 'top',
      sources: [
        {
          path: 'top.vhd',
          language: 'vhdl',
          text: 'entity top is end top; architecture rtl of top is begin end rtl;',
        },
      ],
    },
    fpga: {
      board: 'basys3',
      part: 'xc7a35tcpg236-1',
      top: 'top',
      constraints: {
        type: 'xdc',
        text: 'set_property PACKAGE_PIN V17 [get_ports {SW0}]\nset_property PACKAGE_PIN U16 [get_ports {LD0}]',
      },
    },
    ioMapping: {
      inputs: [
        {
          id: 'internal_input_0',
          nodeId: 'sw0_node',
          port: 'SW0',
          label: '',
          pin: 'V17',
        },
      ],
      outputs: [
        {
          id: 'internal_output_0',
          nodeId: 'ld0_node',
          port: 'LD0',
          label: '',
          pin: 'U16',
        },
      ],
    },
    vectors: [{ tick: 0, inputs: { sw0: 1 }, expected: { ld0: 1 } }],
    meta: {
      projectId: 'rb-export-naming-fixture',
    },
  };
}

describe('buildExportViewModel canonical naming', () => {
  it('uses mapped port names when labels are blank', () => {
    const viewModel = buildExportViewModel(createExportFixture());

    const inputRow = viewModel.pinTable.find((row) => row.pin === 'V17');
    const outputRow = viewModel.pinTable.find((row) => row.pin === 'U16');

    expect(inputRow?.port).toBe('SW0');
    expect(outputRow?.port).toBe('LD0');
  });
});
