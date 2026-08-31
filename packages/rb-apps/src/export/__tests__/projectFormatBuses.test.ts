import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { busRangeLabel, createBusBoundary, deleteBus } from '@redbyte/rb-logic-core';
import { createRBProject, decodeRBProject, encodeRBProject } from '../projectFormat';

const project = (circuit: Circuit) =>
  createRBProject({
    createdAt: '2026-01-01T00:00:00.000Z',
    name: 'bus-roundtrip',
    circuit,
  });

const legacyScalarRipple = (): Circuit => ({
  nodes: [
    { id: 'a0', type: 'Switch', label: 'A[0]', position: { x: 0, y: 0 } },
    { id: 'a1', type: 'Switch', label: 'A[1]', position: { x: 0, y: 60 } },
    { id: 'b0', type: 'Switch', label: 'B[0]', position: { x: 80, y: 0 } },
    { id: 'b1', type: 'Switch', label: 'B[1]', position: { x: 80, y: 60 } },
    { id: 'sum0', type: 'Lamp', label: 'SUM[0]', position: { x: 400, y: 0 } },
    { id: 'sum1', type: 'Lamp', label: 'SUM[1]', position: { x: 400, y: 60 } },
    { id: 'carry', type: 'Lamp', label: 'CARRY', position: { x: 400, y: 120 } },
  ],
  connections: [],
});

describe('project format: first-class buses', () => {
  it('serializes and reloads declared buses byte-stably', () => {
    let circuit: Circuit = { nodes: [], connections: [] };
    circuit = createBusBoundary(circuit, { name: 'A', direction: 'input', left: 3, right: 0 }).circuit;
    circuit = createBusBoundary(circuit, { name: 'SUM', direction: 'output', left: 3, right: 0 }).circuit;

    const encoded = encodeRBProject(project(circuit));
    const decoded = decodeRBProject(encoded);
    expect(decoded.circuit.buses?.map((bus) => busRangeLabel(bus))).toEqual([
      'A[3:0]',
      'SUM[3:0]',
    ]);
    // Byte-stability at the fixed point: one decode materializes defaults
    // (e.g. the hierarchy document); from there encode∘decode is identity.
    const settled = encodeRBProject(decoded);
    expect(encodeRBProject(decodeRBProject(settled))).toBe(settled);
    expect(decodeRBProject(settled).circuit.buses).toEqual(decoded.circuit.buses);
  });

  it('migrates legacy scalar projects: contiguous Base[N] groups load as buses', () => {
    const encoded = encodeRBProject(project(legacyScalarRipple()));
    const decoded = decodeRBProject(encoded);
    const labels = decoded.circuit.buses?.map((bus) => busRangeLabel(bus)) ?? [];
    expect(labels).toEqual(['A[1:0]', 'B[1:0]', 'SUM[1:0]']);
    // The scalar substrate is untouched: same nodes, CARRY stays scalar.
    expect(decoded.circuit.nodes).toHaveLength(7);
    expect(decoded.circuit.buses?.some((bus) => bus.name === 'CARRY')).toBe(false);
  });

  it('loads a raw legacy JSON document (no buses field) without destruction', () => {
    const raw = JSON.stringify({
      kind: 'rb-project',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'legacy',
      circuit: legacyScalarRipple(),
    });
    const decoded = decodeRBProject(raw);
    expect(decoded.circuit.nodes).toHaveLength(7);
    expect(decoded.circuit.buses).toHaveLength(3);
  });

  it('prunes declared bits whose nodes are gone instead of failing the load', () => {
    const circuit = createBusBoundary(
      { nodes: [], connections: [] },
      { name: 'A', direction: 'input', left: 1, right: 0 }
    ).circuit;
    const corrupted: Circuit = {
      ...circuit,
      nodes: circuit.nodes.slice(0, 1),
    };
    const decoded = decodeRBProject(encodeRBProject(project(corrupted)));
    const bus = decoded.circuit.buses?.find((entry) => entry.name === 'A');
    expect(bus).toBeDefined();
    expect(bus?.bits).toHaveLength(1);
  });

  it('a deleted bus stays deleted across save and reload', () => {
    const { circuit, bus } = createBusBoundary(
      { nodes: [], connections: [] },
      { name: 'A', direction: 'input', left: 1, right: 0 }
    );
    const demoted = deleteBus(circuit, bus.id);
    const reloaded = decodeRBProject(encodeRBProject(project(demoted)));
    expect(reloaded.circuit.buses).toBeUndefined();
    expect(reloaded.circuit.nodes.map((node) => node.label).sort()).toEqual(['A_0', 'A_1']);
  });

  it('keeps projects with no vector labels free of bus declarations', () => {
    const scalarOnly: Circuit = {
      nodes: [
        { id: 'sw', type: 'Switch', label: 'ENABLE', position: { x: 0, y: 0 } },
        { id: 'ld', type: 'Lamp', label: 'READY', position: { x: 200, y: 0 } },
      ],
      connections: [],
    };
    const decoded = decodeRBProject(encodeRBProject(project(scalarOnly)));
    expect(decoded.circuit.buses).toBeUndefined();
  });
});
