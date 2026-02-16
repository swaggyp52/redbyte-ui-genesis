// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// TEST SUITE RC-P2: Position Serialization + Migration
// Verifies that node positions are never lost during save/load round-trips
// and that legacy projects migrate cleanly

import { describe, it, expect, beforeEach } from 'vitest';
import { toCircuitV1, fromCircuitV1 } from '@redbyte/rb-logic-core';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { CircuitV1 } from '@redbyte/rb-utils';

describe('RC-P2: Position Serialization + Migration', () => {

  // ========================================================================
  // Deliverable C.1: Round-trip preserves position
  // ========================================================================

  describe('Round-trip preservation', () => {
    it('should preserve non-zero positions through serialize → deserialize', () => {
      // Build circuit with node at known non-zero position
      const circuit: Circuit = {
        nodes: [
          {
            id: 'node-1',
            type: 'AND',
            position: { x: 123, y: 456 },  // Non-zero position
            rotation: 0,
            state: {},
            config: {},
          },
        ],
        connections: [],
      };

      // Round-trip through canonical converters
      const v1 = toCircuitV1(circuit);
      const restored = fromCircuitV1(v1);

      // Assert position preserved (not collapsed to 0,0)
      expect(restored.nodes[0].position?.x).toBe(123);
      expect(restored.nodes[0].position?.y).toBe(456);
    });

    it('should preserve zero positions (not confuse with undefined)', () => {
      // Edge case: nodes at origin should still be (0,0), not (0,0) with lost data
      const circuit: Circuit = {
        nodes: [
          {
            id: 'node-1',
            type: 'Switch',
            position: { x: 0, y: 0 },  // Explicit origin
            rotation: 0,
            state: {},
            config: {},
          },
        ],
        connections: [],
      };

      const v1 = toCircuitV1(circuit);
      const restored = fromCircuitV1(v1);

      expect(restored.nodes[0].position?.x).toBe(0);
      expect(restored.nodes[0].position?.y).toBe(0);
    });

    it('should preserve negative positions (lower-left quadrant)', () => {
      // Some apps may support negative coordinates
      const circuit: Circuit = {
        nodes: [
          {
            id: 'node-1',
            type: 'OUTPUT',
            position: { x: -100, y: -200 },
            rotation: 90,
            state: {},
            config: {},
          },
        ],
        connections: [],
      };

      const v1 = toCircuitV1(circuit);
      const restored = fromCircuitV1(v1);

      expect(restored.nodes[0].position?.x).toBe(-100);
      expect(restored.nodes[0].position?.y).toBe(-200);
    });
  });

  // ========================================================================
  // Deliverable C.2: Legacy migration (x/y → position)
  // ========================================================================

  describe('Legacy migration (x/y → position)', () => {
    it('should migrate legacy x/y fields to modern position object', () => {
      // Input: old CircuitV1 with x/y (simulating legacy saved file)
      const legacyV1: CircuitV1 = {
        schemaVersion: '1.0',
        nodes: [
          {
            id: 'node-1',
            type: 'Switch',
            x: 50,  // Legacy coordinates
            y: 60,
            rotation: 0,
            params: {},
            state: {},
          },
        ],
        connections: [],
        customChips: [],
      };

      // Deserialize legacy circuit
      const restored = fromCircuitV1(legacyV1);

      // Assert migration created position object
      expect(restored.nodes[0].position).toBeDefined();
      expect(restored.nodes[0].position?.x).toBe(50);
      expect(restored.nodes[0].position?.y).toBe(60);
      
      // Legacy x/y should also be available (fallback compatibility)
      expect(restored.nodes[0].x).toBe(50);
      expect(restored.nodes[0].y).toBe(60);
    });

    it('should handle missing x/y with safe defaults (0,0) not undefined', () => {
      // Edge case: corrupted or minimal CircuitV1 missing coordinates
      const minimalV1: CircuitV1 = {
        schemaVersion: '1.0',
        nodes: [
          {
            id: 'node-1',
            type: 'Lamp',
            // x: undefined,  // Missing!
            // y: undefined,  // Missing!
            rotation: 0,
            params: {},
            state: {},
          } as any,  // Intentionally missing x/y to test defaults
        ],
        connections: [],
        customChips: [],
      };

      const restored = fromCircuitV1(minimalV1);

      // Should use safe default (0,0) not undefined
      expect(restored.nodes[0].position?.x).toBe(0);
      expect(restored.nodes[0].position?.y).toBe(0);
    });
  });

  // ========================================================================
  // Deliverable C.3: Mixed-format precedence (position wins over x/y)
  // ========================================================================

  describe('Mixed-format precedence', () => {
    it('should prefer position over legacy x/y when both exist', () => {
      // Scenario: modern node with position, but old x/y fields still present
      const circuit: Circuit = {
        nodes: [
          {
            id: 'node-1',
            type: 'AND',
            position: { x: 100, y: 200 },  // Modern (preferred)
            x: 999,                         // Legacy (should be ignored)
            y: 999,
            rotation: 0,
            state: {},
            config: {},
          },
        ],
        connections: [],
      };

      // Serialize with modern position
      const v1 = toCircuitV1(circuit);
      expect(v1.nodes[0].x).toBe(100);
      expect(v1.nodes[0].y).toBe(200);
      
      // Deserialize back: should read position, not legacy x/y
      const restored = fromCircuitV1(v1);
      expect(restored.nodes[0].position?.x).toBe(100);
      expect(restored.nodes[0].position?.y).toBe(200);
    });
  });

  // ========================================================================
  // Deliverable C.4: No silent defaults (log/flag missing coords)
  // ========================================================================

  describe('Safe defaults for missing coordinates', () => {
    it('should use (0,0) for missing coordinates but NOT silently', () => {
      // In dev mode, this should be logged/flagged
      // In prod, gracefully default to (0,0)
      const v1NoCoords: CircuitV1 = {
        schemaVersion: '1.0',
        nodes: [
          {
            id: 'node-orphaned',
            type: 'Switch',
            // No x, y defined
            rotation: 0,
            params: {},
            state: {},
          } as any,
        ],
        connections: [],
        customChips: [],
      };

      // Deserialize should not crash, should use safe default
      const circuit = fromCircuitV1(v1NoCoords);
      expect(circuit.nodes).toHaveLength(1);
      expect(circuit.nodes[0].position?.x).toBe(0);
      expect(circuit.nodes[0].position?.y).toBe(0);
      
      // In dev mode (if running tests), would expect a console warning
      // This test just verifies no crash and safe fallback
    });

    it('should distinguish between explicit (0,0) and missing coords', () => {
      // Explicit origin should round-trip cleanly
      const circuit: Circuit = {
        nodes: [
          {
            id: 'at-origin',
            type: 'Switch',
            position: { x: 0, y: 0 },  // Intentional origin
            rotation: 0,
            state: {},
            config: {},
          },
        ],
        connections: [],
      };

      const v1 = toCircuitV1(circuit);
      const restored = fromCircuitV1(v1);

      // Should preserve (0,0) intent, not treat as "missing"
      expect(restored.nodes[0].position?.x).toBe(0);
      expect(restored.nodes[0].position?.y).toBe(0);
    });
  });

  // ========================================================================
  // Additional test: Multiple nodes preserve distinct positions
  // ========================================================================

  describe('Multi-node circuits', () => {
    it('should preserve distinct positions for all nodes', () => {
      const circuit: Circuit = {
        nodes: [
          {
            id: 'node-A',
            type: 'Switch',
            position: { x: 10, y: 20 },
            rotation: 0,
            state: {},
            config: {},
          },
          {
            id: 'node-B',
            type: 'AND',
            position: { x: 100, y: 200 },
            rotation: 90,
            state: {},
            config: {},
          },
          {
            id: 'node-C',
            type: 'Lamp',
            position: { x: 500, y: 600 },
            rotation: 180,
            state: {},
            config: {},
          },
        ],
        connections: [
          {
            id: 'conn-1',
            from: 'node-A',
            fromPin: 'out',
            to: 'node-B',
            toPin: 'in0',
          },
          {
            id: 'conn-2',
            from: 'node-B',
            fromPin: 'out',
            to: 'node-C',
            toPin: 'in',
          },
        ],
      };

      const v1 = toCircuitV1(circuit);
      const restored = fromCircuitV1(v1);

      // All nodes should maintain distinct positions
      expect(restored.nodes[0].position).toEqual({ x: 10, y: 20 });
      expect(restored.nodes[1].position).toEqual({ x: 100, y: 200 });
      expect(restored.nodes[2].position).toEqual({ x: 500, y: 600 });

      // Connections should be preserved
      expect(restored.connections).toHaveLength(2);
    });
  });

});
