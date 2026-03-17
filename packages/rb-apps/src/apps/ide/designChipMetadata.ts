import type { ChipMetadata } from '@redbyte/rb-logic-view';

export type DesignIssueRole = 'logic' | 'source' | 'output-observer' | 'neutral';

export interface DesignIssueSemantics {
  role: DesignIssueRole;
  inputPorts: string[];
  outputPorts: string[];
}

/**
 * Canonical design-surface chip metadata used for port rendering and wiring validation.
 * Keep this in parity with the built-in node catalog used across IDE examples.
 */
export const DESIGN_CHIP_METADATA: Record<string, ChipMetadata> = {
  PowerSource: {
    name: 'PowerSource',
    inputs: [],
    outputs: [{ id: 'out', name: 'out' }],
    color: '#ef4444',
    layer: 0,
  },
  Ground: {
    name: 'Ground',
    inputs: [],
    outputs: [{ id: 'out', name: 'out' }],
    color: '#64748b',
    layer: 0,
  },
  Switch: {
    name: 'Switch',
    inputs: [],
    outputs: [{ id: 'out', name: 'out' }],
    color: '#3b82f6',
    layer: 0,
  },
  INPUT: {
    name: 'INPUT',
    inputs: [],
    outputs: [{ id: 'out', name: 'out' }],
    color: '#3b82f6',
    layer: 0,
  },
  Lamp: {
    name: 'Lamp',
    inputs: [{ id: 'in', name: 'in' }],
    outputs: [{ id: 'out', name: 'out' }],
    color: '#fbbf24',
    layer: 0,
  },
  OUTPUT: {
    name: 'OUTPUT',
    inputs: [{ id: 'in', name: 'in' }],
    outputs: [{ id: 'out', name: 'out' }],
    color: '#fbbf24',
    layer: 0,
  },
  Wire: {
    name: 'Wire',
    inputs: [{ id: 'in', name: 'in' }],
    outputs: [{ id: 'out', name: 'out' }],
    color: '#6b7280',
    layer: 0,
  },
  AND: {
    name: 'AND',
    inputs: [{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }],
    outputs: [{ id: 'out', name: 'out' }],
    color: '#203041',
    layer: 0,
  },
  OR: {
    name: 'OR',
    inputs: [{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }],
    outputs: [{ id: 'out', name: 'out' }],
    color: '#203041',
    layer: 0,
  },
  NOT: {
    name: 'NOT',
    inputs: [{ id: 'in', name: 'in' }],
    outputs: [{ id: 'out', name: 'out' }],
    color: '#2b3545',
    layer: 0,
  },
  NAND: {
    name: 'NAND',
    inputs: [{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }],
    outputs: [{ id: 'out', name: 'out' }],
    color: '#2b3545',
    layer: 0,
  },
  NOR: {
    name: 'NOR',
    inputs: [{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }],
    outputs: [{ id: 'out', name: 'out' }],
    color: '#2b3545',
    layer: 0,
  },
  XOR: {
    name: 'XOR',
    inputs: [{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }],
    outputs: [{ id: 'out', name: 'out' }],
    color: '#1f3d48',
    layer: 1,
  },
  XNOR: {
    name: 'XNOR',
    inputs: [{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }],
    outputs: [{ id: 'out', name: 'out' }],
    color: '#1f3d48',
    layer: 1,
  },
  Clock: {
    name: 'Clock',
    inputs: [],
    outputs: [{ id: 'out', name: 'out' }],
    color: '#f59e0b',
    layer: 0,
  },
  Delay: {
    name: 'Delay',
    inputs: [{ id: 'in', name: 'in' }],
    outputs: [{ id: 'out', name: 'out' }],
    color: '#6b7280',
    layer: 0,
  },
  RSLatch: {
    name: 'RSLatch',
    inputs: [{ id: 'R', name: 'R' }, { id: 'S', name: 'S' }],
    outputs: [{ id: 'Q', name: 'Q' }, { id: 'Q_inv', name: 'Q_inv' }],
    color: '#ec4899',
    layer: 3,
  },
  DLatch: {
    name: 'DLatch',
    inputs: [{ id: 'D', name: 'D' }, { id: 'EN', name: 'EN' }],
    outputs: [{ id: 'Q', name: 'Q' }, { id: 'Q_inv', name: 'Q_inv' }],
    color: '#ec4899',
    layer: 3,
  },
  DFlipFlop: {
    name: 'DFlipFlop',
    inputs: [{ id: 'D', name: 'D' }, { id: 'CLK', name: 'CLK' }],
    outputs: [{ id: 'Q', name: 'Q' }, { id: 'Q_inv', name: 'Q_inv' }],
    color: '#ec4899',
    layer: 3,
  },
  TFlipFlop: {
    name: 'TFlipFlop',
    inputs: [{ id: 'T', name: 'T' }, { id: 'CLK', name: 'CLK' }, { id: 'CLR', name: 'CLR' }],
    outputs: [{ id: 'Q', name: 'Q' }, { id: 'Q_inv', name: 'Q_inv' }],
    color: '#ec4899',
    layer: 3,
  },
  JKFlipFlop: {
    name: 'JKFlipFlop',
    inputs: [{ id: 'J', name: 'J' }, { id: 'K', name: 'K' }, { id: 'CLK', name: 'CLK' }, { id: 'CLR', name: 'CLR' }],
    outputs: [{ id: 'Q', name: 'Q' }, { id: 'Q_inv', name: 'Q_inv' }],
    color: '#ec4899',
    layer: 3,
  },
  FullAdder: {
    name: 'FullAdder',
    inputs: [{ id: 'A', name: 'A' }, { id: 'B', name: 'B' }, { id: 'Cin', name: 'Cin' }],
    outputs: [{ id: 'Sum', name: 'Sum' }, { id: 'Cout', name: 'Cout' }],
    color: '#1f3d48',
    layer: 2,
  },
  Counter4Bit: {
    name: 'Counter4Bit',
    inputs: [{ id: 'CLK', name: 'CLK' }],
    outputs: [
      { id: 'Q0', name: 'Q0' },
      { id: 'Q1', name: 'Q1' },
      { id: 'Q2', name: 'Q2' },
      { id: 'Q3', name: 'Q3' },
    ],
    color: '#f97316',
    layer: 4,
  },
};

