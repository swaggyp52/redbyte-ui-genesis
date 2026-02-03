// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { CircuitEngine } from './CircuitEngine';
import { TraceRecorder } from './TraceRecorder';
/**
 * Tick engine that runs circuit simulation at a specific Hz
 */
export class TickEngine {
    circuitEngine;
    tickRate;
    running;
    intervalId;
    tickCount;
    traceRecorder;
    constructor(circuit, config = { tickRate: 20 }) {
        this.circuitEngine = new CircuitEngine(circuit);
        this.tickRate = config.tickRate;
        this.running = false;
        this.intervalId = null;
        this.tickCount = 0;
        this.traceRecorder = null;
    }
    /**
     * Get the circuit engine
     */
    getEngine() {
        return this.circuitEngine;
    }
    /**
     * Get current circuit
     */
    getCircuit() {
        return this.circuitEngine.getCircuit();
    }
    /**
     * Update circuit
     */
    setCircuit(circuit) {
        this.circuitEngine.setCircuit(circuit);
    }
    /**
     * Get current tick rate (Hz)
     */
    getTickRate() {
        return this.tickRate;
    }
    /**
     * Set tick rate (Hz)
     */
    setTickRate(hz) {
        this.tickRate = hz;
        if (this.running) {
            this.pause();
            this.start();
        }
    }
    /**
     * Start the simulation
     */
    start() {
        if (this.running)
            return;
        this.running = true;
        const intervalMs = 1000 / this.tickRate;
        this.intervalId = setInterval(() => {
            this.stepOnce();
        }, intervalMs);
    }
    /**
     * Pause the simulation
     */
    pause() {
        if (!this.running)
            return;
        this.running = false;
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
    /**
     * Execute one tick
     */
    stepOnce() {
        this.circuitEngine.tick();
        this.tickCount++;
        // Record trace if enabled
        if (this.traceRecorder && this.traceRecorder.isActive()) {
            this.traceRecorder.recordTick(this.circuitEngine, this.tickCount, this.circuitEngine.getCircuit());
        }
    }
    /**
     * Check if running
     */
    isRunning() {
        return this.running;
    }
    /**
     * Get total tick count
     */
    getTickCount() {
        return this.tickCount;
    }
    /**
     * Reset tick count
     */
    resetTickCount() {
        this.tickCount = 0;
    }
    /**
     * Enable trace recording
     */
    enableTracing(maxEntries = 1000) {
        if (!this.traceRecorder) {
            this.traceRecorder = new TraceRecorder(maxEntries);
        }
        this.traceRecorder.start();
    }
    /**
     * Disable trace recording
     */
    disableTracing() {
        if (this.traceRecorder) {
            this.traceRecorder.stop();
        }
    }
    /**
     * Get trace recorder
     */
    getTraceRecorder() {
        return this.traceRecorder;
    }
    /**
     * Clear trace data
     */
    clearTrace() {
        if (this.traceRecorder) {
            this.traceRecorder.clear();
        }
    }
    /**
     * Cleanup
     */
    dispose() {
        this.pause();
    }
}
