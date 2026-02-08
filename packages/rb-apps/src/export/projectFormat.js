// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { stableStringify } from './stableStringify';
export const createRBProject = (input) => ({
    ...input,
    kind: 'rb-project',
    version: 1,
    updatedAt: new Date().toISOString(),
});
const normalizeProjectCircuit = (circuit) => {
    const nodes = [...circuit.nodes]
        .map((node) => ({
        ...node,
        config: node.config ?? {},
        state: node.state ?? {},
    }))
        .sort((a, b) => a.id.localeCompare(b.id));
    const connections = [...circuit.connections]
        .map((connection) => ({
        from: { nodeId: connection.from.nodeId, portName: connection.from.portName },
        to: { nodeId: connection.to.nodeId, portName: connection.to.portName },
    }))
        .sort((a, b) => {
        const left = `${a.from.nodeId}.${a.from.portName}->${a.to.nodeId}.${a.to.portName}`;
        const right = `${b.from.nodeId}.${b.from.portName}->${b.to.nodeId}.${b.to.portName}`;
        return left.localeCompare(right);
    });
    return { nodes, connections };
};
export const encodeRBProject = (project) => {
    const normalized = {
        ...project,
        circuit: normalizeProjectCircuit(project.circuit),
    };
    return stableStringify(normalized);
};
export const decodeRBProject = (raw) => {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid project: not an object');
    }
    if (parsed.kind !== 'rb-project' || parsed.version !== 1) {
        throw new Error('Invalid project: unsupported kind or version');
    }
    return parsed;
};
