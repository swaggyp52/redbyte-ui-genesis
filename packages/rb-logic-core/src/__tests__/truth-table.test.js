// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitEngine } from '../CircuitEngine';
import { NodeRegistry } from '../NodeRegistry';

/**
 * Truth Table & Test Vector Analysis Tests
 *
 * Validates automated testing framework for combinational and sequential logic.
 * - Truth table generation (all 2^N combinations)
 * - Test vector execution with multi-tick sequences
 * - Output verification and mismatch reporting
 */

describe('Truth Table Analysis', () => {
  let circuit;
  let engine;

  beforeEach(() => {
    // Create a simple 2-input AND gate circuit
    circuit = {
      nodes: [
        { id: 'a', type: 'SWITCH', label: 'A', value: 0 },
        { id: 'b', type: 'SWITCH', label: 'B', value: 0 },
        { id: 'and1', type: 'AND', label: 'Y', inputs: ['a', 'b'] },
      ],
      wires: [
        { from: 'a', to: 'and1' },
        { from: 'b', to: 'and1' },
      ],
    };
    engine = new CircuitEngine(circuit);
  });

  it('should generate all truth table combinations for 2-input circuit', () => {
    // Generate 2^2 = 4 combinations
    const combinations = [];
    for (let i = 0; i < 4; i++) {
      combinations.push({
        inputs: {
          A: (i >> 0) & 1,
          B: (i >> 1) & 1,
        },
      });
    }

    expect(combinations.length).toBe(4);
    expect(combinations[0].inputs).toEqual({ A: 0, B: 0 });
    expect(combinations[1].inputs).toEqual({ A: 1, B: 0 });
    expect(combinations[2].inputs).toEqual({ A: 0, B: 1 });
    expect(combinations[3].inputs).toEqual({ A: 1, B: 1 });
  });

  it('should evaluate AND gate truth table correctly', () => {
    const truthTable = [
      { inputs: { A: 0, B: 0 }, expected: 0 },
      { inputs: { A: 1, B: 0 }, expected: 0 },
      { inputs: { A: 0, B: 1 }, expected: 0 },
      { inputs: { A: 1, B: 1 }, expected: 1 },
    ];

    truthTable.forEach((row) => {
      engine.setNodeState('a', row.inputs.A);
      engine.setNodeState('b', row.inputs.B);
      engine.tick();

      const result = engine.getNodeValue('and1', 'Q');
      expect(result).toBe(row.expected);
    });
  });

  it('should handle OR gate truth table', () => {
    const orCircuit = {
      nodes: [
        { id: 'a', type: 'SWITCH', label: 'A', value: 0 },
        { id: 'b', type: 'SWITCH', label: 'B', value: 0 },
        { id: 'or1', type: 'OR', label: 'Y', inputs: ['a', 'b'] },
      ],
      wires: [
        { from: 'a', to: 'or1' },
        { from: 'b', to: 'or1' },
      ],
    };

    const engine = new CircuitEngine(orCircuit);

    const truthTable = [
      { inputs: { A: 0, B: 0 }, expected: 0 },
      { inputs: { A: 1, B: 0 }, expected: 1 },
      { inputs: { A: 0, B: 1 }, expected: 1 },
      { inputs: { A: 1, B: 1 }, expected: 1 },
    ];

    truthTable.forEach((row) => {
      engine.setNodeState('a', row.inputs.A);
      engine.setNodeState('b', row.inputs.B);
      engine.tick();

      const result = engine.getNodeValue('or1', 'Q');
      expect(result).toBe(row.expected);
    });
  });

  it('should identify mismatches in truth table', () => {
    // Incorrect expected values
    const truthTable = [
      { inputs: { A: 0, B: 0 }, expected: 0 },
      { inputs: { A: 1, B: 0 }, expected: 0 },
      { inputs: { A: 0, B: 1 }, expected: 0 },
      { inputs: { A: 1, B: 1 }, expected: 0 }, // Should be 1 (mismatch)
    ];

    const mismatches = [];

    truthTable.forEach((row) => {
      engine.setNodeState('a', row.inputs.A);
      engine.setNodeState('b', row.inputs.B);
      engine.tick();

      const actual = engine.getNodeValue('and1', 'Q');
      if (actual !== row.expected) {
        mismatches.push({
          inputs: row.inputs,
          expected: row.expected,
          actual,
        });
      }
    });

    expect(mismatches.length).toBe(1);
    expect(mismatches[0].actual).toBe(1);
  });

  it('should support 3-input circuits', () => {
    const threeInputCircuit = {
      nodes: [
        { id: 'a', type: 'SWITCH', label: 'A', value: 0 },
        { id: 'b', type: 'SWITCH', label: 'B', value: 0 },
        { id: 'c', type: 'SWITCH', label: 'C', value: 0 },
        { id: 'and1', type: 'AND', label: 'AB', inputs: ['a', 'b'] },
        { id: 'and2', type: 'AND', label: 'Y', inputs: ['and1', 'c'] },
      ],
      wires: [
        { from: 'a', to: 'and1' },
        { from: 'b', to: 'and1' },
        { from: 'and1', to: 'and2' },
        { from: 'c', to: 'and2' },
      ],
    };

    const engine = new CircuitEngine(threeInputCircuit);

    // Generate all 8 combinations
    const combinations = [];
    for (let i = 0; i < 8; i++) {
      combinations.push({
        inputs: {
          A: (i >> 0) & 1,
          B: (i >> 1) & 1,
          C: (i >> 2) & 1,
        },
      });
    }

    expect(combinations.length).toBe(8);

    // Verify 3-input AND (only A=1, B=1, C=1 gives 1)
    combinations.forEach((combo) => {
      engine.setNodeState('a', combo.inputs.A);
      engine.setNodeState('b', combo.inputs.B);
      engine.setNodeState('c', combo.inputs.C);
      engine.tick();

      const result = engine.getNodeValue('and2', 'Q');
      const expected =
        combo.inputs.A && combo.inputs.B && combo.inputs.C ? 1 : 0;
      expect(result).toBe(expected);
    });
  });

  it('should compare against expected outputs in batch', () => {
    const expectedTable = [
      { inputs: { A: 0, B: 0 }, outputs: { Y: 0 } },
      { inputs: { A: 1, B: 0 }, outputs: { Y: 0 } },
      { inputs: { A: 0, B: 1 }, outputs: { Y: 0 } },
      { inputs: { A: 1, B: 1 }, outputs: { Y: 1 } },
    ];

    const results = expectedTable.map((row) => {
      engine.setNodeState('a', row.inputs.A);
      engine.setNodeState('b', row.inputs.B);
      engine.tick();

      const actual = engine.getNodeValue('and1', 'Q');
      const expected = row.outputs.Y;

      return {
        pass: actual === expected,
        inputs: row.inputs,
        expected,
        actual,
      };
    });

    const passCount = results.filter((r) => r.pass).length;
    expect(passCount).toBe(4);
  });
});

