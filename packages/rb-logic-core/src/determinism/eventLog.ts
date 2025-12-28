// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit } from '../types';

/**
 * Event log schema version 1
 *
 * Intent-level events capture user actions and simulation state changes
 * needed to deterministically replay a session.
 */

export type SimulationEventV1 =
  | CircuitLoadedEvent
  | InputToggledEvent
  | SimulationTickEvent
  | NodeStateModifiedEvent;

/**
 * Circuit loaded - establishes initial state
 */
export interface CircuitLoadedEvent {
  type: 'circuit_loaded';
  timestamp: number;
  circuit: Circuit;
}

/**
 * User toggled an input port value (e.g., POWER on/off, SWITCH toggle)
 */
export interface InputToggledEvent {
  type: 'input_toggled';
  timestamp: number;
  nodeId: string;
  portName: string;
  value: 0 | 1;
}

/**
 * Simulation tick executed
 */
export interface SimulationTickEvent {
  type: 'simulation_tick';
  timestamp: number;
  tickIndex: number;
  dt: number; // Delta time in ms (usually 1 for single step)
}

/**
 * Node internal state modified (e.g., flip-flop state change)
 * This is typically the result of a tick, but recorded explicitly for replay
 */
export interface NodeStateModifiedEvent {
  type: 'node_state_modified';
  timestamp: number;
  nodeId: string;
  state: Record<string, any>;
}

/**
 * Event log - ordered sequence of simulation events
 */
export interface EventLogV1 {
  version: 1;
  events: SimulationEventV1[];
  metadata?: {
    startTime?: number;
    endTime?: number;
    description?: string;
  };
}

/**
 * Encode event log to JSON string
 */
export function encodeEventLog(log: EventLogV1): string {
  return JSON.stringify(log);
}

/**
 * Decode event log from JSON string
 * Validates version and throws if unsupported
 */
export function decodeEventLog(encoded: string): EventLogV1 {
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

  return parsed as EventLogV1;
}

/**
 * Create an empty event log
 */
export function createEventLog(metadata?: EventLogV1['metadata']): EventLogV1 {
  return {
    version: 1,
    events: [],
    metadata,
  };
}

/**
 * Append an event to the log (immutable - returns new log)
 */
export function appendEvent(log: EventLogV1, event: SimulationEventV1): EventLogV1 {
  return {
    ...log,
    events: [...log.events, event],
  };
}

/**
 * Create a circuit loaded event
 */
export function createCircuitLoadedEvent(circuit: Circuit, timestamp = Date.now()): CircuitLoadedEvent {
  return {
    type: 'circuit_loaded',
    timestamp,
    circuit,
  };
}

/**
 * Create an input toggled event
 */
export function createInputToggledEvent(
  nodeId: string,
  portName: string,
  value: 0 | 1,
  timestamp = Date.now()
): InputToggledEvent {
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
export function createSimulationTickEvent(
  tickIndex: number,
  dt = 1,
  timestamp = Date.now()
): SimulationTickEvent {
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
export function createNodeStateModifiedEvent(
  nodeId: string,
  state: Record<string, any>,
  timestamp = Date.now()
): NodeStateModifiedEvent {
  return {
    type: 'node_state_modified',
    timestamp,
    nodeId,
    state,
  };
}
