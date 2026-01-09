// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import { analyzeCircuitHealth, getTracePath } from '../logic/circuitHealth';
import type { Circuit } from '@redbyte/rb-logic-core';
import { createTestNode } from './testUtils';

describe('Circuit Health Analysis', () => {
  describe('analyzeCircuitHealth', () => {
    it('should return healthy for empty circuit', () => {
      const circuit: Circuit = {
        nodes: [],
        connections: [],
      };

      const health = analyzeCircuitHealth(circuit);

      expect(health.isHealthy).toBe(true);
      expect(health.hasErrors).toBe(false);
      expect(health.hasWarnings).toBe(false);
      expect(health.issues).toHaveLength(0);
    });

    it('should detect unconnected inputs', () => {
      const circuit: Circuit = {
        nodes: [
          createTestNode('and1', 'AND', { x: 0, y: 0 }),
        ],
        connections: [],
      };

      const health = analyzeCircuitHealth(circuit);

      expect(health.isHealthy).toBe(false);
      expect(health.hasWarnings).toBe(true);

      const unconnectedInputs = health.issues.filter(i => i.type === 'unconnected-input');
      expect(unconnectedInputs).toHaveLength(2); // AND gate has in1 and in2
      expect(unconnectedInputs[0].nodeId).toBe('and1');
      expect(unconnectedInputs[0].message).toContain('unconnected input');
    });

    it('should detect floating outputs', () => {
      const circuit: Circuit = {
        nodes: [
          createTestNode('switch1', 'Switch', { x: 0, y: 0 }),
        ],
        connections: [],
      };

      const health = analyzeCircuitHealth(circuit);

      const floatingOutputs = health.issues.filter(i => i.type === 'floating-output');
      expect(floatingOutputs).toHaveLength(1);
      expect(floatingOutputs[0].nodeId).toBe('switch1');
      expect(floatingOutputs[0].severity).toBe('hint');
    });

    it('should detect missing input sources', () => {
      const circuit: Circuit = {
        nodes: [
          createTestNode('and1', 'AND', { x: 0, y: 0 }),
          createTestNode('lamp1', 'Lamp', { x: 100, y: 0 }),
        ],
        connections: [
          { from: { nodeId: 'and1', portName: 'out' }, to: { nodeId: 'lamp1', portName: 'in' } },
        ],
      };

      const health = analyzeCircuitHealth(circuit);

      const noInputs = health.issues.filter(i => i.type === 'no-inputs');
      expect(noInputs).toHaveLength(1);
      expect(noInputs[0].message).toContain('no input sources');
      expect(noInputs[0].severity).toBe('hint');
    });

    it('should detect missing outputs', () => {
      const circuit: Circuit = {
        nodes: [
          createTestNode('switch1', 'Switch', { x: 0, y: 0 }),
          createTestNode('and1', 'AND', { x: 100, y: 0 }),
        ],
        connections: [
          { from: { nodeId: 'switch1', portName: 'out' }, to: { nodeId: 'and1', portName: 'in1' } },
        ],
      };

      const health = analyzeCircuitHealth(circuit);

      const noOutputs = health.issues.filter(i => i.type === 'no-outputs');
      expect(noOutputs).toHaveLength(1);
      expect(noOutputs[0].message).toContain('no outputs');
      expect(noOutputs[0].severity).toBe('hint');
    });

    it('should report healthy for properly connected circuit', () => {
      const circuit: Circuit = {
        nodes: [
          createTestNode('switch1', 'Switch', { x: 0, y: 0 }),
          createTestNode('switch2', 'Switch', { x: 0, y: 50 }),
          createTestNode('and1', 'AND', { x: 100, y: 25 }),
          createTestNode('lamp1', 'Lamp', { x: 200, y: 25 }),
        ],
        connections: [
          { from: { nodeId: 'switch1', portName: 'out' }, to: { nodeId: 'and1', portName: 'in1' } },
          { from: { nodeId: 'switch2', portName: 'out' }, to: { nodeId: 'and1', portName: 'in2' } },
          { from: { nodeId: 'and1', portName: 'out' }, to: { nodeId: 'lamp1', portName: 'in' } },
        ],
      };

      const health = analyzeCircuitHealth(circuit);

      expect(health.isHealthy).toBe(true);
      expect(health.hasErrors).toBe(false);
      expect(health.hasWarnings).toBe(false);
      expect(health.issues).toHaveLength(0);
    });

    it('should not flag PowerSource and Switch as having unconnected inputs', () => {
      const circuit: Circuit = {
        nodes: [
          createTestNode('power1', 'PowerSource', { x: 0, y: 0 }),
          createTestNode('switch1', 'Switch', { x: 0, y: 50 }),
        ],
        connections: [],
      };

      const health = analyzeCircuitHealth(circuit);

      const unconnectedInputs = health.issues.filter(i => i.type === 'unconnected-input');
      expect(unconnectedInputs).toHaveLength(0);
    });

    it('should not flag Lamp and OUTPUT as having floating outputs', () => {
      const circuit: Circuit = {
        nodes: [
          createTestNode('lamp1', 'Lamp', { x: 0, y: 0 }),
          createTestNode('output1', 'OUTPUT', { x: 0, y: 50 }),
        ],
        connections: [],
      };

      const health = analyzeCircuitHealth(circuit);

      const floatingOutputs = health.issues.filter(i => i.type === 'floating-output');
      expect(floatingOutputs).toHaveLength(0);
    });
  });

  describe('getTracePath', () => {
    const circuit: Circuit = {
      nodes: [
        createTestNode('switch1', 'Switch', { x: 0, y: 0 }),
        createTestNode('and1', 'AND', { x: 100, y: 0 }),
        createTestNode('not1', 'NOT', { x: 200, y: 0 }),
        createTestNode('lamp1', 'Lamp', { x: 300, y: 0 }),
      ],
      connections: [
        { from: { nodeId: 'switch1', portName: 'out' }, to: { nodeId: 'and1', portName: 'in1' } },
        { from: { nodeId: 'and1', portName: 'out' }, to: { nodeId: 'not1', portName: 'in' } },
        { from: { nodeId: 'not1', portName: 'out' }, to: { nodeId: 'lamp1', portName: 'in' } },
      ],
    };

    it('should trace downstream connections', () => {
      const traced = getTracePath('switch1', circuit, 'downstream', 10);

      expect(traced.has('switch1')).toBe(true);
      expect(traced.has('and1')).toBe(true);
      expect(traced.has('not1')).toBe(true);
      expect(traced.has('lamp1')).toBe(true);
    });

    it('should trace upstream connections', () => {
      const traced = getTracePath('lamp1', circuit, 'upstream', 10);

      expect(traced.has('lamp1')).toBe(true);
      expect(traced.has('not1')).toBe(true);
      expect(traced.has('and1')).toBe(true);
      expect(traced.has('switch1')).toBe(true);
    });

    it('should respect max hops limit', () => {
      const traced = getTracePath('switch1', circuit, 'downstream', 1);

      expect(traced.has('switch1')).toBe(true);
      expect(traced.has('and1')).toBe(true);
      expect(traced.has('not1')).toBe(false);
      expect(traced.has('lamp1')).toBe(false);
    });

    it('should trace both directions', () => {
      const traced = getTracePath('and1', circuit, 'both', 10);

      expect(traced.has('switch1')).toBe(true);
      expect(traced.has('and1')).toBe(true);
      expect(traced.has('not1')).toBe(true);
      expect(traced.has('lamp1')).toBe(true);
    });
  });
});
