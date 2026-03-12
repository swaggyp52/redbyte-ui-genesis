/**
 * RED → GREEN: deterministic copy/paste clipboard helper.
 *
 * Tests the pure serialization / remap helpers in designClipboard.ts.
 * No React, no stores — these run as fast unit tests.
 */
import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import {
  serializeCluster,
  pasteCluster,
  type ClipboardCluster,
} from '../designClipboard';

// ── Fixtures ────────────────────────────────────────────────────────────────

const PASTE_OFFSET = { x: 40, y: 40 };

/**
 * Three-gate circuit:  sw0 → AND(a) → ld0
 *                      sw1 → AND(b)
 * We'll copy the cluster {sw0, and0, ld0} and leave sw1 outside.
 */
function buildFixtureCircuit(): Circuit {
  return {
    nodes: [
      { id: 'node-v2-1', type: 'INPUT',  label: 'SW0', position: { x: 0,   y: 0   }, config: {}, state: {} },
      { id: 'node-v2-2', type: 'INPUT',  label: 'SW1', position: { x: 0,   y: 80  }, config: {}, state: {} },
      { id: 'node-v2-3', type: 'AND',               position: { x: 160, y: 0   }, config: {}, state: {} },
      { id: 'node-v2-4', type: 'OUTPUT', label: 'LD0', position: { x: 320, y: 0   }, config: {}, state: {} },
    ],
    connections: [
      { from: { nodeId: 'node-v2-1', portName: 'out' }, to: { nodeId: 'node-v2-3', portName: 'a'  } },
      { from: { nodeId: 'node-v2-2', portName: 'out' }, to: { nodeId: 'node-v2-3', portName: 'b'  } },
      { from: { nodeId: 'node-v2-3', portName: 'out' }, to: { nodeId: 'node-v2-4', portName: 'in' } },
    ],
  };
}

// ── serializeCluster ─────────────────────────────────────────────────────────

describe('serializeCluster', () => {
  it('serializes a single-node selection', () => {
    const circuit = buildFixtureCircuit();
    const cluster = serializeCluster(circuit, new Set(['node-v2-3']));
    expect(cluster.nodes).toHaveLength(1);
    expect(cluster.nodes[0]?.originalId).toBe('node-v2-3');
    expect(cluster.nodes[0]?.type).toBe('AND');
    expect(cluster.connections).toHaveLength(0); // no connections fully inside selection
  });

  it('serializes a multi-node cluster and keeps only internal connections', () => {
    const circuit = buildFixtureCircuit();
    // Select sw0 + and0 + ld0 — connection sw1 → and0.b is external
    const cluster = serializeCluster(circuit, new Set(['node-v2-1', 'node-v2-3', 'node-v2-4']));
    expect(cluster.nodes).toHaveLength(3);

    // Internal connections: sw0→and0.a and and0→ld0
    expect(cluster.connections).toHaveLength(2);

    const fromIds = cluster.connections.map((c) => c.fromOriginalId).sort();
    expect(fromIds).toEqual(['node-v2-1', 'node-v2-3'].sort());
  });

  it('serializes node positions relative to the cluster bounding-box origin', () => {
    const circuit = buildFixtureCircuit();
    const cluster = serializeCluster(circuit, new Set(['node-v2-1', 'node-v2-3', 'node-v2-4']));

    // min-x = 0, min-y = 0  →  node-v2-1 should be at (0,0)
    const first = cluster.nodes.find((n) => n.originalId === 'node-v2-1');
    expect(first?.x).toBe(0);
    expect(first?.y).toBe(0);

    // and0 at original (160,0) → relative (160,0)
    const and0 = cluster.nodes.find((n) => n.originalId === 'node-v2-3');
    expect(and0?.x).toBe(160);
    expect(and0?.y).toBe(0);
  });

  it('preserves config and label fields', () => {
    const circuit = buildFixtureCircuit();
    const cluster = serializeCluster(circuit, new Set(['node-v2-1']));
    expect(cluster.nodes[0]?.label).toBe('SW0');
  });

  it('does not mutate the source circuit', () => {
    const circuit = buildFixtureCircuit();
    const originalLength = circuit.nodes.length;
    serializeCluster(circuit, new Set(['node-v2-1', 'node-v2-3']));
    expect(circuit.nodes).toHaveLength(originalLength);
  });
});

// ── pasteCluster ─────────────────────────────────────────────────────────────

