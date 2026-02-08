// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * Records simulation history for debugging and analysis
 */
export class TraceRecorder {
    entries = [];
    maxEntries;
    isRecording = false;
    lastSignals = null;
    constructor(maxEntries = 1000) {
        this.maxEntries = maxEntries;
    }
    /**
     * Start recording trace
     */
    start() {
        this.isRecording = true;
        this.clear();
    }
    /**
     * Stop recording trace
     */
    stop() {
        this.isRecording = false;
    }
    /**
     * Clear all recorded entries
     */
    clear() {
        this.entries = [];
        this.lastSignals = null;
    }
    /**
     * Record a tick snapshot
     */
    recordTick(engine, tick, circuit) {
        if (!this.isRecording)
            return;
        const signals = engine.getAllSignals();
        const changedNodes = [];
        // Detect which nodes changed
        if (this.lastSignals) {
            for (const [key, value] of signals.entries()) {
                if (this.lastSignals.get(key) !== value) {
                    // Extract node ID from signal key (format: "nodeId.portName")
                    const nodeId = key.split('.')[0];
                    if (!changedNodes.includes(nodeId)) {
                        changedNodes.push(nodeId);
                    }
                }
            }
        }
        else {
            // First tick - all nodes are "changed"
            for (const node of circuit.nodes) {
                changedNodes.push(node.id);
            }
        }
        // Create snapshot
        const nodeStates = new Map();
        for (const node of circuit.nodes) {
            const state = engine.getNodeState(node.id);
            if (state) {
                nodeStates.set(node.id, { ...state });
            }
        }
        const entry = {
            tick,
            timestamp: Date.now(),
            nodeStates,
            signals: new Map(signals),
            changedNodes,
        };
        this.entries.push(entry);
        // Limit buffer size
        if (this.entries.length > this.maxEntries) {
            this.entries.shift();
        }
        // Save current signals for next comparison
        this.lastSignals = new Map(signals);
    }
    /**
     * Get trace entry at specific tick
     */
    getTraceAt(tick) {
        return this.entries.find((e) => e.tick === tick);
    }
    /**
     * Get all trace entries
     */
    getAllTraces() {
        return this.entries;
    }
    /**
     * Get trace snapshots (serializable format)
     */
    getSnapshots() {
        return this.entries.map((entry) => ({
            tick: entry.tick,
            timestamp: entry.timestamp,
            nodeStates: Object.fromEntries(entry.nodeStates),
            signals: Object.fromEntries(entry.signals),
            changedNodes: entry.changedNodes,
        }));
    }
    /**
     * Get summary statistics
     */
    getStats() {
        if (this.entries.length === 0) {
            return {
                totalTicks: 0,
                totalChanges: 0,
                memoryUsage: 0,
            };
        }
        const totalChanges = this.entries.reduce((sum, entry) => sum + entry.changedNodes.length, 0);
        return {
            totalTicks: this.entries.length,
            totalChanges,
            memoryUsage: this.entries.length * 256, // Rough estimate in bytes
            startTime: this.entries[0]?.timestamp,
            endTime: this.entries[this.entries.length - 1]?.timestamp,
        };
    }
    /**
     * Export trace as JSON
     */
    exportAsJSON() {
        return JSON.stringify(this.getSnapshots(), null, 2);
    }
    /**
     * Check if recording
     */
    isActive() {
        return this.isRecording;
    }
    /**
     * Get tick range
     */
    getTickRange() {
        if (this.entries.length === 0)
            return null;
        return {
            min: this.entries[0].tick,
            max: this.entries[this.entries.length - 1].tick,
        };
    }
}
