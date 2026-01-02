// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { create } from 'zustand';
import type { Circuit, CircuitEngine, Node, Connection, PortRef } from '@redbyte/rb-logic-core';
import type { TickEngine } from '@redbyte/rb-logic-core';

interface CircuitState {
  circuit: Circuit;
  engine: CircuitEngine | null;
  tickEngine: TickEngine | null;
  isDirty: boolean;

  // Engine management
  setEngine: (engine: CircuitEngine) => void;
  setTickEngine: (tickEngine: TickEngine) => void;

  // Circuit mutations (all stable, no closures)
  updateCircuit: (circuit: Circuit) => void;
  addNode: (nodeType: string, position: { x: number; y: number }) => void;
  updateNode: (nodeId: string, updates: Partial<Node>) => void;
  deleteNode: (nodeId: string) => void;
  addConnection: (from: PortRef, to: PortRef) => void;
  deleteConnection: (fromNodeId: string, fromPort: string, toNodeId: string, toPort: string) => void;

  // State management
  setDirty: (dirty: boolean) => void;
  reset: () => void;
}

export const useCircuitStore = create<CircuitState>((set, get) => ({
  circuit: { nodes: [], connections: [] },
  engine: null,
  tickEngine: null,
  isDirty: false,

  setEngine: (engine) => set({ engine }),
  setTickEngine: (tickEngine) => set({ tickEngine }),
  setDirty: (dirty) => set({ isDirty: dirty }),

  updateCircuit: (circuit) => {
    const { engine, tickEngine } = get();
    set({ circuit, isDirty: true });
    engine?.setCircuit(circuit);
    tickEngine?.setCircuit(circuit);
  },

  addNode: (nodeType, position) => {
    const { circuit } = get();
    const newNode: Node = {
      id: `node_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type: nodeType,
      position,
      state: {},
    };
    get().updateCircuit({
      ...circuit,
      nodes: [...circuit.nodes, newNode],
    });
  },

  updateNode: (nodeId, updates) => {
    const { circuit } = get();
    get().updateCircuit({
      ...circuit,
      nodes: circuit.nodes.map((n) => (n.id === nodeId ? { ...n, ...updates } : n)),
    });
  },

  deleteNode: (nodeId) => {
    const { circuit } = get();
    get().updateCircuit({
      ...circuit,
      nodes: circuit.nodes.filter((n) => n.id !== nodeId),
      connections: circuit.connections.filter(
        (c) => c.from.nodeId !== nodeId && c.to.nodeId !== nodeId
      ),
    });
  },

  addConnection: (from, to) => {
    const { circuit } = get();
    const newConnection: Connection = { from, to };
    get().updateCircuit({
      ...circuit,
      connections: [...circuit.connections, newConnection],
    });
  },

  deleteConnection: (fromNodeId, fromPort, toNodeId, toPort) => {
    const { circuit } = get();
    get().updateCircuit({
      ...circuit,
      connections: circuit.connections.filter(
        (c) =>
          !(
            c.from.nodeId === fromNodeId &&
            c.from.portName === fromPort &&
            c.to.nodeId === toNodeId &&
            c.to.portName === toPort
          )
      ),
    });
  },

  reset: () =>
    set({
      circuit: { nodes: [], connections: [] },
      isDirty: false,
    }),
}));
