// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { CircuitEngine } from '../CircuitEngine';
import type { Circuit, Signal } from '../types';
import type { CheckpointDef } from './LabDefinition';

interface EvaluationResult {
  status: 'passed' | 'failed';
  feedback: string;
}

export function evaluateCheckpoint(circuit: unknown, checkpoint: CheckpointDef): EvaluationResult {
  try {
    if (!checkpoint?.testVectors || checkpoint.testVectors.length === 0) {
      return { status: 'failed', feedback: 'No test vectors defined' };
    }

    if (!isCircuit(circuit) || circuit.nodes.length === 0) {
      return { status: 'failed', feedback: 'Circuit is empty or invalid' };
    }

    const mismatches: Array<{ vectorId: string; expected: Record<string, Signal>; got: Record<string, Signal> }> = [];

    for (const vector of checkpoint.testVectors) {
      const engine = new CircuitEngine(circuit);

      // Apply inputs: set state.isOn for input node IDs
      for (const [nodeId, value] of Object.entries(vector.inputs)) {
        const prev = engine.getNodeState(nodeId) ?? {};
        engine.setNodeState(nodeId, { ...prev, isOn: value });
      }

      // Stabilize
      engine.stabilize(50);

      // Compare expected outputs against OUTPUT node state.isOn or signal input
      const got: Record<string, Signal> = {};
      const expected = vector.expectedOutputs;
      const signals = engine.getAllSignals();
      
      for (const [outNodeId] of Object.entries(expected)) {
        // Try to read from OUTPUT node's input signal (from the connection)
        const signalKey = `${outNodeId}.in`;
        const signalValue = signals.get(signalKey);
        
        if (signalValue !== undefined) {
          // Use the signal if available
          got[outNodeId] = signalValue as Signal;
        } else {
          // Fallback: read from OUTPUT node state
          const state = engine.getNodeState(outNodeId) ?? {};
          const val = (state.isOn ?? 0) as Signal;
          got[outNodeId] = val;
        }
      }

      // Check mismatch
      const isMismatch = Object.entries(expected).some(([key, exp]) => got[key] !== exp);
      if (isMismatch) {
        mismatches.push({ vectorId: vector.id, expected, got });
      }
    }

    if (mismatches.length === 0) {
      return { status: 'passed', feedback: `All ${checkpoint.testVectors.length} test vectors passed` };
    }

    const shown = mismatches.slice(0, 5)
      .map(m => `Vector ${m.vectorId}\nExpected: ${JSON.stringify(m.expected)}\nGot: ${JSON.stringify(m.got)}`)
      .join('\n\n');

    const more = mismatches.length > 5 ? `\nand ${mismatches.length - 5} more mismatches` : '';
    return {
      status: 'failed',
      feedback: `Failed ${mismatches.length}/${checkpoint.testVectors.length} test vectors\n\n${shown}${more}`,
    };
  } catch (err) {
    return { status: 'failed', feedback: `Error evaluating checkpoint: ${err instanceof Error ? err.message : String(err)}` };
  }
}

function isCircuit(obj: any): obj is Circuit {
  return obj && Array.isArray(obj.nodes) && Array.isArray(obj.connections);
}
