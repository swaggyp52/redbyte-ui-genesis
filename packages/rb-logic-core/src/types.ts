// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Digital logic value.
 * - 0/1: Driven low/high
 * - Z: High-impedance (floating)
 * - X: Contention/undefined
 */
export type LogicValue = 0 | 1 | 'Z' | 'X';

/**
 * Signal state in the circuit (digital or analog).
 * Digital nodes use 0/1/Z/X, analog nodes use numeric values.
 */
export type Signal = number | LogicValue;

/**
 * Port connection identifier
 */
export interface PortRef {
  nodeId: string;
  portName: string;
  /** Legacy alias (deprecated) */
  port?: string;
}

/**
 * Connection between two ports
 */
export interface Connection {
  id?: string;
  from: PortRef | string;
  to: PortRef | string;
  /** Legacy pin aliases */
  fromPin?: string;
  toPin?: string;
  fromPort?: string;
  toPort?: string;
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
  position?: Position;
  /** Legacy coordinates (deprecated) */
  x?: number;
  y?: number;
  rotation?: number; // degrees
  config?: Record<string, any>;
  /** Legacy params alias (deprecated) */
  params?: Record<string, any>;
  label?: string;
  state?: Record<string, any>;
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
}

/**
 * Runtime node with state available
 */
export interface RuntimeNode extends Node {
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
    config: Record<string, any>,
    node?: Node
  ): {
    outputs: NodeOutputs;
    state: Record<string, any>;
  };
}

/**
 * Node definition used by registry-based engines
 */
export interface NodeDefinition {
  type: string;
  inputs?: string[];
  outputs?: string[];
  update: (
    node: RuntimeNode,
    inputs: Record<string, LogicValue>,
    dt?: number,
    tickIndex?: number
  ) => Record<string, LogicValue>;
}

/**
 * Circuit schema V1 (normalized)
 */
export interface CircuitSchemaV1Node {
  id: string;
  type: string;
  position?: Position;
  rotation?: number;
  config?: Record<string, any>;
  state?: Record<string, any>;
}

export interface CircuitSchemaV1 {
  version: 1;
  nodes: CircuitSchemaV1Node[];
  connections: Connection[];
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
