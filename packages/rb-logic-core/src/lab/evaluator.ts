// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { CheckpointResult } from './LabSession';
import type { CheckpointDef, TestVector } from './LabDefinition';
import type { Circuit } from '../types';
import { CircuitEngine } from '../CircuitEngine';

/**
 * H0.8: Real Checkpoint Evaluator
 * 
 * Takes a circuit snapshot and checkpoint definition,
 * validates circuit against truth-table test vectors using CircuitEngine,
 * returns CheckpointResult with pass/fail status and detailed mismatch info
 */

interface Mismatch {
  vectorId: string;
  vectorName: string;
  inputs: Record<string, number>;
  expectedOutputs: Record<string, number>;
  actualOutputs: Record<string, number>;
}

/**
 * Evaluate a single checkpoint against circuit state and test vectors
 * @param circuitJson - Serialized circuit JSON string or Circuit object
 * @param checkpoint - Checkpoint definition with test vectors
 * @returns CheckpointResult with pass/fail status and feedback
 */
export function evaluateCheckpoint(
  circuitJson: string | object,
  checkpoint: CheckpointDef
): CheckpointResult {
  const now = Date.now();

  try {
    // Parse circuit if it's a string
    const parsedCircuit: Circuit = typeof circuitJson === 'string' ? JSON.parse(circuitJson) : circuitJson;
    if (!checkpoint.testVectors || checkpoint.testVectors.length === 0) {
      return {
        checkpointId: checkpoint.id,
        status: 'failed',
        attempts: 1,
        feedback: '✗ No test vectors defined for this checkpoint.',
      };
    }

    const nodes = Array.isArray(parsedCircuit?.nodes) ? parsedCircuit.nodes : [];
    const connections = Array.isArray(parsedCircuit?.connections) ? parsedCircuit.connections : [];
    const circuit: Circuit = { nodes, connections };

    // Validate circuit structure
    if (nodes.length === 0) {
      return {
        checkpointId: checkpoint.id,
        status: 'failed',
        attempts: 1,
        feedback: '✗ Circuit is empty or invalid. Add components to begin.',
      };
    }

    // Run truth-table evaluation
    const mismatches: Mismatch[] = [];
    const engine = new CircuitEngine(circuit);

    for (const vector of checkpoint.testVectors) {
      // Set input values
      for (const [nodeId, value] of Object.entries(vector.inputs)) {
        const inputValues = Array.isArray(value) ? value : [value];
        for (const val of inputValues) {
          const normalized = val === 1 ? 1 : 0;
          engine.setNodeState(nodeId, { isOn: normalized });
        }
      }

      // Run simulation until stable (combinational circuits converge)
      engine.stabilize(50);

      // Read all output signals
      const signals = engine.getAllSignals();

      // Check each expected output
      const actualOutputs: Record<string, number> = {};
      let vectorFailed = false;

      for (const [nodeId, expectedValue] of Object.entries(vector.expectedOutputs)) {
        const expectedValues = Array.isArray(expectedValue) ? expectedValue : [expectedValue];
        
        // Try multiple signal key formats: nodeId, nodeId.in, nodeId.out
        let signal = signals.get(nodeId);
        if (signal === undefined) signal = signals.get(`${nodeId}.in`);
        if (signal === undefined) signal = signals.get(`${nodeId}.out`);
        
        // For OUTPUT nodes, check what feeds into them
        if (signal === undefined) {
          const node = circuit.nodes.find(n => n.id === nodeId);
          if (node && node.type === 'OUTPUT') {
            // Find connection feeding this OUTPUT
            const conn = circuit.connections.find(c => c.to.nodeId === nodeId);
            if (conn) {
              const sourceKey = `${conn.from.nodeId}.${conn.from.portName}`;
              signal = signals.get(sourceKey);
            }
          }
        }
        
        const actualValue = signal !== undefined ? (signal === 1 ? 1 : 0) : 0;
        actualOutputs[nodeId] = actualValue;

        // Check if any expected value matches
        if (!expectedValues.includes(actualValue)) {
          vectorFailed = true;
        }
      }

      if (vectorFailed) {
        // Flatten inputs for mismatch display
        const flatInputs: Record<string, number> = {};
        for (const [nodeId, value] of Object.entries(vector.inputs)) {
          flatInputs[nodeId] = Array.isArray(value) ? value[0] : value;
        }

        const flatExpected: Record<string, number> = {};
        for (const [nodeId, value] of Object.entries(vector.expectedOutputs)) {
          flatExpected[nodeId] = Array.isArray(value) ? value[0] : value;
        }

        mismatches.push({
          vectorId: vector.id,
          vectorName: vector.name,
          inputs: flatInputs,
          expectedOutputs: flatExpected,
          actualOutputs,
        });
      }
    }

    // Generate result
    if (mismatches.length === 0) {
      return {
        checkpointId: checkpoint.id,
        status: 'passed',
        passedAt: now,
        attempts: 1,
        feedback: `✓ All ${checkpoint.testVectors.length} test vectors passed!`,
      };
    }

    // Show first 5 mismatches
    const displayMismatches = mismatches.slice(0, 5);
    const mismatchDetails = displayMismatches
      .map((m) => {
        const inputStr = Object.entries(m.inputs)
          .map(([id, val]) => `${id}=${val}`)
          .join(', ');
        const expectedStr = Object.entries(m.expectedOutputs)
          .map(([id, val]) => `${id}=${val}`)
          .join(', ');
        const actualStr = Object.entries(m.actualOutputs)
          .map(([id, val]) => `${id}=${val}`)
          .join(', ');
        return `  [${m.vectorName}] Inputs: ${inputStr} → Expected: ${expectedStr}, Got: ${actualStr}`;
      })
      .join('\n');

    const hiddenCount = mismatches.length - displayMismatches.length;
    const hiddenMsg = hiddenCount > 0 ? `\n  ... and ${hiddenCount} more mismatches` : '';

    return {
      checkpointId: checkpoint.id,
      status: 'failed',
      attempts: 1,
      feedback: `✗ Failed ${mismatches.length}/${checkpoint.testVectors.length} test vectors:\n${mismatchDetails}${hiddenMsg}`,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      checkpointId: checkpoint.id,
      status: 'failed',
      attempts: 1,
      feedback: `Error evaluating checkpoint: ${errorMsg}`,
    };
  }
}

