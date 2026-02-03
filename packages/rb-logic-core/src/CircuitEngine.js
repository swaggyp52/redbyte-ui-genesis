// Copyright Ac 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { NodeRegistry } from './NodeRegistry';
/**
 * Circuit evaluation engine
 * Handles signal propagation through the circuit graph
 */
export class CircuitEngine {
    circuit;
    nodeStates;
    signalCache;
    debug;
    constructor(circuit, options = {}) {
        this.debug = options.debug ?? false;
        this.circuit = { nodes: [], connections: [] };
        this.nodeStates = new Map();
        this.signalCache = new Map();
        this.setCircuit(circuit);
    }
    /**
     * Toggle debug logging
     */
    setDebug(enabled) {
        this.debug = enabled;
    }
    /**
     * Get current circuit
     */
    getCircuit() {
        return this.circuit;
    }
    /**
     * Update circuit and reset cached state/signals
     */
    setCircuit(circuit) {
        const safeCircuit = {
            nodes: Array.isArray(circuit.nodes) ? circuit.nodes : [],
            connections: Array.isArray(circuit.connections) ? circuit.connections : [],
        };
        this.circuit = safeCircuit;
        this.nodeStates = new Map();
        this.signalCache = new Map();
        for (const node of safeCircuit.nodes) {
            const state = node.state ? { ...node.state } : {};
            this.nodeStates.set(node.id, state);
        }
    }
    /**
     * Get node state (copy)
     */
    getNodeState(nodeId) {
        const state = this.nodeStates.get(nodeId);
        return state ? { ...state } : undefined;
    }
    /**
     * Set node state
     */
    setNodeState(nodeId, state) {
        this.nodeStates.set(nodeId, { ...state });
    }
    /**
     * Update node position (in-place)
     * This allows "Live Edit" without resetting the simulation state.
     */
    updateNodePosition(nodeId, position) {
        const node = this.circuit.nodes.find((n) => n.id === nodeId);
        if (node) {
            // Modify in place to preserve reference if needed, 
            // but strictly we should probably treat circuit as immutable if possible.
            // However, for performance in live edit, direct mutation of the cached circuit is acceptable
            // as long as we don't need history undo/redo here (that's handled by the store/host).
            node.position = position;
        }
    }
    /**
     * Build inputs for a node by finding all connections to it
     */
    buildNodeInputs(nodeId, fallbackSignals, missingSignals) {
        const inputs = {};
        for (const conn of this.circuit.connections) {
            if (conn.to.nodeId === nodeId) {
                const key = `${conn.from.nodeId}.${conn.from.portName}`;
                const cached = this.signalCache.get(key);
                const fallback = fallbackSignals?.get(key);
                let value;
                if (cached !== undefined && !Number.isNaN(cached)) {
                    value = cached;
                }
                else if (fallback !== undefined && !Number.isNaN(fallback)) {
                    value = fallback;
                }
                else {
                    value = 0;
                    if (this.debug) {
                        missingSignals?.add(key);
                    }
                }
                inputs[conn.to.portName] = value;
            }
        }
        return inputs;
    }
    /**
     * Execute one tick of the simulation in topological order
     * Returns true if any state changed
     */
    tick() {
        const previousSignals = new Map(this.signalCache);
        this.signalCache.clear();
        const missingSignals = new Set();
        const nodesToEval = this.topologicalSort();
        for (const node of nodesToEval) {
            const behavior = NodeRegistry.get(node.type);
            if (!behavior) {
                if (this.debug) {
                    // eslint-disable-next-line no-console
                    console.warn(`[CircuitEngine] Missing behavior for node type: ${node.type}`);
                }
                continue;
            }
            const inputs = this.buildNodeInputs(node.id, previousSignals, missingSignals);
            const state = this.nodeStates.get(node.id) ?? {};
            const result = behavior.evaluate(inputs, state, node.config ?? {}, node);
            const outputs = result.outputs ?? {};
            if (this.debug) {
                // eslint-disable-next-line no-console
                console.log(`[CircuitEngine] ${node.id} (${node.type}) inputs`, inputs);
                // eslint-disable-next-line no-console
                console.log(`[CircuitEngine] ${node.id} outputs`, outputs);
            }
            this.nodeStates.set(node.id, result.state ?? {});
            for (const [port, value] of Object.entries(outputs)) {
                if (typeof value === 'number' && Number.isNaN(value)) {
                    if (this.debug) {
                        missingSignals.add(`${node.id}.${port}`);
                    }
                    this.signalCache.set(`${node.id}.${port}`, 0);
                }
                else {
                    this.signalCache.set(`${node.id}.${port}`, value);
                }
            }
        }
        if (this.debug) {
            // eslint-disable-next-line no-console
            console.log('[CircuitEngine] tick signals', Array.from(this.signalCache.entries()));
            if (missingSignals.size > 0) {
                // eslint-disable-next-line no-console
                console.info('[CircuitEngine] Missing or invalid signals defaulted to 0:', Array.from(missingSignals));
            }
        }
        if (previousSignals.size !== this.signalCache.size) {
            return true;
        }
        for (const [key, value] of this.signalCache.entries()) {
            if (previousSignals.get(key) !== value) {
                return true;
            }
        }
        return false;
    }
    /**
     * Topological sort of nodes (simple forward pass, assumes no cycles)
     */
    topologicalSort() {
        const nodes = this.circuit.nodes;
        const edges = new Map();
        const inDegree = new Map();
        for (const node of nodes) {
            edges.set(node.id, new Set());
            inDegree.set(node.id, 0);
        }
        for (const conn of this.circuit.connections) {
            edges.get(conn.from.nodeId)?.add(conn.to.nodeId);
            inDegree.set(conn.to.nodeId, (inDegree.get(conn.to.nodeId) ?? 0) + 1);
        }
        const queue = [];
        for (const [id, deg] of inDegree.entries()) {
            if (deg === 0)
                queue.push(id);
        }
        const sorted = [];
        while (queue.length) {
            const id = queue.shift();
            const node = nodes.find(n => n.id === id);
            if (node)
                sorted.push(node);
            for (const to of edges.get(id) ?? []) {
                inDegree.set(to, (inDegree.get(to) ?? 1) - 1);
                if (inDegree.get(to) === 0)
                    queue.push(to);
            }
        }
        if (sorted.length < nodes.length) {
            const sortedIds = new Set(sorted.map(n => n.id));
            for (const node of nodes) {
                if (!sortedIds.has(node.id)) {
                    sorted.push(node);
                }
            }
        }
        return sorted;
    }
    /**
     * Run simulation until stable (or max iterations)
     */
    stabilize(maxIterations = 100) {
        let iterations = 0;
        while (iterations < maxIterations) {
            iterations++;
            const changed = this.tick();
            if (!changed)
                break;
        }
        return iterations;
    }
    /**
     * Get all current signal values
     */
    getAllSignals() {
        return new Map(this.signalCache);
    }
    /**
     * Get all outputs for a specific node from the cache
     */
    getNodeOutputs(nodeId) {
        const outputs = {};
        const prefix = `${nodeId}.`;
        for (const [key, value] of this.signalCache.entries()) {
            if (key.startsWith(prefix)) {
                outputs[key.slice(prefix.length)] = value;
            }
        }
        return outputs;
    }
}