const SOURCE_ONLY_NODE_TYPES = new Set(['PowerSource', 'Ground', 'Switch', 'INPUT', 'Clock']);
const OUTPUT_OBSERVER_NODE_TYPES = new Set(['OUTPUT', 'Lamp']);
const NEUTRAL_NODE_TYPES = new Set(['Wire']);

export function getDesignChipMetadata(nodeType: string): ChipMetadata | undefined {
  return DESIGN_CHIP_METADATA[nodeType];
}

export function getDesignIssueSemantics(nodeType: string): DesignIssueSemantics | undefined {
  const metadata = getDesignChipMetadata(nodeType);
  if (!metadata) return undefined;

  if (SOURCE_ONLY_NODE_TYPES.has(nodeType)) {
    return {
      role: 'source',
      inputPorts: [],
      outputPorts: metadata.outputs.map((port) => port.id),
    };
  }

  if (OUTPUT_OBSERVER_NODE_TYPES.has(nodeType)) {
    return {
      role: 'output-observer',
      inputPorts: metadata.inputs.map((port) => port.id),
      outputPorts: metadata.outputs.map((port) => port.id),
    };
  }

  if (NEUTRAL_NODE_TYPES.has(nodeType)) {
    return {
      role: 'neutral',
      inputPorts: metadata.inputs.map((port) => port.id),
      outputPorts: metadata.outputs.map((port) => port.id),
    };
  }

  return {
    role: 'logic',
    inputPorts: metadata.inputs.map((port) => port.id),
    outputPorts: metadata.outputs.map((port) => port.id),
  };
}
