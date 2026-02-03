// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * Encode event log to JSON string
 */
export function encodeEventLog(log) {
    return JSON.stringify(log);
}
/**
 * Decode event log from JSON string
 * Validates version and throws if unsupported
 */
export function decodeEventLog(encoded) {
    const parsed = JSON.parse(encoded);
    if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid event log format: not an object');
    }
    if (parsed.version !== 1) {
        throw new Error(`Unsupported event log version: ${parsed.version}`);
    }
    if (!Array.isArray(parsed.events)) {
        throw new Error('Invalid event log format: events must be an array');
    }
    return parsed;
}
/**
 * Create an empty event log
 */
export function createEventLog(metadata) {
    return {
        version: 1,
        events: [],
        metadata,
    };
}
/**
 * Append an event to the log (immutable - returns new log)
 */
export function appendEvent(log, event) {
    return {
        ...log,
        events: [...log.events, event],
    };
}
/**
 * Create a circuit loaded event
 */
export function createCircuitLoadedEvent(circuit, timestamp = Date.now()) {
    return {
        type: 'circuit_loaded',
        timestamp,
        circuit,
    };
}
/**
 * Create an input toggled event
 */
export function createInputToggledEvent(nodeId, portName, value, timestamp = Date.now()) {
    return {
        type: 'input_toggled',
        timestamp,
        nodeId,
        portName,
        value,
    };
}
/**
 * Create a simulation tick event
 */
export function createSimulationTickEvent(tickIndex, dt = 1, timestamp = Date.now()) {
    return {
        type: 'simulation_tick',
        timestamp,
        tickIndex,
        dt,
    };
}
/**
 * Create a node state modified event
 */
export function createNodeStateModifiedEvent(nodeId, state, timestamp = Date.now()) {
    return {
        type: 'node_state_modified',
        timestamp,
        nodeId,
        state,
    };
}
