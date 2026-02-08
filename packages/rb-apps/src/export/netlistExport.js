// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { digestCircuit } from '../recording/runRecordUtils';
const BUILTIN_PORTS = {
    PowerSource: [{ name: 'out', direction: 'out' }],
    Switch: [{ name: 'out', direction: 'out' }],
    INPUT: [{ name: 'out', direction: 'out' }],
    Lamp: [{ name: 'in', direction: 'in' }],
    OUTPUT: [{ name: 'in', direction: 'in' }],
    Wire: [
        { name: 'in', direction: 'in' },
        { name: 'out', direction: 'out' },
    ],
    Clock: [{ name: 'out', direction: 'out' }],
    Delay: [
        { name: 'in', direction: 'in' },
        { name: 'out', direction: 'out' },
    ],
    AND: [
        { name: 'a', direction: 'in' },
        { name: 'b', direction: 'in' },
        { name: 'out', direction: 'out' },
    ],
    NAND: [
        { name: 'a', direction: 'in' },
        { name: 'b', direction: 'in' },
        { name: 'out', direction: 'out' },
    ],
    OR: [
        { name: 'a', direction: 'in' },
        { name: 'b', direction: 'in' },
        { name: 'out', direction: 'out' },
    ],
    NOR: [
        { name: 'a', direction: 'in' },
        { name: 'b', direction: 'in' },
        { name: 'out', direction: 'out' },
    ],
    XOR: [
        { name: 'a', direction: 'in' },
        { name: 'b', direction: 'in' },
        { name: 'out', direction: 'out' },
    ],
    XNOR: [
        { name: 'a', direction: 'in' },
        { name: 'b', direction: 'in' },
        { name: 'out', direction: 'out' },
    ],
};
const normalizeConnection = (connection) => {
    const fromIsString = typeof connection.from === 'string';
    const toIsString = typeof connection.to === 'string';
    const fromNodeId = fromIsString ? connection.from : connection.from.nodeId;
    const toNodeId = toIsString ? connection.to : connection.to.nodeId;
    const fromPort = fromIsString
        ? connection.fromPin ?? connection.fromPort ?? 'out'
        : connection.from.portName ?? connection.from.port ?? connection.fromPin ?? connection.fromPort ?? 'out';
    const toPort = toIsString
        ? connection.toPin ?? connection.toPort ?? 'in'
        : connection.to.portName ?? connection.to.port ?? connection.toPin ?? connection.toPort ?? 'in';
    return {
        from: { nodeId: fromNodeId, port: fromPort },
        to: { nodeId: toNodeId, port: toPort },
    };
};
const connectionId = (connection) => {
    const normalized = normalizeConnection(connection);
    return `${normalized.from.nodeId}.${normalized.from.port}->${normalized.to.nodeId}.${normalized.to.port}`;
};
const inferPortsFromConnections = (node, connections) => {
    const portMap = new Map();
    connections.forEach((connection) => {
        const normalized = normalizeConnection(connection);
        if (normalized.from.nodeId === node.id) {
            portMap.set(normalized.from.port, 'out');
        }
        if (normalized.to.nodeId === node.id) {
            portMap.set(normalized.to.port, 'in');
        }
    });
    return Array.from(portMap.entries())
        .map(([name, direction]) => ({ name, direction }))
        .sort((a, b) => a.name.localeCompare(b.name));
};
export const netlistFromCircuit = (circuit) => {
    const nodes = [...circuit.nodes].sort((a, b) => a.id.localeCompare(b.id)).map((node) => {
        const builtinPorts = BUILTIN_PORTS[node.type];
        const inferredPorts = inferPortsFromConnections(node, circuit.connections);
        const ports = builtinPorts
            ? [...builtinPorts]
            : inferredPorts.length > 0
                ? inferredPorts
                : [];
        return {
            id: node.id,
            type: node.type,
            ports,
        };
    });
    const nets = [...circuit.connections]
        .map((connection) => {
        const normalized = normalizeConnection(connection);
        return {
            id: connectionId(connection),
            from: normalized.from,
            to: normalized.to,
        };
    })
        .sort((a, b) => a.id.localeCompare(b.id));
    return {
        kind: 'rb-netlist',
        version: 1,
        createdAt: new Date().toISOString(),
        circuitDigest: digestCircuit(circuit),
        nodes,
        nets,
    };
};
