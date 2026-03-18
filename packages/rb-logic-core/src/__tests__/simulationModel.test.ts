import { describe, expect, it } from 'vitest';
import type { Circuit } from '../types';
import { elaborateCircuit } from '../ir/elaborator';
import { buildSimulationModel } from '../ir/simulationModel';

function buildPassthroughCircuit(): Circuit {
  return {
    nodes: [
      { id: 'sw0_node', type: 'INPUT', label: 'SW[0]', position: { x: 0, y: 0 } },
      { id: 'ld0_node', type: 'OUTPUT', label: 'LD[0]', position: { x: 160, y: 0 } },
    ],
    connections: [
      {
        from: { nodeId: 'sw0_node', portName: 'out' },
        to: { nodeId: 'ld0_node', portName: 'in' },
      },
    ],
  };
}

function buildSequentialCircuit(): Circuit {
  return {
    nodes: [
      { id: 'd_node', type: 'INPUT', label: 'D', position: { x: 0, y: 0 } },
      { id: 'clk_node', type: 'INPUT', label: 'CLK', position: { x: 0, y: 80 } },
      { id: 'rst_node', type: 'INPUT', label: 'RST', position: { x: 0, y: 160 } },
      { id: 'ff_node', type: 'DFlipFlop', label: 'ff0', position: { x: 240, y: 80 } },
      { id: 'q_node', type: 'OUTPUT', label: 'Q', position: { x: 420, y: 80 } },
    ],
    connections: [
      {
        from: { nodeId: 'd_node', portName: 'out' },
        to: { nodeId: 'ff_node', portName: 'D' },
      },
      {
        from: { nodeId: 'clk_node', portName: 'out' },
        to: { nodeId: 'ff_node', portName: 'CLK' },
      },
      {
        from: { nodeId: 'rst_node', portName: 'out' },
        to: { nodeId: 'ff_node', portName: 'RST' },
      },
      {
        from: { nodeId: 'ff_node', portName: 'Q' },
        to: { nodeId: 'q_node', portName: 'in' },
      },
    ],
  };
}

function buildInvalidSequentialCircuit(): Circuit {
  return {
    nodes: [
      { id: 'd_node', type: 'INPUT', label: 'D', position: { x: 0, y: 0 } },
      { id: 'ff_node', type: 'DFlipFlop', label: 'ff0', position: { x: 160, y: 0 } },
      { id: 'q_node', type: 'OUTPUT', label: 'Q', position: { x: 320, y: 0 } },
    ],
    connections: [
      {
        from: { nodeId: 'd_node', portName: 'out' },
        to: { nodeId: 'ff_node', portName: 'D' },
      },
      {
        from: { nodeId: 'ff_node', portName: 'Q' },
        to: { nodeId: 'q_node', portName: 'in' },
      },
    ],
  };
}

describe('buildSimulationModel', () => {
  it('groups canonical boundary ports and derives output bindings from IR nets', () => {
    const { ir } = elaborateCircuit(buildPassthroughCircuit());
    const model = buildSimulationModel(ir);

    expect(model.irHash).toBe(ir.irHash);
    expect(model.isRunnable).toBe(true);
    expect(model.inputs).toEqual([
      {
        portId: 'sw0_node',
        sourceNodeId: 'sw0_node',
        canonicalName: 'SW[0]',
        kind: 'input',
        width: 1,
      },
    ]);
    expect(model.outputs).toEqual([
      {
        portId: 'ld0_node',
        sourceNodeId: 'ld0_node',
        canonicalName: 'LD[0]',
        kind: 'output',
        width: 1,
      },
    ]);
    expect(model.outputBindings).toEqual([
      {
        outputPortId: 'ld0_node',
        driverNetName: 'SW[0]',
        driverSourceNodeId: 'sw0_node',
      },
    ]);
  });

  it('derives clock and reset boundary bindings from structural IR only', () => {
    const { ir } = elaborateCircuit(buildSequentialCircuit());
    const model = buildSimulationModel(ir);

    expect(model.isRunnable).toBe(true);
    expect(model.clockBindings).toEqual([
      {
        primitiveId: 'ff_node',
        netName: 'CLK',
        boundarySourceNodeId: 'clk_node',
        canonicalName: 'CLK',
      },
    ]);
    expect(model.resetBindings).toEqual([
      {
        primitiveId: 'ff_node',
        netName: 'RST',
        boundarySourceNodeId: 'rst_node',
        canonicalName: 'RST',
      },
    ]);
    expect(model.resets).toEqual([
      {
        portId: 'rst_node',
        sourceNodeId: 'rst_node',
        canonicalName: 'RST',
        kind: 'reset',
        width: 1,
      },
    ]);
  });

  it('marks blocking IR diagnostics as non-runnable', () => {
    const { ir } = elaborateCircuit(buildInvalidSequentialCircuit());
    const model = buildSimulationModel(ir);

    expect(ir.isValid).toBe(false);
    expect(model.isRunnable).toBe(false);
    expect(model.blockingDiagnostics.some((diagnostic) => diagnostic.code === 'IR004')).toBe(true);
  });
});
