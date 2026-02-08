// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Circuit complexity metrics for classroom guardrails
export function calculateComplexity(circuit) {
    const nodes = Array.isArray(circuit.nodes) ? circuit.nodes : [];
    const connections = Array.isArray(circuit.connections) ? circuit.connections : [];
    // Count fan-out per node
    const fanOutMap = new Map();
    connections.forEach((conn) => {
        if (conn?.from?.nodeId) {
            fanOutMap.set(conn.from.nodeId, (fanOutMap.get(conn.from.nodeId) || 0) + 1);
        }
    });
    const maxFanOut = fanOutMap.size > 0 ? Math.max(...fanOutMap.values()) : 0;
    return {
        nodeCount: nodes.length,
        edgeCount: connections.length,
        maxFanOut,
    };
}
export function shouldBlockNodePlacement(nodeCount) {
    return nodeCount >= 20;
}
export function shouldWarnComplexity(nodeCount) {
    return nodeCount >= 15;
}
