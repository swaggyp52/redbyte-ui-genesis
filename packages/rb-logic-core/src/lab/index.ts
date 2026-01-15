// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Lab module exports (H0.1-H0.4)
 */

// H0.1: Lab Session State Machine
export type { LabSessionState, ILabSession, CircuitSnapshot, LabCapsule } from './LabSession';
export {
  generateSessionId,
  createEmptySession,
  createCheckpointResult,
  type LabCheckpointStatus,
} from './LabSession';

export { createLabSessionStore, getGlobalLabSessionStore, resetGlobalLabSessionStore } from './sessionStore';
export type { LabSessionStoreType } from './sessionStore';

// H0.3-H0.4: Capsule schema and validation
export { validateCapsule, parseCapsuleJSON, parseCapsuleFile } from './CapsuleV1';
export type { CapsuleV1, CheckpointResult, CapsuleImportResult } from './CapsuleV1';
