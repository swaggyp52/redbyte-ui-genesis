// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import { isValidConnection, normalizeConnection, isInputPort } from '../tools/wireValidation';
import type { Circuit } from '@redbyte/rb-logic-core';

describe('Wire Validation', () => {
  const mockCircuit: Circuit = {
    nodes: [
      { id: 'node1', type: 'AND', position: { x: 0, y: 0 } },
      { id: 'node2', type: 'OR', position: { x: 100, y: 0 } },
      { id: 'node3', type: 'NOT', position: { x: 200, y: 0 } },
    ],
    connections: [
      { from: { nodeId: 'node1', portName: 'out' }, to: { nodeId: 'node2', portName: 'in1' } },
    ],
  };

  describe('isInputPort', () => {
    it('should identify input ports by naming convention', () => {
      expect(isInputPort('node1', 'in', mockCircuit)).toBe(true);
      expect(isInputPort('node1', 'in1', mockCircuit)).toBe(true);
      expect(isInputPort('node1', 'in2', mockCircuit)).toBe(true);
      expect(isInputPort('node1', 'input', mockCircuit)).toBe(true);
    });

    it('should identify output ports by naming convention', () => {
      expect(isInputPort('node1', 'out', mockCircuit)).toBe(false);
      expect(isInputPort('node1', 'output', mockCircuit)).toBe(false);
    });

    it('should return false for non-existent nodes', () => {
      expect(isInputPort('nonexistent', 'in', mockCircuit)).toBe(false);
    });
  });

  describe('isValidConnection', () => {
    it('should allow valid output->input connections', () => {
      const result = isValidConnection(
        { nodeId: 'node1', portName: 'out' },
        { nodeId: 'node3', portName: 'in' },
        mockCircuit
      );
      expect(result.valid).toBe(true);
    });

    it('should allow valid input->output connections (will be normalized)', () => {
      const result = isValidConnection(
        { nodeId: 'node3', portName: 'in' },
        { nodeId: 'node1', portName: 'out' },
        mockCircuit
      );
      expect(result.valid).toBe(true);
    });

    it('should prevent self-loops', () => {
      const result = isValidConnection(
        { nodeId: 'node1', portName: 'out' },
        { nodeId: 'node1', portName: 'in' },
        mockCircuit
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Cannot connect node to itself');
    });

    it('should prevent output->output connections', () => {
      const result = isValidConnection(
        { nodeId: 'node1', portName: 'out' },
        { nodeId: 'node2', portName: 'out' },
        mockCircuit
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Cannot connect output to output');
    });

    it('should prevent input->input connections', () => {
      const result = isValidConnection(
        { nodeId: 'node1', portName: 'in1' },
        { nodeId: 'node2', portName: 'in2' },
        mockCircuit
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Cannot connect input to input');
    });

    it('should prevent duplicate connections', () => {
      const result = isValidConnection(
        { nodeId: 'node1', portName: 'out' },
        { nodeId: 'node2', portName: 'in1' },
        mockCircuit
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Connection already exists');
    });

    it('should prevent duplicate connections in reverse direction', () => {
      const result = isValidConnection(
        { nodeId: 'node2', portName: 'in1' },
        { nodeId: 'node1', portName: 'out' },
        mockCircuit
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Connection already exists');
    });
  });

  describe('normalizeConnection', () => {
    it('should keep output->input connections as-is', () => {
      const connection = normalizeConnection(
        { nodeId: 'node1', portName: 'out' },
        { nodeId: 'node2', portName: 'in' },
        mockCircuit
      );
      expect(connection.from.nodeId).toBe('node1');
      expect(connection.from.portName).toBe('out');
      expect(connection.to.nodeId).toBe('node2');
      expect(connection.to.portName).toBe('in');
    });

    it('should swap input->output connections to output->input', () => {
      const connection = normalizeConnection(
        { nodeId: 'node2', portName: 'in' },
        { nodeId: 'node1', portName: 'out' },
        mockCircuit
      );
      expect(connection.from.nodeId).toBe('node1');
      expect(connection.from.portName).toBe('out');
      expect(connection.to.nodeId).toBe('node2');
      expect(connection.to.portName).toBe('in');
    });
  });
});
