// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { create } from 'zustand';
import type { Circuit, CircuitEngine, Node, Connection, PortRef } from '@redbyte/rb-logic-core';
import type { TickEngine } from '@redbyte/rb-logic-core';
import { recordAuditTransition } from '../utils/audit';
import { isCEMode } from '../utils/ceMode';
import { digestValue } from '../utils/digest';

// Debug flag for instrumentation (DEV-only)
const DEBUG_PLAYGROUND = import.meta.env.DEV && false; // Set to true to enable debug logs
const NODE_ID_PREFIX = 'node-v2-';
const NODE_ID_RE = /^node-v2-(\d+)$/;

function getNextNodeId(circuit: Circuit): string {
  let max = 0;
  for (const node of circuit.nodes) {
    const match = NODE_ID_RE.exec(node.id);
    if (!match) continue;
    const value = parseInt(match[1], 10);
    if (Number.isFinite(value)) {
      max = Math.max(max, value);
    }
  }
  return `${NODE_ID_PREFIX}${max + 1}`;
}

// Circuit fingerprint for identity checks (prevents no-op updates)
function computeCircuitFingerprint(circuit: Circuit): string {
  // Fast fingerprint: node count + edge count + sorted node/edge metadata
  const nodeData = circuit.nodes
    .map(n => `${n.id}:${n.type}:${n.position?.x ?? n.x ?? 0}:${n.position?.y ?? n.y ?? 0}:${Number.isFinite(n.rotation) ? n.rotation : 0}`)
    .sort()
    .join('|');
  const edgeData = circuit.connections
    .map(c => {
      const fromId = typeof c.from === 'string' ? c.from : c.from?.nodeId ?? '';
      const toId = typeof c.to === 'string' ? c.to : c.to?.nodeId ?? '';
      const fromPort = typeof c.from === 'string' ? (c as any).fromPin ?? (c as any).fromPort : (c.from as any)?.portName ?? (c.from as any)?.port ?? '';
      const toPort = typeof c.to === 'string' ? (c as any).toPin ?? (c as any).toPort : (c.to as any)?.portName ?? (c.to as any)?.port ?? '';
      return `${fromId}:${fromPort}->${toId}:${toPort}`;
    })
    .sort()
    .join('|');
  return digestValue({ nodes: nodeData, edges: edgeData });
}

// Deep clone circuit to avoid mutation leaks in history
function cloneCircuit(circuit: Circuit): Circuit {
  return structuredClone(circuit);
}

// Simple circuit hash for debugging
function hashCircuit(circuit: Circuit): string {
  return `nodes:${circuit.nodes.length},conns:${circuit.connections.length}`;
}

// Node count limits: strict in Classroom Edition, generous in normal mode
const CE_HARD_LIMIT = 20;
const NORMAL_HARD_LIMIT = 500;
const HARD_LIMIT = isCEMode() ? CE_HARD_LIMIT : NORMAL_HARD_LIMIT;

function getConnectionNodeId(ref: PortRef | string): string {
  return typeof ref === 'string' ? ref : ref.nodeId;
}

function getConnectionPort(conn: Connection, side: 'from' | 'to', fallback: string): string {
  const ref = conn[side];
  if (typeof ref === 'string') {
    return side === 'from'
      ? conn.fromPin ?? conn.fromPort ?? fallback
      : conn.toPin ?? conn.toPort ?? fallback;
  }

  return ref.portName ?? ref.port ?? fallback;
}

// Clamp circuit to classroom-safe limits
function clampCircuit(circuit: Circuit, limit: number): { circuit: Circuit; clamped: boolean; dropped: number } {
  if (circuit.nodes.length <= limit) {
    return { circuit, clamped: false, dropped: 0 };
  }

  // Keep first N nodes (deterministic ordering)
  const keptNodes = circuit.nodes.slice(0, limit);
  const keptIds = new Set(keptNodes.map(n => n.id));

  // Keep only connections between kept nodes
  const keptConnections = circuit.connections.filter(c =>
    keptIds.has(getConnectionNodeId(c.from)) && keptIds.has(getConnectionNodeId(c.to))
  );

  return {
    circuit: { nodes: keptNodes, connections: keptConnections },
    clamped: true,
    dropped: circuit.nodes.length - limit,
  };
}

