// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Checkpoint Verification Dispatcher
 *
 * Routes checkpoint verification to the appropriate verifier based on type.
 * All verifiers are declarative: they operate on (project, checkpoint spec) only.
 */

import type {
  LabProjectV1,
  Checkpoint,
  CheckpointResult,
} from '@redbyte/rb-utils';

export async function verifyCheckpoint(
  project: LabProjectV1,
  checkpoint: Checkpoint
): Promise<CheckpointResult> {
  switch (checkpoint.type) {
    case 'truth-table': {
      const { verifyTruthTable } = await import('./verifyTruthTable');
      return verifyTruthTable(project, checkpoint);
    }

    case 'waveform': {
      const { verifyWaveform } = await import('./verifyWaveform');
      return verifyWaveform(project, checkpoint);
    }

    case 'test-vector': {
      const { verifyTestVector } = await import('./verifyTestVector');
      return verifyTestVector(project, checkpoint);
    }

    case 'board-io': {
      const { verifyBoardIO } = await import('./verifyBoardIO');
      return verifyBoardIO(project, checkpoint);
    }

    case 'custom': {
      // Custom verifiers registered by lab ID
      const { verifyCustom } = await import('./verifyCustom');
      return verifyCustom(project, checkpoint);
    }

    default:
      const _exhaustive: never = checkpoint;
      throw new Error(`Unknown checkpoint type: ${(checkpoint as any).type}`);
  }
}
