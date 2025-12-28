// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit, LogicValue } from '../types';
import {
  createEventLog,
  appendEvent,
  createCircuitLoadedEvent,
  createInputToggledEvent,
  createSimulationTickEvent,
  type EventLogV1,
} from './eventLog';

/**
 * Clock function type for deterministic timestamp generation
 * Default: Date.now (runtime)
 * Tests: Inject deterministic clock
 */
export type Clock = () => number;

/**
 * Recorder options
 */
export interface RecorderOptions {
  /** Deterministic clock (defaults to Date.now) */
  clock?: Clock;
  /** Optional metadata for the event log */
  metadata?: EventLogV1['metadata'];
}

/**
 * Deterministic event recorder
 * Captures user actions (circuit load, input toggles, simulation ticks) into an EventLogV1
 */
export class Recorder {
  private log: EventLogV1;
  private clock: Clock;
  private recording: boolean = true;
  private tickCounter: number = 0;

  constructor(options: RecorderOptions = {}) {
    this.clock = options.clock || Date.now;
    this.log = createEventLog(options.metadata);
  }

  /**
   * Record circuit load event (initial snapshot)
   * This should be the first event recorded
   */
  recordCircuitLoaded(circuit: Circuit): void {
    if (!this.recording) return;

    const event = createCircuitLoadedEvent(circuit, this.clock());
    this.log = appendEvent(this.log, event);
  }

  /**
   * Record input toggle event
   * Called when user toggles a SWITCH/INPUT node
   */
  recordInputToggled(nodeId: string, portName: string, value: LogicValue): void {
    if (!this.recording) return;

    const event = createInputToggledEvent(nodeId, portName, value, this.clock());
    this.log = appendEvent(this.log, event);
  }

  /**
   * Record simulation tick event
   * Called when the engine executes a tick/step
   */
  recordSimulationTick(dt: number = 1): void {
    if (!this.recording) return;

    const event = createSimulationTickEvent(this.tickCounter, dt, this.clock());
    this.log = appendEvent(this.log, event);
    this.tickCounter++;
  }

  /**
   * Get the current event log (immutable snapshot)
   */
  getLog(): EventLogV1 {
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
  stop(): void {
    this.recording = false;
  }

  /**
   * Check if recorder is still recording
   */
  isRecording(): boolean {
    return this.recording;
  }
}

/**
 * Create a new recorder instance
 */
export function createRecorder(options: RecorderOptions = {}): Recorder {
  return new Recorder(options);
}
