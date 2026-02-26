// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { CLOCKED_MACRO_SEQUENCE } from '@redbyte/rb-utils';
import { CircuitEngine } from '@redbyte/rb-logic-core';
import { toLegacyCircuit } from '../adapters/circuitAdapter';
const SEQUENTIAL_Q_TYPES = new Set([
    'DFlipFlop',
    'DLatch',
    'TFlipFlop',
    'JKFlipFlop',
    'RSLatch',
    'Counter4Bit',
]);
const INPUT_NODE_TYPES = new Set([
    'SWITCH',
    'Switch',
    'INPUT',
    'InputPin',
    'Clock',
    'PowerSource',
]);
const OUTPUT_STATE_NODE_TYPES = new Set(['OUTPUT', 'Lamp', 'LED']);
export async function verifyTruthTable(project, checkpoint) {
    const contract = resolveTruthTableContract(checkpoint);
    const { inputs, outputs, rows, schedule, clockSignal } = contract;
    if (schedule === 'clocked_macro') {
        if (!clockSignal || clockSignal.trim().length === 0) {
            return makeConfigFailure('Checkpoint schedule=clocked_macro requires config.clockSignal.', rows);
        }
        const clockNode = findNodeBySignal(project, clockSignal);
        if (!clockNode) {
            return makeConfigFailure(`Clock signal "${clockSignal}" could not be resolved to a node label/id.`, rows);
        }
    }
    // Convert CircuitV1 to legacy circuit for simulation (temporary during migration)
    const legacyCircuit = toLegacyCircuit(project.circuit);
    const engine = new CircuitEngine(legacyCircuit);
    const actualTable = [];
    const failures = [];
    const resolvedClockNode = schedule === 'clocked_macro' && clockSignal
        ? findNodeBySignal(project, clockSignal)
        : undefined;
    for (let i = 0; i < rows.length; i++) {
        const expectedRow = rows[i];
        const actualRow = {};
        for (const inputSignal of inputs) {
            if (schedule === 'clocked_macro' && inputSignal === clockSignal)
                continue;
            const inputValue = normalizeValue(getRowSignalValue(expectedRow, 'inputs', inputSignal));
            actualRow[inputSignal] = inputValue;
            const inputNode = findNodeBySignal(project, inputSignal);
            if (inputNode && INPUT_NODE_TYPES.has(inputNode.type)) {
                engine.setNodeValue(inputNode.id, inputValue);
            }
        }
        if (schedule === 'clocked_macro' && resolvedClockNode) {
            for (const clockValue of CLOCKED_MACRO_SEQUENCE) {
                engine.setNodeValue(resolvedClockNode.id, clockValue);
                engine.tick();
            }
        }
        else {
            engine.tick();
        }
        for (const outputSignal of outputs) {
            const outputNode = findNodeBySignal(project, outputSignal);
            if (!outputNode) {
                actualRow[outputSignal] = 0;
                continue;
            }
            if (OUTPUT_STATE_NODE_TYPES.has(outputNode.type)) {
                const raw = engine.getNodeState(outputNode.id)?.isOn;
                actualRow[outputSignal] = normalizeValue(raw);
                continue;
            }
            const portName = SEQUENTIAL_Q_TYPES.has(outputNode.type) ? 'Q' : 'out';
            const raw = engine.getNodeValue(outputNode.id, portName);
            actualRow[outputSignal] = normalizeValue(raw);
        }
        actualTable.push(actualRow);
        for (const outputSignal of outputs) {
            const expected = normalizeValue(getRowSignalValue(expectedRow, 'outputs', outputSignal));
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
            expected: rows,
            actual: actualTable,
            diff: failures.map((failure) => failure.message),
        },
    };
}
function resolveTruthTableContract(checkpoint) {
    const config = checkpoint.config ?? {};
    const spec = checkpoint.spec ?? {};
    const inputs = toStringArray(config.inputs) ?? toStringArray(spec.inputs) ?? [];
    const outputs = toStringArray(config.outputs) ?? toStringArray(spec.outputs) ?? [];
    const rows = toRows(config.table) ?? toRows(spec.expectedTable) ?? [];
    const schedule = config.schedule ?? 'combinational';
    const clockSignal = typeof config.clockSignal === 'string'
        ? config.clockSignal
        : typeof spec.clockSignal === 'string'
            ? spec.clockSignal
            : undefined;
    return { inputs, outputs, rows, schedule, clockSignal };
}
function makeConfigFailure(message, expectedRows) {
    return {
        passed: false,
        headline: '✗ Truth table configuration error',
        failures: [{ message }],
        evidence: {
            expected: expectedRows,
            actual: [],
            diff: [message],
        },
    };
}
function toStringArray(value) {
    if (!Array.isArray(value))
        return undefined;
    return value
        .filter((entry) => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
}
function toRows(value) {
    if (!Array.isArray(value))
        return undefined;
    return value.filter((entry) => !!entry && typeof entry === 'object');
}
function getRowSignalValue(row, group, signal) {
    if (!row || typeof row !== 'object')
        return undefined;
    const nested = row[group];
    if (nested && typeof nested === 'object' && signal in nested) {
        return nested[signal];
    }
    return row[signal];
}
function findNodeBySignal(project, signalName) {
    return project.circuit.nodes.find((node) => node.label === signalName || node.id === signalName);
}
function normalizeValue(value) {
    if (typeof value === 'boolean')
        return value ? 1 : 0;
    if (typeof value === 'number')
        return value ? 1 : 0;
    return 0;
}
