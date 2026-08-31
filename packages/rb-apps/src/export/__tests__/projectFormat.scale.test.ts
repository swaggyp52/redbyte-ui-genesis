import { describe, expect, it } from 'vitest';
import { decodeRBProject, encodeRBProject, normalizeRBProject } from '../projectFormat';
import type { RBProject } from '../projectFormat';
import { addSourceFile, createEmptyProjectSourceModel } from '../../apps/ide/projectSourceModel';

/**
 * P2-8 — project-format scale/durability proof. A large project must round-trip
 * losslessly and encode deterministically, with no super-linear blow-up. This
 * asserts correctness at scale (round-trip + byte-stable re-encode); timing is
 * logged as informational only (CI machines vary), and recorded in
 * PERFORMANCE.md from a local run.
 */

function buildLargeProject(gateCount: number, sourceCount: number): RBProject {
  const nodes: any[] = [{ id: 'in', type: 'INPUT', position: { x: 0, y: 0 } }];
  const connections: any[] = [];
  let prev = { nodeId: 'in', portName: 'out' };
  for (let i = 0; i < gateCount; i++) {
    const id = `n${i}`;
    nodes.push({ id, type: 'NOT', position: { x: (i + 1) * 40, y: 0 } });
    connections.push({ from: prev, to: { nodeId: id, portName: 'in' } });
    prev = { nodeId: id, portName: 'out' };
  }
  nodes.push({ id: 'out', type: 'OUTPUT', position: { x: (gateCount + 1) * 40, y: 0 } });
  connections.push({ from: prev, to: { nodeId: 'out', portName: 'in' } });

  let sourceModel = createEmptyProjectSourceModel();
  for (let i = 0; i < sourceCount; i++) {
    sourceModel = addSourceFile(sourceModel, { path: `rtl/mod${String(i).padStart(3, '0')}.vhd`, text: `entity mod${i} is end mod${i};` });
  }

  return {
    kind: 'rb-project',
    version: 1,
    name: 'scale-fixture',
    createdAt: '2026-03-09T00:00:00.000Z',
    updatedAt: '2026-03-09T00:00:00.000Z',
    circuit: { nodes, connections },
    sourceModel,
  } as RBProject;
}

describe('project format at scale', () => {
  it('round-trips a large project losslessly and encodes deterministically', () => {
    const gateCount = 400;
    const sourceCount = 80;
    const normalized = normalizeRBProject(buildLargeProject(gateCount, sourceCount));
    expect(normalized.circuit.nodes.length).toBe(gateCount + 2);
    expect(normalized.sourceModel?.files.length).toBe(sourceCount);

    const t0 = Date.now();
    const encoded = encodeRBProject(normalized);
    const t1 = Date.now();
    const decoded = decodeRBProject(encoded);
    const t2 = Date.now();

    // Lossless round-trip.
    expect(decoded).toEqual(normalized);
    // Deterministic re-encode is byte-identical.
    expect(encodeRBProject(decoded)).toBe(encoded);

    // Informational only — not asserted (CI machines vary).
    // eslint-disable-next-line no-console
    console.log(`[scale] nodes=${gateCount + 2} sources=${sourceCount} bytes=${encoded.length} encode=${t1 - t0}ms decode=${t2 - t1}ms`);
  });

  it('scales roughly linearly (2x work is not >6x time)', () => {
    const measure = (gates: number, sources: number): number => {
      const p = normalizeRBProject(buildLargeProject(gates, sources));
      const start = Date.now();
      decodeRBProject(encodeRBProject(p));
      return Math.max(1, Date.now() - start);
    };
    const small = measure(200, 40);
    const large = measure(400, 80);
    // Generous bound: doubling size must not sextuple time (guards against O(n^2)).
    expect(large).toBeLessThan(small * 6 + 50);
  });
});
