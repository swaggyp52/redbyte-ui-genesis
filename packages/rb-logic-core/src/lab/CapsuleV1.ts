// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { SerializedCircuitV1 } from '../types';

/**
 * Checkpoint test result within a capsule
 */
export interface CheckpointResult {
  id: string;
  name: string;
  passed: boolean;
  timeLogged: number; // timestamp
  message: string;
}

/**
 * Capsule V1: Student submission snapshot with circuit + results
 * Schema immutable after H0.3 completion
 */
export interface CapsuleV1 {
  kind: 'rb-capsule-v1';
  version: 1;
  labId: string; // e.g., 'ece-lab-01'
  studentName: string;
  timestamp: number;
  circuitSnapshot: SerializedCircuitV1;
  checkpointResults: CheckpointResult[];
}

/**
 * Result of capsule import attempt
 */
export interface CapsuleImportResult {
  valid: boolean;
  capsule?: CapsuleV1;
  error?: string;
}

/**
 * Validate CapsuleV1 structure and fields
 * @param data - The capsule to validate
 * @returns Validation result with error details if invalid
 */
export function validateCapsule(data: CapsuleV1): CapsuleImportResult {
  // Check kind
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      error: 'Capsule must be a valid object',
    };
  }

  if (data.kind !== 'rb-capsule-v1') {
    return {
      valid: false,
      error: 'Invalid capsule kind. Expected rb-capsule-v1.',
    };
  }

  // Check version
  if (!data.version || data.version !== 1) {
    return {
      valid: false,
      error: 'Missing or invalid version field. Expected version: 1.',
    };
  }

  // Check labId
  if (!data.labId || typeof data.labId !== 'string') {
    return {
      valid: false,
      error: 'Missing required field: labId (string)',
    };
  }

  // Check studentName
  if (!data.studentName || typeof data.studentName !== 'string') {
    return {
      valid: false,
      error: 'Missing required field: studentName (string)',
    };
  }

  // Check timestamp
  if (typeof data.timestamp !== 'number') {
    return {
      valid: false,
      error: 'Missing required field: timestamp (number)',
    };
  }

  // Check circuitSnapshot
  if (!data.circuitSnapshot || typeof data.circuitSnapshot !== 'object') {
    return {
      valid: false,
      error:
        'Invalid circuitSnapshot. Please re-export the capsule from Logic Lab.',
    };
  }

  const snapshot = data.circuitSnapshot as any;
  if (snapshot.version !== 1) {
    return {
      valid: false,
      error:
        'Invalid circuit snapshot version. Expected version 1. Please re-export.',
    };
  }

  if (!Array.isArray(snapshot.nodes)) {
    return {
      valid: false,
      error:
        'Invalid circuit snapshot: nodes must be an array. Please re-export.',
    };
  }

  if (!Array.isArray(snapshot.connections)) {
    return {
      valid: false,
      error:
        'Invalid circuit snapshot: connections must be an array. Please re-export.',
    };
  }

  // Check checkpointResults
  if (!Array.isArray(data.checkpointResults)) {
    return {
      valid: false,
      error: 'checkpointResults must be an array',
    };
  }

  // Validate each checkpoint
  for (const cp of data.checkpointResults) {
    if (!cp.id || !cp.name || typeof cp.passed !== 'boolean') {
      return {
        valid: false,
        error: 'Invalid checkpoint structure: missing id, name, or passed',
      };
    }
  }

  // All checks passed
  return {
    valid: true,
    capsule: data,
  };
}

/**
 * Parse JSON string as CapsuleV1
 * Handles JSON parse errors gracefully
 * @param jsonStr - JSON string to parse
 * @returns Parsed capsule or error
 */
export function parseCapsuleJSON(jsonStr: string): CapsuleImportResult {
  if (!jsonStr || typeof jsonStr !== 'string') {
    return {
      valid: false,
      error: 'Input must be a valid JSON string',
    };
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return validateCapsule(parsed as CapsuleV1);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      error: `Failed to parse JSON: ${message}`,
    };
  }
}

/**
 * Parse capsule from File (drag-drop scenario)
 * @param file - File object from input or drag-drop
 * @returns Promise with parsed capsule or error
 */
export async function parseCapsuleFile(
  file: File
): Promise<CapsuleImportResult> {
  // Check file extension
  const ext = file.name.toLowerCase();
  if (!ext.endsWith('.json') && !ext.endsWith('.rbcapsule')) {
    return {
      valid: false,
      error: 'File must be .json or .rbcapsule format',
    };
  }

  try {
    const text = await file.text();
    return parseCapsuleJSON(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      error: `Failed to read file: ${message}`,
    };
  }
}
