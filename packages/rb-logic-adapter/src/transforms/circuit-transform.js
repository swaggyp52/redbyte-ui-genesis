import { normalizeConnection } from '@redbyte/rb-logic-core';
import { calculatePortPosition, getNodeDimensions, pos } from './shared-helpers';
/**
 * Circuit transform - nodes positioned exactly as in engine
 */
export function circuitTransform(circuit) {
    const nodes = circuit.nodes.map((node) => {
        const { width, height } = getNodeDimensions(node.type);
        const ports = {};
        // Input port
        if (!['PowerSource', 'Clock'].includes(node.type)) {
            ports.in = calculatePortPosition(node, 'in', width, height);
        }
        // Output port
        if (!['Lamp'].includes(node.type)) {
            ports.out = calculatePortPosition(node, 'out', width, height);
        }
        return {
            id: node.id,
            type: node.type,
            view: {
                x: pos(node).x,
                y: pos(node).y,
                w: width,
                h: height,
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
            };
        }
        const fromNodeView = nodes.find((n) => n.id === fromNode.id);
        const toNodeView = nodes.find((n) => n.id === toNode.id);
        return {
            id: `${fromRef.nodeId}.${fromRef.portName}-${toRef.nodeId}.${toRef.portName}`,
            from: fromNodeView.ports[fromRef.portName] || { x: pos(fromNode).x, y: pos(fromNode).y },
            to: toNodeView.ports[toRef.portName] || { x: pos(toNode).x, y: pos(toNode).y },
        };
    });
    return { nodes, wires };
}
