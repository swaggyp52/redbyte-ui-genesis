// Copyright © 2025 Connor Angel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit, Node, Connection, NodeInputs, Signal } from './types';
import { NodeRegistry } from './NodeRegistry';

/**
 * Circuit evaluation engine
 * Handles signal propagation through the circuit graph
 */
export class CircuitEngine {
  private circuit: Circuit;
  private nodeStates: Map<string, Record<string, any>>;
  private signalCache: Map<string, Signal>;

  constructor(circuit: Circuit) {
    // Ensure circuit has valid arrays (defensive programming)
    this.circuit = {
      nodes: Array.isArray(circuit.nodes) ? circuit.nodes : [],
      connections: Array.isArray(circuit.connections) ? circuit.connections : [],
    };
    this.nodeStates = new Map();
    this.signalCache = new Map();

    // Initialize node states
    for (const node of this.circuit.nodes) {
      this.nodeStates.set(node.id, node.state ?? {});
    }
  }

  /**
   * Get current circuit
   */
  getCircuit(): Circuit {
    return this.circuit;
  }

  /**
   * Update circuit
   */
  setCircuit(circuit: Circuit): void {
    // Ensure circuit has valid arrays (defensive programming)
    this.circuit = {
      nodes: Array.isArray(circuit.nodes) ? circuit.nodes : [],
      connections: Array.isArray(circuit.connections) ? circuit.connections : [],
    };
    // Preserve existing states where possible
    const newStates = new Map<string, Record<string, any>>();
    for (const node of this.circuit.nodes) {
      newStates.set(
        node.id,
        this.nodeStates.get(node.id) ?? node.state ?? {}
      );
    }
    this.nodeStates = newStates;
    this.signalCache.clear();
  }

  /**
   * Get node state
   */
  getNodeState(nodeId: string): Record<string, any> | undefined {
    return this.nodeStates.get(nodeId);
  }

  /**
   * Set node state (for interactive nodes like Switch)
   */
  setNodeState(nodeId: string, state: Record<string, any>): void {
    this.nodeStates.set(nodeId, state);
    this.signalCache.clear(); // Invalidate cache
  }

  /**
   * Get signal value at a port
   */
  private getPortSignal(nodeId: string, portName: string): Signal {
    const cacheKey = `${nodeId}.${portName}`;
    const cached = this.signalCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const node = this.circuit.nodes.find(n => n.id === nodeId);
    if (!node) return 0;

    const behavior = NodeRegistry.get(node.type);
    if (!behavior) return 0;

    // Build inputs for this node
    const inputs = this.buildNodeInputs(nodeId);
    const state = this.nodeStates.get(nodeId) ?? {};
    
    // Evaluate node
    const result = behavior.evaluate(inputs, state, node.config);
    
    // Update state
    this.nodeStates.set(nodeId, result.state);
    
    // Cache all outputs
    for (const [port, signal] of Object.entries(result.outputs)) {
      this.signalCache.set(`${nodeId}.${port}`, signal);
    }

    return result.outputs[portName] ?? 0;
  }

  /**
   * Build inputs for a node by finding all connections to it
   */
  private buildNodeInputs(nodeId: string): NodeInputs {
    const inputs: NodeInputs = {};
    
    for (const conn of this.circuit.connections) {
      if (conn.to.nodeId === nodeId) {
        // This connection feeds into our node
        inputs[conn.to.portName] = this.getPortSignal(
          conn.from.nodeId,
          conn.from.portName
        );
      }
    }
    
    return inputs;
  }

  /**
   * Execute one tick of the simulation
   * Returns true if any state changed
   */
  tick(): boolean {
    const oldCache = new Map(this.signalCache);
    this.signalCache.clear();
    
    // Evaluate all nodes
    for (const node of this.circuit.nodes) {
      const behavior = NodeRegistry.get(node.type);
      if (!behavior) continue;
      
      const inputs = this.buildNodeInputs(node.id);
      const state = this.nodeStates.get(node.id) ?? {};
      
      const result = behavior.evaluate(inputs, state, node.config);
      this.nodeStates.set(node.id, result.state);
      
      // Cache outputs
      for (const [port, signal] of Object.entries(result.outputs)) {
        this.signalCache.set(`${node.id}.${port}`, signal);
      }
    }
    
    // Check if anything changed
    if (oldCache.size !== this.signalCache.size) return true;
    
    for (const [key, value] of this.signalCache.entries()) {
      if (oldCache.get(key) !== value) return true;
    }
    
    return false;
  }

  /**
   * Run simulation until stable (or max iterations)
   */
  stabilize(maxIterations = 100): number {
    let iterations = 0;
    while (iterations < maxIterations) {
      iterations++;
      const changed = this.tick();
      if (!changed) break;
    }
    return iterations;
  }

  /**
   * Get all current signal values
   */
  getAllSignals(): Map<string, Signal> {
    return new Map(this.signalCache);
  }
}
