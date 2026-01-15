/**
 * Lab Definition Schema v0
 *
 * Defines the structure of a lab (ECE learning module):
 * - labId: unique identifier
 * - labVersion: semantic version for schema evolution
 * - title, description: human-readable metadata
 * - labType: 'intro' | 'advanced' | 'capstone'
 * - instructions: markdown content
 * - checkpoints: optional array of learning milestones
 */

/**
 * Represents a learning checkpoint within a lab.
 * Students must complete checkpoints sequentially or in parallel
 * to pass the lab.
 */
export interface LabCheckpoint {
  /**
   * Unique ID within this lab (e.g., "checkpoint-1")
   */
  checkpointId: string;

  /**
   * Human-readable name (e.g., "Half Adder Sum Output")
   */
  name: string;

  /**
   * Detailed description of what to build/verify
   */
  description: string;

  /**
   * Expected circuit structure: gate types and counts
   * Example: { AND: 2, OR: 1, XOR: 1 }
   */
  circuitGoal: Record<string, number>;

  /**
   * Acceptance criteria as structured checks
   * Evaluated by checkpoint validator
   */
  acceptanceCriteria: {
    /**
     * Expected output count (number of output pins)
     */
    expectedOutputs?: number;

    /**
     * Custom validation rules (e.g., "Carry output must use OR gate")
     */
    customRules?: string[];
  };
}

/**
 * Complete lab definition as data.
 * All labs are delivered as installable apps via this schema.
 */
export interface LabDefinition {
  /**
   * Unique lab identifier (e.g., "intro-half-adder")
   * Used for tracking, storage, export capsules
   */
  labId: string;

  /**
   * Lab schema version (e.g., "1.0.0")
   * Enables backward-compatible schema evolution
   */
  labVersion: string;

  /**
   * Lab title for display in Launcher, tabs, etc.
   */
  title: string;

  /**
   * One-sentence summary of learning objectives
   */
  description: string;

  /**
   * Lab difficulty/type for filtering and progression
   * - 'intro': foundational concepts (AND/OR/NOT gates)
   * - 'advanced': multi-bit logic, complex topology
   * - 'capstone': multi-component design (e.g., multiplier)
   */
  labType: 'intro' | 'advanced' | 'capstone';

  /**
   * Full markdown instructions
   * Rendered as side panel in LabApp
   */
  instructions: string;

  /**
   * Optional learning checkpoints
   * If omitted, lab has no progression gates (free-form design)
   * If present, checkpoints are non-gated (all accessible, but tracked)
   */
  checkpoints?: LabCheckpoint[];
}

/**
 * Type guard for LabCheckpoint
 * @param obj Unknown value to test
 * @returns true if obj satisfies LabCheckpoint structure
 */
export function isLabCheckpoint(obj: unknown): obj is LabCheckpoint {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const checkpoint = obj as Record<string, unknown>;

  return (
    typeof checkpoint.checkpointId === 'string' &&
    typeof checkpoint.name === 'string' &&
    typeof checkpoint.description === 'string' &&
    typeof checkpoint.circuitGoal === 'object' &&
    checkpoint.circuitGoal !== null &&
    typeof checkpoint.acceptanceCriteria === 'object' &&
    checkpoint.acceptanceCriteria !== null
  );
}

/**
 * Type guard for LabDefinition
 * @param obj Unknown value to test
 * @returns true if obj satisfies LabDefinition structure
 */
export function isLabDefinition(obj: unknown): obj is LabDefinition {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const lab = obj as Record<string, unknown>;

  const hasRequiredFields =
    typeof lab.labId === 'string' &&
    typeof lab.labVersion === 'string' &&
    typeof lab.title === 'string' &&
    typeof lab.description === 'string' &&
    (lab.labType === 'intro' ||
      lab.labType === 'advanced' ||
      lab.labType === 'capstone') &&
    typeof lab.instructions === 'string';

  if (!hasRequiredFields) {
    return false;
  }

  // checkpoints is optional, but if present must be array of LabCheckpoint
  if (lab.checkpoints !== undefined) {
    if (!Array.isArray(lab.checkpoints)) {
      return false;
    }
    if (!lab.checkpoints.every(isLabCheckpoint)) {
      return false;
    }
  }

  return true;
}
