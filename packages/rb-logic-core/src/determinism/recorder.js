// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { createEventLog, appendEvent, createCircuitLoadedEvent, createInputToggledEvent, createSimulationTickEvent, } from './eventLog';
/**
 * Deterministic event recorder
 * Captures user actions (circuit load, input toggles, simulation ticks) into an EventLogV1
 */
export class Recorder {
    log;
    clock;
    recording = true;
    tickCounter = 0;
    constructor(options = {}) {
        this.clock = options.clock || Date.now;
        this.log = createEventLog(options.metadata);
    }
    /**
     * Record circuit load event (initial snapshot)
     * This should be the first event recorded
     */
    recordCircuitLoaded(circuit) {
        if (!this.recording)
            return;
        const event = createCircuitLoadedEvent(circuit, this.clock());
        this.log = appendEvent(this.log, event);
    }
    /**
     * Record input toggle event
     * Called when user toggles a SWITCH/INPUT node
     */
    recordInputToggled(nodeId, portName, value) {
        if (!this.recording)
            return;
        const event = createInputToggledEvent(nodeId, portName, value, this.clock());
        this.log = appendEvent(this.log, event);
    }
    /**
     * Record simulation tick event
     * Called when the engine executes a tick/step
     */
    recordSimulationTick(dt = 1) {
        if (!this.recording)
            return;
        const event = createSimulationTickEvent(this.tickCounter, dt, this.clock());
        this.log = appendEvent(this.log, event);
        this.tickCounter++;
    }
    /**
     * Get the current event log (immutable snapshot)
     */
    getLog() {
        // Return a deep copy to prevent external mutation
        return {
            version: this.log.version,
            events: [...this.log.events],
            metadata: this.log.metadata ? { ...this.log.metadata } : undefined,
        };
    }
    /**
     * Stop recording (subsequent record calls are no-ops)
     */
    stop() {
        this.recording = false;
    }
    /**
     * Check if recorder is still recording
     */
    isRecording() {
        return this.recording;
    }
}
/**
 * Create a new recorder instance
 */
export function createRecorder(options = {}) {
    return new Recorder(options);
}
