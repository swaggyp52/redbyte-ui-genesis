import {
  analyzeSequentialLogic,
  getBlockedVerificationNodeTypes,
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
 * Node types whose presence must block verify.
 * These are structurally recognized as stateful but lack verified simulation
 * support in the current product contract.
 *
 * 'blocked' always wins over 'sequential': a circuit with both a DFlipFlop and
 * a Counter4Bit is blocked, not sequential, until Counter4Bit is supported.
 */
export const UNSUPPORTED_SEQUENTIAL = new Set<string>([
  ...getBlockedVerificationNodeTypes(),
]);

/**
 * Determine the canonical verify mode for a circuit.
 *
 * Detection priority (highest to lowest):
 * 1. Any UNSUPPORTED_SEQUENTIAL node type → 'blocked'  (wins over everything)
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
  if (nodeTypes.some((t) => UNSUPPORTED_SEQUENTIAL.has(t))) {
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
