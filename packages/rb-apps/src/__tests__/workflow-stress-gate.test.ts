import { describe, expect, it } from 'vitest';
import { CircuitEngine, fromCircuitV1, toCircuitV1, type Circuit } from '@redbyte/rb-logic-core';
import { screenToWorld, worldToScreen, type Camera } from '@redbyte/rb-viewport';
import type { LabActionV1, LabProjectV1 } from '@redbyte/rb-utils';
import { labReducer } from '@redbyte/rb-lab-engine';
import { decodeRBProject, encodeRBProject, type RBProject } from '../export/projectFormat';
import { digestCircuit } from '../recording/runRecordUtils';

function buildLargeCircuit(nodeCount: number): Circuit {
  const nodes = Array.from({ length: nodeCount }, (_, index) => ({
    id: `n${index}`,
    type: index === 0 ? 'Switch' : index === nodeCount - 1 ? 'Lamp' : 'Wire',
    position: { x: index * 24, y: (index % 10) * 20 },
    config: {},
    state: {},
  }));

  const connections = Array.from({ length: nodeCount - 1 }, (_, index) => ({
    from: { nodeId: `n${index}`, portName: 'out' },
    to: { nodeId: `n${index + 1}`, portName: 'in' },
  }));

  return { nodes, connections };
}

function makeBaseProject(): LabProjectV1 {
  return {
    schemaVersion: '1.0',
    projectId: 'workflow-stress-gate',
    name: 'Workflow Stress Gate',
    description: 'Stress fixture',
    createdAt: '2026-02-16T00:00:00.000Z',
    updatedAt: '2026-02-16T00:00:00.000Z',
    circuit: {
      schemaVersion: '1.0',
      nodes: [{ id: 'm1', type: 'SWITCH', x: 10, y: 10, rotation: 0, params: {} }],
      connections: [],
      customChips: [],
    },
    simulation: { tickRate: 1, currentTick: 0, probes: [] },
    evidence: { actions: [], snapshots: [] },
  };
}

describe('RC D4 workflow stress gate', () => {
  it('handles 100-node roundtrip, persistence loops, and engine tick sanity', () => {
    const circuit = buildLargeCircuit(100);
    const v1 = toCircuitV1(circuit);
    const restored = fromCircuitV1(v1);

    expect(restored.nodes).toHaveLength(100);
    expect(restored.connections).toHaveLength(99);
    expect(digestCircuit(restored)).toBe(digestCircuit(circuit));

    const project: RBProject = {
      kind: 'rb-project',
      version: 1,
      createdAt: '2026-02-16T00:00:00.000Z',
      updatedAt: '2026-02-16T00:00:00.000Z',
      name: 'Stress',
      circuit,
    };

    const firstEncoded = encodeRBProject(project);
    const firstFingerprint = digestCircuit(decodeRBProject(firstEncoded).circuit);

    let encoded = firstEncoded;
    for (let i = 0; i < 10; i += 1) {
      const decoded = decodeRBProject(encoded);
      expect(digestCircuit(decoded.circuit)).toBe(firstFingerprint);
      encoded = encodeRBProject(decoded);
    }
    expect(encoded).toBe(firstEncoded);

    const engine = new CircuitEngine(circuit);
    engine.setNodeState('n0', { isOn: 1 });
    const start = Date.now();
    for (let tick = 0; tick < 200; tick += 1) {
      engine.tick();
    }
    const durationMs = Date.now() - start;
    expect(durationMs).toBeLessThan(5000);
  });

  it('survives 100 undo/redo-style move operations without corruption', () => {
    const initial = makeBaseProject();
    const moves: LabActionV1[] = Array.from({ length: 100 }, (_, index) => ({
      v: 1,
      t: 'circuit/moveNode',
      p: { nodeId: 'm1', x: 10 + index, y: 10 + index },
    }));

    let state = initial;
    const inverses: LabActionV1[] = [];
    for (const move of moves) {
      const node = state.circuit.nodes.find((item) => item.id === 'm1');
      inverses.push({
        v: 1,
        t: 'circuit/moveNode',
        p: { nodeId: 'm1', x: node?.x ?? 10, y: node?.y ?? 10 },
      });
      state = labReducer(state, move);
    }

    while (inverses.length > 0) {
      const inverse = inverses.pop();
      if (!inverse) break;
      state = labReducer(state, inverse);
    }

    expect(state.circuit.nodes.find((node) => node.id === 'm1')?.x).toBe(10);
    expect(state.circuit.nodes.find((node) => node.id === 'm1')?.y).toBe(10);
  });

  it('keeps world placement stable under zoom/pan transforms across save/load', () => {
    const cameras: Camera[] = [
      { x: 0, y: 0, zoom: 1 },
      { x: 320, y: 180, zoom: 0.75 },
      { x: -140, y: 260, zoom: 1.5 },
      { x: 720, y: -90, zoom: 2.25 },
    ];

    const baseWorldPoints = [
      { x: 12.25, y: 98.75 },
      { x: 300, y: 44 },
      { x: -125.5, y: 240.5 },
    ];

    const pointsAfterProjection = cameras.flatMap((camera) =>
      baseWorldPoints.map((world) => {
        const screen = worldToScreen(world.x, world.y, camera);
        return screenToWorld(screen.x, screen.y, camera);
      })
    );

    const circuit: Circuit = {
      nodes: pointsAfterProjection.map((point, index) => ({
        id: `p${index}`,
        type: 'Wire',
        position: { x: point.x, y: point.y },
        config: {},
        state: {},
      })),
      connections: [],
    };

    const restored = fromCircuitV1(toCircuitV1(circuit));
    restored.nodes.forEach((node, index) => {
      const expected = pointsAfterProjection[index];
      expect(node.position?.x ?? node.x ?? 0).toBeCloseTo(expected.x, 6);
      expect(node.position?.y ?? node.y ?? 0).toBeCloseTo(expected.y, 6);
    });
  });
});
