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
const connectionId = (connection) => `${connection.from.nodeId}.${connection.from.portName}->${connection.to.nodeId}.${connection.to.portName}`;
const inferPortsFromConnections = (node, connections) => {
    const portMap = new Map();
    connections.forEach((connection) => {
        if (connection.from.nodeId === node.id) {
            portMap.set(connection.from.portName, 'out');
        }
        if (connection.to.nodeId === node.id) {
            portMap.set(connection.to.portName, 'in');
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
        .map((connection) => ({
        id: connectionId(connection),
        from: { nodeId: connection.from.nodeId, port: connection.from.portName },
        to: { nodeId: connection.to.nodeId, port: connection.to.portName },
    }))
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
