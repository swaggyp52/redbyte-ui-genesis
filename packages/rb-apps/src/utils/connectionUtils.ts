import type { Connection, PortRef } from '@redbyte/rb-logic-core';

/**
 * Extracts the node ID from a connection reference (string or PortRef).
 */
export function getConnectionNodeId(ref: PortRef | string): string {
    if (typeof ref === 'string') return ref;
    return ref.nodeId;
}

/**
 * Extracts the port name from a connection, with a fallback.
 */
export function getConnectionPort(
    conn: Connection,
    side: 'from' | 'to',
    fallback: string = 'out'
): string {
    const ref = conn[side];
    if (typeof ref === 'string') {
        // Legacy support for fromPin/toPin properties
        if (side === 'from') return conn.fromPin || conn.fromPort || fallback;
        return conn.toPin || conn.toPort || fallback;
    }
    return ref.portName || ref.port || fallback;
}
