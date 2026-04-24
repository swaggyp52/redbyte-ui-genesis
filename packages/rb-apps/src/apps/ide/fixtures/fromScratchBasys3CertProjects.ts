/**
 * From-scratch Basys3 certification fixtures.
 *
 * These RBProject snapshots mirror what students save from a blank project (no
 * `sourceExampleId`, `projectKind: 'blank'`) while using the same circuit/export
 * shape as hand-authored designs. They are NOT loaded from `examplesCatalog`.
 */

import type { RBProject } from '../../../export/projectFormat';
import { createRBProject } from '../../../export/projectFormat';

const CERT_NOW = '2026-04-23T20:00:00.000Z';

/** Combinational: SW0 ∧ SW1 → LD0. Basys3 aliases only (no raw package pins). */
export function createFromScratchCombSwitchAndBasys3Project(): RBProject {
  return createRBProject({
    createdAt: CERT_NOW,
    name: 'FS Comb: SW0 AND SW1 → LD0',
    description:
      'Certification fixture: blank-project-class combinational AND with Basys3 mapping (student-shaped save).',
    circuit: {
      nodes: [
        { id: 'sw0_node', type: 'INPUT', x: 100, y: 140, label: 'SW0', config: {}, state: {} },
        { id: 'sw1_node', type: 'INPUT', x: 100, y: 280, label: 'SW1', config: {}, state: {} },
        { id: 'and_gate', type: 'AND', x: 320, y: 200, label: 'AND', config: {}, state: {} },
        { id: 'ld0_node', type: 'OUTPUT', x: 520, y: 200, label: 'LD0', config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'sw0_node', portName: 'out' }, to: { nodeId: 'and_gate', portName: 'a' } },
        { from: { nodeId: 'sw1_node', portName: 'out' }, to: { nodeId: 'and_gate', portName: 'b' } },
        { from: { nodeId: 'and_gate', portName: 'out' }, to: { nodeId: 'ld0_node', portName: 'in' } },
      ],
    },
    ioMapping: {
      inputs: [
        { id: 'sw0', nodeId: 'sw0_node', port: 'out', label: 'SW0', pin: 'SW0' },
        { id: 'sw1', nodeId: 'sw1_node', port: 'out', label: 'SW1', pin: 'SW1' },
      ],
      outputs: [{ id: 'ld0', nodeId: 'ld0_node', port: 'in', label: 'LD0', pin: 'LD0' }],
    },
    vectors: [
      { tick: 0, inputs: { sw0_node: 0, sw1_node: 0 }, expected: { ld0_node: 0 } },
      { tick: 1, inputs: { sw0_node: 1, sw1_node: 0 }, expected: { ld0_node: 0 } },
      { tick: 2, inputs: { sw0_node: 0, sw1_node: 1 }, expected: { ld0_node: 0 } },
      { tick: 3, inputs: { sw0_node: 1, sw1_node: 1 }, expected: { ld0_node: 1 } },
    ],
    fpga: { board: 'basys3', part: 'xc7a35tcpg236-1', top: 'top' },
    meta: {
      projectId: 'fs-comb-switch-and-basys3',
      projectKind: 'blank',
      sourceExampleId: null,
      scenarioAuthority: 'authored',
      tags: ['from-scratch-cert', 'combinational', 'basys3'],
    },
  });
}

/**
 * Sequential: 2-bit up counter with CLK100MHZ, SW0 enable, BTNC sync reset, LD0/LD1.
 * Gate-level graph matches the curated teaching counter; this copy exists so certification
 * does not depend on `examplesCatalog` or `activeExampleId`.
 */
