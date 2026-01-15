// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

// Capsule schema and validation
export { validateCapsule, parseCapsuleJSON, parseCapsuleFile } from './CapsuleV1';
export type { CapsuleV1, CheckpointResult, CapsuleImportResult } from './CapsuleV1';

// Components (exported from rb-apps only, not from logic-core)
// This file allows re-export if needed for consistency
