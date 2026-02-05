// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Connection } from '@redbyte/rb-logic-core';

type PortRefKey = string;

const toPortRefKey = (nodeId: string, portName: string): PortRefKey => `${nodeId}.${portName}`;

const normalizeConnectionEndpoints = (conn: Connection): {
  fromNodeId: string;
  fromPortName: string;
  toNodeId: string;
  toPortName: string;
} => {
  const fromIsString = typeof conn.from === 'string';
  const toIsString = typeof conn.to === 'string';

  const fromNodeId = fromIsString ? (conn.from as string) : (conn.from as any).nodeId;
  const toNodeId = toIsString ? (conn.to as string) : (conn.to as any).nodeId;

  const fromPortName = fromIsString
    ? (conn.fromPin ?? conn.fromPort ?? 'out')
    : ((conn.from as any).portName ?? (conn.from as any).port ?? conn.fromPin ?? conn.fromPort ?? 'out');

  const toPortName = toIsString
    ? (conn.toPin ?? conn.toPort ?? 'in')
    : ((conn.to as any).portName ?? (conn.to as any).port ?? conn.toPin ?? conn.toPort ?? 'in');

  return { fromNodeId, fromPortName, toNodeId, toPortName };
};

export const getWireIdForConnection = (conn: Connection): string => {
  const e = normalizeConnectionEndpoints(conn);
  return `${e.fromNodeId}.${e.fromPortName}-${e.toNodeId}.${e.toPortName}`;
};

class UnionFind {
  private parent = new Map<PortRefKey, PortRefKey>();
  private rank = new Map<PortRefKey, number>();

  private ensure(x: PortRefKey) {
    if (this.parent.has(x)) return;
    this.parent.set(x, x);
    this.rank.set(x, 0);
  }

  find(x: PortRefKey): PortRefKey {
    this.ensure(x);
    const p = this.parent.get(x)!;
    if (p === x) return x;
    const root = this.find(p);
    this.parent.set(x, root);
    return root;
  }

  union(a: PortRefKey, b: PortRefKey) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;

    const rankA = this.rank.get(ra) ?? 0;
    const rankB = this.rank.get(rb) ?? 0;

    if (rankA < rankB) {
      this.parent.set(ra, rb);
      return;
    }
    if (rankA > rankB) {
      this.parent.set(rb, ra);
      return;
    }

    this.parent.set(rb, ra);
    this.rank.set(ra, rankA + 1);
  }
}

const fnv1a32Hex = (input: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Convert to unsigned 32-bit hex
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const stableNetIdForPorts = (portKeys: PortRefKey[]): string => {
  const sorted = [...portKeys].sort((a, b) => a.localeCompare(b));
  const joined = sorted.join('|');
  return `net-${fnv1a32Hex(joined)}`;
};

/**
 * Compute a deterministic net id for each wire connection based on connected components of port refs.
 *
 * This is intentionally circuit-agnostic (no node metadata) and uses only the connection graph:
 * - Each port ref is a vertex (nodeId.portName)
 * - Each connection is an undirected edge between two port refs
 * - Each connected component becomes a net with a stable id (hash of sorted port refs)
 */
export const computeWireNetIds = (connections: Connection[]): Map<string, string> => {
  const uf = new UnionFind();

  const edges = connections
    .map((conn) => {
      const e = normalizeConnectionEndpoints(conn);
      const fromKey = toPortRefKey(e.fromNodeId, e.fromPortName);
      const toKey = toPortRefKey(e.toNodeId, e.toPortName);
      const wireId = `${e.fromNodeId}.${e.fromPortName}-${e.toNodeId}.${e.toPortName}`;
      return { wireId, fromKey, toKey };
    })
    .sort((a, b) => a.wireId.localeCompare(b.wireId));

  for (const edge of edges) {
    uf.union(edge.fromKey, edge.toKey);
  }

  const rootToPorts = new Map<PortRefKey, PortRefKey[]>();
  for (const edge of edges) {
    const r1 = uf.find(edge.fromKey);
    const r2 = uf.find(edge.toKey);
    if (!rootToPorts.has(r1)) rootToPorts.set(r1, []);
    if (!rootToPorts.has(r2)) rootToPorts.set(r2, []);
    rootToPorts.get(r1)!.push(edge.fromKey);
    rootToPorts.get(r1)!.push(edge.toKey);
    if (r2 !== r1) {
      rootToPorts.get(r2)!.push(edge.fromKey);
      rootToPorts.get(r2)!.push(edge.toKey);
    }
  }

  const rootToNetId = new Map<PortRefKey, string>();
  for (const [root, ports] of rootToPorts.entries()) {
    const unique = Array.from(new Set(ports));
    rootToNetId.set(root, stableNetIdForPorts(unique));
  }

  const result = new Map<string, string>();
  for (const edge of edges) {
    const root = uf.find(edge.fromKey);
    const netId = rootToNetId.get(root) ?? stableNetIdForPorts([edge.fromKey, edge.toKey]);
    result.set(edge.wireId, netId);
  }

  return result;
};

