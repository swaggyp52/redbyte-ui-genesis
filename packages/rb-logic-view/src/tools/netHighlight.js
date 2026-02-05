// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
const toPortRefKey = (nodeId, portName) => `${nodeId}.${portName}`;
const normalizeConnectionEndpoints = (conn) => {
    const fromIsString = typeof conn.from === 'string';
    const toIsString = typeof conn.to === 'string';
    const fromNodeId = fromIsString ? conn.from : conn.from.nodeId;
    const toNodeId = toIsString ? conn.to : conn.to.nodeId;
    const fromPortName = fromIsString
        ? (conn.fromPin ?? conn.fromPort ?? 'out')
        : (conn.from.portName ?? conn.from.port ?? conn.fromPin ?? conn.fromPort ?? 'out');
    const toPortName = toIsString
        ? (conn.toPin ?? conn.toPort ?? 'in')
        : (conn.to.portName ?? conn.to.port ?? conn.toPin ?? conn.toPort ?? 'in');
    return { fromNodeId, fromPortName, toNodeId, toPortName };
};
export const getWireIdForConnection = (conn) => {
    const e = normalizeConnectionEndpoints(conn);
    return `${e.fromNodeId}.${e.fromPortName}-${e.toNodeId}.${e.toPortName}`;
};
class UnionFind {
    parent = new Map();
    rank = new Map();
    ensure(x) {
        if (this.parent.has(x))
            return;
        this.parent.set(x, x);
        this.rank.set(x, 0);
    }
    find(x) {
        this.ensure(x);
        const p = this.parent.get(x);
        if (p === x)
            return x;
        const root = this.find(p);
        this.parent.set(x, root);
        return root;
    }
    union(a, b) {
        const ra = this.find(a);
        const rb = this.find(b);
        if (ra === rb)
            return;
        const rankA = this.rank.get(ra) ?? 0;
        const rankB = this.rank.get(rb) ?? 0;
        if (rankA < rankB) {
            this.parent.set(ra, rb);
            return;
        }
        if (rankA > rankB) {
            this.parent.set(rb, ra);
            return;
        }
        this.parent.set(rb, ra);
        this.rank.set(ra, rankA + 1);
    }
}
const fnv1a32Hex = (input) => {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
};
const stableNetIdForPorts = (portKeys) => {
    const sorted = [...portKeys].sort((a, b) => a.localeCompare(b));
    const joined = sorted.join('|');
    return `net-${fnv1a32Hex(joined)}`;
};
export const computeWireNetIds = (connections) => {
    const uf = new UnionFind();
    const edges = connections
        .map((conn) => {
        const e = normalizeConnectionEndpoints(conn);
        const fromKey = toPortRefKey(e.fromNodeId, e.fromPortName);
        const toKey = toPortRefKey(e.toNodeId, e.toPortName);
        const wireId = `${e.fromNodeId}.${e.fromPortName}-${e.toNodeId}.${e.toPortName}`;
        return { wireId, fromKey, toKey };
    })
        .sort((a, b) => a.wireId.localeCompare(b.wireId));
    for (const edge of edges) {
        uf.union(edge.fromKey, edge.toKey);
    }
    const rootToPorts = new Map();
    for (const edge of edges) {
        const r1 = uf.find(edge.fromKey);
        const r2 = uf.find(edge.toKey);
        if (!rootToPorts.has(r1))
            rootToPorts.set(r1, []);
        if (!rootToPorts.has(r2))
            rootToPorts.set(r2, []);
        rootToPorts.get(r1).push(edge.fromKey);
        rootToPorts.get(r1).push(edge.toKey);
        if (r2 !== r1) {
            rootToPorts.get(r2).push(edge.fromKey);
            rootToPorts.get(r2).push(edge.toKey);
        }
    }
    const rootToNetId = new Map();
    for (const [root, ports] of rootToPorts.entries()) {
        const unique = Array.from(new Set(ports));
        rootToNetId.set(root, stableNetIdForPorts(unique));
    }
    const result = new Map();
    for (const edge of edges) {
        const root = uf.find(edge.fromKey);
        const netId = rootToNetId.get(root) ?? stableNetIdForPorts([edge.fromKey, edge.toKey]);
        result.set(edge.wireId, netId);
    }
    return result;
};

