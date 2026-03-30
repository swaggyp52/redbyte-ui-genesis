import { describe, expect, it } from 'vitest';
import type { RBProject } from '../../../export/projectFormat';
import { getIdeExampleById } from '../examplesCatalog';
import { validateArtifactConsistency } from '../../../fpga/boards/basys3/basys3ExportService';
import { buildExportViewModel } from '../viewmodels/buildExportViewModel';
import type { VerifyScenario } from '../verifyScenario';

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

function createRenamedBoundaryDuplicateFixture(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-21T00:00:00.000Z',
    updatedAt: '2026-03-21T00:00:00.000Z',
    name: 'Export Rename Survivor Fixture',
    description: 'Export should follow the live boundary label when stale duplicate rows remain.',
    circuit: {
      nodes: [
        {
          id: 'sw0_node',
          type: 'INPUT',
          label: 'sw0',
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
          label: 'ld0_live',
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
    ioMapping: {
      inputs: [
        {
          id: 'sw0',
          nodeId: 'sw0_node',
          port: 'out',
          label: 'sw0',
          pin: 'V17',
        },
      ],
      outputs: [
        {
          id: 'ld0_stale',
          nodeId: 'ld0_node',
          port: 'in',
          label: 'ld0_old',
          pin: '',
        },
        {
          id: 'ld0_live',
          nodeId: 'ld0_node',
          port: 'in',
          label: 'ld0_live',
          pin: 'U16',
        },
      ],
    },
    vectors: [{ tick: 0, inputs: { sw0: 1 }, expected: { ld0_live: 1 } }],
    meta: {
      projectId: 'rb-export-rename-survivor-fixture',
    },
  };
}

function createDeletedBoundaryOrphanFixture(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-21T00:00:00.000Z',
    updatedAt: '2026-03-21T00:00:00.000Z',
    name: 'Export Orphan Fixture',
    description: 'Export should ignore mapping rows whose boundary node was deleted from the live circuit.',
    circuit: {
      nodes: [
        {
          id: 'sw0_node',
          type: 'INPUT',
          label: 'sw0',
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
          label: 'ld0',
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
    ioMapping: {
      inputs: [
        {
          id: 'sw0',
          nodeId: 'sw0_node',
          port: 'out',
          label: 'sw0',
          pin: 'V17',
        },
      ],
      outputs: [
        {
          id: 'ld0',
          nodeId: 'ld0_node',
          port: 'in',
          label: 'ld0',
          pin: 'U16',
        },
        {
          id: 'ghost_output',
          nodeId: 'ghost_output_node',
          port: 'in',
          label: 'ghost_output',
          pin: 'LD9',
        },
      ],
    },
    vectors: [{ tick: 0, inputs: { sw0: 1 }, expected: { ld0: 1 } }],
    meta: {
      projectId: 'rb-export-orphan-fixture',
    },
  };
}

function createDuplicateLabelStableIdFixture(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-30T00:00:00.000Z',
    updatedAt: '2026-03-30T00:00:00.000Z',
    name: 'Duplicate Label Stable Id Fixture',
    description: 'Export should resolve stable row ids even when boundary labels collide.',
    circuit: {
      nodes: [
        {
          id: 'input_a',
          type: 'INPUT',
          label: 'Input 1',
          position: { x: 0, y: 0 },
          x: 0,
          y: 0,
          rotation: 0,
          config: {},
          state: {},
        },
        {
          id: 'input_b',
          type: 'INPUT',
          label: 'Input 1',
          position: { x: 0, y: 120 },
          x: 0,
          y: 120,
          rotation: 0,
          config: {},
          state: {},
        },
        {
          id: 'and_0',
          type: 'AND',
          label: 'AND 1',
          position: { x: 160, y: 60 },
          x: 160,
          y: 60,
          rotation: 0,
          config: {},
          state: {},
        },
        {
          id: 'output_node',
          type: 'OUTPUT',
          label: 'Output 1',
          position: { x: 320, y: 60 },
          x: 320,
          y: 60,
          rotation: 0,
          config: {},
          state: {},
        },
      ],
      connections: [
        {
          from: { nodeId: 'input_a', portName: 'out' },
          to: { nodeId: 'and_0', portName: 'in1' },
        },
        {
          from: { nodeId: 'input_b', portName: 'out' },
          to: { nodeId: 'and_0', portName: 'in2' },
        },
        {
          from: { nodeId: 'and_0', portName: 'out' },
          to: { nodeId: 'output_node', portName: 'in' },
        },
      ],
    },
    ioMapping: {
      inputs: [
        {
          id: 'input_1',
          nodeId: 'input_a',
          port: 'out',
          label: 'Input 1',
          pin: 'SW0',
        },
        {
          id: 'input_1_2',
          nodeId: 'input_b',
          port: 'out',
          label: 'Input 1',
          pin: 'SW1',
        },
      ],
      outputs: [
        {
          id: 'output_1',
          nodeId: 'output_node',
          port: 'in',
          label: 'Output 1',
          pin: 'LD0',
        },
      ],
    },
    vectors: [
      { tick: 0, inputs: { input_1: 0, input_1_2: 0 }, expected: { output_1: 0 } },
      { tick: 1, inputs: { input_1: 0, input_1_2: 1 }, expected: { output_1: 0 } },
      { tick: 2, inputs: { input_1: 1, input_1_2: 0 }, expected: { output_1: 0 } },
      { tick: 3, inputs: { input_1: 1, input_1_2: 1 }, expected: { output_1: 1 } },
    ],
    meta: {
      projectId: 'rb-export-duplicate-label-stable-id-fixture',
    },
  };
}

function createRuntimeStableIdScenarioFixture(): { project: RBProject; activeScenario: VerifyScenario } {
  const project: RBProject = {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-30T00:00:00.000Z',
    updatedAt: '2026-03-30T00:00:00.000Z',
    name: 'Runtime Stable Id Scenario Fixture',
    description: 'Runtime-backed export should resolve stable ids against entity refs.',
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
          id: 'sw1_node',
          type: 'INPUT',
          label: 'SW1',
          position: { x: 0, y: 120 },
          x: 0,
          y: 120,
          rotation: 0,
          config: {},
          state: {},
        },
        {
          id: 'and_0',
          type: 'AND',
          label: 'AND 1',
          position: { x: 160, y: 60 },
          x: 160,
          y: 60,
          rotation: 0,
          config: {},
          state: {},
        },
        {
          id: 'ld0_node',
          type: 'OUTPUT',
          label: 'LD0',
          position: { x: 320, y: 60 },
          x: 320,
          y: 60,
          rotation: 0,
          config: {},
          state: {},
        },
      ],
      connections: [
        {
          from: { nodeId: 'sw0_node', portName: 'out' },
          to: { nodeId: 'and_0', portName: 'in1' },
        },
        {
          from: { nodeId: 'sw1_node', portName: 'out' },
          to: { nodeId: 'and_0', portName: 'in2' },
        },
        {
          from: { nodeId: 'and_0', portName: 'out' },
          to: { nodeId: 'ld0_node', portName: 'in' },
        },
      ],
    },
    ioMapping: {
      inputs: [
        {
          id: 'input_1',
          nodeId: 'sw0_node',
          port: 'out',
          label: 'SW0',
          pin: 'SW0',
        },
        {
          id: 'input_2',
          nodeId: 'sw1_node',
          port: 'out',
          label: 'SW1',
          pin: 'SW1',
        },
      ],
      outputs: [
        {
          id: 'output_1',
          nodeId: 'ld0_node',
          port: 'in',
          label: 'LD0',
          pin: 'LD0',
        },
      ],
    },
    vectors: [
      { tick: 0, inputs: { SW0: 0, SW1: 0 }, expected: { LD0: 0 } },
      { tick: 1, inputs: { SW0: 0, SW1: 1 }, expected: { LD0: 0 } },
      { tick: 2, inputs: { SW0: 1, SW1: 0 }, expected: { LD0: 0 } },
      { tick: 3, inputs: { SW0: 1, SW1: 1 }, expected: { LD0: 1 } },
    ],
    meta: {
      projectId: 'rb-export-runtime-stable-id-fixture',
    },
  };

  const activeScenario: VerifyScenario = {
    id: 'default',
    name: 'Default',
    version: 1,
    createdAt: '2026-03-30T00:00:00.000Z',
    updatedAt: '2026-03-30T00:00:00.000Z',
    vectors: [
      { tick: 0, inputs: { input_1: 0, input_2: 0 }, expected: { output_1: 0 } },
      { tick: 1, inputs: { input_1: 0, input_2: 1 }, expected: { output_1: 0 } },
      { tick: 2, inputs: { input_1: 1, input_2: 0 }, expected: { output_1: 0 } },
      { tick: 3, inputs: { input_1: 1, input_2: 1 }, expected: { output_1: 1 } },
    ],
  };

  return { project, activeScenario };
}

