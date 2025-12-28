// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit, Node, Connection } from '../types';

/**
 * Browser-compatible SHA-256 hash using Web Crypto API
 */
async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Normalized circuit state for deterministic hashing.
 * All collections are sorted arrays to eliminate Map/Set iteration nondeterminism.
 */
export interface NormalizedCircuitState {
  nodes: NormalizedNode[];
  connections: NormalizedConnection[];
}

interface NormalizedNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  rotation: number;
  config: Array<[string, any]>; // Sorted key-value pairs
  state: Array<[string, any]>; // Sorted key-value pairs
}

interface NormalizedConnection {
  from: { nodeId: string; portName: string };
  to: { nodeId: string; portName: string };
}

/**
 * Normalize a Record<string, any> into sorted key-value pairs
 * Handles nested objects recursively for deterministic serialization
 */
function normalizeRecord(obj: Record<string, any> | undefined): Array<[string, any]> {
  if (!obj || typeof obj !== 'object') {
    return [];
  }

  const keys = Object.keys(obj).sort();
  return keys.map((key) => {
    const value = obj[key];
    // Recursively normalize nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return [key, normalizeRecord(value)];
    }
    return [key, value];
  });
}

/**
 * Normalize a Circuit into a deterministic representation.
 * Sorts all collections and converts Maps/objects to sorted arrays.
 */
export function normalizeCircuitState(circuit: Circuit): NormalizedCircuitState {
  // Sort nodes by ID
  const sortedNodes = [...circuit.nodes].sort((a, b) => a.id.localeCompare(b.id));

  const nodes: NormalizedNode[] = sortedNodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: node.position ? { x: node.position.x, y: node.position.y } : { x: 0, y: 0 },
    rotation: node.rotation,
    config: normalizeRecord(node.config),
    state: normalizeRecord(node.state),
  }));

  // Sort connections by a stable key (from.nodeId, from.portName, to.nodeId, to.portName)
  const sortedConnections = [...circuit.connections].sort((a, b) => {
    const aKey = `${a.from.nodeId}:${a.from.portName}:${a.to.nodeId}:${a.to.portName}`;
    const bKey = `${b.from.nodeId}:${b.from.portName}:${b.to.nodeId}:${b.to.portName}`;
    return aKey.localeCompare(bKey);
  });

  const connections: NormalizedConnection[] = sortedConnections.map((conn) => ({
    from: { nodeId: conn.from.nodeId, portName: conn.from.portName },
    to: { nodeId: conn.to.nodeId, portName: conn.to.portName },
  }));

  return { nodes, connections };
}

/**
 * Serialize normalized state to a deterministic JSON string.
 * Uses explicit key ordering and no whitespace.
 */
export function serializeNormalizedState(normalized: NormalizedCircuitState): string {
  return JSON.stringify(normalized);
}

/**
 * Hash a circuit state using SHA-256.
 * Returns a hex-encoded hash string.
 *
 * Browser-compatible using Web Crypto API.
 */
export async function hashCircuitState(circuit: Circuit): Promise<string> {
  const normalized = normalizeCircuitState(circuit);
  const serialized = serializeNormalizedState(normalized);
  const hash = await sha256(serialized);
  return hash;
}

/**
 * Extended circuit state including runtime signals from LogicEngine.
 * Signals are stored as Map<nodeId, Map<portName, value>> in LogicEngine.
 */
export interface CircuitRuntimeState {
  circuit: Circuit;
  signals: Map<string, Map<string, number>>;
}

/**
 * Normalized runtime state with sorted signals
 */
export interface NormalizedRuntimeState extends NormalizedCircuitState {
  signals: Array<{
    nodeId: string;
    ports: Array<[string, number]>; // Sorted port name -> value pairs
  }>;
}

/**
 * Normalize runtime state including signals.
 * Converts all Maps to sorted arrays for deterministic hashing.
 */
export function normalizeRuntimeState(state: CircuitRuntimeState): NormalizedRuntimeState {
  const circuitState = normalizeCircuitState(state.circuit);

  // Convert signals Map<nodeId, Map<portName, value>> to sorted arrays
  const nodeIds = Array.from(state.signals.keys()).sort();
  const signals = nodeIds.map((nodeId) => {
    const portMap = state.signals.get(nodeId)!;
    const portNames = Array.from(portMap.keys()).sort();
    const ports: Array<[string, number]> = portNames.map((portName) => [
      portName,
      portMap.get(portName)!,
    ]);
    return { nodeId, ports };
  });

  return {
    ...circuitState,
    signals,
  };
}

/**
 * Hash runtime state (circuit + signals)
 */
export async function hashRuntimeState(state: CircuitRuntimeState): Promise<string> {
  const normalized = normalizeRuntimeState(state);
  const serialized = JSON.stringify(normalized);
  const hash = await sha256(serialized);
  return hash;
}
