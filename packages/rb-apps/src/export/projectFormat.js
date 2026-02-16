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
const normalizeProbes = (probes) => {
    if (!probes)
        return probes;
    return [...probes]
        .map((probe) => ({ ...probe }))
        .sort((a, b) => {
        const left = `${a.nodeId}.${a.portName}.${a.id}`;
        const right = `${b.nodeId}.${b.portName}.${b.id}`;
        return left.localeCompare(right);
    });
};
const normalizeHdl = (hdl) => {
    if (!hdl)
        return hdl;
    const sources = [...(hdl.sources ?? [])]
        .map((source) => ({ ...source }))
        .sort((a, b) => {
        const left = `${a.path}.${a.language}`;
        const right = `${b.path}.${b.language}`;
        return left.localeCompare(right);
    });
    return {
        ...hdl,
        sources,
    };
};
export const encodeRBProject = (project) => {
    const sortedTags = project.meta?.tags ? [...project.meta.tags].sort((a, b) => a.localeCompare(b)) : undefined;
    const normalized = {
        ...project,
        circuit: normalizeProjectCircuit(project.circuit),
        probes: normalizeProbes(project.probes),
        hdl: normalizeHdl(project.hdl),
        meta: project.meta
            ? {
                ...project.meta,
                tags: sortedTags,
            }
            : undefined,
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
