import { normalizeConnection } from '@redbyte/rb-logic-core';
import { getNodeDimensions, manhattanRoute, pos } from './shared-helpers';
/**
 * Schematic transform - symbolic representation with Manhattan routing
 */
export function schematicTransform(circuit) {
    const nodes = circuit.nodes.map((node) => {
        const { width, height } = getNodeDimensions(node.type);
        // Use symbolic sizes for schematic
        const schematicWidth = width * 1.2;
        const schematicHeight = height * 0.8;
        const ports = {};
        // Input port
        if (!['PowerSource', 'Clock'].includes(node.type)) {
            ports.in = { x: pos(node).x - schematicWidth / 2, y: pos(node).y };
        }
        // Output port
        if (!['Lamp'].includes(node.type)) {
            ports.out = { x: pos(node).x + schematicWidth / 2, y: pos(node).y };
        }
        return {
            id: node.id,
            type: node.type,
            view: {
                x: pos(node).x,
                y: pos(node).y,
                w: schematicWidth,
                h: schematicHeight,
            },
            ports,
        };
    });
    const wires = circuit.connections.map((conn, idx) => {
        const { from: fromRef, to: toRef } = normalizeConnection(conn);
        const fromNode = circuit.nodes.find((n) => n.id === fromRef.nodeId);
        const toNode = circuit.nodes.find((n) => n.id === toRef.nodeId);
        if (!fromNode || !toNode) {
            return {
                id: `wire_${idx}`,
                from: { x: 0, y: 0 },
                to: { x: 0, y: 0 },
                points: [],
            };
        }
        const fromNodeView = nodes.find((n) => n.id === fromNode.id);
        const toNodeView = nodes.find((n) => n.id === toNode.id);
        const from = fromNodeView.ports[fromRef.portName] || { x: pos(fromNode).x, y: pos(fromNode).y };
        const to = toNodeView.ports[toRef.portName] || { x: pos(toNode).x, y: pos(toNode).y };
        // Use Manhattan routing for schematic wires
        const points = manhattanRoute(from, to);
        return {
            id: `${fromRef.nodeId}.${fromRef.portName}-${toRef.nodeId}.${toRef.portName}`,
            from,
            to,
            points,
        };
    });
    return { nodes, wires };
}
