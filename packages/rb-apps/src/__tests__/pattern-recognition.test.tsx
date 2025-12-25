// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import { recognizePattern } from '../patterns/patternMatcher';
import type { Circuit } from '@redbyte/rb-logic-core';

describe('Pattern Recognition', () => {
  describe('XOR Gate Recognition', () => {
    it('should recognize XOR gate built from NANDs', () => {
      const xorCircuit: Circuit = {
        nodes: [
          { id: 'input-a', type: 'INPUT', x: 50, y: 100 },
          { id: 'input-b', type: 'INPUT', x: 50, y: 200 },
          { id: 'nand1', type: 'NAND', x: 200, y: 100 },
          { id: 'nand2', type: 'NAND', x: 200, y: 200 },
          { id: 'nand3', type: 'NAND', x: 350, y: 150 },
          { id: 'output', type: 'OUTPUT', x: 500, y: 150 },
        ],
        connections: [
          { id: 'c1', from: 'input-a', to: 'nand1', fromPort: 'out', toPort: 'in1' },
          { id: 'c2', from: 'input-b', to: 'nand1', fromPort: 'out', toPort: 'in2' },
          { id: 'c3', from: 'input-a', to: 'nand2', fromPort: 'out', toPort: 'in1' },
          { id: 'c4', from: 'nand1', to: 'nand2', fromPort: 'out', toPort: 'in2' },
          { id: 'c5', from: 'input-b', to: 'nand3', fromPort: 'out', toPort: 'in1' },
          { id: 'c6', from: 'nand2', to: 'nand3', fromPort: 'out', toPort: 'in2' },
          { id: 'c7', from: 'nand3', to: 'output', fromPort: 'out', toPort: 'in' },
        ],
      };

      const pattern = recognizePattern(xorCircuit);

      expect(pattern).not.toBeNull();
      expect(pattern?.name).toBe('XOR Gate');
      expect(pattern?.layer).toBe(1);
      expect(pattern?.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should not recognize XOR with wrong gate count', () => {
      const wrongCircuit: Circuit = {
        nodes: [
          { id: 'input-a', type: 'INPUT', x: 50, y: 100 },
          { id: 'input-b', type: 'INPUT', x: 50, y: 200 },
          { id: 'nand1', type: 'NAND', x: 200, y: 100 },
          { id: 'nand2', type: 'NAND', x: 200, y: 200 },
          { id: 'output', type: 'OUTPUT', x: 500, y: 150 },
        ],
        connections: [
          { id: 'c1', from: 'input-a', to: 'nand1', fromPort: 'out', toPort: 'in1' },
          { id: 'c2', from: 'input-b', to: 'nand1', fromPort: 'out', toPort: 'in2' },
          { id: 'c3', from: 'nand1', to: 'nand2', fromPort: 'out', toPort: 'in1' },
          { id: 'c4', from: 'nand2', to: 'output', fromPort: 'out', toPort: 'in' },
        ],
      };

      const pattern = recognizePattern(wrongCircuit);

      // Should either return null or a different pattern
      if (pattern) {
        expect(pattern.name).not.toBe('XOR Gate');
      }
    });
  });

  describe('Half Adder Recognition', () => {
    it('should recognize Half Adder (XOR + AND)', () => {
      const halfAdderCircuit: Circuit = {
        nodes: [
          { id: 'input-a', type: 'INPUT', x: 50, y: 100 },
          { id: 'input-b', type: 'INPUT', x: 50, y: 200 },
          { id: 'xor', type: 'XOR', x: 200, y: 100 },
          { id: 'and', type: 'AND', x: 200, y: 200 },
          { id: 'sum-output', type: 'OUTPUT', x: 350, y: 100 },
          { id: 'carry-output', type: 'OUTPUT', x: 350, y: 200 },
        ],
        connections: [
          { id: 'c1', from: 'input-a', to: 'xor', fromPort: 'out', toPort: 'in1' },
          { id: 'c2', from: 'input-b', to: 'xor', fromPort: 'out', toPort: 'in2' },
          { id: 'c3', from: 'input-a', to: 'and', fromPort: 'out', toPort: 'in1' },
          { id: 'c4', from: 'input-b', to: 'and', fromPort: 'out', toPort: 'in2' },
          { id: 'c5', from: 'xor', to: 'sum-output', fromPort: 'out', toPort: 'in' },
          { id: 'c6', from: 'and', to: 'carry-output', fromPort: 'out', toPort: 'in' },
        ],
      };

      const pattern = recognizePattern(halfAdderCircuit);

      expect(pattern).not.toBeNull();
      expect(pattern?.name).toBe('Half Adder');
      expect(pattern?.layer).toBe(1);
      expect(pattern?.confidence).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe('Full Adder Recognition', () => {
    it('should recognize Full Adder (2 XOR + 2 AND + 1 OR)', () => {
      const fullAdderCircuit: Circuit = {
        nodes: [
          { id: 'input-a', type: 'INPUT', x: 50, y: 80 },
          { id: 'input-b', type: 'INPUT', x: 50, y: 160 },
          { id: 'carry-in', type: 'INPUT', x: 50, y: 240 },
          { id: 'xor1', type: 'XOR', x: 200, y: 120 },
          { id: 'xor2', type: 'XOR', x: 350, y: 150 },
          { id: 'and1', type: 'AND', x: 200, y: 220 },
          { id: 'and2', type: 'AND', x: 350, y: 250 },
          { id: 'or-carry', type: 'OR', x: 500, y: 235 },
          { id: 'sum-output', type: 'OUTPUT', x: 550, y: 150 },
          { id: 'carry-output', type: 'OUTPUT', x: 650, y: 235 },
        ],
        connections: [
          { id: 'c1', from: 'input-a', to: 'xor1', fromPort: 'out', toPort: 'in1' },
          { id: 'c2', from: 'input-b', to: 'xor1', fromPort: 'out', toPort: 'in2' },
          { id: 'c3', from: 'xor1', to: 'xor2', fromPort: 'out', toPort: 'in1' },
          { id: 'c4', from: 'carry-in', to: 'xor2', fromPort: 'out', toPort: 'in2' },
          { id: 'c5', from: 'xor2', to: 'sum-output', fromPort: 'out', toPort: 'in' },
          { id: 'c6', from: 'input-a', to: 'and1', fromPort: 'out', toPort: 'in1' },
          { id: 'c7', from: 'input-b', to: 'and1', fromPort: 'out', toPort: 'in2' },
          { id: 'c8', from: 'xor1', to: 'and2', fromPort: 'out', toPort: 'in1' },
          { id: 'c9', from: 'carry-in', to: 'and2', fromPort: 'out', toPort: 'in2' },
          { id: 'c10', from: 'and1', to: 'or-carry', fromPort: 'out', toPort: 'in1' },
          { id: 'c11', from: 'and2', to: 'or-carry', fromPort: 'out', toPort: 'in2' },
          { id: 'c12', from: 'or-carry', to: 'carry-output', fromPort: 'out', toPort: 'in' },
        ],
      };

      const pattern = recognizePattern(fullAdderCircuit);

      expect(pattern).not.toBeNull();
      expect(pattern?.name).toBe('Full Adder');
      expect(pattern?.layer).toBe(2);
      expect(pattern?.confidence).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe('SR Latch Recognition', () => {
    it('should recognize SR Latch (2 NOR gates)', () => {
      const srLatchCircuit: Circuit = {
        nodes: [
          { id: 'set', type: 'INPUT', x: 50, y: 100 },
          { id: 'reset', type: 'INPUT', x: 50, y: 250 },
          { id: 'nor1', type: 'NOR', x: 250, y: 120 },
          { id: 'nor2', type: 'NOR', x: 250, y: 230 },
          { id: 'q-output', type: 'OUTPUT', x: 450, y: 120 },
          { id: 'qbar-output', type: 'OUTPUT', x: 450, y: 230 },
        ],
        connections: [
          { id: 'c1', from: 'set', to: 'nor1', fromPort: 'out', toPort: 'in1' },
          { id: 'c2', from: 'nor2', to: 'nor1', fromPort: 'out', toPort: 'in2' },
          { id: 'c3', from: 'nor1', to: 'nor2', fromPort: 'out', toPort: 'in1' },
          { id: 'c4', from: 'reset', to: 'nor2', fromPort: 'out', toPort: 'in2' },
          { id: 'c5', from: 'nor1', to: 'q-output', fromPort: 'out', toPort: 'in' },
          { id: 'c6', from: 'nor2', to: 'qbar-output', fromPort: 'out', toPort: 'in' },
        ],
      };

      const pattern = recognizePattern(srLatchCircuit);

      expect(pattern).not.toBeNull();
      expect(pattern?.name).toBe('SR Latch');
      expect(pattern?.layer).toBe(3);
      expect(pattern?.confidence).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe('Empty Circuit', () => {
    it('should return null for empty circuit', () => {
      const emptyCircuit: Circuit = {
        nodes: [],
        connections: [],
      };

      const pattern = recognizePattern(emptyCircuit);

      expect(pattern).toBeNull();
    });
  });

  describe('Unrecognized Circuit', () => {
    it('should return null for random circuit', () => {
      const randomCircuit: Circuit = {
        nodes: [
          { id: 'input', type: 'INPUT', x: 50, y: 100 },
          { id: 'not1', type: 'NOT', x: 200, y: 100 },
          { id: 'not2', type: 'NOT', x: 350, y: 100 },
          { id: 'not3', type: 'NOT', x: 500, y: 100 },
          { id: 'output', type: 'OUTPUT', x: 650, y: 100 },
        ],
        connections: [
          { id: 'c1', from: 'input', to: 'not1', fromPort: 'out', toPort: 'in' },
          { id: 'c2', from: 'not1', to: 'not2', fromPort: 'out', toPort: 'in' },
          { id: 'c3', from: 'not2', to: 'not3', fromPort: 'out', toPort: 'in' },
          { id: 'c4', from: 'not3', to: 'output', fromPort: 'out', toPort: 'in' },
        ],
      };

      const pattern = recognizePattern(randomCircuit);

      // Triple NOT is not a recognized pattern
      expect(pattern).toBeNull();
    });
  });

  describe('Confidence Threshold', () => {
    it('should still recognize pattern with a few extra gates', () => {
      // Circuit similar to Half Adder but with extra disconnected gates
      const extraGatesCircuit: Circuit = {
        nodes: [
          { id: 'input-a', type: 'INPUT', x: 50, y: 100 },
          { id: 'input-b', type: 'INPUT', x: 50, y: 200 },
          { id: 'xor', type: 'XOR', x: 200, y: 100 },
          { id: 'and', type: 'AND', x: 200, y: 200 },
          { id: 'extra-or', type: 'OR', x: 200, y: 300 },
          { id: 'extra-not', type: 'NOT', x: 200, y: 400 },
          { id: 'sum-output', type: 'OUTPUT', x: 350, y: 100 },
          { id: 'carry-output', type: 'OUTPUT', x: 350, y: 200 },
        ],
        connections: [
          { id: 'c1', from: 'input-a', to: 'xor', fromPort: 'out', toPort: 'in1' },
          { id: 'c2', from: 'input-b', to: 'xor', fromPort: 'out', toPort: 'in2' },
          { id: 'c3', from: 'input-a', to: 'and', fromPort: 'out', toPort: 'in1' },
          { id: 'c4', from: 'input-b', to: 'and', fromPort: 'out', toPort: 'in2' },
          { id: 'c5', from: 'xor', to: 'sum-output', fromPort: 'out', toPort: 'in' },
          { id: 'c6', from: 'and', to: 'carry-output', fromPort: 'out', toPort: 'in' },
        ],
      };

      const pattern = recognizePattern(extraGatesCircuit);

      // Should still recognize Half Adder despite extra gates
      // The matcher is smart enough to find the core pattern
      expect(pattern).not.toBeNull();
      expect(pattern?.name).toBe('Half Adder');
      expect(pattern?.confidence).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe('Layer 4 Pattern Recognition', () => {
    it('should recognize 2-to-4 Decoder', () => {
      const decoderCircuit: Circuit = {
        nodes: [
          { id: 'a0', type: 'INPUT', x: 50, y: 80 },
          { id: 'a1', type: 'INPUT', x: 50, y: 200 },
          { id: 'not-a0', type: 'NOT', x: 150, y: 80 },
          { id: 'not-a1', type: 'NOT', x: 150, y: 200 },
          { id: 'and-y0', type: 'AND', x: 280, y: 60 },
          { id: 'and-y1', type: 'AND', x: 280, y: 140 },
          { id: 'and-y2', type: 'AND', x: 280, y: 220 },
          { id: 'and-y3', type: 'AND', x: 280, y: 300 },
          { id: 'y0', type: 'OUTPUT', x: 420, y: 60 },
          { id: 'y1', type: 'OUTPUT', x: 420, y: 140 },
          { id: 'y2', type: 'OUTPUT', x: 420, y: 220 },
          { id: 'y3', type: 'OUTPUT', x: 420, y: 300 },
        ],
        connections: [
          { id: 'c1', from: 'a0', to: 'not-a0', fromPort: 'out', toPort: 'in' },
          { id: 'c2', from: 'a1', to: 'not-a1', fromPort: 'out', toPort: 'in' },
          { id: 'c3', from: 'not-a0', to: 'and-y0', fromPort: 'out', toPort: 'in1' },
          { id: 'c4', from: 'not-a1', to: 'and-y0', fromPort: 'out', toPort: 'in2' },
          { id: 'c5', from: 'a0', to: 'and-y1', fromPort: 'out', toPort: 'in1' },
          { id: 'c6', from: 'not-a1', to: 'and-y1', fromPort: 'out', toPort: 'in2' },
          { id: 'c7', from: 'not-a0', to: 'and-y2', fromPort: 'out', toPort: 'in1' },
          { id: 'c8', from: 'a1', to: 'and-y2', fromPort: 'out', toPort: 'in2' },
          { id: 'c9', from: 'a0', to: 'and-y3', fromPort: 'out', toPort: 'in1' },
          { id: 'c10', from: 'a1', to: 'and-y3', fromPort: 'out', toPort: 'in2' },
          { id: 'c11', from: 'and-y0', to: 'y0', fromPort: 'out', toPort: 'in' },
          { id: 'c12', from: 'and-y1', to: 'y1', fromPort: 'out', toPort: 'in' },
          { id: 'c13', from: 'and-y2', to: 'y2', fromPort: 'out', toPort: 'in' },
          { id: 'c14', from: 'and-y3', to: 'y3', fromPort: 'out', toPort: 'in' },
        ],
      };

      const pattern = recognizePattern(decoderCircuit);

      expect(pattern).not.toBeNull();
      expect(pattern?.name).toBe('2-to-4 Decoder');
      expect(pattern?.layer).toBe(4);
      expect(pattern?.confidence).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe('Layer 5 Pattern Recognition', () => {
    it('should recognize 4-bit Register', () => {
      // 4-bit register: 4 edge-triggered D flip-flops (4 NANDs per flip-flop) + shared clock
      // Total: 16 NANDs, 36 connections
      const registerCircuit: Circuit = {
        nodes: [
          // Clock input
          { id: 'clk', type: 'INPUT', x: 50, y: 400 },
          // Data inputs
          { id: 'd0', type: 'INPUT', x: 50, y: 60 },
          { id: 'd1', type: 'INPUT', x: 50, y: 140 },
          { id: 'd2', type: 'INPUT', x: 50, y: 220 },
          { id: 'd3', type: 'INPUT', x: 50, y: 300 },
          // D flip-flop 0 (4 NANDs)
          { id: 'dff0-nand1', type: 'NAND', x: 180, y: 50 },
          { id: 'dff0-nand2', type: 'NAND', x: 180, y: 90 },
          { id: 'dff0-nand3', type: 'NAND', x: 280, y: 60 },
          { id: 'dff0-nand4', type: 'NAND', x: 280, y: 100 },
          // D flip-flop 1 (4 NANDs)
          { id: 'dff1-nand1', type: 'NAND', x: 180, y: 130 },
          { id: 'dff1-nand2', type: 'NAND', x: 180, y: 170 },
          { id: 'dff1-nand3', type: 'NAND', x: 280, y: 140 },
          { id: 'dff1-nand4', type: 'NAND', x: 280, y: 180 },
          // D flip-flop 2 (4 NANDs)
          { id: 'dff2-nand1', type: 'NAND', x: 180, y: 210 },
          { id: 'dff2-nand2', type: 'NAND', x: 180, y: 250 },
          { id: 'dff2-nand3', type: 'NAND', x: 280, y: 220 },
          { id: 'dff2-nand4', type: 'NAND', x: 280, y: 260 },
          // D flip-flop 3 (4 NANDs)
          { id: 'dff3-nand1', type: 'NAND', x: 180, y: 290 },
          { id: 'dff3-nand2', type: 'NAND', x: 180, y: 330 },
          { id: 'dff3-nand3', type: 'NAND', x: 280, y: 300 },
          { id: 'dff3-nand4', type: 'NAND', x: 280, y: 340 },
          // Outputs
          { id: 'q0', type: 'OUTPUT', x: 380, y: 70 },
          { id: 'q1', type: 'OUTPUT', x: 380, y: 150 },
          { id: 'q2', type: 'OUTPUT', x: 380, y: 230 },
          { id: 'q3', type: 'OUTPUT', x: 380, y: 310 },
        ],
        connections: [
          // D flip-flop 0 connections (9 total)
          { id: 'c1', from: 'd0', to: 'dff0-nand1', fromPort: 'out', toPort: 'in1' },
          { id: 'c2', from: 'clk', to: 'dff0-nand1', fromPort: 'out', toPort: 'in2' },
          { id: 'c3', from: 'clk', to: 'dff0-nand2', fromPort: 'out', toPort: 'in1' },
          { id: 'c4', from: 'dff0-nand1', to: 'dff0-nand2', fromPort: 'out', toPort: 'in2' },
          { id: 'c5', from: 'dff0-nand1', to: 'dff0-nand3', fromPort: 'out', toPort: 'in1' },
          { id: 'c6', from: 'dff0-nand4', to: 'dff0-nand3', fromPort: 'out', toPort: 'in2' },
          { id: 'c7', from: 'dff0-nand3', to: 'dff0-nand4', fromPort: 'out', toPort: 'in1' },
          { id: 'c8', from: 'dff0-nand2', to: 'dff0-nand4', fromPort: 'out', toPort: 'in2' },
          { id: 'c9', from: 'dff0-nand3', to: 'q0', fromPort: 'out', toPort: 'in' },
          // D flip-flop 1 connections (9 total)
          { id: 'c10', from: 'd1', to: 'dff1-nand1', fromPort: 'out', toPort: 'in1' },
          { id: 'c11', from: 'clk', to: 'dff1-nand1', fromPort: 'out', toPort: 'in2' },
          { id: 'c12', from: 'clk', to: 'dff1-nand2', fromPort: 'out', toPort: 'in1' },
          { id: 'c13', from: 'dff1-nand1', to: 'dff1-nand2', fromPort: 'out', toPort: 'in2' },
          { id: 'c14', from: 'dff1-nand1', to: 'dff1-nand3', fromPort: 'out', toPort: 'in1' },
          { id: 'c15', from: 'dff1-nand4', to: 'dff1-nand3', fromPort: 'out', toPort: 'in2' },
          { id: 'c16', from: 'dff1-nand3', to: 'dff1-nand4', fromPort: 'out', toPort: 'in1' },
          { id: 'c17', from: 'dff1-nand2', to: 'dff1-nand4', fromPort: 'out', toPort: 'in2' },
          { id: 'c18', from: 'dff1-nand3', to: 'q1', fromPort: 'out', toPort: 'in' },
          // D flip-flop 2 connections (9 total)
          { id: 'c19', from: 'd2', to: 'dff2-nand1', fromPort: 'out', toPort: 'in1' },
          { id: 'c20', from: 'clk', to: 'dff2-nand1', fromPort: 'out', toPort: 'in2' },
          { id: 'c21', from: 'clk', to: 'dff2-nand2', fromPort: 'out', toPort: 'in1' },
          { id: 'c22', from: 'dff2-nand1', to: 'dff2-nand2', fromPort: 'out', toPort: 'in2' },
          { id: 'c23', from: 'dff2-nand1', to: 'dff2-nand3', fromPort: 'out', toPort: 'in1' },
          { id: 'c24', from: 'dff2-nand4', to: 'dff2-nand3', fromPort: 'out', toPort: 'in2' },
          { id: 'c25', from: 'dff2-nand3', to: 'dff2-nand4', fromPort: 'out', toPort: 'in1' },
          { id: 'c26', from: 'dff2-nand2', to: 'dff2-nand4', fromPort: 'out', toPort: 'in2' },
          { id: 'c27', from: 'dff2-nand3', to: 'q2', fromPort: 'out', toPort: 'in' },
          // D flip-flop 3 connections (9 total)
          { id: 'c28', from: 'd3', to: 'dff3-nand1', fromPort: 'out', toPort: 'in1' },
          { id: 'c29', from: 'clk', to: 'dff3-nand1', fromPort: 'out', toPort: 'in2' },
          { id: 'c30', from: 'clk', to: 'dff3-nand2', fromPort: 'out', toPort: 'in1' },
          { id: 'c31', from: 'dff3-nand1', to: 'dff3-nand2', fromPort: 'out', toPort: 'in2' },
          { id: 'c32', from: 'dff3-nand1', to: 'dff3-nand3', fromPort: 'out', toPort: 'in1' },
          { id: 'c33', from: 'dff3-nand4', to: 'dff3-nand3', fromPort: 'out', toPort: 'in2' },
          { id: 'c34', from: 'dff3-nand3', to: 'dff3-nand4', fromPort: 'out', toPort: 'in1' },
          { id: 'c35', from: 'dff3-nand2', to: 'dff3-nand4', fromPort: 'out', toPort: 'in2' },
          { id: 'c36', from: 'dff3-nand3', to: 'q3', fromPort: 'out', toPort: 'in' },
        ],
      };

      const pattern = recognizePattern(registerCircuit);

      expect(pattern).not.toBeNull();
      expect(pattern?.name).toBe('4-bit Register');
      expect(pattern?.layer).toBe(5);
      expect(pattern?.confidence).toBeGreaterThanOrEqual(0.8);
    });
  });
});