interface CircuitState {
  // Current circuit state
  circuit: Circuit;
  engine: CircuitEngine | null;
  tickEngine: TickEngine | null;
  isDirty: boolean;

  // Classroom guardrail events
  lastClampEvent: { originalNodes: number; keptNodes: number; source: string; timestamp: number } | null;
  clearClampEvent: () => void;

  // History management (PR2.3)
  past: Circuit[];
  future: Circuit[];
  maxHistory: number;

  // Engine management
  setEngine: (engine: CircuitEngine) => void;
  setTickEngine: (tickEngine: TickEngine) => void;

  // Circuit mutations (all stable, no closures)
  updateCircuit: (circuit: Circuit, opts?: { skipHistory?: boolean; enforceLimits?: boolean }) => void;
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

// Lazy-init singleton to prevent TDZ crash from circular imports
let _store: ReturnType<typeof createCircuitStore> | null = null;

function createCircuitStore() {
  return create<CircuitState>((set, get) => ({
    circuit: { nodes: [], connections: [] },
    engine: null,
    tickEngine: null,
    isDirty: false,

    // Classroom guardrail state
    lastClampEvent: null,
    clearClampEvent: () => set({ lastClampEvent: null }),

    // History state
    past: [],
    future: [],
    maxHistory: 100,

    setEngine: (engine) => {
      // Immediately sync the current circuit to the new engine so signals
      // are never stale when the engine is first registered.
      const { circuit } = get();
      if (circuit.nodes.length > 0) {
        engine.setCircuit(circuit);
      }
      set({ engine });
    },
    setTickEngine: (tickEngine) => {
      const { circuit } = get();
      if (circuit.nodes.length > 0) {
        tickEngine.setCircuit(circuit);
      }
      set({ tickEngine });
    },
    setDirty: (dirty) => set({ isDirty: dirty }),

    updateCircuit: (incoming, opts = {}) => {
      // Recursion guard: prevent infinite loops from Zustand subscribers
      // Use ref on store instance to avoid triggering subscribers
      const storeRef = _store as any;
      if (storeRef && storeRef._updateInProgress) {
        console.warn('[CircuitStore] Prevented recursive updateCircuit call');
        return;
      }

      if (storeRef) storeRef._updateInProgress = true;
      try {
        const { skipHistory = false, enforceLimits = true } = opts;
        const { engine, tickEngine, circuit: currentCircuit } = get();

      // Fingerprint no-op: if circuit is functionally identical, skip all work
      const incomingFp = computeCircuitFingerprint(incoming);
      const currentFp = computeCircuitFingerprint(currentCircuit);
      if (incomingFp === currentFp && !enforceLimits) {
        // Circuit is identical; no update needed
        if (DEBUG_PLAYGROUND) {
          console.log('[CircuitStore] Skipped no-op update (fingerprints match)');
        }
        return;
      }

      // CHOKE POINT: normalize and clamp incoming circuit BEFORE anything else
      let circuit = {
        ...incoming,
        nodes: incoming.nodes.map((node) => ({
          ...node,
          rotation: Number.isFinite(node.rotation) ? node.rotation : 0,
        })),
      };
      let clampEvent: CircuitState['lastClampEvent'] = null;

      if (enforceLimits) {
        const res = clampCircuit(incoming, HARD_LIMIT);
        circuit = res.circuit;

        if (res.clamped) {
          const source = skipHistory ? 'load/restore' : 'edit/paste';
          console.warn(`[CircuitStore] Circuit clamped: ${incoming.nodes.length} → ${circuit.nodes.length} nodes (dropped ${res.dropped}, source: ${source})`);

          clampEvent = {
            originalNodes: incoming.nodes.length,
            keptNodes: circuit.nodes.length,
            source,
            timestamp: Date.now(),
          };
        }
      }

      // Debug instrumentation
      if (DEBUG_PLAYGROUND) {
        console.log('[CircuitStore] updateCircuit called', {
          skipHistory,
          enforceLimits,
          before: hashCircuit(currentCircuit),
          after: hashCircuit(circuit),
          historyAdded: !skipHistory,
        });
      }

      // Dev-mode invariant: warn if engines not connected when mutating circuit
      if (import.meta.env.DEV) {
        const isTestEnv = (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') ||
          // Vite/Vitest expose this during unit tests
          !!import.meta.env.VITEST ||
          import.meta.env.MODE === 'test';
        if (!engine || !tickEngine) {
          if (!isTestEnv) {
            console.warn(
              '[CircuitStore] Circuit mutation called but engines not connected!\n' +
              `  - engine: ${engine ? '✓' : '✗ MISSING'}\n` +
              `  - tickEngine: ${tickEngine ? '✓' : '✗ MISSING'}\n` +
              'Circuit mutations will not propagate to simulation. ' +
              'Call setEngine() and setTickEngine() during app initialization.'
            );
          }
        }
      }

      // Add current circuit to history BEFORE updating (if not skipped)
      if (!skipHistory) {
        const { past, maxHistory } = get();
        const newPast = [...past, cloneCircuit(currentCircuit)].slice(-maxHistory);
        set({ past: newPast, future: [] }); // Clear future on new commit

        if (DEBUG_PLAYGROUND) {
          console.log('[CircuitStore] History entry added', { pastLength: newPast.length });
        }
      }

      // Update state
      set({
        circuit,
        isDirty: true,
        lastClampEvent: clampEvent, // Set clamp event if clamping occurred
      });

      recordAuditTransition({
        scope: 'circuit_store',
        action: skipHistory ? 'restore' : 'update',
        before: currentCircuit,
        after: circuit,
      });

      // Sync engines — setCircuit now propagates initial signals via tick()
      if (engine) {
        engine.setCircuit(circuit);
      }
      if (tickEngine) {
        tickEngine.setCircuit(circuit);
      }

      // Update complexity tracking for classroom guardrails ONLY if circuit fingerprint changed
      // (must happen after state update so new circuit is in place)
      const finalFp = computeCircuitFingerprint(circuit);
      if (finalFp !== currentFp) {
        try {
          const nodeCount = circuit.nodes.length;
          const edgeCount = circuit.connections.length;

        // Calculate max fan-out
        const fanOutCounts = new Map<string, number>();
        circuit.connections.forEach((conn) => {
          const key = `${getConnectionNodeId(conn.from)}:${getConnectionPort(conn, 'from', 'out')}`;
          fanOutCounts.set(key, (fanOutCounts.get(key) || 0) + 1);
        });
        const maxFanOut = fanOutCounts.size > 0 ? Math.max(...fanOutCounts.values()) : 0;

        // Notify classroom mode store (dynamic import to avoid circular dependency)
        if (typeof window !== 'undefined' && (window as any).__RB_CLASSROOM_MODE_STORE__) {
          const classroomStore = (window as any).__RB_CLASSROOM_MODE_STORE__;
          classroomStore.getState().setComplexity(nodeCount, edgeCount, maxFanOut);
        }
        } catch (err) {
          // Fail silently - complexity tracking is non-critical
          if (DEBUG_PLAYGROUND) console.warn('[CircuitStore] Complexity tracking failed:', err);
        }
      }

      if (DEBUG_PLAYGROUND) {
        console.log('[CircuitStore] Engines synced with new circuit');
      }
      } finally {
        const storeRef = _store as any;
        if (storeRef) storeRef._updateInProgress = false;
      }
    },

    commit: (circuit) => {
      // Explicit commit - always adds to history, enforces limits
      get().updateCircuit(circuit, { skipHistory: false, enforceLimits: true });
    },

    undo: () => {
      const { past, circuit, future } = get();
      if (past.length === 0) return;

      const previous = past[past.length - 1];
      const newPast = past.slice(0, -1);
      const newFuture = [cloneCircuit(circuit), ...future];

      set({ past: newPast, future: newFuture });
      get().updateCircuit(previous, { skipHistory: true, enforceLimits: false }); // Lossless history restore
    },

    redo: () => {
      const { future, circuit, past, maxHistory } = get();
      if (future.length === 0) return;

      const next = future[0];
      const newFuture = future.slice(1);
      const newPast = [...past, cloneCircuit(circuit)].slice(-maxHistory);

      set({ past: newPast, future: newFuture });
      get().updateCircuit(next, { skipHistory: true, enforceLimits: false }); // Lossless history restore
    },

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,

    addNode: (nodeType, position) => {
      console.log(`[CircuitStore.addNode] Called with type=${nodeType}, pos=${JSON.stringify(position)}`);
      const { circuit } = get();

      // Guardrail: block at node limit (CE: 20, normal: 500)
      if (circuit.nodes.length >= HARD_LIMIT) {
        console.warn(`[CircuitStore] Node creation blocked: limit reached (${circuit.nodes.length}/${HARD_LIMIT})`);
        return;
      }

      // Dev-mode invariant: validate node type is registered
      if (import.meta.env.DEV) {
        const validTypes = [
          'PowerSource', 'Switch', 'INPUT', 'Lamp', 'OUTPUT', 'Wire',
          'AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR',
          'Clock', 'Delay',
          'VoltageSource', 'LDR', 'FixedResistor', 'VoltageDivider', 'LM358',
          'RSLatch', 'DFlipFlop', 'JKFlipFlop', 'FullAdder', 'Counter4Bit',
        ];
        if (!validTypes.includes(nodeType)) {
          console.error(
            `[CircuitStore] Attempted to add unregistered node type: "${nodeType}"\n` +
            `Valid types: ${validTypes.join(', ')}`
          );
        }
      }

      const defaultConfig = nodeType === 'Clock' ? { period: 10 } : {};
      const newNode: Node = {
        id: getNextNodeId(circuit),
        type: nodeType,
        position,
        rotation: 0,
        state: {},
        config: defaultConfig,
      };
      console.log(`[CircuitStore.addNode] Creating new node:`, newNode);
      get().commit({
        ...circuit,
        nodes: [...circuit.nodes, newNode],
      });
      console.log(`[CircuitStore.addNode] Commit called, circuit now has ${circuit.nodes.length + 1} nodes`);
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
}

/**
 * Circuit store for managing circuit state and simulation.
 * Lazy-initialized to prevent TDZ crash from circular imports.
 */
export const useCircuitStore: ReturnType<typeof createCircuitStore> = ((...args: any[]) => {
  if (!_store) _store = createCircuitStore();
  return (_store as any)(...args);
}) as any;

(useCircuitStore as any).getState = () => {
  if (!_store) _store = createCircuitStore();
  return (_store as any).getState();
};

(useCircuitStore as any).setState = (...a: any[]) => {
  if (!_store) _store = createCircuitStore();
  return (_store as any).setState(...a);
};

(useCircuitStore as any).subscribe = (...a: any[]) => {
  if (!_store) _store = createCircuitStore();
  return (_store as any).subscribe(...a);
};

// E2E test hook: expose store for programmatic access (always, safe for E2E testing)
// Uses lazy-init wrapper so store is created on first access
if (typeof window !== 'undefined') {
  (window as any).__RB_CIRCUIT_STORE__ = useCircuitStore;
}