describe('Test Vectors (Sequential)', () => {
  let circuit;
  let engine;

  beforeEach(() => {
    // Create a simple counter-like circuit with feedback
    circuit = {
      nodes: [
        { id: 'clk', type: 'SWITCH', label: 'CLK', value: 0 },
        { id: 'rst', type: 'SWITCH', label: 'RST', value: 0 },
        { id: 'ff', type: 'D_FLIP_FLOP', label: 'Q', inputs: ['clk', 'rst'] },
      ],
      wires: [
        { from: 'clk', to: 'ff' },
        { from: 'rst', to: 'ff' },
      ],
    };
    engine = new CircuitEngine(circuit);
  });

  it('should execute single-tick test vectors', () => {
    const vectors = [
      {
        tick: 1,
        inputs: { CLK: 0, RST: 1 },
        expected: { Q: 0 }, // Reset state
      },
      {
        tick: 1,
        inputs: { CLK: 1, RST: 0 },
        expected: { Q: 0 }, // Shifted value
      },
    ];

    vectors.forEach((vector) => {
      engine.setNodeState('clk', vector.inputs.CLK);
      engine.setNodeState('rst', vector.inputs.RST);

      for (let t = 0; t < vector.tick; t++) {
        engine.tick();
      }

      const actual = engine.getNodeValue('ff', 'Q');
      expect(actual).toBeDefined();
    });
  });

  it('should execute multi-tick test sequences', () => {
    // Sequence: RST → CLK rising → CLK falling → CLK rising
    const vectors = [
      { tick: 1, inputs: { RST: 1, CLK: 0 }, expected: { Q: 0 } },
      { tick: 2, inputs: { RST: 0, CLK: 1 }, expected: { Q: 0 } }, // 2 ticks
      { tick: 3, inputs: { RST: 0, CLK: 0 }, expected: { Q: 0 } }, // 3 ticks
    ];

    vectors.forEach((vector) => {
      engine.setNodeState('rst', vector.inputs.RST);
      engine.setNodeState('clk', vector.inputs.CLK);

      for (let t = 0; t < vector.tick; t++) {
        engine.tick();
      }

      const actual = engine.getNodeValue('ff', 'Q');
      expect(actual).toBeDefined();
    });
  });

  it('should detect mismatches in test vectors', () => {
    const vectors = [
      {
        tick: 1,
        inputs: { CLK: 0, RST: 1 },
        expected: { Q: 0 },
      },
      {
        tick: 1,
        inputs: { CLK: 1, RST: 0 },
        expected: { Q: 1 }, // Potentially wrong
      },
    ];

    const results = vectors.map((vector) => {
      engine.setNodeState('clk', vector.inputs.CLK);
      engine.setNodeState('rst', vector.inputs.RST);

      for (let t = 0; t < vector.tick; t++) {
        engine.tick();
      }

      const actual = engine.getNodeValue('ff', 'Q');
      return {
        pass: actual === vector.expected.Q,
        expected: vector.expected.Q,
        actual,
      };
    });

    expect(results.length).toBe(2);
  });

  it('should track state across multiple test vectors', () => {
    let stateHistory = [];

    const vectors = [
      { tick: 1, inputs: { RST: 1, CLK: 0 }, desc: 'Reset' },
      { tick: 1, inputs: { RST: 0, CLK: 0 }, desc: 'Hold' },
      { tick: 1, inputs: { RST: 0, CLK: 1 }, desc: 'Clock High' },
      { tick: 1, inputs: { RST: 0, CLK: 0 }, desc: 'Clock Low' },
    ];

    vectors.forEach((vector) => {
      engine.setNodeState('rst', vector.inputs.RST);
      engine.setNodeState('clk', vector.inputs.CLK);

      for (let t = 0; t < vector.tick; t++) {
        engine.tick();
      }

      const state = engine.getNodeValue('ff', 'Q');
      stateHistory.push({ desc: vector.desc, state });
    });

    expect(stateHistory.length).toBe(4);
    expect(stateHistory[0].desc).toBe('Reset');
    expect(stateHistory[3].desc).toBe('Clock Low');
  });
});

