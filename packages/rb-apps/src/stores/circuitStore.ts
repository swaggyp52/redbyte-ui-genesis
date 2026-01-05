// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { create } from 'zustand';
import type { Circuit, CircuitEngine, Node, Connection, PortRef } from '@redbyte/rb-logic-core';
import type { TickEngine } from '@redbyte/rb-logic-core';

// Deep clone circuit to avoid mutation leaks in history
function cloneCircuit(circuit: Circuit): Circuit {
  return structuredClone(circuit);
}

interface CircuitState {
  // Current circuit state
  circuit: Circuit;
  engine: CircuitEngine | null;
  tickEngine: TickEngine | null;
  isDirty: boolean;

  // History management (PR2.3)
  past: Circuit[];
  future: Circuit[];
  maxHistory: number;

  // Engine management
  setEngine: (engine: CircuitEngine) => void;
  setTickEngine: (tickEngine: TickEngine) => void;

  // Circuit mutations (all stable, no closures)
  updateCircuit: (circuit: Circuit, skipHistory?: boolean) => void;
  commit: (circuit: Circuit) => void; // Explicit commit with history
  addNode: (nodeType: string, position: { x: number; y: number }) => void;
  updateNode: (nodeId: string, updates: Partial<Node>) => void;
  deleteNode: (nodeId: string) => void;
  addConnection: (from: PortRef, to: PortRef) => void;
  deleteConnection: (fromNodeId: string, fromPort: string, toNodeId: string, toPort: string) => void;

  // Undo/Redo (PR2.3)
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // State management
  setDirty: (dirty: boolean) => void;
  reset: () => void;
}

export const useCircuitStore = create<CircuitState>((set, get) => ({
  circuit: { nodes: [], connections: [] },
  engine: null,
  tickEngine: null,
  isDirty: false,

  // History state
  past: [],
  future: [],
  maxHistory: 100,

  setEngine: (engine) => set({ engine }),
  setTickEngine: (tickEngine) => set({ tickEngine }),
  setDirty: (dirty) => set({ isDirty: dirty }),

  updateCircuit: (circuit, skipHistory = false) => {
    const { engine, tickEngine, circuit: currentCircuit } = get();

    // Dev-mode invariant: warn if engines not connected when mutating circuit
    if (import.meta.env.DEV) {
      if (!engine || !tickEngine) {
        console.warn(
          '[CircuitStore] Circuit mutation called but engines not connected!\n' +
          `  - engine: ${engine ? '✓' : '✗ MISSING'}\n` +
          `  - tickEngine: ${tickEngine ? '✓' : '✗ MISSING'}\n` +
          'Circuit mutations will not propagate to simulation. ' +
          'Call setEngine() and setTickEngine() during app initialization.'
        );
      }
    }

    // Add current circuit to history BEFORE updating (if not skipped)
    if (!skipHistory) {
      const { past, maxHistory } = get();
      const newPast = [...past, cloneCircuit(currentCircuit)].slice(-maxHistory);
      set({ past: newPast, future: [] }); // Clear future on new commit
    }

    // Update state
    set({ circuit, isDirty: true });

    // Sync engines
    engine?.setCircuit(circuit);
    tickEngine?.setCircuit(circuit);
  },

  commit: (circuit) => {
    // Explicit commit - always adds to history
    get().updateCircuit(circuit, false);
  },

  undo: () => {
    const { past, circuit, future } = get();
    if (past.length === 0) return;

    const previous = past[past.length - 1];
    const newPast = past.slice(0, -1);
    const newFuture = [cloneCircuit(circuit), ...future];

    set({ past: newPast, future: newFuture });
    get().updateCircuit(previous, true); // Skip history to avoid double-add
  },

  redo: () => {
    const { future, circuit, past, maxHistory } = get();
    if (future.length === 0) return;

    const next = future[0];
    const newFuture = future.slice(1);
    const newPast = [...past, cloneCircuit(circuit)].slice(-maxHistory);

    set({ past: newPast, future: newFuture });
    get().updateCircuit(next, true); // Skip history to avoid double-add
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  addNode: (nodeType, position) => {
    // Dev-mode invariant: validate node type is registered
    if (import.meta.env.DEV) {
      const validTypes = [
        'PowerSource', 'Switch', 'INPUT', 'Lamp', 'OUTPUT', 'Wire',
        'AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR',
        'Clock', 'Delay',
        'RSLatch', 'DFlipFlop', 'JKFlipFlop', 'FullAdder', 'Counter4Bit',
      ];
      if (!validTypes.includes(nodeType)) {
        console.error(
          `[CircuitStore] Attempted to add unregistered node type: "${nodeType}"\n` +
          `Valid types: ${validTypes.join(', ')}`
        );
      }
    }

    const { circuit } = get();
    const newNode: Node = {
      id: `node_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type: nodeType,
      position,
      state: {},
    };
    get().commit({
      ...circuit,
      nodes: [...circuit.nodes, newNode],
    });
  },

  updateNode: (nodeId, updates) => {
    const { circuit } = get();
    get().commit({
      ...circuit,
      nodes: circuit.nodes.map((n) => (n.id === nodeId ? { ...n, ...updates } : n)),
    });
  },

  deleteNode: (nodeId) => {
    const { circuit } = get();
    get().commit({
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
    get().commit({
      ...circuit,
      connections: [...circuit.connections, newConnection],
    });
  },

  deleteConnection: (fromNodeId, fromPort, toNodeId, toPort) => {
    const { circuit } = get();
    get().commit({
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
      past: [],
      future: [],
      isDirty: false,
    }),
}));
