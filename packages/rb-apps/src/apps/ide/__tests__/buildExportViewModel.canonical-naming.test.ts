import { describe, expect, it } from 'vitest';
import type { RBProject } from '../../../export/projectFormat';
import { getIdeExampleById } from '../examplesCatalog';
import { validateArtifactConsistency } from '../../../fpga/boards/basys3/basys3ExportService';
import { buildExportViewModel } from '../viewmodels/buildExportViewModel';

function createExportFixture(vectorStyle: 'normalized-label' | 'node-id' = 'normalized-label'): RBProject {
  const vectors =
    vectorStyle === 'node-id'
      ? [{ tick: 0, inputs: { sw0_node: 1 }, expected: { ld0_node: 1 } }]
      : [{ tick: 0, inputs: { sw0: 1 }, expected: { ld0: 1 } }];

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
    vectors,
    meta: {
      projectId: 'rb-export-naming-fixture',
    },
  };
}

function createProjectFromExample(exampleId: string): RBProject {
  const example = getIdeExampleById(exampleId);
  if (!example) {
    throw new Error(`Missing example fixture: ${exampleId}`);
  }

  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-13T00:00:00.000Z',
    updatedAt: '2026-03-13T00:00:00.000Z',
    name: example.name,
    description: example.summary,
    circuit: {
      nodes: example.circuit.nodes.map((node) => ({ ...node })),
      connections: example.circuit.connections.map((connection) => ({
        ...connection,
        from: typeof connection.from === 'string' ? connection.from : { ...connection.from },
        to: typeof connection.to === 'string' ? connection.to : { ...connection.to },
      })),
    },
    ioMapping: {
      inputs: example.ioRows
        .filter((row) => row.direction === 'in')
        .map((row) => ({
          id: row.id,
          nodeId: row.nodeId,
          port: row.port,
          label: row.label,
          pin: row.pin,
        })),
      outputs: example.ioRows
        .filter((row) => row.direction === 'out')
        .map((row) => ({
          id: row.id,
          nodeId: row.nodeId,
          port: row.port,
          label: row.label,
          pin: row.pin,
        })),
    },
    vectors: example.vectors.map((vector) => ({
      tick: vector.tick,
      inputs: { ...vector.inputs },
      expected: vector.expected ? { ...vector.expected } : undefined,
    })),
    fpga: {
      board: 'basys3',
      top: 'top',
    },
    meta: {
      projectId: `example-${example.id}`,
    },
  };
}

function getArtifactContent(project: RBProject, path: string): string {
  const viewModel = buildExportViewModel(project);
  expect(viewModel.status).toBe('ok');
  expect(viewModel.errors).toEqual([]);

  const artifact = viewModel.artifacts.find((candidate) => candidate.path === path);
  expect(artifact?.content).toBeTruthy();
  return artifact?.content ?? '';
}

describe('buildExportViewModel canonical naming', () => {
  it('uses mapped port names when labels are blank', () => {
    const viewModel = buildExportViewModel(createExportFixture());

    const inputRow = viewModel.pinTable.find((row) => row.pin === 'V17');
    const outputRow = viewModel.pinTable.find((row) => row.pin === 'U16');

    expect(inputRow?.port).toBe('SW0');
    expect(outputRow?.port).toBe('LD0');
  });

  it('accepts normalized label vector keys without creating phantom testbench ports', () => {
    const project = createExportFixture('normalized-label');
    const topVhd = getArtifactContent(project, 'top.vhd');
    const testbenchVhd = getArtifactContent(project, 'testbench.vhd');

    expect(validateArtifactConsistency(topVhd, testbenchVhd)).toEqual([]);
  });

  it('accepts nodeId vector keys without creating phantom testbench ports', () => {
    const project = createExportFixture('node-id');
    const topVhd = getArtifactContent(project, 'top.vhd');
    const testbenchVhd = getArtifactContent(project, 'testbench.vhd');

    expect(validateArtifactConsistency(topVhd, testbenchVhd)).toEqual([]);
  });

  it('keeps the logic-gates starter exportable without false RBEX9000 blockers', () => {
    const project = createProjectFromExample('logic-gates');
    const topVhd = getArtifactContent(project, 'top.vhd');
    const testbenchVhd = getArtifactContent(project, 'testbench.vhd');

    expect(validateArtifactConsistency(topVhd, testbenchVhd)).toEqual([]);
  });
});