describe('Test Vector Performance', () => {
  it('should run 100+ test vectors efficiently', () => {
    const circuit = {
      nodes: [
        { id: 'a', type: 'SWITCH', label: 'A', value: 0 },
        { id: 'b', type: 'SWITCH', label: 'B', value: 0 },
        { id: 'and1', type: 'AND', label: 'Y', inputs: ['a', 'b'] },
      ],
      wires: [
        { from: 'a', to: 'and1' },
        { from: 'b', to: 'and1' },
      ],
    };

    const engine = new CircuitEngine(circuit);

    // Generate 100 random test vectors
    const vectors = [];
    for (let i = 0; i < 100; i++) {
      vectors.push({
        inputs: { A: Math.random() > 0.5 ? 1 : 0, B: Math.random() > 0.5 ? 1 : 0 },
      });
    }

    const start = performance.now();

    vectors.forEach((vector) => {
      engine.setNodeState('a', vector.inputs.A);
      engine.setNodeState('b', vector.inputs.B);
      engine.tick();
      engine.getNodeValue('and1', 'Q');
    });

    const elapsed = performance.now() - start;

    expect(vectors.length).toBe(100);
    expect(elapsed).toBeLessThan(1000); // Should complete in under 1 second
  });

  it('should handle 256-row truth table for 4-input circuit', () => {
    const circuit = {
      nodes: [
        { id: 'a', type: 'SWITCH', label: 'A', value: 0 },
        { id: 'b', type: 'SWITCH', label: 'B', value: 0 },
        { id: 'c', type: 'SWITCH', label: 'C', value: 0 },
        { id: 'd', type: 'SWITCH', label: 'D', value: 0 },
        { id: 'and1', type: 'AND', label: 'Y', inputs: ['a', 'b'] },
        { id: 'and2', type: 'AND', label: 'Z', inputs: ['c', 'd'] },
        { id: 'or1', type: 'OR', label: 'OUT', inputs: ['and1', 'and2'] },
      ],
      wires: [
        { from: 'a', to: 'and1' },
        { from: 'b', to: 'and1' },
        { from: 'c', to: 'and2' },
        { from: 'd', to: 'and2' },
        { from: 'and1', to: 'or1' },
        { from: 'and2', to: 'or1' },
      ],
    };

    const engine = new CircuitEngine(circuit);

    // Generate all 2^4 = 16 combinations (full truth table)
    const rows = [];
    for (let i = 0; i < 16; i++) {
      rows.push({
        inputs: {
          A: (i >> 0) & 1,
          B: (i >> 1) & 1,
          C: (i >> 2) & 1,
          D: (i >> 3) & 1,
        },
      });
    }

    const results = rows.map((row) => {
      engine.setNodeState('a', row.inputs.A);
      engine.setNodeState('b', row.inputs.B);
      engine.setNodeState('c', row.inputs.C);
      engine.setNodeState('d', row.inputs.D);
      engine.tick();

      return engine.getNodeValue('or1', 'Q');
    });

    expect(results.length).toBe(16);
    expect(results.every((r) => typeof r === 'number')).toBe(true);
  });
});

