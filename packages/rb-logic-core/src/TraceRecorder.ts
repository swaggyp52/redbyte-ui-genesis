// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit, Signal } from './types';
import type { CircuitEngine } from './CircuitEngine';

export interface TraceEntry {
  tick: number;
  timestamp: number;
  nodeStates: Map<string, Record<string, any>>;
  signals: Map<string, Signal>;
  changedNodes: string[];
}

export interface TraceSnapshot {
  tick: number;
  timestamp: number;
  nodeStates: Record<string, Record<string, any>>;
  signals: Record<string, Signal>;
  changedNodes: string[];
}

/**
 * Records simulation history for debugging and analysis
 */
export class TraceRecorder {
  private entries: TraceEntry[] = [];
  private maxEntries: number;
  private isRecording: boolean = false;
  private lastSignals: Map<string, Signal> | null = null;

  constructor(maxEntries: number = 1000) {
    this.maxEntries = maxEntries;
  }

  /**
   * Start recording trace
   */
  start(): void {
    this.isRecording = true;
    this.clear();
  }

  /**
   * Stop recording trace
   */
  stop(): void {
    this.isRecording = false;
  }

  /**
   * Clear all recorded entries
   */
  clear(): void {
    this.entries = [];
    this.lastSignals = null;
  }

  /**
   * Record a tick snapshot
   */
  recordTick(engine: CircuitEngine, tick: number, circuit: Circuit): void {
    if (!this.isRecording) return;

    const signals = engine.getAllSignals();
    const changedNodes: string[] = [];

    // Detect which nodes changed
    if (this.lastSignals) {
      for (const [key, value] of signals.entries()) {
        if (this.lastSignals.get(key) !== value) {
          // Extract node ID from signal key (format: "nodeId.portName")
          const nodeId = key.split('.')[0];
          if (!changedNodes.includes(nodeId)) {
            changedNodes.push(nodeId);
          }
        }
      }
    } else {
      // First tick - all nodes are "changed"
      for (const node of circuit.nodes) {
        changedNodes.push(node.id);
      }
    }

    // Create snapshot
    const nodeStates = new Map<string, Record<string, any>>();
    for (const node of circuit.nodes) {
      const state = engine.getNodeState(node.id);
      if (state) {
        nodeStates.set(node.id, { ...state });
      }
    }

    const entry: TraceEntry = {
      tick,
      timestamp: Date.now(),
      nodeStates,
      signals: new Map(signals),
      changedNodes,
    };

    this.entries.push(entry);

    // Limit buffer size
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    // Save current signals for next comparison
    this.lastSignals = new Map(signals);
  }

  /**
   * Get trace entry at specific tick
   */
  getTraceAt(tick: number): TraceEntry | undefined {
    return this.entries.find((e) => e.tick === tick);
  }

  /**
   * Get all trace entries
   */
  getAllTraces(): TraceEntry[] {
    return this.entries;
  }

  /**
   * Get trace snapshots (serializable format)
   */
  getSnapshots(): TraceSnapshot[] {
    return this.entries.map((entry) => ({
      tick: entry.tick,
      timestamp: entry.timestamp,
      nodeStates: Object.fromEntries(entry.nodeStates),
      signals: Object.fromEntries(entry.signals),
      changedNodes: entry.changedNodes,
    }));
  }

  /**
   * Get summary statistics
   */
  getStats(): {
    totalTicks: number;
    totalChanges: number;
    memoryUsage: number;
    startTime?: number;
    endTime?: number;
  } {
    if (this.entries.length === 0) {
      return {
        totalTicks: 0,
        totalChanges: 0,
        memoryUsage: 0,
      };
    }

    const totalChanges = this.entries.reduce(
      (sum, entry) => sum + entry.changedNodes.length,
      0
    );

    return {
      totalTicks: this.entries.length,
      totalChanges,
      memoryUsage: this.entries.length * 256, // Rough estimate in bytes
      startTime: this.entries[0]?.timestamp,
      endTime: this.entries[this.entries.length - 1]?.timestamp,
    };
  }

  /**
   * Export trace as JSON
   */
  exportAsJSON(): string {
    return JSON.stringify(this.getSnapshots(), null, 2);
  }

  /**
   * Check if recording
   */
  isActive(): boolean {
    return this.isRecording;
  }

  /**
   * Get tick range
   */
  getTickRange(): { min: number; max: number } | null {
    if (this.entries.length === 0) return null;
    return {
      min: this.entries[0].tick,
      max: this.entries[this.entries.length - 1].tick,
    };
  }
}
