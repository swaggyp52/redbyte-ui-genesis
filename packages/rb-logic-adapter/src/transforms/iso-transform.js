// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { getNodeDimensions } from './shared-helpers';
/**
 * Isometric projection formula
 */
function toIsometric(x, y, z = 0) {
    return {
        x: (x - y),
        y: (x + y) * 0.5 - z,
    };
}
/**
 * Isometric transform - 2.5D projection
 */
export function isometricTransform(circuit) {
    // TRACK POSITIONS TO PREVENT STACKING
    const positionCounts = new Map();
    const nodes = circuit.nodes.map((node) => {
        const { width, height } = getNodeDimensions(node.type);
        let x = node.position.x;
        let y = node.position.y;
        // DETERMINISTIC AUTO-SPACING for stacked components (usually at 0,0)
        const posKey = `${x},${y}`;
        const count = positionCounts.get(posKey) || 0;
        positionCounts.set(posKey, count + 1);
        if (count > 0) {
            // Offset in a grid pattern (approx 8 units apart)
            const offset = 8;
            const cols = 5;
            x += (count % cols) * offset;
            y += Math.floor(count / cols) * offset;
        }
        // Convert to isometric coordinates
        const iso = toIsometric(x, y, 0);
        const ports = {};
        // Input port (isometric)
        if (!['PowerSource', 'Clock'].includes(node.type)) {
            const inputIso = toIsometric(x - width / 2, y, 0);
            ports.in = inputIso;
        }
        // Output port (isometric)
        if (!['Lamp'].includes(node.type)) {
            const outputIso = toIsometric(x + width / 2, y, 0);
            ports.out = outputIso;
        }
        return {
            id: node.id,
            type: node.type,
            view: {
                x: iso.x,
                y: iso.y,
                z: 0,
                w: width,
                h: height,
            },
            ports,
        };
    });
    // Sort nodes by depth (back to front rendering)
    nodes.sort((a, b) => (a.view.y + (a.view.z || 0)) - (b.view.y + (b.view.z || 0)));
    const wires = circuit.connections.map((conn, idx) => {
        const fromNode = circuit.nodes.find((n) => n.id === conn.from.nodeId);
        const toNode = circuit.nodes.find((n) => n.id === conn.to.nodeId);
        if (!fromNode || !toNode) {
            return {
                id: `wire_${idx}`,
                from: { x: 0, y: 0 },
                to: { x: 0, y: 0 },
            };
        }
        const fromNodeView = nodes.find((n) => n.id === fromNode.id);
        const toNodeView = nodes.find((n) => n.id === toNode.id);
        return {
            id: `${conn.from.nodeId}.${conn.from.portName}-${conn.to.nodeId}.${conn.to.portName}`,
            from: fromNodeView.ports[conn.from.portName] || { x: fromNodeView.view.x, y: fromNodeView.view.y },
            to: toNodeView.ports[conn.to.portName] || { x: toNodeView.view.x, y: toNodeView.view.y },
        };
    });
    return { nodes, wires };
}
