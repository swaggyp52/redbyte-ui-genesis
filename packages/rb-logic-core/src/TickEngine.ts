// Copyright © 2025 Connor Angel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit, TickEngineConfig } from './types';
import { CircuitEngine } from './CircuitEngine';

/**
 * Tick engine that runs circuit simulation at a specific Hz
 */
export class TickEngine {
  private circuitEngine: CircuitEngine;
  private tickRate: number;
  private running: boolean;
  private intervalId: number | null;
  private tickCount: number;

  constructor(circuit: Circuit, config: TickEngineConfig = { tickRate: 20 }) {
    this.circuitEngine = new CircuitEngine(circuit);
    this.tickRate = config.tickRate;
    this.running = false;
    this.intervalId = null;
    this.tickCount = 0;
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
   * Cleanup
   */
  dispose(): void {
    this.pause();
  }
}
