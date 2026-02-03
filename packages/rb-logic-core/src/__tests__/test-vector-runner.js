// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Phase 2 Task 2.1.4: Dual-Mode Test Vector Runner
 * 
 * Example usage of TickEngine in fast mode for automated test execution
 */

import { CircuitEngine } from '../CircuitEngine';
import { TickEngine } from '../TickEngine';

/**
 * Test vector runner for combinational circuit verification
 * 
 * Example:
 *   const testVectors = [
 *     { inputs: { a: 0, b: 0 }, expected: { out: 0 } },  // AND gate
 *     { inputs: { a: 0, b: 1 }, expected: { out: 0 } },
 *     { inputs: { a: 1, b: 0 }, expected: { out: 0 } },
 *     { inputs: { a: 1, b: 1 }, expected: { out: 1 } },
 *   ];
 *   
 *   const results = runTestVectors(circuit, testVectors);
 *   console.log(`Passed: ${results.passed}/${results.total}`);
 */

export class TestVectorRunner {
    circuit;
    engine;
    testVectors;
    results = {
        passed: 0,
        failed: 0,
        total: 0,
        failures: [],
    };

    constructor(circuit) {
        this.circuit = circuit;
        this.engine = new TickEngine(circuit, { tickRate: 1000, fastMode: true });
    }

    /**
     * Run a set of test vectors
     * Fast mode: no delays, runs synchronously
     */
    run(testVectors) {
        this.testVectors = testVectors;
        this.results = {
            passed: 0,
            failed: 0,
            total: testVectors.length,
            failures: [],
        };

        for (let i = 0; i < testVectors.length; i++) {
            const vector = testVectors[i];
            const result = this.runVector(i, vector);
            
            if (result.passed) {
                this.results.passed++;
            } else {
                this.results.failed++;
                this.results.failures.push(result);
            }
        }

        return this.results;
    }

    /**
     * Run a single test vector
     */
    private runVector(index, vector) {
        const { inputs, expected } = vector;

        // Reset and apply inputs
        this.engine.resetTickCount();
        this.applyInputs(inputs);

        // Execute one tick (fast mode: immediate)
        this.engine.stepOnce();

        // Stabilize combinational logic (max 10 iterations)
        for (let i = 0; i < 10; i++) {
            const changed = this.engine.getEngine().tick();
            this.engine.tickCount++;
            if (!changed) break; // Stable
        }

        // Read outputs
        const actual = this.readOutputs(expected);

        // Compare
        const passed = this.compareOutputs(expected, actual);

        return {
            index,
            vector,
            actual,
            passed,
            message: passed
                ? `Vector ${index}: PASS`
                : `Vector ${index}: FAIL (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`,
        };
    }

    /**
     * Apply input values to switches/inputs
     */
    private applyInputs(inputs) {
        for (const [nodeId, value] of Object.entries(inputs)) {
            const node = this.circuit.nodes.find((n) => n.id === nodeId);
            if (node) {
                node.state = { ...node.state, isOn: value };
            }
        }
    }

    /**
     * Read output values from specified nodes
     */
    private readOutputs(outputSpec) {
        const outputs = {};
        for (const [key, _] of Object.entries(outputSpec)) {
            const nodeOutputs = this.engine.getEngine().getNodeOutputs(key);
            // Prefer 'out' port, otherwise take first available
            outputs[key] = nodeOutputs.out ?? Object.values(nodeOutputs)[0] ?? 0;
        }
        return outputs;
    }

    /**
     * Compare actual vs expected outputs
     */
    private compareOutputs(expected, actual) {
        for (const [key, value] of Object.entries(expected)) {
            if (actual[key] !== value) {
                return false;
            }
        }
        return true;
    }

    /**
     * Get formatted test report
     */
    getReport() {
        const { passed, failed, total, failures } = this.results;
        const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : 0;

        let report = `Test Vector Report\n`;
        report += `==================\n`;
        report += `Passed: ${passed}/${total} (${passRate}%)\n`;
        report += `Failed: ${failed}/${total}\n\n`;

        if (failures.length > 0) {
            report += `Failures:\n`;
            report += `--------\n`;
            for (const failure of failures) {
                report += `${failure.message}\n`;
            }
        }

        return report;
    }
}

/**
 * Helper function for quick test vector runs
 */
export function runTestVectors(circuit, testVectors) {
    const runner = new TestVectorRunner(circuit);
    return runner.run(testVectors);
}

/**
 * Example: AND gate test vectors
 */
export const AND_GATE_VECTORS = [
    { inputs: { A: 0, B: 0 }, expected: { Y: 0 } },
    { inputs: { A: 0, B: 1 }, expected: { Y: 0 } },
    { inputs: { A: 1, B: 0 }, expected: { Y: 0 } },
    { inputs: { A: 1, B: 1 }, expected: { Y: 1 } },
];

/**
 * Example: 4-to-1 Multiplexer test vectors
 * MUX(a, b, c, d, s1, s0) = selected input based on s1:s0
 * 00 -> a, 01 -> b, 10 -> c, 11 -> d
 */
export const MUX4_1_VECTORS = [
    { inputs: { a: 1, b: 0, c: 0, d: 0, s1: 0, s0: 0 }, expected: { y: 1 } },
    { inputs: { a: 0, b: 1, c: 0, d: 0, s1: 0, s0: 1 }, expected: { y: 1 } },
    { inputs: { a: 0, b: 0, c: 1, d: 0, s1: 1, s0: 0 }, expected: { y: 1 } },
    { inputs: { a: 0, b: 0, c: 0, d: 1, s1: 1, s0: 1 }, expected: { y: 1 } },
];
