// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach } from 'vitest';
import { NodeRegistry } from './NodeRegistry';
import { CircuitEngine } from './CircuitEngine';
import type { Circuit } from './types';

// Import to ensure built-ins are registered
import './index';

describe('Built-in Node Behaviors', () => {

  describe('PowerSource', () => {
    it('should always output 1', () => {
      const circuit: Circuit = {
        nodes: [{ id: 'p1', type: 'PowerSource', position: { x: 0, y: 0 }, rotation: 0, config: {} }],
        connections: [],
      };
      const engine = new CircuitEngine(circuit);
      engine.tick();
      const signals = engine.getAllSignals();
      expect(signals.get('p1.out')).toBe(1);
    });
  });

  describe('Wire', () => {
    it('should pass through input signal', () => {
      const circuit: Circuit = {
        nodes: [
          { id: 'p1', type: 'PowerSource', position: { x: 0, y: 0 }, rotation: 0, config: {} },
          { id: 'w1', type: 'Wire', position: { x: 1, y: 0 }, rotation: 0, config: {} },
        ],
        connections: [
          { from: { nodeId: 'p1', portName: 'out' }, to: { nodeId: 'w1', portName: 'in' } },
        ],
      };
      const engine = new CircuitEngine(circuit);
      engine.tick();
      const signals = engine.getAllSignals();
      expect(signals.get('w1.out')).toBe(1);
    });
  });

  describe('Logic Gates', () => {
    it('AND gate should output 1 only when both inputs are 1', () => {
      const circuit: Circuit = {
        nodes: [
          { id: 'p1', type: 'PowerSource', position: { x: 0, y: 0 }, rotation: 0, config: {} },
          { id: 'p2', type: 'PowerSource', position: { x: 0, y: 1 }, rotation: 0, config: {} },
          { id: 'and1', type: 'AND', position: { x: 1, y: 0 }, rotation: 0, config: {} },
        ],
        connections: [
          { from: { nodeId: 'p1', portName: 'out' }, to: { nodeId: 'and1', portName: 'a' } },
          { from: { nodeId: 'p2', portName: 'out' }, to: { nodeId: 'and1', portName: 'b' } },
        ],
      };
      const engine = new CircuitEngine(circuit);
      engine.tick();
      const signals = engine.getAllSignals();
      expect(signals.get('and1.out')).toBe(1);
    });

    it('OR gate should output 1 when either input is 1', () => {
      const circuit: Circuit = {
        nodes: [
          { id: 'p1', type: 'PowerSource', position: { x: 0, y: 0 }, rotation: 0, config: {} },
          { id: 'or1', type: 'OR', position: { x: 1, y: 0 }, rotation: 0, config: {} },
        ],
        connections: [
          { from: { nodeId: 'p1', portName: 'out' }, to: { nodeId: 'or1', portName: 'a' } },
        ],
      };
      const engine = new CircuitEngine(circuit);
      engine.tick();
      const signals = engine.getAllSignals();
      expect(signals.get('or1.out')).toBe(1);
    });

    it('NOT gate should invert input', () => {
      const circuit: Circuit = {
        nodes: [
          { id: 'p1', type: 'PowerSource', position: { x: 0, y: 0 }, rotation: 0, config: {} },
          { id: 'not1', type: 'NOT', position: { x: 1, y: 0 }, rotation: 0, config: {} },
        ],
        connections: [
          { from: { nodeId: 'p1', portName: 'out' }, to: { nodeId: 'not1', portName: 'in' } },
        ],
      };
      const engine = new CircuitEngine(circuit);
      engine.tick();
      const signals = engine.getAllSignals();
      expect(signals.get('not1.out')).toBe(0);
    });

    it('XOR gate should output 1 when inputs differ', () => {
      const circuit: Circuit = {
        nodes: [
          { id: 'p1', type: 'PowerSource', position: { x: 0, y: 0 }, rotation: 0, config: {} },
          { id: 'xor1', type: 'XOR', position: { x: 1, y: 0 }, rotation: 0, config: {} },
        ],
        connections: [
          { from: { nodeId: 'p1', portName: 'out' }, to: { nodeId: 'xor1', portName: 'a' } },
        ],
      };
      const engine = new CircuitEngine(circuit);
      engine.tick();
      const signals = engine.getAllSignals();
      expect(signals.get('xor1.out')).toBe(1);
    });
  });

  describe('Clock', () => {
    it('should oscillate with configured period', () => {
      const circuit: Circuit = {
        nodes: [
          { id: 'clk1', type: 'Clock', position: { x: 0, y: 0 }, rotation: 0, config: { period: 4 } },
        ],
        connections: [],
      };
      const engine = new CircuitEngine(circuit);
      
      const outputs: number[] = [];
      for (let i = 0; i < 8; i++) {
        engine.tick();
        const signals = engine.getAllSignals();
        outputs.push(signals.get('clk1.out') ?? 0);
      }
      
      // Period 4: high for 2 ticks, low for 2 ticks
      expect(outputs).toEqual([1, 1, 0, 0, 1, 1, 0, 0]);
    });
  });

  describe('Delay', () => {
    it('should delay signal by configured ticks', () => {
      const circuit: Circuit = {
        nodes: [
          { id: 'p1', type: 'PowerSource', position: { x: 0, y: 0 }, rotation: 0, config: {} },
          { id: 'd1', type: 'Delay', position: { x: 1, y: 0 }, rotation: 0, config: { delay: 2 } },
        ],
        connections: [
          { from: { nodeId: 'p1', portName: 'out' }, to: { nodeId: 'd1', portName: 'in' } },
        ],
      };
      const engine = new CircuitEngine(circuit);
      
      const outputs: number[] = [];
      for (let i = 0; i < 5; i++) {
        engine.tick();
        const signals = engine.getAllSignals();
        outputs.push(signals.get('d1.out') ?? 0);
      }
      
      // Delay of 2: output should be 0 for first 2 ticks, then 1
      expect(outputs).toEqual([0, 0, 1, 1, 1]);
    });
  });

  describe('Switch', () => {
    it('should toggle based on state', () => {
      const circuit: Circuit = {
        nodes: [
          { id: 's1', type: 'Switch', position: { x: 0, y: 0 }, rotation: 0, config: {}, state: { isOn: 0 } },
        ],
        connections: [],
      };
      const engine = new CircuitEngine(circuit);
      
      engine.tick();
      let signals = engine.getAllSignals();
      expect(signals.get('s1.out')).toBe(0);
      
      // Toggle switch on
      engine.setNodeState('s1', { isOn: 1 });
      engine.tick();
      signals = engine.getAllSignals();
      expect(signals.get('s1.out')).toBe(1);
    });
  });
});
