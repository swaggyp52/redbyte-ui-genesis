// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Custom Verifier Registry
 * DEFERRED: Not part of vertical slice.
 */

import type {
  LabProjectV1,
  CustomCheckpoint,
  CheckpointResult,
} from '@redbyte/rb-utils';

export async function verifyCustom(
  project: LabProjectV1,
  checkpoint: CustomCheckpoint
): Promise<CheckpointResult> {
  // TODO: Implement verifier registry after vertical slice
  return {
    passed: false,
    headline: '⚠ Custom verification not implemented',
    failures: [{ message: `Custom verifier '${checkpoint.spec.customSpecId}' not registered` }],
    evidence: { expected: checkpoint.spec, actual: null },
  };
}
