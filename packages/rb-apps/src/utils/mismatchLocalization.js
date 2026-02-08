// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
export const buildSuspectSet = (circuit, targets, maxDepth) => {
    const nodeIds = new Set();
    const wireIds = new Set();
    const queue = [];
    targets.forEach((target) => {
        nodeIds.add(target.nodeId);
        queue.push({ nodeId: target.nodeId, depth: 0 });
    });
    while (queue.length > 0) {
        const current = queue.shift();
        if (!current)
            break;
        if (current.depth >= maxDepth)
            continue;
        circuit.connections.forEach((connection) => {
            if (connection.to.nodeId !== current.nodeId)
                return;
            const wireId = `${connection.from.nodeId}.${connection.from.portName}-${connection.to.nodeId}.${connection.to.portName}`;
            wireIds.add(wireId);
            if (!nodeIds.has(connection.from.nodeId)) {
                nodeIds.add(connection.from.nodeId);
                queue.push({ nodeId: connection.from.nodeId, depth: current.depth + 1 });
            }
        });
    }
    return { nodeIds, wireIds };
};
