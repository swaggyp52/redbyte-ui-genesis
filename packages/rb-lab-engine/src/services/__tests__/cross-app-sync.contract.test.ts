import { describe, it, expect } from 'vitest';
import {
  convertCircuitV1ToCircuit,
  convertCircuitToCircuitV1,
  prepareImportedProjectState,
} from '../importWorkflowUtils';
import type { LabProjectV1, CircuitV1, Circuit } from '../schema/index.js';

const baseCircuit: Circuit = {
  nodes: [
    {
      id: 'sw1',
      type: 'SWITCH',
      x: 10,
      y: 20,
      rotation: 0,
      label: 'Switch 1',
      config: {},
      state: { isOn: false },
      inputs: {},
      outputs: {},
    },
    {
      id: 'lamp1',
      type: 'LAMP',
      x: 140,
      y: 40,
      rotation: 0,
      label: 'Lamp 1',
      config: {},
      state: { on: false },
      inputs: {},
      outputs: {},
    },
  ],
  connections: [
    {
      id: 'c1',
      from: 'sw1',
      fromPin: 'out',
      to: 'lamp1',
      toPin: 'in',
    },
  ],
};

const baseCircuitV1: CircuitV1 = {
  schemaVersion: '1.0',
  nodes: [
    {
      id: 'sw1',
      type: 'SWITCH',
      x: 10,
      y: 20,
      rotation: 0,
      label: 'Switch 1',
      params: {},
      state: { isOn: false },
    },
    {
      id: 'lamp1',
      type: 'LAMP',
      x: 140,
      y: 40,
      rotation: 0,
      label: 'Lamp 1',
      params: {},
      state: { on: false },
    },
  ],
  connections: [
    {
      id: 'c1',
      fromNodeId: 'sw1',
      fromPin: 'out',
      toNodeId: 'lamp1',
      toPin: 'in',
    },
  ],
  customChips: [],
};

const baseProject: LabProjectV1 = {
  schemaVersion: '1.0',
  projectId: 'proj-sync',
  name: 'Sync Contract',
  description: '',
  createdAt: '2026-02-03T00:00:00Z',
  updatedAt: '2026-02-03T00:00:00Z',
  circuit: baseCircuitV1,
  simulation: {
    tickRate: 20,
    currentTick: 0,
    probes: [],
  },
  evidence: {
    actions: [],
    snapshots: [],
  },
};

describe('Cross-app sync contract', () => {
  it('round-trips circuit Playground -> Unified -> Playground without loss', () => {
    const toV1 = convertCircuitToCircuitV1(baseCircuit);
    const back = convertCircuitV1ToCircuit(toV1);

    expect(back.nodes).toHaveLength(baseCircuit.nodes.length);
    expect(back.connections).toHaveLength(baseCircuit.connections.length);
    expect(back.nodes[0].id).toBe('sw1');
    expect((back.connections[0].from as { nodeId: string }).nodeId).toBe('sw1');
    expect((back.connections[0].to as { nodeId: string }).nodeId).toBe('lamp1');
  });

  it('round-trips circuit Unified -> Playground -> Unified without loss', () => {
    const runtime = convertCircuitV1ToCircuit(baseCircuitV1);
    const back = convertCircuitToCircuitV1(runtime, baseCircuitV1);

    expect(back.nodes).toHaveLength(baseCircuitV1.nodes.length);
    expect(back.connections).toHaveLength(baseCircuitV1.connections.length);
    expect(back.nodes[1].type).toBe('LAMP');
    expect(back.connections[0].fromNodeId).toBe('sw1');
  });

  it('prepares import state with circuit matching unified project', () => {
    const prepared = prepareImportedProjectState(baseProject, 'recovery');

    expect(prepared.project.projectId).toBe('proj-sync');
    expect(prepared.circuit.nodes).toHaveLength(baseProject.circuit.nodes.length);
    expect((prepared.circuit.connections[0].to as { nodeId: string }).nodeId).toBe('lamp1');
  });
});
