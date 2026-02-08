// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * Browser-compatible SHA-256 hash using Web Crypto API
 */
async function sha256(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}
/**
 * Normalize a Record<string, any> into sorted key-value pairs
 * Handles nested objects recursively for deterministic serialization
 */
function normalizeRecord(obj) {
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
export function normalizeCircuitState(circuit) {
    // Sort nodes by ID
    const sortedNodes = [...circuit.nodes].sort((a, b) => a.id.localeCompare(b.id));
    const nodes = sortedNodes.map((node) => ({
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
    const connections = sortedConnections.map((conn) => ({
        from: { nodeId: conn.from.nodeId, portName: conn.from.portName },
        to: { nodeId: conn.to.nodeId, portName: conn.to.portName },
    }));
    return { nodes, connections };
}
/**
 * Serialize normalized state to a deterministic JSON string.
 * Uses explicit key ordering and no whitespace.
 */
export function serializeNormalizedState(normalized) {
    return JSON.stringify(normalized);
}
/**
 * Hash a circuit state using SHA-256.
 * Returns a hex-encoded hash string.
 *
 * Browser-compatible using Web Crypto API.
 */
export async function hashCircuitState(circuit) {
    const normalized = normalizeCircuitState(circuit);
    const serialized = serializeNormalizedState(normalized);
    const hash = await sha256(serialized);
    return hash;
}
/**
 * Normalize runtime state including signals.
 * Converts all Maps to sorted arrays for deterministic hashing.
 */
export function normalizeRuntimeState(state) {
    const circuitState = normalizeCircuitState(state.circuit);
    // Convert signals Map<nodeId, Map<portName, value>> to sorted arrays
    const nodeIds = Array.from(state.signals.keys()).sort();
    const signals = nodeIds.map((nodeId) => {
        const portMap = state.signals.get(nodeId);
        const portNames = Array.from(portMap.keys()).sort();
        const ports = portNames.map((portName) => [
            portName,
            portMap.get(portName),
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
export async function hashRuntimeState(state) {
    const normalized = normalizeRuntimeState(state);
    const serialized = JSON.stringify(normalized);
    const hash = await sha256(serialized);
    return hash;
}
