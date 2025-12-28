// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit } from '../types';
import type { EventLogV1 } from './eventLog';
import { LogicEngine } from '../engine';
import type { EngineFactory, ReplayEngine } from './replay';

/**
 * Circuit state snapshot at a specific point in replay.
 * Contains both the circuit structure and runtime signal state.
 */
export interface CircuitStateSnapshot {
  /** Circuit structure (nodes + connections) at this point */
  circuit: Circuit;
  /** Runtime signals at this point (Map<nodeId, Map<portName, value>>) */
  signals: Map<string, Map<string, number>>;
  /** Event index this snapshot represents (0-indexed into eventLog.events) */
  eventIndex: number;
  /** Total number of events in the log */
  totalEvents: number;
}

/**
 * Options for getStateAtIndex
 */
export interface GetStateAtIndexOptions {
  /** Factory function to create engine instances. Defaults to LogicEngine. */
  engineFactory?: EngineFactory;
}

/**
 * Get circuit state at a specific event index via partial replay.
 *
 * This is the foundational primitive for time travel inspection.
 * It applies events [0..eventIndex] (inclusive) to produce the state
 * at that point in the event log.
 *
 * Event-index semantics:
 * - eventIndex=0: state after circuit_loaded event (initial state)
 * - eventIndex=1: state after first event following circuit_loaded
 * - eventIndex=N: state after N+1 events total
 *
 * This function is:
 * - Pure: same inputs → same output
 * - Deterministic: replay always produces identical state
 * - Read-only: never mutates input circuit or event log
 *
 * @param initialCircuit - Starting circuit (must match eventLog's circuit_loaded event)
 * @param eventLog - Event log to replay
 * @param eventIndex - Index into eventLog.events (0-based, inclusive)
 * @param options - Optional configuration (engineFactory, etc.)
 * @returns State snapshot at the specified event index
 * @throws Error if eventIndex is out of bounds or log is invalid
 */
export function getStateAtIndex(
  initialCircuit: Circuit,
  eventLog: EventLogV1,
  eventIndex: number,
  options?: GetStateAtIndexOptions
): CircuitStateSnapshot {
  const engineFactory = options?.engineFactory ?? ((circuit: Circuit) => new LogicEngine(circuit));

  // Validate inputs
  if (eventLog.version !== 1) {
    throw new Error(`Unsupported event log version: ${eventLog.version}`);
  }

  if (eventLog.events.length === 0) {
    throw new Error('Event log must contain at least one event');
  }

  if (eventIndex < 0 || eventIndex >= eventLog.events.length) {
    throw new Error(
      `Event index ${eventIndex} out of bounds (log has ${eventLog.events.length} events, valid range: 0..${eventLog.events.length - 1})`
    );
  }

  const firstEvent = eventLog.events[0];
  if (firstEvent.type !== 'circuit_loaded') {
    throw new Error(`First event must be circuit_loaded, got: ${firstEvent.type}`);
  }

  // Deep clone initial circuit to avoid mutation
  let circuit = JSON.parse(JSON.stringify(initialCircuit)) as Circuit;
  let engine: ReplayEngine = engineFactory(circuit);

  // Apply events [0..eventIndex] inclusive
  // Event 0 is circuit_loaded, which initializes the state
  for (let i = 0; i <= eventIndex; i++) {
    const event = eventLog.events[i];

    switch (event.type) {
      case 'circuit_loaded':
        // Replace circuit with the one from the event
        circuit = JSON.parse(JSON.stringify(event.circuit)) as Circuit;
        engine = engineFactory(circuit);
        break;

      case 'input_toggled':
        // Toggle input: update node state and signal
        const toggleNode = circuit.nodes.find((n) => n.id === event.nodeId);
        if (toggleNode && (toggleNode.type === 'SWITCH' || toggleNode.type === 'Switch' || toggleNode.type === 'INPUT')) {
          if (!toggleNode.state) toggleNode.state = {};
          toggleNode.state.isOn = event.value;
        }

        const nodeSignals = engine.signals.get(event.nodeId);
        if (nodeSignals) {
          nodeSignals.set(event.portName, event.value);
        }
        break;

      case 'simulation_tick':
        // Execute simulation tick
        engine.tick(event.dt, event.tickIndex);
        break;

      case 'node_state_modified':
        // Modify node internal state
        const node = circuit.nodes.find((n) => n.id === event.nodeId);
        if (node) {
          node.state = { ...node.state, ...event.state };
        }
        break;

      default:
        // Unknown event type - skip with warning
        console.warn(`Unknown event type: ${(event as any).type}`);
        break;
    }
  }

  // Return snapshot with deep-cloned signals to prevent mutation
  const snapshotSignals = new Map<string, Map<string, number>>();
  for (const [nodeId, portMap] of engine.signals.entries()) {
    const clonedPortMap = new Map<string, number>();
    for (const [portName, value] of portMap.entries()) {
      clonedPortMap.set(portName, value);
    }
    snapshotSignals.set(nodeId, clonedPortMap);
  }

  return {
    circuit,
    signals: snapshotSignals,
    eventIndex,
    totalEvents: eventLog.events.length,
  };
}
