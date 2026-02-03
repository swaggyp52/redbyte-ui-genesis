// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * Apply a single event to the circuit/engine state
 */
function applyEvent(circuit, engine, event, engineFactory) {
    switch (event.type) {
        case 'circuit_loaded':
            // Circuit loaded event replaces the entire circuit
            // This should only appear as the first event
            // Deep clone to avoid mutating the original circuit object
            const loadedCircuit = JSON.parse(JSON.stringify(event.circuit));
            return {
                circuit: loadedCircuit,
                engine: engineFactory(loadedCircuit),
            };
        case 'input_toggled':
            // Toggle an input port value by modifying node state and setting signal
            const toggleNode = circuit.nodes.find((n) => n.id === event.nodeId);
            if (toggleNode && (toggleNode.type === 'SWITCH' || toggleNode.type === 'Switch' || toggleNode.type === 'INPUT')) {
                // For stateful input nodes, modify the state
                if (!toggleNode.state)
                    toggleNode.state = {};
                toggleNode.state.isOn = event.value;
            }
            // Always set the signal directly for immediate effect
            const nodeSignals = engine.signals.get(event.nodeId);
            if (nodeSignals) {
                nodeSignals.set(event.portName, event.value);
            }
            return { circuit, engine };
        case 'simulation_tick':
            // Execute a simulation tick
            engine.tick(event.dt, event.tickIndex);
            return { circuit, engine };
        case 'node_state_modified':
            // Modify node internal state
            // Find the node in the circuit and update its state
            const node = circuit.nodes.find((n) => n.id === event.nodeId);
            if (node) {
                node.state = { ...node.state, ...event.state };
            }
            return { circuit, engine };
        default:
            // Unknown event type - skip it
            console.warn(`Unknown event type: ${event.type}`);
            return { circuit, engine };
    }
}
/**
 * Run replay from an event log
 *
 * Applies events in order to produce the final circuit state.
 * This is a pure pipeline: initial state + events → final state.
 *
 * @param eventLog - Event log to replay
 * @returns Final circuit state, engine, and count of events processed
 */
/**
 * Run replay from an event log
 *
 * @param eventLog - Event log to replay
 * @param engineFactory - Factory function to create engine instances (e.g., (circuit) => new LogicEngine(circuit))
 * @returns Final circuit state, engine, and count of events processed
 */
export function runReplay(eventLog, engineFactory) {
    if (eventLog.version !== 1) {
        throw new Error(`Unsupported event log version: ${eventLog.version}`);
    }
    if (eventLog.events.length === 0) {
        throw new Error('Event log must contain at least one circuit_loaded event');
    }
    // First event must be circuit_loaded
    const firstEvent = eventLog.events[0];
    if (firstEvent.type !== 'circuit_loaded') {
        throw new Error(`First event must be circuit_loaded, got: ${firstEvent.type}`);
    }
    // Initialize from the circuit_loaded event
    let circuit = firstEvent.circuit;
    let engine = engineFactory(circuit);
    // Apply remaining events
    for (let i = 1; i < eventLog.events.length; i++) {
        const event = eventLog.events[i];
        const result = applyEvent(circuit, engine, event, engineFactory);
        circuit = result.circuit;
        engine = result.engine;
    }
    return {
        circuit,
        engine,
        eventsProcessed: eventLog.events.length,
    };
}
/**
 * Validate that an event log is well-formed for replay
 *
 * Checks:
 * - Version is supported
 * - At least one event exists
 * - First event is circuit_loaded
 * - Events are in chronological order (timestamps non-decreasing)
 */
export function validateEventLog(eventLog) {
    const errors = [];
    if (eventLog.version !== 1) {
        errors.push(`Unsupported version: ${eventLog.version}`);
    }
    if (eventLog.events.length === 0) {
        errors.push('Event log must contain at least one event');
        return { valid: false, errors };
    }
    const firstEvent = eventLog.events[0];
    if (firstEvent.type !== 'circuit_loaded') {
        errors.push(`First event must be circuit_loaded, got: ${firstEvent.type}`);
    }
    // Check timestamps are non-decreasing
    for (let i = 1; i < eventLog.events.length; i++) {
        const prev = eventLog.events[i - 1];
        const curr = eventLog.events[i];
        if (curr.timestamp < prev.timestamp) {
            errors.push(`Events out of order: event ${i} timestamp ${curr.timestamp} < event ${i - 1} timestamp ${prev.timestamp}`);
        }
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
