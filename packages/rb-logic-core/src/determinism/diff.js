// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * Compute the structural diff between two circuit state snapshots.
 *
 * Compares:
 * - Node additions/removals
 * - Node state changes (e.g., switch isOn)
 * - Signal value changes
 * - Connection additions/removals
 *
 * This function is deterministic and pure - same inputs always produce the same output.
 *
 * @param before - Earlier snapshot
 * @param after - Later snapshot
 * @returns Structural diff showing all changes
 */
export function diffState(before, after) {
    const diff = {
        nodesAdded: [],
        nodesRemoved: [],
        nodeStateChanges: [],
        signalChanges: [],
        connectionChanges: [],
        hasChanges: false,
    };
    // Build node ID sets for quick lookup
    const beforeNodeIds = new Set(before.circuit.nodes.map((n) => n.id));
    const afterNodeIds = new Set(after.circuit.nodes.map((n) => n.id));
    // Find added nodes (in 'after' but not in 'before')
    for (const node of after.circuit.nodes) {
        if (!beforeNodeIds.has(node.id)) {
            diff.nodesAdded.push({
                nodeId: node.id,
                nodeType: node.type,
                node,
            });
        }
    }
    // Find removed nodes (in 'before' but not in 'after')
    for (const node of before.circuit.nodes) {
        if (!afterNodeIds.has(node.id)) {
            diff.nodesRemoved.push({
                nodeId: node.id,
                nodeType: node.type,
                node,
            });
        }
    }
    // Find node state changes (nodes present in both, but with different state)
    const beforeNodesMap = new Map(before.circuit.nodes.map((n) => [n.id, n]));
    const afterNodesMap = new Map(after.circuit.nodes.map((n) => [n.id, n]));
    for (const nodeId of beforeNodeIds) {
        if (afterNodeIds.has(nodeId)) {
            const beforeNode = beforeNodesMap.get(nodeId);
            const afterNode = afterNodesMap.get(nodeId);
            // Compare node state
            const beforeState = beforeNode.state ?? {};
            const afterState = afterNode.state ?? {};
            const changedKeys = [];
            // Find all keys that exist in either state
            const allKeys = new Set([...Object.keys(beforeState), ...Object.keys(afterState)]);
            for (const key of allKeys) {
                const beforeValue = beforeState[key];
                const afterValue = afterState[key];
                // Deep equality check (simple JSON comparison)
                if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
                    changedKeys.push(key);
                }
            }
            if (changedKeys.length > 0) {
                diff.nodeStateChanges.push({
                    nodeId,
                    nodeType: beforeNode.type,
                    stateBefore: beforeState,
                    stateAfter: afterState,
                    changedKeys,
                });
            }
        }
    }
    // Find signal changes
    // Build signal maps for easy comparison
    const beforeSignals = new Map();
    for (const [nodeId, portMap] of before.signals.entries()) {
        beforeSignals.set(nodeId, new Map(portMap));
    }
    const afterSignals = new Map();
    for (const [nodeId, portMap] of after.signals.entries()) {
        afterSignals.set(nodeId, new Map(portMap));
    }
    // Find all node IDs that have signals in either snapshot
    const allSignalNodeIds = new Set([...beforeSignals.keys(), ...afterSignals.keys()]);
    for (const nodeId of allSignalNodeIds) {
        const beforePortMap = beforeSignals.get(nodeId) ?? new Map();
        const afterPortMap = afterSignals.get(nodeId) ?? new Map();
        // Find all port names in either map
        const allPortNames = new Set([...beforePortMap.keys(), ...afterPortMap.keys()]);
        for (const portName of allPortNames) {
            const beforeValue = beforePortMap.get(portName) ?? 0;
            const afterValue = afterPortMap.get(portName) ?? 0;
            if (beforeValue !== afterValue) {
                diff.signalChanges.push({
                    nodeId,
                    portName,
                    valueBefore: beforeValue,
                    valueAfter: afterValue,
                });
            }
        }
    }
    // Find connection changes
    // Build connection sets using a stable string key
    const beforeConnections = new Set(before.circuit.connections.map((c) => `${c.from.nodeId}:${c.from.portName}→${c.to.nodeId}:${c.to.portName}`));
    const afterConnections = new Set(after.circuit.connections.map((c) => `${c.from.nodeId}:${c.from.portName}→${c.to.nodeId}:${c.to.portName}`));
    // Find added connections (in 'after' but not in 'before')
    for (const conn of after.circuit.connections) {
        const key = `${conn.from.nodeId}:${conn.from.portName}→${conn.to.nodeId}:${conn.to.portName}`;
        if (!beforeConnections.has(key)) {
            diff.connectionChanges.push({
                type: 'added',
                from: conn.from,
                to: conn.to,
            });
        }
    }
    // Find removed connections (in 'before' but not in 'after')
    for (const conn of before.circuit.connections) {
        const key = `${conn.from.nodeId}:${conn.from.portName}→${conn.to.nodeId}:${conn.to.portName}`;
        if (!afterConnections.has(key)) {
            diff.connectionChanges.push({
                type: 'removed',
                from: conn.from,
                to: conn.to,
            });
        }
    }
    // Determine if there are any changes
    diff.hasChanges =
        diff.nodesAdded.length > 0 ||
            diff.nodesRemoved.length > 0 ||
            diff.nodeStateChanges.length > 0 ||
            diff.signalChanges.length > 0 ||
            diff.connectionChanges.length > 0;
    return diff;
}
