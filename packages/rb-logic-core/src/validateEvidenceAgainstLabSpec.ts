// Validate evidence against a LabSpecV1
// Returns a structured ValidationResult for UI guidance

import { LabSpecV1 } from './labSpecSchema';
import { EvidenceBundle } from './evidenceSchema';

export interface ValidationResult {
  probes?: Record<string, 'present' | 'missing'>;
  ticks?: {
    required?: number;
    observed?: number;
    status: 'sufficient' | 'insufficient' | 'not-checked';
  };
  exampleMatch?: 'match' | 'mismatch' | 'not-checked';
}

export function validateEvidenceAgainstLabSpec(
  evidence: EvidenceBundle,
  labSpec: LabSpecV1
): ValidationResult {
  const result: ValidationResult = {};

  // Probes check
  if (labSpec.requirements?.probes) {
    result.probes = {};
    for (const probe of labSpec.requirements.probes) {
      result.probes[probe] = evidence.probes?.some(p => p.name === probe)
        ? 'present'
        : 'missing';
    }
  }

  // Ticks check
  if (labSpec.requirements?.minTicks !== undefined) {
    const observed = evidence.ticks?.length || 0;
    result.ticks = {
      required: labSpec.requirements.minTicks,
      observed,
      status:
        observed >= labSpec.requirements.minTicks
          ? 'sufficient'
          : 'insufficient',
    };
  } else {
    result.ticks = { status: 'not-checked' };
  }

  // Example ID check
  if (labSpec.requiredExampleId) {
    result.exampleMatch =
      evidence.exampleId === labSpec.requiredExampleId
        ? 'match'
        : 'mismatch';
  } else {
    result.exampleMatch = 'not-checked';
  }

  return result;
}
