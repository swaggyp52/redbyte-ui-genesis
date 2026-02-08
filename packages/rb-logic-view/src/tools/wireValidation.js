// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
const normalizeExistingConnection = (conn) => {
    const fromIsString = typeof conn.from === 'string';
    const toIsString = typeof conn.to === 'string';
    const fromNodeId = fromIsString ? conn.from : conn.from.nodeId;
    const toNodeId = toIsString ? conn.to : conn.to.nodeId;
    const fromPortName = fromIsString
        ? conn.fromPin ?? conn.fromPort ?? 'out'
        : conn.from.portName ?? conn.from.port ?? conn.fromPin ?? conn.fromPort ?? 'out';
    const toPortName = toIsString
        ? conn.toPin ?? conn.toPort ?? 'in'
        : conn.to.portName ?? conn.to.port ?? conn.toPin ?? conn.toPort ?? 'in';
    return {
        from: { nodeId: fromNodeId, portName: fromPortName },
        to: { nodeId: toNodeId, portName: toPortName },
    };
};
/**
 * Determine if a port is an input or output based on naming convention and metadata
 */
export function isInputPort(nodeId, portName, circuit, getChipMetadata) {
    const node = circuit.nodes.find(n => n.id === nodeId);
    if (!node)
        return false;
    // Check chip metadata first
    if (getChipMetadata) {
        const chipMeta = getChipMetadata(node.type);
        if (chipMeta) {
            return chipMeta.inputs.some(input => input.id === portName);
        }
    }
    // Fallback to naming convention
    // Most nodes use "in", "in1", "in2" for inputs and "out" for outputs
    return portName.startsWith('in');
}
/**
 * Check if a connection would be valid
 */
export function isValidConnection(from, to, circuit, getChipMetadata) {
    // Prevent self-loops
    if (from.nodeId === to.nodeId) {
        return { valid: false, reason: 'Cannot connect node to itself' };
    }
    // Check if connection already exists
    const duplicate = circuit.connections.some((conn) => {
        const normalized = normalizeExistingConnection(conn);
        return ((normalized.from.nodeId === from.nodeId &&
            normalized.from.portName === from.portName &&
            normalized.to.nodeId === to.nodeId &&
            normalized.to.portName === to.portName) ||
            (normalized.from.nodeId === to.nodeId &&
                normalized.from.portName === to.portName &&
                normalized.to.nodeId === from.nodeId &&
                normalized.to.portName === from.portName));
    });
    if (duplicate) {
        return { valid: false, reason: 'Connection already exists' };
    }
    // Determine port directions
    const fromIsInput = isInputPort(from.nodeId, from.portName, circuit, getChipMetadata);
    const toIsInput = isInputPort(to.nodeId, to.portName, circuit, getChipMetadata);
    // Prevent input->input or output->output connections
    if (fromIsInput === toIsInput) {
        if (fromIsInput) {
            return { valid: false, reason: 'Cannot connect input to input' };
        }
        else {
            return { valid: false, reason: 'Cannot connect output to output' };
        }
    }
    // Valid connection
    return { valid: true };
}
/**
 * Normalize connection to always go from output to input
 */
export function normalizeConnection(from, to, circuit, getChipMetadata) {
    const fromIsInput = isInputPort(from.nodeId, from.portName, circuit, getChipMetadata);
    // If from is input and to is output, swap them
    if (fromIsInput) {
        return { from: to, to: from };
    }
    // Otherwise keep as-is (from is output, to is input)
    return { from, to };
}
