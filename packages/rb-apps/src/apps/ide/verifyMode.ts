import {
  analyzeSequentialLogic,
  getBlockedVerificationNodeTypes,
  getComponentSupport,
  getVerificationSequentialNodeTypes,
} from '@redbyte/rb-logic-core';
import type { Circuit } from '@redbyte/rb-logic-core';

/**
 * Canonical verify mode for a circuit.
 *
 * combinational — no stateful behavior; truth-table authoring.
 * sequential    — contains supported stateful elements; cycle-by-cycle authoring.
 * blocked       — contains unsupported node types that cannot be verified or exported.
 */
export type VerifyMode = 'combinational' | 'sequential' | 'blocked';

/**
 * Node types that are registered and supported for sequential verify.
 * A circuit containing at least one of these maps to 'sequential' mode.
 * Expand this set as additional stateful elements are validated end-to-end.
 */
export const SUPPORTED_SEQUENTIAL = new Set<string>([
  ...getVerificationSequentialNodeTypes(),
]);

/**
 * Node types whose presence must block verify: every non-boundary part the
 * component support registry does not simulate or cannot verify, combinational
 * (MUX4) or stateful (Counter4Bit, Delay). Derived from the registry, never
 * listed here.
 *
 * 'blocked' always wins over 'sequential': a circuit with both a DFlipFlop and
 * a Counter4Bit is blocked, not sequential, until Counter4Bit is supported.
 */
export const BLOCKED_VERIFY_NODE_TYPES = new Set<string>([
  ...getBlockedVerificationNodeTypes(),
]);

/** One blocked part type in a circuit and the nodes that carry it, in circuit order. */
export interface VerifyBlocker {
  type: string;
  /** Student-readable part name from the support registry. */
  label: string;
  /** False when the engine does not simulate the part at all, so its outputs would be invented. */
  simulated: boolean;
  nodes: Array<{ id: string; label: string }>;
}

/** The parts that block Verify for this circuit, grouped by type in first-seen order. */
export function findVerifyBlockers(circuit: Circuit): VerifyBlocker[] {
  const byType = new Map<string, VerifyBlocker>();
  for (const node of circuit.nodes) {
    if (!BLOCKED_VERIFY_NODE_TYPES.has(node.type)) continue;
    let blocker = byType.get(node.type);
    if (!blocker) {
      const support = getComponentSupport(node.type);
      blocker = {
        type: node.type,
        label: support?.label ?? node.type,
        simulated: support?.capabilities.simulation === true,
        nodes: [],
      };
      byType.set(node.type, blocker);
    }
    blocker.nodes.push({ id: node.id, label: node.label?.trim() || node.id });
  }
  return [...byType.values()];
}

/** "4:1 multiplexer (MUX4) on MUX[0], MUX[1]" */
export function describeVerifyBlocker(blocker: VerifyBlocker): string {
  return `${blocker.label} (${blocker.type}) on ${blocker.nodes.map((node) => node.label).join(', ')}`;
}

/**
 * Why a run of this circuit must not be recorded, or null when it may run. A
 * part the engine does not simulate would leave its outputs at values nothing
 * computed (MUX4 read 0), so no run, Observe or Compare, may record them.
 */
export function unsimulatedRunRefusal(circuit: Circuit): string | null {
  const unsimulated = findVerifyBlockers(circuit).filter((blocker) => !blocker.simulated);
  if (unsimulated.length === 0) return null;
  return (
    `Simulation was not run: RedByte does not simulate ${unsimulated.map(describeVerifyBlocker).join('; ')}, ` +
    'so a recording would show values it never computed. ' +
    'Fix: rebuild that logic from supported gates or remove the part; the design is unchanged.'
  );
}

/**
 * Determine the canonical verify mode for a circuit.
 *
 * Detection priority (highest to lowest):
 * 1. Any BLOCKED_VERIFY_NODE_TYPES node type → 'blocked'  (wins over everything)
 * 2. Any stateful behavior (supported nodes OR hasClockedMacros analysis OR HDL hint) → 'sequential'
 * 3. Default → 'combinational'
 *
 * A clock-role INPUT node does NOT force sequential mode.
 * Only structural stateful elements (flip-flops, latches) do.
 *
 * @param circuit      The current circuit graph.
 * @param hdlScheduleHint  Optional: schedule string from a prior verify run.
 *   Pass `verifyLastRun?.schedule` to handle HDL import paths where the circuit
 *   graph may not carry DFF nodes directly.
 */
export function detectVerifyMode(circuit: Circuit, hdlScheduleHint?: string): VerifyMode {
  const nodeTypes = circuit.nodes.map((n) => n.type);

  // Blocked wins over everything.
  if (nodeTypes.some((t) => BLOCKED_VERIFY_NODE_TYPES.has(t))) {
    return 'blocked';
  }

  // Supported stateful behavior via explicit node types.
  if (nodeTypes.some((t) => SUPPORTED_SEQUENTIAL.has(t))) {
    return 'sequential';
  }

  // Broader stateful analysis (catches composite sequential types the registry
  // recognizes even when not in the explicit SUPPORTED_SEQUENTIAL set above).
  if (analyzeSequentialLogic(circuit).hasClockedMacros) {
    return 'sequential';
  }

  // HDL import fallback: the circuit graph may not carry flip-flop nodes directly
  // when imported from VHDL/Verilog. A prior run schedule of 'clocked_macro'
  // indicates the elaborator confirmed sequential behavior.
  if (hdlScheduleHint === 'clocked_macro') {
    return 'sequential';
  }

  return 'combinational';
}
