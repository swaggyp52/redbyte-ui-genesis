/**
 * Lab Definition Parser
 *
 * Parses and validates YAML/JSON lab definitions.
 * Provides detailed error messages on schema violations.
 */

import {
  LabDefinition,
  LabCheckpoint,
  isLabDefinition,
  isLabCheckpoint,
} from './labDefinition';

/**
 * Parser result: success or detailed error
 */
export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Validation result: valid or array of error messages
 */
export type ValidationResult =
  | { valid: true }
  | { valid: false; errors: string[] };

/**
 * Parse unknown input into a LabDefinition
 *
 * @param input Unknown value (typically JSON or parsed YAML)
 * @returns ParseResult with either valid LabDefinition or detailed error
 *
 * @example
 * const result = parseLabDefinition(JSON.parse(jsonString));
 * if (result.success) {
 *   console.log(result.data.labId);
 * } else {
 *   console.error(result.error);
 * }
 */
export function parseLabDefinition(
  input: unknown
): ParseResult<LabDefinition> {
  // Check if input is an object
  if (typeof input !== 'object' || input === null) {
    return {
      success: false,
      error: `Expected lab definition object, got ${typeof input}`,
    };
  }

  // Use type guard for comprehensive validation
  if (!isLabDefinition(input)) {
    const lab = input as Record<string, unknown>;

    // Provide specific error for common mistakes
    if (typeof lab.labId !== 'string') {
      return {
        success: false,
        error: `Field 'labId' is required and must be a string, got ${typeof lab.labId}`,
      };
    }

    if (typeof lab.labVersion !== 'string') {
      return {
        success: false,
        error: `Field 'labVersion' is required and must be a string, got ${typeof lab.labVersion}`,
      };
    }

    if (typeof lab.title !== 'string') {
      return {
        success: false,
        error: `Field 'title' is required and must be a string, got ${typeof lab.title}`,
      };
    }

    if (typeof lab.description !== 'string') {
      return {
        success: false,
        error: `Field 'description' is required and must be a string, got ${typeof lab.description}`,
      };
    }

    if (
      lab.labType !== 'intro' &&
      lab.labType !== 'advanced' &&
      lab.labType !== 'capstone'
    ) {
      return {
        success: false,
        error: `Field 'labType' must be one of: 'intro', 'advanced', 'capstone'; got '${lab.labType}'`,
      };
    }

    if (typeof lab.instructions !== 'string') {
      return {
        success: false,
        error: `Field 'instructions' is required and must be a string, got ${typeof lab.instructions}`,
      };
    }

    // Checkpoints validation
    if (lab.checkpoints !== undefined) {
      if (!Array.isArray(lab.checkpoints)) {
        return {
          success: false,
          error: `Field 'checkpoints' must be an array if present, got ${typeof lab.checkpoints}`,
        };
      }

      // Validate each checkpoint
      for (let i = 0; i < lab.checkpoints.length; i++) {
        const checkpoint = lab.checkpoints[i];
        if (!isLabCheckpoint(checkpoint)) {
          return {
            success: false,
            error: `Checkpoint at index ${i} has invalid structure; expected checkpointId, name, description, circuitGoal, acceptanceCriteria`,
          };
        }
      }
    }

    return {
      success: false,
      error: `Lab definition does not match expected schema`,
    };
  }

  return {
    success: true,
    data: input,
  };
}

/**
 * Validate a LabDefinition instance
 * Performs semantic checks beyond schema structure
 *
 * @param lab LabDefinition to validate
 * @returns ValidationResult with any semantic errors
 *
 * @example
 * const validation = validateLabDefinition(lab);
 * if (!validation.valid) {
 *   console.error(validation.errors);
 * }
 */
export function validateLabDefinition(lab: LabDefinition): ValidationResult {
  const errors: string[] = [];

  // labId should be non-empty
  if (lab.labId.trim().length === 0) {
    errors.push('labId must be non-empty');
  }

  // labId should be kebab-case or underscore_case (basic check)
  if (!/^[a-z0-9_-]+$/.test(lab.labId)) {
    errors.push(
      `labId should contain only lowercase letters, numbers, hyphens, or underscores; got '${lab.labId}'`
    );
  }

  // labVersion should be a valid semver-like version
  if (!/^\d+\.\d+\.\d+/.test(lab.labVersion)) {
    errors.push(
      `labVersion should follow semantic versioning (e.g., '1.0.0'); got '${lab.labVersion}'`
    );
  }

  // title should be non-empty
  if (lab.title.trim().length === 0) {
    errors.push('title must be non-empty');
  }

  // description should be non-empty
  if (lab.description.trim().length === 0) {
    errors.push('description must be non-empty');
  }

  // instructions should be non-empty
  if (lab.instructions.trim().length === 0) {
    errors.push('instructions must be non-empty');
  }

  // Validate checkpoints if present
  if (lab.checkpoints && lab.checkpoints.length > 0) {
    const checkpointIds = new Set<string>();

    for (let i = 0; i < lab.checkpoints.length; i++) {
      const checkpoint = lab.checkpoints[i];

      // Check for duplicate checkpoint IDs
      if (checkpointIds.has(checkpoint.checkpointId)) {
        errors.push(
          `Checkpoint ID '${checkpoint.checkpointId}' is duplicated`
        );
      }
      checkpointIds.add(checkpoint.checkpointId);

      // Check checkpoint fields
      if (checkpoint.checkpointId.trim().length === 0) {
        errors.push(`Checkpoint ${i}: checkpointId must be non-empty`);
      }

      if (checkpoint.name.trim().length === 0) {
        errors.push(`Checkpoint ${i}: name must be non-empty`);
      }

      if (checkpoint.description.trim().length === 0) {
        errors.push(`Checkpoint ${i}: description must be non-empty`);
      }

      // circuitGoal should have at least one gate
      const goalEntries = Object.entries(checkpoint.circuitGoal);
      if (goalEntries.length === 0) {
        errors.push(`Checkpoint ${i}: circuitGoal must specify at least one gate type`);
      }

      // All counts should be positive
      for (const [gateType, count] of goalEntries) {
        if (typeof count !== 'number' || count < 0) {
          errors.push(
            `Checkpoint ${i}: circuitGoal['${gateType}'] must be a non-negative number`
          );
        }
      }

      // acceptanceCriteria.expectedOutputs should be positive if present
      if (
        checkpoint.acceptanceCriteria.expectedOutputs !== undefined &&
        typeof checkpoint.acceptanceCriteria.expectedOutputs !== 'number'
      ) {
        errors.push(
          `Checkpoint ${i}: acceptanceCriteria.expectedOutputs must be a number`
        );
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

/**
 * Parse checkpoints array from unknown input
 * Skips invalid checkpoints with warnings
 *
 * @param input Unknown array of checkpoints
 * @returns Array of valid LabCheckpoint objects (may be empty if all invalid)
 *
 * @example
 * const checkpoints = parseCheckpoints(data.checkpoints);
 * if (checkpoints.length < data.checkpoints.length) {
 *   console.warn('Some checkpoints were skipped due to invalid structure');
 * }
 */
export function parseCheckpoints(input: unknown[]): LabCheckpoint[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const valid: LabCheckpoint[] = [];

  for (let i = 0; i < input.length; i++) {
    if (isLabCheckpoint(input[i])) {
      valid.push(input[i] as LabCheckpoint);
    } else {
      // Silently skip invalid checkpoints; caller should validate separately
      console.warn(
        `Skipped checkpoint at index ${i}: does not match LabCheckpoint structure`
      );
    }
  }

  return valid;
}
