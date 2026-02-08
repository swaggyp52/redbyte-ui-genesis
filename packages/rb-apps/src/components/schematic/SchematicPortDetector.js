// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * Calculate port positions for schematic symbols
 * Input ports on left, output ports on right
 */
export function getPortPositions(node, nodeX, nodeY) {
    const positions = [];
    // Standard gate dimensions (matching GateSymbols component)
    // Gates have input legs at y=10 and y=30 (relative to node origin)
    // Gates have output at x=60 (relative to node origin)
    const nodeHeight = 40;
    const nodeWidth = 60; // Updated to match actual gate width
    // For most gates: 2 inputs on left, 1 output on right
    switch (node.type) {
        case 'AND':
        case 'OR':
        case 'NAND':
        case 'NOR':
        case 'XOR':
        case 'XNOR':
            // Input ports (left side) - matching InputLegs at y=10 and y=30
            positions.push({
                nodeId: node.id,
                portName: 'in1',
                x: nodeX - 10, // Input leg starts at -10
                y: nodeY + 10, // First input leg at y=10
            });
            positions.push({
                nodeId: node.id,
                portName: 'in2',
                x: nodeX - 10, // Input leg starts at -10
                y: nodeY + 30, // Second input leg at y=30
            });
            // Output port (right side) - matching output leg at x=60
            positions.push({
                nodeId: node.id,
                portName: 'output',
                x: nodeX + nodeWidth, // Output leg at x=60
                y: nodeY + 20,
            });
            break;
        case 'NOT':
        case 'Inverter':
            // Single input (left) - matching SingleInputLeg at y=20
            positions.push({
                nodeId: node.id,
                portName: 'input',
                x: nodeX - 10, // Input leg starts at -10
                y: nodeY + 20, // Single input at y=20
            });
            // Output (right) - matching output leg at x=60
            positions.push({
                nodeId: node.id,
                portName: 'output',
                x: nodeX + nodeWidth, // Output leg at x=60
                y: nodeY + 20,
            });
            break;
        case 'PowerSource':
        case 'Switch':
        case 'Clock':
            // No inputs, single output at x=60
            positions.push({
                nodeId: node.id,
                portName: 'output',
                x: nodeX + nodeWidth, // Output leg at x=60
                y: nodeY + 20,
            });
            break;
        case 'Lamp':
        case 'LED':
        case 'Probe':
            // Single input at x=-10, no output
            positions.push({
                nodeId: node.id,
                portName: 'input',
                x: nodeX - 10, // Input leg starts at -10
                y: nodeY + 20,
            });
            break;
        default:
            // Generic: assume 1 input and 1 output
            positions.push({
                nodeId: node.id,
                portName: 'input',
                x: nodeX - 10,
                y: nodeY + 20,
            });
            positions.push({
                nodeId: node.id,
                portName: 'output',
                x: nodeX + nodeWidth,
                y: nodeY + 20,
            });
            break;
    }
    return positions;
}
/**
 * Find the nearest port to a given point
 */
export function findNearestPort(x, y, portPositions, maxDistance = 20) {
    let nearest = null;
    let minDistance = maxDistance;
    for (const port of portPositions) {
        const dx = port.x - x;
        const dy = port.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < minDistance) {
            minDistance = distance;
            nearest = port;
        }
    }
    return nearest;
}