function getArtifactContent(project: RBProject, path: string): string {
  const viewModel = buildExportViewModel(project);
  expect(viewModel.status).toBe('ok');
  expect(viewModel.errors).toEqual([]);

  const artifact = viewModel.artifacts.find((candidate) => candidate.path === path);
  expect(artifact?.content).toBeTruthy();
  return artifact?.content ?? '';
}

function getArtifactContentFromViewModel(
  viewModel: ReturnType<typeof buildExportViewModel>,
  path: string
): string {
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

  it('suppresses projection-only HDL/XDC mismatch warnings for live Signal Tour export', () => {
    const project = createProjectFromExample('signal-tour');
    // Mirror the live app: fpga.top and hdl.top are both 'top', and the
    // generated VHDL entity is also named 'top'.  The entity has no ports
    // because INPUT/OUTPUT-only circuits produce stub VHDL that merely
    // reserves the entity name.  The scaffold-warning filter must suppress
    // every resulting HDL/XDC mismatch warning so the export stays 'ok'.
    project.hdl = {
      top: 'top',
      sources: [
        {
          path: 'top.vhd',
          language: 'vhdl',
          text: 'entity top is end top; architecture rtl of top is begin end rtl;',
        },
      ],
    };

    const viewModel = buildExportViewModel(project);
    const warningMessages = viewModel.warnings.map((warning) => warning.message);
    const errorMessages = viewModel.errors.map((error) => error.message);

    expect(viewModel.status).toBe('ok');
    expect(errorMessages).toEqual([]);
    expect(warningMessages.some((message) => /HDL ports missing in XDC/i.test(message))).toBe(false);
    expect(warningMessages.some((message) => /XDC ports missing in HDL/i.test(message))).toBe(false);
    expect(warningMessages.some((message) => /Bundle validation failed/i.test(message))).toBe(false);
  });

  it('resolves duplicate-label stable vector ids onto declared entity refs', () => {
    const project = createDuplicateLabelStableIdFixture();
    const topVhd = getArtifactContent(project, 'top.vhd');
    const testbenchVhd = getArtifactContent(project, 'testbench.vhd');

    expect(testbenchVhd).toContain("SW(0) <= '0';");
    expect(testbenchVhd).toContain("SW(1) <= '0';");
    expect(testbenchVhd).toContain('assert LED =');
    expect(testbenchVhd).not.toContain('input_1 <=');
    expect(testbenchVhd).not.toContain('input_1_2 <=');
    expect(testbenchVhd).not.toContain('assert output_1 =');
    expect(validateArtifactConsistency(topVhd, testbenchVhd)).toEqual([]);
  });

  it('resolves stable scenario ids in the runtime-backed export path', () => {
    const { project, activeScenario } = createRuntimeStableIdScenarioFixture();
    const viewModel = buildExportViewModel(project, undefined, activeScenario);

    expect(viewModel.status).toBe('ok');

    const topVhd = getArtifactContentFromViewModel(viewModel, 'top.vhd');
    const testbenchVhd = getArtifactContentFromViewModel(viewModel, 'testbench.vhd');

    expect(testbenchVhd).toContain("SW(0) <= '0';");
    expect(testbenchVhd).toContain("SW(1) <= '0';");
    expect(testbenchVhd).toContain('assert LED =');
    expect(testbenchVhd).not.toContain('input_1 <=');
    expect(testbenchVhd).not.toContain('input_2 <=');
    expect(testbenchVhd).not.toContain('assert output_1 =');
    expect(validateArtifactConsistency(topVhd, testbenchVhd)).toEqual([]);
  });

  it('flags undeclared stimulus refs even when component ports still match the entity', () => {
    const { project } = createRuntimeStableIdScenarioFixture();
    const topVhd = getArtifactContent(project, 'top.vhd');
    const testbenchVhd = getArtifactContent(project, 'testbench.vhd');
    const brokenTestbench = testbenchVhd.replace('SW(0)', 'input_1');

    const issues = validateArtifactConsistency(topVhd, brokenTestbench);

    expect(issues.some((issue) => issue.includes('stimulus target "input_1"') && issue.includes('not declared'))).toBe(true);
  });

  it('collapses stale duplicate mapping rows onto the live renamed boundary label', () => {
    const viewModel = buildExportViewModel(createRenamedBoundaryDuplicateFixture());
    const liveRows = viewModel.pinTable.filter((row) => row.port === 'ld0_live');

    expect(liveRows).toHaveLength(1);
    expect(liveRows[0]?.pin).toBe('U16');
    expect(viewModel.pinTable.some((row) => row.port === 'ld0_old')).toBe(false);
  });

  it('drops orphan mapping rows whose boundary node no longer exists in the live circuit', () => {
    const viewModel = buildExportViewModel(createDeletedBoundaryOrphanFixture());

    expect(viewModel.pinTable.some((row) => row.port === 'ghost_output')).toBe(false);
    expect(viewModel.pinTable.find((row) => row.port === 'ld0')?.pin).toBe('U16');
  });
});
