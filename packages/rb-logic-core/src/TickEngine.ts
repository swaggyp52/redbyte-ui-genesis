// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit, TickEngineConfig } from './types';
import { CircuitEngine } from './CircuitEngine';
import { TraceRecorder } from './TraceRecorder';

/**
 * Tick engine that runs circuit simulation at a specific Hz
 */
export class TickEngine {
  private circuitEngine: CircuitEngine;
  private tickRate: number;
  private running: boolean;
  private intervalId: number | null;
  private tickCount: number;
  private traceRecorder: TraceRecorder | null;

  constructor(circuit: Circuit, config: TickEngineConfig = { tickRate: 20 }) {
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
  getEngine(): CircuitEngine {
    return this.circuitEngine;
  }

  /**
   * Get current circuit
   */
  getCircuit(): Circuit {
    return this.circuitEngine.getCircuit();
  }

  /**
   * Update circuit
   */
  setCircuit(circuit: Circuit): void {
    this.circuitEngine.setCircuit(circuit);
  }

  /**
   * Get current tick rate (Hz)
   */
  getTickRate(): number {
    return this.tickRate;
  }

  /**
   * Set tick rate (Hz)
   */
  setTickRate(hz: number): void {
    this.tickRate = hz;
    if (this.running) {
      this.pause();
      this.start();
    }
  }

  /**
   * Start the simulation
   */
  start(): void {
    if (this.running) return;
    
    this.running = true;
    const intervalMs = 1000 / this.tickRate;
    
    this.intervalId = setInterval(() => {
      this.stepOnce();
    }, intervalMs) as unknown as number;
  }

  /**
   * Pause the simulation
   */
  pause(): void {
    if (!this.running) return;
    
    this.running = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Execute one tick
   */
  stepOnce(): void {
    this.circuitEngine.tick();
    this.tickCount++;

    // Record trace if enabled
    if (this.traceRecorder && this.traceRecorder.isActive()) {
      this.traceRecorder.recordTick(
        this.circuitEngine,
        this.tickCount,
        this.circuitEngine.getCircuit()
      );
    }
  }

  /**
   * Check if running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get total tick count
   */
  getTickCount(): number {
    return this.tickCount;
  }

  /**
   * Reset tick count
   */
  resetTickCount(): void {
    this.tickCount = 0;
  }

  /**
   * Enable trace recording
   */
  enableTracing(maxEntries: number = 1000): void {
    if (!this.traceRecorder) {
      this.traceRecorder = new TraceRecorder(maxEntries);
    }
    this.traceRecorder.start();
  }

  /**
   * Disable trace recording
   */
  disableTracing(): void {
    if (this.traceRecorder) {
      this.traceRecorder.stop();
    }
  }

  /**
   * Get trace recorder
   */
  getTraceRecorder(): TraceRecorder | null {
    return this.traceRecorder;
  }

  /**
   * Clear trace data
   */
  clearTrace(): void {
    if (this.traceRecorder) {
      this.traceRecorder.clear();
    }
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.pause();
  }
}
