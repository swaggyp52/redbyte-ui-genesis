// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit } from '../types';
import type { EventLogV1 } from './eventLog';
import { hashCircuitState } from './stateHash';
import { runReplay, type EngineFactory } from './replay';
import { LogicEngine } from '../engine';

/**
 * Verification result from comparing live execution to replay
 */
export interface VerifyReplayResult {
  /** Hash of the circuit state after live execution */
  liveHash: string;
  /** Hash of the circuit state after replay execution */
  replayHash: string;
  /** Whether the hashes match (determinism proof) */
  equal: boolean;
}

/**
 * Options for replay verification
 */
export interface VerifyReplayOptions {
  /** Engine factory for creating engine instances (defaults to LogicEngine) */
  engineFactory?: EngineFactory;
}

/**
 * Verify that an event log replays deterministically
 *
 * This function proves determinism by:
 * 1. Running the "live" path: applying events imperatively to a fresh engine
 * 2. Running the "replay" path: using runReplay() to reconstruct state
 * 3. Comparing the final state hashes
 *
 * If equal: the event log is a faithful recording of the live execution
 * If not equal: divergence detected (corrupted log, non-deterministic behavior, or bug)
 *
 * This is the core primitive for:
 * - Dev tools verification
 * - Export/import validation
 * - Collaboration feature testing
 * - Research reproducibility
 *
 * @param initialCircuit - The initial circuit state (before any events)
 * @param eventLog - The event log to verify
 * @param options - Optional configuration (engineFactory)
 * @returns Verification result with liveHash, replayHash, and equality check
 */
export async function verifyReplay(
  initialCircuit: Circuit,
  eventLog: EventLogV1,
  options: VerifyReplayOptions = {}
): Promise<VerifyReplayResult> {
  const engineFactory = options.engineFactory || ((circuit) => new LogicEngine(circuit));

  // ========== LIVE PATH ==========
  // Apply events imperatively to simulate "live" execution
  // This should match what the recorder captured during actual runtime

  // Deep clone to avoid mutating the initial circuit
  const liveCircuit = JSON.parse(JSON.stringify(initialCircuit)) as Circuit;
  const liveEngine = engineFactory(liveCircuit);

  // Apply each event (skipping the first circuit_loaded event since we already have the circuit)
  for (let i = 1; i < eventLog.events.length; i++) {
    const event = eventLog.events[i];

    switch (event.type) {
      case 'input_toggled': {
        // Toggle an input by modifying node state and setting signal
        const node = liveCircuit.nodes.find((n) => n.id === event.nodeId);
        if (node && (node.type === 'SWITCH' || node.type === 'Switch' || node.type === 'INPUT')) {
          if (!node.state) node.state = {};
          node.state.isOn = event.value;
        }

        // Set the signal directly
        const nodeSignals = liveEngine.signals.get(event.nodeId);
        if (nodeSignals) {
          nodeSignals.set(event.portName, event.value);
        }
        break;
      }

      case 'simulation_tick': {
        // Execute a simulation tick
        liveEngine.tick(event.dt, event.tickIndex);
        break;
      }

      case 'node_state_modified': {
        // Modify node internal state
        const node = liveCircuit.nodes.find((n) => n.id === event.nodeId);
        if (node) {
          node.state = { ...node.state, ...event.state };
        }
        break;
      }

      case 'circuit_loaded':
        // Should only appear as the first event
        console.warn('circuit_loaded event found after initial event - skipping');
        break;

      default:
        console.warn(`Unknown event type: ${(event as any).type}`);
    }
  }

  // Compute live hash
  const liveHash = await hashCircuitState(liveCircuit);

  // ========== REPLAY PATH ==========
  // Use the replay runner to reconstruct the circuit state
  const replayResult = runReplay(eventLog, engineFactory);

  // Compute replay hash
  const replayHash = await hashCircuitState(replayResult.circuit);

  // ========== COMPARISON ==========
  const equal = liveHash === replayHash;

  return {
    liveHash,
    replayHash,
    equal,
  };
}
