import type { Circuit } from '@redbyte/rb-logic-core';
import { useCircuitStore } from '../../stores/circuitStore';
import { digestValue } from '../../utils/digest';

/** One-way projection from runtime authority into the editor store cache. */
export function projectRuntimeCircuitToEditorStore(circuit: Circuit): boolean {
  const store = useCircuitStore.getState();
  if (digestValue(store.circuit) === digestValue(circuit)) {
    return false;
  }

  store.reset();
  store.updateCircuit(circuit, { skipHistory: true, enforceLimits: true });
  return true;
}