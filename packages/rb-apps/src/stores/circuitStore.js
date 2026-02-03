// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { create } from 'zustand';
import { recordAuditTransition } from '../utils/audit';
// Debug flag for instrumentation (DEV-only)
const DEBUG_PLAYGROUND = import.meta.env.DEV && false; // Set to true to enable debug logs
const NODE_ID_PREFIX = 'node-v2-';
const NODE_ID_RE = /^node-v2-(\d+)$/;
function getNextNodeId(circuit) {
    let max = 0;
    for (const node of circuit.nodes) {
        const match = NODE_ID_RE.exec(node.id);
        if (!match)
            continue;
        const value = parseInt(match[1], 10);
        if (Number.isFinite(value)) {
            max = Math.max(max, value);
        }
    }
    return `${NODE_ID_PREFIX}${max + 1}`;
}
// Deep clone circuit to avoid mutation leaks in history
function cloneCircuit(circuit) {
    return structuredClone(circuit);
}
// Simple circuit hash for debugging
function hashCircuit(circuit) {
    return `nodes:${circuit.nodes.length},conns:${circuit.connections.length}`;
}
// Classroom guardrail: hard limit for node count
const HARD_LIMIT = 20;
// Clamp circuit to classroom-safe limits
function clampCircuit(circuit, limit) {
    if (circuit.nodes.length <= limit) {
        return { circuit, clamped: false, dropped: 0 };
    }
    // Keep first N nodes (deterministic ordering)
    const keptNodes = circuit.nodes.slice(0, limit);
    const keptIds = new Set(keptNodes.map(n => n.id));
    // Keep only connections between kept nodes
    const keptConnections = circuit.connections.filter(c => keptIds.has(c.from.nodeId) && keptIds.has(c.to.nodeId));
    return {
        circuit: { nodes: keptNodes, connections: keptConnections },
        clamped: true,
        dropped: circuit.nodes.length - limit,
    };
}
// Lazy-init singleton to prevent TDZ crash from circular imports
let _store = null;
function createCircuitStore() {
    return create((set, get) => ({
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
        setEngine: (engine) => set({ engine }),
        setTickEngine: (tickEngine) => set({ tickEngine }),
        setDirty: (dirty) => set({ isDirty: dirty }),
        updateCircuit: (incoming, opts = {}) => {
            const { skipHistory = false, enforceLimits = true } = opts;
            const { engine, tickEngine, circuit: currentCircuit } = get();
            // CHOKE POINT: Classroom guardrail - clamp incoming circuit BEFORE anything else
            let circuit = incoming;
            let clampEvent = null;
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
                if (!engine || !tickEngine) {
                    console.warn('[CircuitStore] Circuit mutation called but engines not connected!\n' +
                        `  - engine: ${engine ? '✓' : '✗ MISSING'}\n` +
                        `  - tickEngine: ${tickEngine ? '✓' : '✗ MISSING'}\n` +
                        'Circuit mutations will not propagate to simulation. ' +
                        'Call setEngine() and setTickEngine() during app initialization.');
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
            // Sync engines
            engine?.setCircuit(circuit);
            tickEngine?.setCircuit(circuit);
            // Update complexity tracking for classroom guardrails
            // (must happen after state update so new circuit is in place)
            try {
                const nodeCount = circuit.nodes.length;
                const edgeCount = circuit.connections.length;
                // Calculate max fan-out
                const fanOutCounts = new Map();
                circuit.connections.forEach((conn) => {
                    const key = `${conn.from.nodeId}:${conn.from.port}`;
                    fanOutCounts.set(key, (fanOutCounts.get(key) || 0) + 1);
                });
                const maxFanOut = fanOutCounts.size > 0 ? Math.max(...fanOutCounts.values()) : 0;
                // Notify classroom mode store (dynamic import to avoid circular dependency)
                if (typeof window !== 'undefined' && window.__RB_CLASSROOM_MODE_STORE__) {
                    const classroomStore = window.__RB_CLASSROOM_MODE_STORE__;
                    classroomStore.getState().setComplexity(nodeCount, edgeCount, maxFanOut);
                }
            }
            catch (err) {
                // Fail silently - complexity tracking is non-critical
                if (DEBUG_PLAYGROUND)
                    console.warn('[CircuitStore] Complexity tracking failed:', err);
            }
            if (DEBUG_PLAYGROUND) {
                console.log('[CircuitStore] Engines synced with new circuit');
            }
        },
        commit: (circuit) => {
            // Explicit commit - always adds to history, enforces limits
            get().updateCircuit(circuit, { skipHistory: false, enforceLimits: true });
        },
        undo: () => {
            const { past, circuit, future } = get();
            if (past.length === 0)
                return;
            const previous = past[past.length - 1];
            const newPast = past.slice(0, -1);
            const newFuture = [cloneCircuit(circuit), ...future];
            set({ past: newPast, future: newFuture });
            get().updateCircuit(previous, { skipHistory: true, enforceLimits: false }); // Lossless history restore
        },
        redo: () => {
            const { future, circuit, past, maxHistory } = get();
            if (future.length === 0)
                return;
            const next = future[0];
            const newFuture = future.slice(1);
            const newPast = [...past, cloneCircuit(circuit)].slice(-maxHistory);
            set({ past: newPast, future: newFuture });
            get().updateCircuit(next, { skipHistory: true, enforceLimits: false }); // Lossless history restore
        },
        canUndo: () => get().past.length > 0,
        canRedo: () => get().future.length > 0,
        addNode: (nodeType, position) => {
            const { circuit } = get();
            // CLASSROOM GUARDRAIL: Hard block at 20 nodes (cannot create #21)
            if (circuit.nodes.length >= HARD_LIMIT) {
                console.warn(`[CircuitStore] Node creation blocked: limit reached (${circuit.nodes.length}/${HARD_LIMIT})`);
                return; // Silent return; UI will show banner
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
                    console.error(`[CircuitStore] Attempted to add unregistered node type: "${nodeType}"\n` +
                        `Valid types: ${validTypes.join(', ')}`);
                }
            }
            const defaultConfig = nodeType === 'Clock' ? { period: 10 } : {};
            const newNode = {
                id: getNextNodeId(circuit),
                type: nodeType,
                position,
                state: {},
                config: defaultConfig,
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
                connections: circuit.connections.filter((c) => c.from.nodeId !== nodeId && c.to.nodeId !== nodeId),
            });
        },
        addConnection: (from, to) => {
            const { circuit } = get();
            const newConnection = { from, to };
            get().commit({
                ...circuit,
                connections: [...circuit.connections, newConnection],
            });
        },
        deleteConnection: (fromNodeId, fromPort, toNodeId, toPort) => {
            const { circuit } = get();
            get().commit({
                ...circuit,
                connections: circuit.connections.filter((c) => !(c.from.nodeId === fromNodeId &&
                    c.from.portName === fromPort &&
                    c.to.nodeId === toNodeId &&
                    c.to.portName === toPort)),
            });
        },
        reset: () => set({
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
export const useCircuitStore = ((...args) => {
    if (!_store)
        _store = createCircuitStore();
    return _store(...args);
});
useCircuitStore.getState = () => {
    if (!_store)
        _store = createCircuitStore();
    return _store.getState();
};
useCircuitStore.setState = (...a) => {
    if (!_store)
        _store = createCircuitStore();
    return _store.setState(...a);
};
useCircuitStore.subscribe = (...a) => {
    if (!_store)
        _store = createCircuitStore();
    return _store.subscribe(...a);
};
// E2E test hook: expose store for programmatic access (always, safe for E2E testing)
// Uses lazy-init wrapper so store is created on first access
if (typeof window !== 'undefined') {
    window.__RB_CIRCUIT_STORE__ = useCircuitStore;
}
