import { getComponentSupport, type Circuit, type Node } from '@redbyte/rb-logic-core';

const GATE_TYPES = new Set(['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR', 'AND3', 'OR3', 'NAND3', 'NOR3', 'XOR3']);

/**
 * A part as a student names it: its own label; otherwise its kind and its place among the parts of
 * that kind in the circuit ("AND 1", "D flip-flop 2"), or its kind alone when the circuit is not at
 * hand. An internal node id ("node-v2-3") is never shown for a part that exists.
 */
export function studentPartName(node: Node, nodeId: string, circuit?: Circuit): string {
  const label = node.label?.trim();
  if (label) return label;
  const kind = GATE_TYPES.has(node.type) ? node.type : getComponentSupport(node.type)?.label ?? node.type;
  if (!circuit) return GATE_TYPES.has(node.type) ? `${node.type} gate` : kind;
  const ordinal = circuit.nodes.filter((entry) => entry.type === node.type).findIndex((entry) => entry.id === nodeId) + 1;
  return ordinal > 0 ? `${kind} ${ordinal}` : kind;
}
