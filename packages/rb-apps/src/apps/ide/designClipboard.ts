/**
 * designClipboard.ts — deterministic copy/paste serialization for the Design editor.
 *
 * These are pure functions (no store access, no side effects).
 * They are also the foundation for "Save as Block" (macro v1).
 *
 * Key invariants:
 * - No random IDs. IDs are assigned by sorted position in original cluster + circuit max.
 * - Positions are stored relative to cluster bounding-box so paste offset is clean.
 * - Only connections where BOTH endpoints are inside the selection are serialized.
 * - Does not mutate the source circuit or cluster.
 */

import type { Circuit, Connection, Node, PortRef } from '@redbyte/rb-logic-core';

// ── Public types ──────────────────────────────────────────────────────────────

export interface ClipboardNode {
  /** Original circuit node id — used to remap connections at paste time. */
  originalId: string;
  type: string;
  label?: string;
  /** Relative position from bounding-box origin of the cluster. */
  x: number;
  y: number;
  config: Record<string, unknown>;
  state: Record<string, unknown>;
}

export interface ClipboardConnection {
  fromOriginalId: string;
  fromPort: string;
  toOriginalId: string;
  toPort: string;
}

export interface ClipboardCluster {
  /** Serialized nodes in sorted-id order (deterministic). */
  nodes: ClipboardNode[];
  /** Only connections where both endpoints are in this cluster. */
  connections: ClipboardConnection[];
  /**
   * Absolute canvas position of the bounding-box origin of the original selection.
   * Stored so progressive paste can compute offset = origin + step * stepSize.
   */
  originX: number;
  originY: number;
}

export interface PasteResult {
  pastedNodes: Node[];
  pastedConnections: Connection[];
  /** Maps originalId → new pasted node id. */
  newIdMap: Map<string, string>;
}

// ── ID helpers ────────────────────────────────────────────────────────────────

const NODE_ID_PREFIX = 'node-v2-';
const NODE_ID_RE = /^node-v2-(\d+)$/;

function getCircuitMaxId(circuit: Circuit): number {
  let max = 0;
  for (const node of circuit.nodes) {
    const m = NODE_ID_RE.exec(node.id);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  return max;
}

// ── Position helpers ──────────────────────────────────────────────────────────

function nodeX(node: Node): number {
  return node.position?.x ?? node.x ?? 0;
}

function nodeY(node: Node): number {
  return node.position?.y ?? node.y ?? 0;
}

// ── Connection port extraction ────────────────────────────────────────────────

function portNodeId(ref: PortRef | string): string {
  return typeof ref === 'string' ? ref : ref.nodeId;
}

function portName(conn: Connection, side: 'from' | 'to'): string {
  const ref = conn[side];
  if (typeof ref !== 'string') {
    return ref.portName ?? (ref as any).port ?? (side === 'from' ? 'out' : 'in');
  }
  if (side === 'from') {
    return conn.fromPin ?? conn.fromPort ?? 'out';
  }
  return conn.toPin ?? conn.toPort ?? 'in';
}

// ── serializeCluster ──────────────────────────────────────────────────────────

/**
 * Serialize a selection of node IDs into a ClipboardCluster.
 *
 * Positions are stored relative to the bounding-box min corner so that paste
 * offset is applied cleanly. Nodes are ordered by original id (sorted) so that
 * deterministic ID assignment at paste time is stable.
 */
export function serializeCluster(circuit: Circuit, selectedIds: Set<string>): ClipboardCluster {
  // Gather selected nodes in sorted-id order (deterministic)
  const selected = circuit.nodes
    .filter((n) => selectedIds.has(n.id))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  if (selected.length === 0) {
    return { nodes: [], connections: [] };
  }

  // Compute bounding-box origin
  const minX = Math.min(...selected.map(nodeX));
  const minY = Math.min(...selected.map(nodeY));

  const nodes: ClipboardNode[] = selected.map((node) => ({
    originalId: node.id,
    type: node.type,
    label: node.label,
    x: nodeX(node) - minX,
    y: nodeY(node) - minY,
    config: { ...(node.config ?? {}) },
    state: {}, // intentionally drop runtime state on copy
  }));

  // Keep only connections where BOTH endpoints are within the selection
  const connections: ClipboardConnection[] = circuit.connections
    .filter((conn) => {
      const fromId = portNodeId(conn.from);
      const toId = portNodeId(conn.to);
      return selectedIds.has(fromId) && selectedIds.has(toId);
    })
    .map((conn) => ({
      fromOriginalId: portNodeId(conn.from),
      fromPort: portName(conn, 'from'),
      toOriginalId: portNodeId(conn.to),
      toPort: portName(conn, 'to'),
    }));

  return { nodes, connections, originX: minX, originY: minY };
}

// ── pasteCluster ─────────────────────────────────────────────────────────────

/**
 * Paste a ClipboardCluster into a circuit.
 *
 * Assigns deterministic new node IDs: sorted cluster nodes get consecutive IDs
 * starting from (circuitMax + 1). This means:
 * - First paste:  IDs are max+1 … max+n
 * - Second paste: circuit max is higher, so IDs are max+n+1 … max+2n
 * - No random IDs, no collisions.
 *
 * @param circuit   Current circuit (read-only — not mutated)
 * @param cluster   Serialized cluster from serializeCluster
 * @param offset    Where to place the bounding-box origin of the pasted cluster
 */
export function pasteCluster(
  circuit: Circuit,
  cluster: ClipboardCluster,
  offset: { x: number; y: number },
): PasteResult {
  if (cluster.nodes.length === 0) {
    return { pastedNodes: [], pastedConnections: [], newIdMap: new Map() };
  }

  const base = getCircuitMaxId(circuit);

  // Assign new IDs in sorted-originalId order (cluster.nodes is already sorted by serializeCluster)
  const newIdMap = new Map<string, string>();
  cluster.nodes.forEach((node, index) => {
    newIdMap.set(node.originalId, `${NODE_ID_PREFIX}${base + index + 1}`);
  });

  const pastedNodes: Node[] = cluster.nodes.map((node) => ({
    id: newIdMap.get(node.originalId)!,
    type: node.type,
    label: node.label,
    position: {
      x: offset.x + node.x,
      y: offset.y + node.y,
    },
    rotation: 0,
    config: { ...node.config },
    state: {},
  }));

  const pastedConnections: Connection[] = cluster.connections.map((conn) => ({
    from: {
      nodeId: newIdMap.get(conn.fromOriginalId)!,
      portName: conn.fromPort,
    },
    to: {
      nodeId: newIdMap.get(conn.toOriginalId)!,
      portName: conn.toPort,
    },
  }));

  return { pastedNodes, pastedConnections, newIdMap };
}
