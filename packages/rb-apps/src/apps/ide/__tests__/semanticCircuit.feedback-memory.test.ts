import { describe, expect, it } from 'vitest';
import { elaborateCircuit, type Circuit } from '@redbyte/rb-logic-core';
import type { RBProject } from '../../../export/projectFormat';
import { buildDeterministicVerifyContext } from '../../../fpga/boards/basys3/verifySchedule';
import { canonicalizeSemanticCircuit } from '../../../circuit/semanticCircuit';
import { buildExportViewModel } from '../viewmodels/buildExportViewModel';

function makeNode(
  id: string,
  type: string,
  x: number,
  y: number,
  label = id
): Circuit['nodes'][number] {
  return {
    id,
    type,
    label,
    position: { x, y },
    x,
    y,
    rotation: 0,
    config: {},
    state: {},
  };
}

function makeFourNandDlatchCircuit(): Circuit {
  return {
    nodes: [
      makeNode('d_in', 'INPUT', 0, 0, 'D'),
      makeNode('en_in', 'INPUT', 0, 120, 'EN'),
      makeNode('n1', 'NAND', 180, 0, 'n1'),
      makeNode('n2', 'NAND', 180, 120, 'n2'),
      makeNode('n3', 'NAND', 360, 0, 'n3'),
      makeNode('n4', 'NAND', 360, 120, 'n4'),
      makeNode('q_out', 'OUTPUT', 560, 0, 'Q'),
    ],
    connections: [
      { from: { nodeId: 'd_in', portName: 'out' }, to: { nodeId: 'n1', portName: 'a' } },
      { from: { nodeId: 'en_in', portName: 'out' }, to: { nodeId: 'n1', portName: 'b' } },
      { from: { nodeId: 'n1', portName: 'out' }, to: { nodeId: 'n2', portName: 'a' } },
      { from: { nodeId: 'en_in', portName: 'out' }, to: { nodeId: 'n2', portName: 'b' } },
      { from: { nodeId: 'n1', portName: 'out' }, to: { nodeId: 'n3', portName: 'a' } },
      { from: { nodeId: 'n4', portName: 'out' }, to: { nodeId: 'n3', portName: 'b' } },
      { from: { nodeId: 'n2', portName: 'out' }, to: { nodeId: 'n4', portName: 'a' } },
      { from: { nodeId: 'n3', portName: 'out' }, to: { nodeId: 'n4', portName: 'b' } },
      { from: { nodeId: 'n3', portName: 'out' }, to: { nodeId: 'q_out', portName: 'in' } },
    ],
  };
}

function makeFourNandDlatchProject(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-27T00:00:00.000Z',
    updatedAt: '2026-03-27T00:00:00.000Z',
    name: 'Four NAND D Latch',
    description: 'Student-authored exact 4-NAND D latch',
    circuit: makeFourNandDlatchCircuit(),
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
        text: '',
      },
    },
    ioMapping: {
      inputs: [
        { id: 'map_d', nodeId: 'd_in', port: 'D', label: 'D', pin: 'V17' },
        { id: 'map_en', nodeId: 'en_in', port: 'EN', label: 'EN', pin: 'W16' },
      ],
      outputs: [{ id: 'map_q', nodeId: 'q_out', port: 'Q', label: 'Q', pin: 'U16' }],
    },
    vectors: [],
  };
}

describe('semantic feedback-memory canonicalization', () => {
  it('lifts an exact 4-NAND D-latch graph into a DLatch primitive for elaboration', () => {
    const semanticCircuit = canonicalizeSemanticCircuit(makeFourNandDlatchCircuit());

    expect(semanticCircuit.nodes.some((node) => node.type === 'DLatch')).toBe(true);
    expect(semanticCircuit.nodes.filter((node) => node.type === 'NAND')).toHaveLength(0);

    const { ir } = elaborateCircuit(semanticCircuit);
    expect(ir.features.hasCombinationalLoop).toBe(false);
  });

  it('treats the lifted latch as sequential in deterministic verify scheduling', () => {
    const context = buildDeterministicVerifyContext(makeFourNandDlatchCircuit(), {
      inputs: [
        { id: 'map_d', nodeId: 'd_in', port: 'D', label: 'D', pin: 'V17' },
        { id: 'map_en', nodeId: 'en_in', port: 'EN', label: 'EN', pin: 'W16' },
      ],
      outputs: [{ id: 'map_q', nodeId: 'q_out', port: 'Q', label: 'Q', pin: 'U16' }],
    });

    expect(context.simModel.isRunnable).toBe(true);
    expect(context.schedule.reason).toBe('circuit-sequential');
  });

  it('does not block export with RBEX4102 for the supported exact 4-NAND D-latch topology', () => {
    const viewModel = buildExportViewModel(makeFourNandDlatchProject());

    expect(viewModel.diagnostics.some((diagnostic) => diagnostic.code === 'RBEX4102')).toBe(false);
    expect(viewModel.status).toBe('ok');
  });
});
