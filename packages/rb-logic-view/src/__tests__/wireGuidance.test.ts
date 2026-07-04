import { describe, expect, it } from 'vitest';
import type { Circuit, Node } from '@redbyte/rb-logic-core';
import type { ChipMetadata } from '../components/NodeView';
import {
  describePortRefForStudents,
  describeWireRejectionForStudents,
  describeWireSourceCue,
  wirePortState,
} from '../tools/wireGuidance';

const circuit: Circuit = {
  nodes: [
    { id: 'input_a', type: 'INPUT', label: 'A', position: { x: 0, y: 0 } },
    { id: 'fa0', type: 'FullAdder', label: 'Full Adder', position: { x: 120, y: 0 } },
    { id: 'sum_out', type: 'OUTPUT', label: 'Sum', position: { x: 240, y: 0 } },
  ],
  connections: [],
};

const getChipMetadata = (nodeType: string, _node?: Node): ChipMetadata | undefined => {
  if (nodeType !== 'FullAdder') return undefined;
  return {
    name: 'Full Adder',
    inputs: [
      { id: 'A', name: 'A' },
      { id: 'B', name: 'B' },
      { id: 'Cin', name: 'Cin' },
    ],
    outputs: [
      { id: 'Sum', name: 'Sum' },
      { id: 'Cout', name: 'Cout' },
    ],
  };
};

describe('wire guidance', () => {
  it('names the source port instead of saying only source selected', () => {
    expect(
      describeWireSourceCue(circuit, { nodeId: 'input_a', portName: 'out' }, getChipMetadata)
    ).toBe('Source: A out (output). Click a green target port; Esc cancels.');
  });

  it('uses FullAdder metadata for student-facing port labels', () => {
    expect(
      describePortRefForStudents(circuit, { nodeId: 'fa0', portName: 'Cin' }, getChipMetadata)
    ).toBe('Full Adder Cin');
  });

  it('keeps the source explicit after an invalid target', () => {
    expect(
      describeWireRejectionForStudents(
        circuit,
        'Cannot connect output to output',
        { nodeId: 'input_a', portName: 'out' },
        { nodeId: 'fa0', portName: 'Sum' },
        getChipMetadata
      )
    ).toBe(
      'Outputs cannot be wired directly to each other. Source kept: A out. Full Adder Sum is not a compatible target; click a green target or press Esc.'
    );
  });

  it('classifies source, valid targets, and invalid targets for port affordances', () => {
    const validTargets = new Set(['fa0:A', 'fa0:B', 'fa0:Cin']);

    expect(wirePortState({ nodeId: 'input_a', portName: 'out' }, 'input_a', 'out', validTargets)).toBe('source');
    expect(wirePortState({ nodeId: 'input_a', portName: 'out' }, 'fa0', 'Cin', validTargets)).toBe('valid-target');
    expect(wirePortState({ nodeId: 'input_a', portName: 'out' }, 'fa0', 'Sum', validTargets)).toBe('invalid-target');
    expect(wirePortState(null, 'fa0', 'Sum', validTargets)).toBe('idle');
  });
});
