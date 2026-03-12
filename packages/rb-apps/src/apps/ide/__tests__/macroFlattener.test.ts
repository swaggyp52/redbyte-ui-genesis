import { describe, expect, it } from 'vitest';
import { createRBProject, decodeRBProject } from '../../../export/projectFormat';
import { buildExportViewModel } from '../viewmodels/buildExportViewModel';
import { flattenProjectMacros } from '../macros/macroFlattener';
import { getInstantiationTemplate, saveMacro } from '../macros/MacroLibrary';

function buildProjectWithMacro() {
  const baseCircuit = {
    nodes: [
      {
        id: 'node-v2-1',
        type: 'INPUT',
        label: 'A',
        position: { x: 0, y: 0 },
        rotation: 0,
        config: {},
        state: {},
      },
      {
        id: 'node-v2-2',
        type: 'INPUT',
        label: 'B',
        position: { x: 0, y: 80 },
        rotation: 0,
        config: {},
        state: {},
      },
      {
        id: 'node-v2-3',
        type: 'AND',
        position: { x: 140, y: 40 },
        rotation: 0,
        config: {},
        state: {},
      },
      {
        id: 'node-v2-4',
        type: 'OUTPUT',
        label: 'Q',
        position: { x: 280, y: 40 },
        rotation: 0,
        config: {},
        state: {},
      },
    ],
    connections: [
      { from: { nodeId: 'node-v2-1', portName: 'out' }, to: { nodeId: 'node-v2-3', portName: 'a' } },
      { from: { nodeId: 'node-v2-2', portName: 'out' }, to: { nodeId: 'node-v2-3', portName: 'b' } },
      { from: { nodeId: 'node-v2-3', portName: 'out' }, to: { nodeId: 'node-v2-4', portName: 'in' } },
    ],
  };

  const { macro } = saveMacro([], {
    circuit: baseCircuit,
    selectedNodeIds: new Set(['node-v2-3']),
    name: 'AND Gate',
    createdAt: 1710000000000,
    idFactory: () => 'macro-and-gate',
  });
  const template = getInstantiationTemplate([macro], macro.id, baseCircuit, { x: 520, y: 220 }, {
    nextInstanceIndex: 1,
  });

  const circuit = {
    nodes: [...baseCircuit.nodes, ...template.nodes],
    connections: [...baseCircuit.connections, ...template.connections],
  };

  return createRBProject({
    createdAt: '2026-03-11T00:00:00.000Z',
    name: 'macro-export-fixture',
    description: 'Project with reusable macro library',
    circuit,
    ioMapping: {
      inputs: [
        { id: 'a', nodeId: 'node-v2-1', port: 'out', label: 'A', pin: 'V17' },
        { id: 'b', nodeId: 'node-v2-2', port: 'out', label: 'B', pin: 'V16' },
      ],
      outputs: [{ id: 'q', nodeId: 'node-v2-4', port: 'in', label: 'Q', pin: 'U16' }],
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
    fpga: { board: 'basys3', top: 'top' },
    macros: [macro],
  });
}

describe('macroFlattener', () => {
  it('removes the macro library from the export project while preserving the expanded circuit', () => {
    const project = buildProjectWithMacro();

    const flattened = flattenProjectMacros(project);

    expect(flattened.macros).toBeUndefined();
    expect(flattened.circuit.nodes).toHaveLength(project.circuit.nodes.length);
    expect(flattened.circuit.connections).toHaveLength(project.circuit.connections.length);
  });

  it('emits a flattened project.rbproj.json artifact with no macro library payload', () => {
    const project = buildProjectWithMacro();

    const viewModel = buildExportViewModel(project);
    const rbprojArtifact = viewModel.artifacts.find((artifact) => artifact.path === 'project.rbproj.json');

    expect(rbprojArtifact).toBeTruthy();
    const decoded = decodeRBProject(rbprojArtifact!.content);
    expect(decoded.macros).toBeUndefined();
    expect(decoded.circuit.nodes).toHaveLength(project.circuit.nodes.length);
  });
});