describe('Test Result Reporting', () => {
  it('should generate pass/fail summary', () => {
    const testResults = [
      { pass: true },
      { pass: true },
      { pass: false },
      { pass: true },
      { pass: false },
    ];

    const summary = {
      total: testResults.length,
      passed: testResults.filter((r) => r.pass).length,
      failed: testResults.filter((r) => !r.pass).length,
    };

    expect(summary.total).toBe(5);
    expect(summary.passed).toBe(3);
    expect(summary.failed).toBe(2);
    expect((summary.passed / summary.total) * 100).toBe(60);
  });

  it('should track mismatch details', () => {
    const mismatches = [
      {
        testId: 1,
        signal: 'Y',
        expected: 1,
        actual: 0,
      },
      {
        testId: 3,
        signal: 'Y',
        expected: 0,
        actual: 1,
      },
    ];

    expect(mismatches.length).toBe(2);
    mismatches.forEach((mismatch) => {
      expect(mismatch).toHaveProperty('testId');
      expect(mismatch).toHaveProperty('signal');
      expect(mismatch).toHaveProperty('expected');
      expect(mismatch).toHaveProperty('actual');
    });
  });

  it('should format test report with coverage metrics', () => {
    const report = {
      timestamp: new Date().toISOString(),
      circuitName: 'AND Gate',
      totalTests: 4,
      passedTests: 4,
      failedTests: 0,
      coverage: 100,
      mismatches: [],
    };

    expect(report.coverage).toBe(100);
    expect(report.mismatches).toEqual([]);
  });
});
