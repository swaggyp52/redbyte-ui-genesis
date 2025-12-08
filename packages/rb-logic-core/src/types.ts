// Copyright © 2025 Connor Angel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Signal state in the circuit (binary)
 */
export type Signal = 0 | 1;

/**
 * Port connection identifier
 */
export interface PortRef {
  nodeId: string;
  portName: string;
}

/**
 * Connection between two ports
 */
export interface Connection {
  from: PortRef;
  to: PortRef;
}

/**
 * Position in 2D space
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Node in the circuit
 */
export interface Node {
  id: string;
  type: string;
  position: Position;
  rotation: number; // degrees
  config: Record<string, any>;
  state?: Record<string, any>;
}

/**
 * Complete circuit definition
 */
export interface Circuit {
  nodes: Node[];
  connections: Connection[];
}

/**
 * Node evaluation inputs
 */
export type NodeInputs = Record<string, Signal>;

/**
 * Node evaluation outputs
 */
export type NodeOutputs = Record<string, Signal>;

/**
 * Node behavior evaluation function
 */
export interface NodeBehavior {
  evaluate(
    inputs: NodeInputs,
    state: Record<string, any>,
    config: Record<string, any>
  ): {
    outputs: NodeOutputs;
    state: Record<string, any>;
  };
}

/**
 * Serialized circuit format (V1)
 */
export interface SerializedCircuitV1 {
  version: 1 | '1' | 'v1';  // Support multiple version formats
  nodes: Node[];
  connections: Connection[];
}

/**
 * Tick engine configuration
 */
export interface TickEngineConfig {
  tickRate: number; // Hz (default 20)
}
