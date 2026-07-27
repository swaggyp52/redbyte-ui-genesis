import type { RBProject } from '../../export/projectFormat';
import { normalizeCircuit } from '../../recording/runRecordUtils';
import { digestValue } from '../../utils/digest';

/**
 * Verification authority follows circuit behavior, not canvas geometry.
 * Keep the rest of the project contract in the hash while normalizing away
 * node positions and connection ordering.
 */
export function buildVerifyDeterminismHash(project: RBProject): string {
  return digestValue({
    ...project,
    circuit: normalizeCircuit(project.circuit),
  });
}
