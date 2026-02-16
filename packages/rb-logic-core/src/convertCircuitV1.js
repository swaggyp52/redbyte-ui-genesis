/**
 * Canonical converter between internal Circuit format and CircuitV1 (project format).
 *
 * This is the ONLY place these conversions should happen.
 * All apps and export paths must import from here.
 *
 * RC-P8 fix: Eliminates duplicate ad-hoc converters across the codebase.
 */
/**
 * Convert internal Circuit to CircuitV1 (project/serialization format).
 *
 * CRITICAL: Reads from node.position first (current format), falls back to legacy node.x/y.
 * This ensures positions are never lost (RC-P2).
 */
export function toCircuitV1(src) {
    return {
        schemaVersion: '1.0',
        nodes: src.nodes.map((node) => ({
            id: node.id,
            type: node.type,
            x: node.position?.x ?? node.x ?? 0,
            y: node.position?.y ?? node.y ?? 0,
            rotation: node.rotation || 0,
            params: node.config || {},
            label: node.label,
            state: node.state || {},
        })),
        connections: src.connections.map((conn) => ({
            id: conn.id,
            fromNodeId: typeof conn.from === 'string' ? conn.from : conn.from.nodeId,
            fromPin: conn.fromPin ||
                conn.fromPort ||
                (typeof conn.from === 'string'
                    ? undefined
                    : conn.from.portName || conn.from.port) ||
                'out',
            toNodeId: typeof conn.to === 'string' ? conn.to : conn.to.nodeId,
            toPin: conn.toPin ||
                conn.toPort ||
                (typeof conn.to === 'string'
                    ? undefined
                    : conn.to.portName || conn.to.port) ||
                'in',
        })),
        customChips: [],
    };
}
/**
 * Convert CircuitV1 (project format) to internal Circuit.
 *
 * CRITICAL: Creates position object from V1 x/y fields (RC-P2).
 * Also maintains legacy x/y fields for backward compatibility.
 */
export function fromCircuitV1(src) {
    return {
        nodes: src.nodes.map((node) => ({
            id: node.id,
            type: node.type,
            position: { x: node.x ?? 0, y: node.y ?? 0 }, // NEW format
            x: node.x, // Legacy field
            y: node.y, // Legacy field
            rotation: node.rotation,
            config: node.params || {},
            label: node.label,
            state: node.state || {},
            inputs: {},
            outputs: {},
        })),
        connections: src.connections.map((conn) => ({
            id: conn.id,
            from: { nodeId: conn.fromNodeId, portName: conn.fromPin },
            fromPin: conn.fromPin,
            to: { nodeId: conn.toNodeId, portName: conn.toPin },
            toPin: conn.toPin,
        })),
    };
}
