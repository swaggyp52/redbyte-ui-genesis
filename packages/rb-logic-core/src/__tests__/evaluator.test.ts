// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import { evaluateCheckpoint } from '../lab/evaluator';
import type { CheckpointDef } from '../lab/LabDefinition';
import type { Circuit } from '../types';

// Import to ensure built-ins are registered
import '../index';

describe('H0.8: Real Checkpoint Evaluator', () => {
  describe('NOT Gate Truth Table', () => {
    const notCircuit: Circuit = {
      nodes: [
        { id: 'in', type: 'INPUT', position: { x: 0, y: 0 }, state: {}, config: {}, rotation: 0 },
        { id: 'not', type: 'NOT', position: { x: 50, y: 0 }, state: {}, config: {}, rotation: 0 },
        { id: 'out', type: 'OUTPUT', position: { x: 100, y: 0 }, state: {}, config: {}, rotation: 0 },
      ],
      connections: [
        { from: { nodeId: 'in', portName: 'out' }, to: { nodeId: 'not', portName: 'in' } },
        { from: { nodeId: 'not', portName: 'out' }, to: { nodeId: 'out', portName: 'in' } },
      ],
    };

    const checkpoint: CheckpointDef = {
      id: 'cp-not',
      name: 'NOT Gate',
      testVectors: [
        { id: 'v1', name: 'A=0', inputs: { in: 0 }, expectedOutputs: { out: 1 } },
        { id: 'v2', name: 'A=1', inputs: { in: 1 }, expectedOutputs: { out: 0 } },
      ],
    };

    it('passes when circuit produces correct outputs', () => {
      const result = evaluateCheckpoint(notCircuit, checkpoint);
      expect(result.status).toBe('passed');
      expect(result.feedback).toContain('All 2 test vectors passed');
    });

    it('fails when circuit is missing', () => {
      const emptyCircuit: Circuit = { nodes: [], connections: [] };
      const result = evaluateCheckpoint(emptyCircuit, checkpoint);
      expect(result.status).toBe('failed');
      expect(result.feedback).toContain('empty or invalid');
    });
  });

  describe('AND Gate Truth Table', () => {
    const andCircuit: Circuit = {
      nodes: [
        { id: 'a', type: 'INPUT', position: { x: 0, y: 0 }, state: {}, config: {}, rotation: 0 },
        { id: 'b', type: 'INPUT', position: { x: 0, y: 20 }, state: {}, config: {}, rotation: 0 },
        { id: 'and', type: 'AND', position: { x: 50, y: 10 }, state: {}, config: {}, rotation: 0 },
        { id: 'out', type: 'OUTPUT', position: { x: 100, y: 10 }, state: {}, config: {}, rotation: 0 },
      ],
      connections: [
        { from: { nodeId: 'a', portName: 'out' }, to: { nodeId: 'and', portName: 'in1' } },
        { from: { nodeId: 'b', portName: 'out' }, to: { nodeId: 'and', portName: 'in2' } },
        { from: { nodeId: 'and', portName: 'out' }, to: { nodeId: 'out', portName: 'in' } },
      ],
    };

    const checkpoint: CheckpointDef = {
      id: 'cp-and',
      name: 'AND Gate',
      testVectors: [
        { id: 'v1', name: '0 AND 0', inputs: { a: 0, b: 0 }, expectedOutputs: { out: 0 } },
        { id: 'v2', name: '0 AND 1', inputs: { a: 0, b: 1 }, expectedOutputs: { out: 0 } },
        { id: 'v3', name: '1 AND 0', inputs: { a: 1, b: 0 }, expectedOutputs: { out: 0 } },
        { id: 'v4', name: '1 AND 1', inputs: { a: 1, b: 1 }, expectedOutputs: { out: 1 } },
      ],
    };

    it('passes when all 4 test vectors pass', () => {
      const result = evaluateCheckpoint(andCircuit, checkpoint);
      expect(result.status).toBe('passed');
      expect(result.feedback).toContain('All 4 test vectors passed');
    });
  });

  describe('XOR Gate Truth Table', () => {
    // XOR built from: (A AND NOT B) OR (NOT A AND B)
    const xorCircuit: Circuit = {
      nodes: [
        { id: 'a', type: 'INPUT', position: { x: 0, y: 0 }, state: {}, config: {}, rotation: 0 },
        { id: 'b', type: 'INPUT', position: { x: 0, y: 40 }, state: {}, config: {}, rotation: 0 },
        { id: 'not-a', type: 'NOT', position: { x: 50, y: 0 }, state: {}, config: {}, rotation: 0 },
        { id: 'not-b', type: 'NOT', position: { x: 50, y: 40 }, state: {}, config: {}, rotation: 0 },
        { id: 'and1', type: 'AND', position: { x: 100, y: 10 }, state: {}, config: {}, rotation: 0 },
        { id: 'and2', type: 'AND', position: { x: 100, y: 30 }, state: {}, config: {}, rotation: 0 },
        { id: 'or', type: 'OR', position: { x: 150, y: 20 }, state: {}, config: {}, rotation: 0 },
        { id: 'out', type: 'OUTPUT', position: { x: 200, y: 20 }, state: {}, config: {}, rotation: 0 },
      ],
      connections: [
        { from: { nodeId: 'a', portName: 'out' }, to: { nodeId: 'not-a', portName: 'in' } },
        { from: { nodeId: 'b', portName: 'out' }, to: { nodeId: 'not-b', portName: 'in' } },
        { from: { nodeId: 'a', portName: 'out' }, to: { nodeId: 'and1', portName: 'in1' } },
        { from: { nodeId: 'not-b', portName: 'out' }, to: { nodeId: 'and1', portName: 'in2' } },
        { from: { nodeId: 'not-a', portName: 'out' }, to: { nodeId: 'and2', portName: 'in1' } },
        { from: { nodeId: 'b', portName: 'out' }, to: { nodeId: 'and2', portName: 'in2' } },
        { from: { nodeId: 'and1', portName: 'out' }, to: { nodeId: 'or', portName: 'in1' } },
        { from: { nodeId: 'and2', portName: 'out' }, to: { nodeId: 'or', portName: 'in2' } },
        { from: { nodeId: 'or', portName: 'out' }, to: { nodeId: 'out', portName: 'in' } },
      ],
    };

    const checkpoint: CheckpointDef = {
      id: 'cp-xor',
      name: 'XOR Gate',
      testVectors: [
        { id: 'v1', name: '0 XOR 0', inputs: { a: 0, b: 0 }, expectedOutputs: { out: 0 } },
        { id: 'v2', name: '0 XOR 1', inputs: { a: 0, b: 1 }, expectedOutputs: { out: 1 } },
        { id: 'v3', name: '1 XOR 0', inputs: { a: 1, b: 0 }, expectedOutputs: { out: 1 } },
        { id: 'v4', name: '1 XOR 1', inputs: { a: 1, b: 1 }, expectedOutputs: { out: 0 } },
      ],
    };

    it('passes when XOR logic is correct', () => {
      const result = evaluateCheckpoint(xorCircuit, checkpoint);
      expect(result.status).toBe('passed');
      expect(result.feedback).toContain('All 4 test vectors passed');
    });
  });

  describe('Mismatch Reporting', () => {
    const wrongCircuit: Circuit = {
      nodes: [
        { id: 'in', type: 'INPUT', position: { x: 0, y: 0 }, state: {}, config: {}, rotation: 0 },
        // Missing NOT gate - output will always be same as input
        { id: 'out', type: 'OUTPUT', position: { x: 100, y: 0 }, state: {}, config: {}, rotation: 0 },
      ],
      connections: [
        { from: { nodeId: 'in', portName: 'out' }, to: { nodeId: 'out', portName: 'in' } },
      ],
    };

    const checkpoint: CheckpointDef = {
      id: 'cp-not',
      name: 'NOT Gate',
      testVectors: [
        { id: 'v1', name: 'A=0', inputs: { in: 0 }, expectedOutputs: { out: 1 } },
        { id: 'v2', name: 'A=1', inputs: { in: 1 }, expectedOutputs: { out: 0 } },
      ],
    };

    it('shows mismatch details when vectors fail', () => {
      const result = evaluateCheckpoint(wrongCircuit, checkpoint);
      expect(result.status).toBe('failed');
      expect(result.feedback).toContain('Failed 2/2 test vectors');
      expect(result.feedback).toContain('Expected:');
      expect(result.feedback).toContain('Got:');
    });

    it('limits mismatch display to first 5', () => {
      const manyVectors: CheckpointDef = {
        id: 'cp-many',
        name: 'Many Vectors',
        testVectors: Array.from({ length: 10 }, (_, i) => ({
          id: `v${i}`,
          name: `Test ${i}`,
          inputs: { in: 0 },
          expectedOutputs: { out: 1 },
        })),
      };

      const result = evaluateCheckpoint(wrongCircuit, manyVectors);
      expect(result.status).toBe('failed');
      expect(result.feedback).toContain('and 5 more mismatches');
    });
  });

  describe('Error Handling', () => {
    it('handles invalid circuit gracefully', () => {
      const checkpoint: CheckpointDef = {
        id: 'cp-test',
        name: 'Test',
        testVectors: [
          { id: 'v1', name: 'Test', inputs: { in: 0 }, expectedOutputs: { out: 1 } },
        ],
      };

      const result = evaluateCheckpoint('invalid json', checkpoint);
      expect(result.status).toBe('failed');
      expect(result.feedback).toContain('Error evaluating checkpoint');
    });

    it('handles missing test vectors', () => {
      const circuit: Circuit = { nodes: [], connections: [] };
      const checkpoint: CheckpointDef = {
        id: 'cp-no-vectors',
        name: 'No Vectors',
        testVectors: [],
      };

      const result = evaluateCheckpoint(circuit, checkpoint);
      expect(result.status).toBe('failed');
      expect(result.feedback).toContain('No test vectors defined');
    });
  });
});