describe('pasteCluster', () => {
  function buildCluster(): ClipboardCluster {
    return serializeCluster(
      buildFixtureCircuit(),
      new Set(['node-v2-1', 'node-v2-3', 'node-v2-4']),
    );
  }

  it('produces the correct number of new nodes', () => {
    const circuit = buildFixtureCircuit();
    const cluster = buildCluster();
    const result = pasteCluster(circuit, cluster, PASTE_OFFSET);
    expect(result.pastedNodes).toHaveLength(3);
  });

  it('generates deterministic new IDs based on sorted order + circuit max', () => {
    const circuit = buildFixtureCircuit(); // max existing id = 4
    const cluster = buildCluster();
    const result = pasteCluster(circuit, cluster, PASTE_OFFSET);

    // IDs should be node-v2-5, node-v2-6, node-v2-7 (sorted by originalId)
    const ids = result.pastedNodes.map((n) => n.id).sort();
    expect(ids).toEqual(['node-v2-5', 'node-v2-6', 'node-v2-7']);
  });

  it('remaps connections to new IDs', () => {
    const circuit = buildFixtureCircuit();
    const cluster = buildCluster();
    const result = pasteCluster(circuit, cluster, PASTE_OFFSET);

    // All connection endpoints must reference new node IDs only
    const newIds = new Set(result.pastedNodes.map((n) => n.id));
    for (const conn of result.pastedConnections) {
      const fromId = typeof conn.from === 'string' ? conn.from : conn.from.nodeId;
      const toId   = typeof conn.to   === 'string' ? conn.to   : conn.to.nodeId;
      expect(newIds.has(fromId)).toBe(true);
      expect(newIds.has(toId)).toBe(true);
    }
  });

  it('applies paste offset to all node positions', () => {
    const circuit = buildFixtureCircuit();
    const cluster = buildCluster();
    const result = pasteCluster(circuit, cluster, PASTE_OFFSET);

    // node-v2-1 was at relative (0,0) → pasted at (0+40, 0+40)
    const remapped = result.newIdMap;
    // Find which new id corresponds to original node-v2-1
    const newId = remapped.get('node-v2-1');
    expect(newId).toBeDefined();
    const pasted = result.pastedNodes.find((n) => n.id === newId);
    expect(pasted?.position?.x ?? pasted?.x).toBe(PASTE_OFFSET.x + 0);
    expect(pasted?.position?.y ?? pasted?.y).toBe(PASTE_OFFSET.y + 0);
  });

  it('repeated paste (simulating Ctrl+V twice) produces stable incremental IDs', () => {
    const circuit = buildFixtureCircuit(); // max = 4
    const cluster = buildCluster();

    // First paste
    const first = pasteCluster(circuit, cluster, PASTE_OFFSET);
    // Simulate circuit after first paste
    const circuitAfterFirst: Circuit = {
      nodes: [...circuit.nodes, ...first.pastedNodes],
      connections: [...circuit.connections, ...first.pastedConnections],
    };

    // Second paste on updated circuit
    const second = pasteCluster(circuitAfterFirst, cluster, PASTE_OFFSET);
    const firstIds = first.pastedNodes.map((n) => n.id).sort();
    const secondIds = second.pastedNodes.map((n) => n.id).sort();

    // Ids must not overlap
    const overlap = firstIds.filter((id) => secondIds.includes(id));
    expect(overlap).toHaveLength(0);

    // Second paste IDs must be sequentially higher
    expect(secondIds).toEqual(['node-v2-10', 'node-v2-8', 'node-v2-9']); // lex sort of v2-8, v2-9, v2-10
  });

  it('does not include external connections (no dangling wires)', () => {
    const circuit = buildFixtureCircuit();
    // Paste only the AND gate — sw1→and0.b is external, not included
    const cluster = serializeCluster(circuit, new Set(['node-v2-3']));
    const result = pasteCluster(circuit, cluster, PASTE_OFFSET);

    expect(result.pastedConnections).toHaveLength(0);
  });

  it('does not mutate the source circuit', () => {
    const circuit = buildFixtureCircuit();
    const cluster = buildCluster();
    const originalNodeCount = circuit.nodes.length;
    pasteCluster(circuit, cluster, PASTE_OFFSET);
    expect(circuit.nodes).toHaveLength(originalNodeCount);
  });

  it('exposes newIdMap keyed by original node id', () => {
    const circuit = buildFixtureCircuit();
    const cluster = buildCluster();
    const result = pasteCluster(circuit, cluster, PASTE_OFFSET);

    expect(result.newIdMap.size).toBe(3);
    for (const node of cluster.nodes) {
      expect(result.newIdMap.has(node.originalId)).toBe(true);
    }
  });
});
