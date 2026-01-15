// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { SerializedCircuitV1 } from '../types';

/**
 * Test vector for checkpoint validation
 * Defines input values and expected output values
 */
export interface TestVector {
  id: string;
  name: string;
  description?: string;
  // Input node IDs mapped to their values [0, 1]
  inputs: Record<string, number[]>;
  // Expected output node IDs mapped to their values [0, 1]
  expectedOutputs: Record<string, number[]>;
}

/**
 * Checkpoint definition for a lab
 * Validates that circuit produces correct outputs for test vectors
 */
export interface CheckpointDef {
  id: string;
  name: string;
  description?: string;
  // Test vectors to validate against
  testVectors: TestVector[];
  // Optional: require minimum number of specific gate types
  gateRequirements?: {
    gateName: string;
    minCount: number;
  }[];
}

/**
 * Lab definition: complete assignment with circuit template and checkpoints
 */
export interface LabDef {
  id: string;
  name: string;
  description: string;
  instructions: string;
  // Starting circuit (empty or with example structure)
  startingCircuit: SerializedCircuitV1;
  // Checkpoints that must be satisfied
  checkpoints: CheckpointDef[];
}

/**
 * Lab library with multiple example labs
 */
export interface LabLibrary {
  format: 'rb-lab-library-v1';
  version: 1;
  labs: LabDef[];
}

/**
 * Helper: Create a test vector
 */
export function createTestVector(
  id: string,
  name: string,
  inputs: Record<string, number[]>,
  expectedOutputs: Record<string, number[]>
): TestVector {
  return {
    id,
    name,
    description: `Test case: ${name}`,
    inputs,
    expectedOutputs,
  };
}

/**
 * Helper: Create a checkpoint
 */
export function createCheckpoint(
  id: string,
  name: string,
  testVectors: TestVector[],
  gateRequirements?: { gateName: string; minCount: number }[]
): CheckpointDef {
  return {
    id,
    name,
    description: `Checkpoint: ${name}`,
    testVectors,
    gateRequirements,
  };
}

/**
 * Helper: Create a lab definition
 */
export function createLabDef(
  id: string,
  name: string,
  instructions: string,
  startingCircuit: SerializedCircuitV1,
  checkpoints: CheckpointDef[]
): LabDef {
  return {
    id,
    name,
    description: `ECE Lab: ${name}`,
    instructions,
    startingCircuit,
    checkpoints,
  };
}
