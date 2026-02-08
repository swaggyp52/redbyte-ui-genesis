import { describe, it, expect } from 'vitest';
import { Circuit, CircuitV1, toCircuitV1, fromCircuitV1 } from '@redbyte/rb-logic-core';

/**
 * Round-trip test for Circuit <-> CircuitV1 conversion
 * 
 * This test verifies RC-P2 fix: node positions must survive serialization.
 * Previously, converters read node.x (legacy undefined field) instead of
 * node.position.x, causing all positions to collapse to (0,0) on save/export.
 */

describe('CircuitV1 round-trip', () => {
  it('preserves node positions through toCircuitV1 -> fromCircuitV1', () => {
    const circuit: Circuit = {
      nodes: [
        { 
          id: 'n1', 
          type: 'AND', 
          position: { x: 100, y: 200 }, 
          config: {},
          inputs: {},
          outputs: {},
        },
        { 
          id: 'n2', 
          type: 'Lamp', 
          position: { x: 300, y: 400 }, 
          config: {},
          inputs: {},
          outputs: {},
        },
      ],
      connections: [],
    };

    // Convert to V1 and back
    const v1 = toCircuitV1(circuit);
    const restored = fromCircuitV1(v1);

    // Positions must be preserved
    expect(restored.nodes[0].position).toEqual({ x: 100, y: 200 });
    expect(restored.nodes[1].position).toEqual({ x: 300, y: 400 });
  });

  it('handles nodes with only legacy x/y fields (no position)', () => {
    const circuit: Circuit = {
      nodes: [
        { 
          id: 'n1', 
          type: 'AND', 
          x: 50,      // legacy field only
          y: 75,      // legacy field only
          config: {},
          inputs: {},
          outputs: {},
        },
      ],
      connections: [],
    };

    const v1 = toCircuitV1(circuit);
    expect(v1.nodes[0].x).toBe(50);
    expect(v1.nodes[0].y).toBe(75);

    const restored = fromCircuitV1(v1);
    expect(restored.nodes[0].position).toEqual({ x: 50, y: 75 });
  });

  it('handles empty circuits', () => {
    const circuit: Circuit = { nodes: [], connections: [] };
    const v1 = toCircuitV1(circuit);
    const restored = fromCircuitV1(v1);
    
    expect(restored.nodes).toHaveLength(0);
    expect(restored.connections).toHaveLength(0);
  });
});