export function createFromScratchSeqTwoBitCounterBasys3Project(): RBProject {
  return createRBProject({
    createdAt: CERT_NOW,
    name: 'FS Seq: 2-bit counter (Basys3)',
    description:
      'Certification fixture: blank-project-class clocked counter with board oscillator + real IO aliases.',
    circuit: {
      nodes: [
        { id: 'clk_node', type: 'INPUT', x: 90, y: 100, label: 'CLK100MHZ', config: {}, state: {} },
        { id: 'en_node', type: 'INPUT', x: 90, y: 220, label: 'EN', config: {}, state: {} },
        { id: 'rst_node', type: 'INPUT', x: 90, y: 340, label: 'RST', config: {}, state: {} },
        { id: 'xor0', type: 'XOR', x: 270, y: 100, label: 'XOR0', config: {}, state: {} },
        { id: 'and_en', type: 'AND', x: 270, y: 200, label: 'AND', config: {}, state: {} },
        { id: 'xor1', type: 'XOR', x: 270, y: 290, label: 'XOR1', config: {}, state: {} },
        { id: 'rst_not', type: 'NOT', x: 270, y: 380, label: 'NOT', config: {}, state: {} },
        { id: 'd0_rst', type: 'AND', x: 420, y: 100, label: 'RST0', config: {}, state: {} },
        { id: 'd1_rst', type: 'AND', x: 420, y: 290, label: 'RST1', config: {}, state: {} },
        { id: 'q0_ff', type: 'DFlipFlop', x: 560, y: 100, label: 'Q0', config: {}, state: {} },
        { id: 'q1_ff', type: 'DFlipFlop', x: 560, y: 290, label: 'Q1', config: {}, state: {} },
        { id: 'q0_out', type: 'OUTPUT', x: 720, y: 100, label: 'LD0', config: {}, state: {} },
        { id: 'q1_out', type: 'OUTPUT', x: 720, y: 290, label: 'LD1', config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'q0_ff', portName: 'Q' }, to: { nodeId: 'xor0', portName: 'a' } },
        { from: { nodeId: 'en_node', portName: 'out' }, to: { nodeId: 'xor0', portName: 'b' } },
        { from: { nodeId: 'q0_ff', portName: 'Q' }, to: { nodeId: 'and_en', portName: 'a' } },
        { from: { nodeId: 'en_node', portName: 'out' }, to: { nodeId: 'and_en', portName: 'b' } },
        { from: { nodeId: 'q1_ff', portName: 'Q' }, to: { nodeId: 'xor1', portName: 'a' } },
        { from: { nodeId: 'and_en', portName: 'out' }, to: { nodeId: 'xor1', portName: 'b' } },
        { from: { nodeId: 'rst_node', portName: 'out' }, to: { nodeId: 'rst_not', portName: 'in' } },
        { from: { nodeId: 'xor0', portName: 'out' }, to: { nodeId: 'd0_rst', portName: 'a' } },
        { from: { nodeId: 'rst_not', portName: 'out' }, to: { nodeId: 'd0_rst', portName: 'b' } },
        { from: { nodeId: 'd0_rst', portName: 'out' }, to: { nodeId: 'q0_ff', portName: 'D' } },
        { from: { nodeId: 'xor1', portName: 'out' }, to: { nodeId: 'd1_rst', portName: 'a' } },
        { from: { nodeId: 'rst_not', portName: 'out' }, to: { nodeId: 'd1_rst', portName: 'b' } },
        { from: { nodeId: 'd1_rst', portName: 'out' }, to: { nodeId: 'q1_ff', portName: 'D' } },
        { from: { nodeId: 'clk_node', portName: 'out' }, to: { nodeId: 'q0_ff', portName: 'CLK' } },
        { from: { nodeId: 'clk_node', portName: 'out' }, to: { nodeId: 'q1_ff', portName: 'CLK' } },
        { from: { nodeId: 'q0_ff', portName: 'Q' }, to: { nodeId: 'q0_out', portName: 'in' } },
        { from: { nodeId: 'q1_ff', portName: 'Q' }, to: { nodeId: 'q1_out', portName: 'in' } },
      ],
    },
    ioMapping: {
      inputs: [
        { id: 'clk', nodeId: 'clk_node', port: 'out', label: 'CLK100MHZ', pin: 'CLK100MHZ' },
        { id: 'en', nodeId: 'en_node', port: 'out', label: 'SW0', pin: 'SW0' },
        { id: 'rst', nodeId: 'rst_node', port: 'out', label: 'BTNC', pin: 'BTNC' },
      ],
      outputs: [
        { id: 'q0', nodeId: 'q0_out', port: 'in', label: 'LD0', pin: 'LD0' },
        { id: 'q1', nodeId: 'q1_out', port: 'in', label: 'LD1', pin: 'LD1' },
      ],
    },
    vectors: [
      { tick: 0, inputs: { clk_node: 0, en_node: 0, rst_node: 1 }, expected: { q0_out: 0, q1_out: 0 } },
      { tick: 1, inputs: { clk_node: 0, en_node: 0, rst_node: 0 }, expected: { q0_out: 0, q1_out: 0 } },
      { tick: 2, inputs: { clk_node: 0, en_node: 1, rst_node: 0 }, expected: { q0_out: 1, q1_out: 0 } },
      { tick: 3, inputs: { clk_node: 0, en_node: 1, rst_node: 0 }, expected: { q0_out: 0, q1_out: 1 } },
      { tick: 4, inputs: { clk_node: 0, en_node: 1, rst_node: 0 }, expected: { q0_out: 1, q1_out: 1 } },
      { tick: 5, inputs: { clk_node: 0, en_node: 1, rst_node: 0 }, expected: { q0_out: 0, q1_out: 0 } },
      { tick: 6, inputs: { clk_node: 0, en_node: 0, rst_node: 0 }, expected: { q0_out: 0, q1_out: 0 } },
    ],
    fpga: { board: 'basys3', part: 'xc7a35tcpg236-1', top: 'top' },
    meta: {
      projectId: 'fs-seq-two-bit-counter-basys3',
      projectKind: 'blank',
      sourceExampleId: null,
      scenarioAuthority: 'authored',
      tags: ['from-scratch-cert', 'sequential', 'basys3', 'board-clock'],
    },
  });
}

export const FROM_SCRATCH_BASYS3_CERT_FIXTURE_IDS = [
  'fs-comb-switch-and-basys3',
  'fs-seq-two-bit-counter-basys3',
] as const;

export function getFromScratchBasys3CertProjectById(
  id: (typeof FROM_SCRATCH_BASYS3_CERT_FIXTURE_IDS)[number]
): RBProject {
  switch (id) {
    case 'fs-comb-switch-and-basys3':
      return createFromScratchCombSwitchAndBasys3Project();
    case 'fs-seq-two-bit-counter-basys3':
      return createFromScratchSeqTwoBitCounterBasys3Project();
    default: {
      const _exhaustive: never = id;
      throw new Error(`unknown from-scratch fixture: ${_exhaustive}`);
    }
  }
}
