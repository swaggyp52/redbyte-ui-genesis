/**
 * Integrity of supplied, disconnected classroom scaffolds.
 * Lab 8 supplies individual primitives; the student still authors every wire.
 */
export interface ClassroomStarterNode {
  id?: string;
  type?: string;
  label?: string;
}
export interface ClassroomStarter {
  nodes?: ClassroomStarterNode[];
  connections?: unknown[];
  labSpec?: {
    checkpoints?: Array<{
      id?: string;
      type?: string;
      config?: { schedule?: string; clockSignal?: string };
    }>;
  };
}
export interface ClassroomStarterSpec {
  labId: 'lab-5' | 'lab-6' | 'lab-7' | 'lab-8';
  requiredLabels: string[];
}

const LAB8_SCAFFOLD = new Map([
  ['sw_in2', 'Switch'], ['sw_in1', 'Switch'], ['sw_in0', 'Switch'],
  ['sw_enter', 'Switch'], ['sw_reset', 'Switch'],
  ['cap_p0_ff', 'DFlipFlop'], ['cap_p1_ff', 'DFlipFlop'],
  ['pos0_ff', 'DFlipFlop'], ['pos1_ff', 'DFlipFlop'],
  ['xor_valid', 'XOR'], ['not_last', 'NOT'], ['valid_group', 'AND'],
  ['m1_ff', 'DFlipFlop'], ['m2_ff', 'DFlipFlop'],
  ['m3_ff', 'DFlipFlop'], ['m4_ff', 'DFlipFlop'],
  ['lock_drive', 'OR'], ['led_lock', 'Lamp'],
]);
const SOLUTION_TYPES = new Set([
  'AND', 'NAND', 'OR', 'NOR', 'XOR', 'XNOR', 'MUX', 'DECODER', 'TRISTATE',
  'FULLADDER', 'COUNTER', 'FSM', 'DFF', 'LATCH',
]);

export function analyzeClassroomStarter(starter: ClassroomStarter, spec: ClassroomStarterSpec) {
  const nodes = Array.isArray(starter.nodes) ? starter.nodes : [];
  const connections = Array.isArray(starter.connections) ? starter.connections : [];
  if (connections.length !== 0) {
    throw new Error(`${spec.labId} starter must be unsolved scaffold with zero connections (found ${connections.length}).`);
  }
  const labels = nodes.map((node) => String(node.label ?? '').trim().toLowerCase());
  for (const marker of spec.requiredLabels) {
    if (!labels.some((label) => label.includes(marker))) {
      throw new Error(`${spec.labId} starter missing required label marker: ${marker}`);
    }
  }
  if (spec.labId === 'lab-8') {
    const ids = new Set(nodes.map((node) => node.id));
    if (nodes.length !== LAB8_SCAFFOLD.size || ids.size !== LAB8_SCAFFOLD.size ||
        nodes.some((node) => !node.id || LAB8_SCAFFOLD.get(node.id) !== node.type)) {
      throw new Error('lab-8 starter must retain exactly its supplied disconnected primitive scaffold; completed blocks and extra logic are forbidden.');
    }
    const checkpoints = starter.labSpec?.checkpoints ?? [];
    for (const id of ['fsm-invalid-path', 'fsm-valid-path', 'fsm-valid-path-2']) {
      const matching = checkpoints.filter((checkpoint) => checkpoint.id === id);
      const checkpoint = matching[0];
      if (matching.length !== 1 || checkpoint?.type !== 'truth-table' ||
          checkpoint.config?.schedule !== 'clocked_macro' ||
          checkpoint.config?.clockSignal !== 'sw_enter') {
        throw new Error(`lab-8 starter must retain ${id} with clocked_macro and sw_enter clock authority.`);
      }
    }
  } else {
    const suspicious = nodes.filter((node) => SOLUTION_TYPES.has(String(node.type ?? '').toUpperCase()));
    if (suspicious.length > 0) {
      throw new Error(`${spec.labId} starter contains solution-like logic nodes: ${suspicious.map((node) => node.type).join(', ')}`);
    }
  }
  return {
    labId: spec.labId,
    nodeCount: nodes.length,
    connectionCount: connections.length,
    requiredLabelsSatisfied: true,
  };
}
