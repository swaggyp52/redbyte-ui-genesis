/**
 * Resolves Verify vector input keys (IO row `id`, e.g. "sw0") to the circuit
 * `nodeId` values (e.g. "sw0_node") that the runtime simulator expects.
 *
 * Vectors store inputs keyed by the IO row `id` (label-based). The runtime
 * sim (`projectRuntime.setInput`) stores and reads inputs by `nodeId` (the
 * circuit UUID). Without this translation the Verify→Design tick-context bridge
 * silently stores inputs under the wrong key and the Design sim ignores them.
 */
export function resolveVerifyInputNodeIds(
  inputs: Readonly<Record<string, 0 | 1>>,
  verifySignals: ReadonlyArray<{ readonly id: string; readonly nodeId: string }>,
): Record<string, 0 | 1> {
  const result: Record<string, 0 | 1> = {};
  for (const [signalId, value] of Object.entries(inputs)) {
    const sig = verifySignals.find((s) => s.id === signalId);
    result[sig?.nodeId ?? signalId] = value;
  }
  return result;
}
