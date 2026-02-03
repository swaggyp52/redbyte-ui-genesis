// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { CircuitEngine } from '@redbyte/rb-logic-core';
import { toLegacyCircuit } from '../adapters/circuitAdapter';
export async function verifyTruthTable(project, checkpoint) {
    const { inputs, outputs, expectedTable } = checkpoint.spec;
    // Convert CircuitV1 to legacy circuit for simulation (temporary during migration)
    const legacyCircuit = toLegacyCircuit(project.circuit);
    const engine = new CircuitEngine(legacyCircuit);
    // Compute actual truth table by exhaustive simulation
    const actualTable = [];
    const failures = [];
    for (let i = 0; i < expectedTable.length; i++) {
        const expectedRow = expectedTable[i];
        const actualRow = {};
        // Set input values
        for (const inputSignal of inputs) {
            const inputValue = normalizeValue(expectedRow[inputSignal]);
            actualRow[inputSignal] = inputValue;
            // Find input node and set its state
            const inputNode = project.circuit.nodes.find((n) => n.label === inputSignal || n.id === inputSignal);
            if (inputNode) {
                // For SWITCH nodes, set config.value
                if (inputNode.type === 'SWITCH' || inputNode.type === 'INPUT') {
                    engine.setNodeValue(inputNode.id, inputValue);
                }
            }
        }
        // Step simulation to settle
        engine.tick();
        // Read output values
        for (const outputSignal of outputs) {
            const outputNode = project.circuit.nodes.find((n) => n.label === outputSignal || n.id === outputSignal);
            if (outputNode) {
                actualRow[outputSignal] = engine.getNodeValue(outputNode.id, 'Q') ?? 0;
            }
            else {
                actualRow[outputSignal] = 0; // Missing output
            }
        }
        actualTable.push(actualRow);
        // Compare actual vs expected
        for (const outputSignal of outputs) {
            const expected = normalizeValue(expectedRow[outputSignal]);
            const actual = normalizeValue(actualRow[outputSignal]);
            if (expected !== actual) {
                failures.push({
                    message: `Row ${i + 1}: expected ${outputSignal}=${expected}, got ${actual}`,
                    jumpTarget: { type: 'table-row', row: i },
                });
            }
        }
    }
    const passed = failures.length === 0;
    const headline = passed
        ? '✓ Truth table matches'
        : `✗ ${failures.length} mismatch${failures.length > 1 ? 'es' : ''} found`;
    return {
        passed,
        headline,
        failures,
        evidence: {
            expected: expectedTable,
            actual: actualTable,
            diff: failures.map((f) => f.message),
        },
    };
}
/**
 * Normalize boolean/number to 0/1
 */
function normalizeValue(value) {
    if (typeof value === 'boolean')
        return value ? 1 : 0;
    if (typeof value === 'number')
        return value ? 1 : 0;
    return 0;
}
