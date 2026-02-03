// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { describe, it, expect } from 'vitest';
import { evaluateCheckpoint } from '../lab/evaluator';
import { CircuitEngine } from '../CircuitEngine';
// Import to ensure built-ins and analog nodes are registered
import '../index';
describe('Analog Chain: LDR → VoltageDivider → LM358 → Lamp', () => {
    // LDR feeds voltage divider, which feeds comparator, which drives a lamp
    const circuit = {
        nodes: [
            { id: 'ldr', type: 'LDR', position: { x: 0, y: 0 }, state: {}, config: {}, rotation: 0 },
            { id: 'r1', type: 'FixedResistor', position: { x: 25, y: 0 }, state: {}, config: { resistance: 500 }, rotation: 0 },
            { id: 'div', type: 'VoltageDivider', position: { x: 50, y: 0 }, state: {}, config: {}, rotation: 0 },
            { id: 'cmp', type: 'LM358', position: { x: 100, y: 0 }, state: {}, config: {}, rotation: 0 },
            { id: 'lamp', type: 'Lamp', position: { x: 150, y: 0 }, state: {}, config: {}, rotation: 0 },
            { id: 'vdd', type: 'VoltageSource', position: { x: 100, y: -30 }, state: {}, config: { voltage: 5 }, rotation: 0 },
            { id: 'vref', type: 'VoltageSource', position: { x: 100, y: 30 }, state: {}, config: { voltage: 4.9 }, rotation: 0 },
        ],
        connections: [
            // LDR resistance to divider r2
            { from: { nodeId: 'ldr', portName: 'resistance' }, to: { nodeId: 'div', portName: 'r2' } },
            // FixedResistor resistance to divider r1
            { from: { nodeId: 'r1', portName: 'resistance' }, to: { nodeId: 'div', portName: 'r1' } },
            // vdd out to divider v_in
            { from: { nodeId: 'vdd', portName: 'out' }, to: { nodeId: 'div', portName: 'v_in' } },
            // divider v_out to comparator V_plus
            { from: { nodeId: 'div', portName: 'v_out' }, to: { nodeId: 'cmp', portName: 'V_plus' } },
            // vref out to comparator V_minus
            { from: { nodeId: 'vref', portName: 'out' }, to: { nodeId: 'cmp', portName: 'V_minus' } },
            // comparator out to lamp in
            { from: { nodeId: 'cmp', portName: 'out' }, to: { nodeId: 'lamp', portName: 'in' } },
        ],
    };
    const checkpoint = {
        id: 'cp-analog',
        name: 'Analog LDR Chain',
        testVectors: [
            {
                id: 'low-light',
                name: 'LDR in dark (low light)',
                inputs: { ldr: { light: 0.1 } },
                expectedOutputs: { lamp: 1 }, // Comparator should trigger (Vout > Vref)
            },
            {
                id: 'bright',
                name: 'LDR in bright light',
                inputs: { ldr: { light: 0.9 } },
                expectedOutputs: { lamp: 0 }, // Comparator should not trigger (Vout < Vref)
            },
        ],
    };
    it('simulates analog chain and toggles output as expected', () => {
        const result = evaluateCheckpoint(circuit, checkpoint);
        // Debug: print feedback and result
        // eslint-disable-next-line no-console
        console.log('Analog evaluator result:', result);
        // Additional debug: run the simulation step-by-step for each vector
        for (const vector of checkpoint.testVectors) {
            const engine = new CircuitEngine(circuit, { debug: true });
            for (const [nodeId, value] of Object.entries(vector.inputs)) {
                const prev = engine.getNodeState(nodeId) ?? {};
                if (typeof value === 'object' && value !== null) {
                    engine.setNodeState(nodeId, { ...prev, ...value });
                }
                else {
                    engine.setNodeState(nodeId, { ...prev, isOn: value });
                }
            }
            engine.stabilize(50);
            const ldr = engine.getNodeState('ldr');
            const r1 = engine.getNodeState('r1');
            const div = engine.getNodeState('div');
            const cmp = engine.getNodeState('cmp');
            const lamp = engine.getNodeState('lamp');
            const signals = engine.getAllSignals();
            // Print node states and outputs
            const nodeIds = ['ldr', 'r1', 'div', 'cmp', 'lamp', 'vref'];
            // eslint-disable-next-line no-console
            console.log(`Vector ${vector.id}:`);
            for (const id of nodeIds) {
                // eslint-disable-next-line no-console
                console.log(`  Node ${id} state:`, engine.getNodeState(id));
                // eslint-disable-next-line no-console
                console.log(`  Node ${id} outputs:`, engine.getNodeOutputs(id));
            }
            // eslint-disable-next-line no-console
            console.log('  Signals:', Array.from(signals.entries()));
        }
        expect(result.status).toBe('passed');
        expect(result.feedback).toContain('All 2 test vectors passed');
    });
});
