// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import './index';
import { CircuitEngine } from './CircuitEngine';
import type { Circuit } from './types';

describe('Composite Nodes', () => {
  describe('FullAdder', () => {
    it('should compute sum and carry correctly for 0+0+0', () => {
      const circuit: Circuit = {
        nodes: [
          { id: 'adder', type: 'FullAdder', position: { x: 0, y: 0 }, rotation: 0, config: {} },
        ],
        connections: [],
      };

      const engine = new CircuitEngine(circuit);
      engine.setNodeState('adder', {});
      engine.stabilize();

      const signals = engine.getAllSignals();
      expect(signals.get('adder.Sum')).toBe(0);
      expect(signals.get('adder.Cout')).toBe(0);
    });

    it('should compute sum and carry correctly for 1+1+0', () => {
      const circuit: Circuit = {
        nodes: [
          { id: 'a', type: 'PowerSource', position: { x: 0, y: 0 }, rotation: 0, config: {} },
          { id: 'b', type: 'PowerSource', position: { x: 0, y: 1 }, rotation: 0, config: {} },
          { id: 'adder', type: 'FullAdder', position: { x: 2, y: 0 }, rotation: 0, config: {} },
        ],
        connections: [
          { from: { nodeId: 'a', portName: 'out' }, to: { nodeId: 'adder', portName: 'A' } },
          { from: { nodeId: 'b', portName: 'out' }, to: { nodeId: 'adder', portName: 'B' } },
        ],
      };

      const engine = new CircuitEngine(circuit);
      engine.stabilize();

      const signals = engine.getAllSignals();
      // 1 + 1 + 0 = 10 in binary (Sum=0, Carry=1)
      expect(signals.get('adder.Sum')).toBe(0);
      expect(signals.get('adder.Cout')).toBe(1);
    });

    it('should compute sum and carry correctly for 1+1+1', () => {
      const circuit: Circuit = {
        nodes: [
          { id: 'a', type: 'PowerSource', position: { x: 0, y: 0 }, rotation: 0, config: {} },
          { id: 'b', type: 'PowerSource', position: { x: 0, y: 1 }, rotation: 0, config: {} },
          { id: 'cin', type: 'PowerSource', position: { x: 0, y: 2 }, rotation: 0, config: {} },
          { id: 'adder', type: 'FullAdder', position: { x: 2, y: 0 }, rotation: 0, config: {} },
        ],
        connections: [
          { from: { nodeId: 'a', portName: 'out' }, to: { nodeId: 'adder', portName: 'A' } },
          { from: { nodeId: 'b', portName: 'out' }, to: { nodeId: 'adder', portName: 'B' } },
          { from: { nodeId: 'cin', portName: 'out' }, to: { nodeId: 'adder', portName: 'Cin' } },
        ],
      };

      const engine = new CircuitEngine(circuit);
      engine.stabilize();

      const signals = engine.getAllSignals();
      // 1 + 1 + 1 = 11 in binary (Sum=1, Carry=1)
      expect(signals.get('adder.Sum')).toBe(1);
      expect(signals.get('adder.Cout')).toBe(1);
    });
  });

  // Note: RS Latch, D/JK Flip-Flops have feedback loops that require special handling
  // Skipping those tests for now - they would need a different evaluation strategy
});
