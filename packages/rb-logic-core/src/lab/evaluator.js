// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { CircuitEngine } from '../CircuitEngine';
export function evaluateCheckpoint(circuit, checkpoint) {
    try {
        if (!checkpoint?.testVectors || checkpoint.testVectors.length === 0) {
            return { status: 'failed', feedback: 'No test vectors defined' };
        }
        if (!isCircuit(circuit) || circuit.nodes.length === 0) {
            return { status: 'failed', feedback: 'Circuit is empty or invalid' };
        }
        const mismatches = [];
        for (const vector of checkpoint.testVectors) {
            const engine = new CircuitEngine(circuit);
            // Apply inputs: set state for input node IDs
            for (const [nodeId, value] of Object.entries(vector.inputs)) {
                const prev = engine.getNodeState(nodeId) ?? {};
                if (typeof value === 'object' && value !== null) {
                    // Analog or multi-input node: assign all properties
                    engine.setNodeState(nodeId, { ...prev, ...value });
                }
                else {
                    // Digital: assign to isOn
                    engine.setNodeState(nodeId, { ...prev, isOn: value });
                }
            }
        // Stabilize
        engine.stabilize(50);
        const issue = engine.getLastIssue?.();
        if (issue && issue.code === 'COMBINATIONAL_LOOP') {
            return { status: 'failed', feedback: issue.message };
        }
        // Compare expected outputs against OUTPUT node state.isOn or signal input
        const got = {};
            const expected = vector.expectedOutputs;
            const signals = engine.getAllSignals();
            for (const [outNodeId] of Object.entries(expected)) {
                // Try to read from OUTPUT node's input signal (from the connection)
                const signalKey = `${outNodeId}.in`;
                const signalValue = signals.get(signalKey);
                if (signalValue !== undefined) {
                    // Use the signal if available
                    got[outNodeId] = signalValue;
                }
                else {
                    // Fallback: read from OUTPUT node state
                    const state = engine.getNodeState(outNodeId) ?? {};
                    const val = (state.isOn ?? 0);
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
    }
    catch (err) {
        return { status: 'failed', feedback: `Error evaluating checkpoint: ${err instanceof Error ? err.message : String(err)}` };
    }
}
function isCircuit(obj) {
    return obj && Array.isArray(obj.nodes) && Array.isArray(obj.connections);
}
