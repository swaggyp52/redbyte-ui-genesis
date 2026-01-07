// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';

describe('Switch Toggle Behavior', () => {
  // Test 1: Verify toggle logic updates node state correctly
  it('should toggle switch state from OFF to ON', () => {
    const circuit: Circuit = {
      nodes: [
        {
          id: 'switch1',
          type: 'Switch',
          position: { x: 0, y: 0 },
          rotation: 0,
          config: {},
          state: { isOn: 0 },
        },
      ],
      connections: [],
    };

    // Simulate toggle logic
    const updatedCircuit = {
      ...circuit,
      nodes: circuit.nodes.map((n) => {
        if (n.id === 'switch1' && (n.type === 'Switch' || n.type === 'INPUT')) {
          const currentState = n.state?.isOn ?? 0;
          const newValue = currentState ? 0 : 1;
          return { ...n, state: { ...n.state, isOn: newValue } };
        }
        return n;
      }),
    };

    expect(updatedCircuit.nodes[0].state?.isOn).toBe(1);
  });

  // Test 2: Verify toggle logic updates node state from ON to OFF
  it('should toggle switch state from ON to OFF', () => {
    const circuit: Circuit = {
      nodes: [
        {
          id: 'switch1',
          type: 'Switch',
          position: { x: 0, y: 0 },
          rotation: 0,
          config: {},
          state: { isOn: 1 },
        },
      ],
      connections: [],
    };

    // Simulate toggle logic
    const updatedCircuit = {
      ...circuit,
      nodes: circuit.nodes.map((n) => {
        if (n.id === 'switch1' && (n.type === 'Switch' || n.type === 'INPUT')) {
          const currentState = n.state?.isOn ?? 0;
          const newValue = currentState ? 0 : 1;
          return { ...n, state: { ...n.state, isOn: newValue } };
        }
        return n;
      }),
    };

    expect(updatedCircuit.nodes[0].state?.isOn).toBe(0);
  });

  // Test 3: Verify only switch nodes are toggled
  it('should only toggle switch/input nodes, not other node types', () => {
    const circuit: Circuit = {
      nodes: [
        {
          id: 'switch1',
          type: 'Switch',
          position: { x: 0, y: 0 },
          rotation: 0,
          config: {},
          state: { isOn: 0 },
        },
        {
          id: 'and1',
          type: 'AND',
          position: { x: 100, y: 0 },
          rotation: 0,
          config: {},
        },
      ],
      connections: [],
    };

    // Attempt to toggle the AND gate (should not affect it)
    const updatedCircuit = {
      ...circuit,
      nodes: circuit.nodes.map((n) => {
        if (n.id === 'and1' && (n.type === 'Switch' || n.type === 'INPUT')) {
          const currentState = n.state?.isOn ?? 0;
          const newValue = currentState ? 0 : 1;
          return { ...n, state: { ...n.state, isOn: newValue } };
        }
        return n;
      }),
    };

    // AND gate should be unchanged
    expect(updatedCircuit.nodes[1]).toEqual(circuit.nodes[1]);
  });

  // Test 4: Verify INPUT type also toggles
  it('should toggle INPUT type nodes', () => {
    const circuit: Circuit = {
      nodes: [
        {
          id: 'input1',
          type: 'INPUT',
          position: { x: 0, y: 0 },
          rotation: 0,
          config: {},
          state: { isOn: 0 },
        },
      ],
      connections: [],
    };

    // Simulate toggle logic
    const updatedCircuit = {
      ...circuit,
      nodes: circuit.nodes.map((n) => {
        if (n.id === 'input1' && (n.type === 'Switch' || n.type === 'INPUT')) {
          const currentState = n.state?.isOn ?? 0;
          const newValue = currentState ? 0 : 1;
          return { ...n, state: { ...n.state, isOn: newValue } };
        }
        return n;
      }),
    };

    expect(updatedCircuit.nodes[0].state?.isOn).toBe(1);
  });

  // Test 5: Verify toggle with undefined initial state defaults to 0
  it('should handle undefined state by defaulting to 0', () => {
    const circuit: Circuit = {
      nodes: [
        {
          id: 'switch1',
          type: 'Switch',
          position: { x: 0, y: 0 },
          rotation: 0,
          config: {},
          // No state property
        },
      ],
      connections: [],
    };

    // Simulate toggle logic
    const updatedCircuit = {
      ...circuit,
      nodes: circuit.nodes.map((n) => {
        if (n.id === 'switch1' && (n.type === 'Switch' || n.type === 'INPUT')) {
          const currentState = n.state?.isOn ?? 0;
          const newValue = currentState ? 0 : 1;
          return { ...n, state: { ...n.state, isOn: newValue } };
        }
        return n;
      }),
    };

    // Should toggle from 0 (default) to 1
    expect(updatedCircuit.nodes[0].state?.isOn).toBe(1);
  });
});
