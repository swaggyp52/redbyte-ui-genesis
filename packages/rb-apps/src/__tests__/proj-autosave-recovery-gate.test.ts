import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LabProjectV1 } from '@redbyte/rb-utils';
import { labReducer, useUnifiedProjectStore } from '@redbyte/rb-lab-engine';
import { decodeRBProject } from '../export/projectFormat';
import {
  buildRbprojAutosaveRecord,
  getCanonicalProjectAutosaveKey,
  loadRbprojAutosave,
  saveRbprojAutosave,
} from '../utils/rbprojAutosave';
import { labProjectToRBProject, rbProjectToLabProject } from '../utils/labProjectRbprojAdapter';

function makeBaseProject(): LabProjectV1 {
  return {
    schemaVersion: '1.0',
    projectId: 'proj-autosave-gate',
    name: 'Autosave Recovery Gate',
    description: 'Deterministic fixture for autosave recovery',
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
    circuit: {
      schemaVersion: '1.0',
      nodes: [],
      connections: [],
      customChips: [],
    },
    simulation: {
      tickRate: 10,
      currentTick: 0,
      probes: [],
    },
    evidence: {
      actions: [],
      snapshots: [],
    },
  };
}

function normalizeCircuitForGate(circuit: LabProjectV1['circuit']): unknown {
  const nodes = [...(circuit.nodes ?? [])]
    .map((n) => ({
      id: n.id,
      type: n.type,
      x: n.x,
      y: n.y,
      rotation: n.rotation ?? 0,
      params: n.params ?? {},
      state: n.state ?? {},
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const connections = [...(circuit.connections ?? [])]
    .map((c) => ({
      fromNodeId: c.fromNodeId,
      fromPin: c.fromPin,
      toNodeId: c.toNodeId,
      toPin: c.toPin,
    }))
    .sort((a, b) => {
      const left = `${a.fromNodeId}.${a.fromPin}->${a.toNodeId}.${a.toPin}`;
      const right = `${b.fromNodeId}.${b.fromPin}->${b.toNodeId}.${b.toPin}`;
      return left.localeCompare(right);
    });

  return { schemaVersion: circuit.schemaVersion, nodes, connections, customChips: circuit.customChips ?? [] };
}

describe('Project autosave recovery gate (RBProject codec, canonical key)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-01T12:00:00.000Z'));
    localStorage.clear();
    useUnifiedProjectStore.getState().reset();
  });

  it('writes autosave (rb:autosave:<projectId>) and restores identical canonical circuit state', () => {
    const base = makeBaseProject();

    const actions = [
      { v: 1, t: 'circuit/addNode', p: { nodeId: 'sw1', componentType: 'SWITCH', x: 0, y: 0 } },
      { v: 1, t: 'circuit/addNode', p: { nodeId: 'led1', componentType: 'LED', x: 64, y: 0 } },
      {
        v: 1,
        t: 'circuit/addConnection',
        p: { id: 'c1', fromNodeId: 'sw1', fromPin: 'OUT', toNodeId: 'led1', toPin: 'IN' },
      },
      { v: 1, t: 'circuit/moveNode', p: { nodeId: 'led1', x: 96, y: 16 } },
    ] as const;

    const edited = actions.reduce((state, action) => labReducer(state, action as any), base);
    useUnifiedProjectStore.getState().loadProject(edited);

    const rbproj = labProjectToRBProject(edited, { appSurface: 'ece-lab', labId: 'lab-fixture', labStepIndex: 2 });
    const record = buildRbprojAutosaveRecord(rbproj);
    const key = getCanonicalProjectAutosaveKey(edited.projectId);
    saveRbprojAutosave(key, record);

    const saved = loadRbprojAutosave(key);
    expect(saved).not.toBeNull();
    expect(saved?.projectJson).toBeTypeOf('string');
    expect(saved?.contentHash).toBeTypeOf('string');
    expect(saved?.savedAtMs).toBeTypeOf('number');

    useUnifiedProjectStore.getState().reset();
    const decoded = decodeRBProject(saved!.projectJson);
    const restored = rbProjectToLabProject(decoded, null);
    useUnifiedProjectStore.getState().loadProject(restored);

    const loaded = useUnifiedProjectStore.getState().currentProject;
    expect(loaded).not.toBeNull();
    expect(loaded?.projectId).toBe(edited.projectId);
    expect(normalizeCircuitForGate(loaded!.circuit)).toEqual(normalizeCircuitForGate(edited.circuit));
    expect(loaded?.simulation.tickRate).toBe(edited.simulation.tickRate);
  });

  it('fails gracefully on corrupt autosave payload', () => {
    const key = getCanonicalProjectAutosaveKey('proj-autosave-gate');
    localStorage.setItem(key, '{');
    expect(loadRbprojAutosave(key)).toBeNull();
  });
});
