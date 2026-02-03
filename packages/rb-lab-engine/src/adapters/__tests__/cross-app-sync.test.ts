// Copyright (c) 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import type { LabProjectV1, CircuitV1 } from '@redbyte/rb-utils';
import {
  toLogicPlaygroundModel,
  toVirtualLab3DModel,
  fromLogicPlaygroundEdits,
  fromVirtualLab3DEdits,
  toLab2DModel,
  fromLab2DEdits,
} from '../projectAdapters';
import { exportEvidenceCapsule, importEvidenceCapsule } from '../../services/exportService';

function createTestProject(overrides: Partial<LabProjectV1> = {}): LabProjectV1 {
  return {
    schemaVersion: '1.0',
    projectId: 'proj-test',
    name: 'Sync Test',
    description: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    circuit: {
      schemaVersion: '1.0',
      nodes: [],
      connections: [],
      customChips: [],
    },
    simulation: {
      tickRate: 20,
      currentTick: 0,
      probes: [],
    },
    evidence: {
      actions: [],
      snapshots: [],
    },
    ...overrides,
  };
}

describe('Cross-app sync contracts', () => {
  it('propagates Logic Playground edits into Virtual Lab model', () => {
    const circuit: CircuitV1 = {
      schemaVersion: '1.0',
      nodes: [
        { id: 'sw1', type: 'SWITCH', x: 0, y: 0, rotation: 0, params: {}, state: {} },
        { id: 'led1', type: 'LAMP', x: 120, y: 0, rotation: 0, params: {}, state: {} },
      ],
      connections: [
        { id: 'sw1-out-led1-in', fromNodeId: 'sw1', fromPin: 'out', toNodeId: 'led1', toPin: 'in' },
      ],
      customChips: [],
    };

    const base = createTestProject();
    const updated = fromLogicPlaygroundEdits(base, { circuit });
    const virtualModel = toVirtualLab3DModel(updated);

    expect(virtualModel.circuit.nodes.length).toBe(2);
    expect(virtualModel.circuit.connections.length).toBe(1);
  });

  it('propagates Virtual Lab edits back into Playground model', () => {
    const circuit: CircuitV1 = {
      schemaVersion: '1.0',
      nodes: [
        { id: 'btn1', type: 'BUTTON', x: 0, y: 0, rotation: 0, params: {}, state: {} },
      ],
      connections: [],
      customChips: [],
    };

    const base = createTestProject();
    const updated = fromVirtualLab3DEdits(base, {
      circuit,
      ioState: { switches: [true], buttons: [false], leds: [] },
    });

    const playground = toLogicPlaygroundModel(updated, { selectedNodes: [] });
    expect(playground.circuit.nodes.length).toBe(1);
    expect(playground.circuit.nodes[0].id).toBe('btn1');
  });

  it('maintains equivalence across export/import pipeline', async () => {
    const circuit: CircuitV1 = {
      schemaVersion: '1.0',
      nodes: [
        { id: 'and1', type: 'LOGIC_AND', x: 0, y: 0, rotation: 0, params: {}, state: {} },
      ],
      connections: [],
      customChips: [],
    };

    const project = createTestProject({ circuit });
    const bundle = await exportEvidenceCapsule(project);
    const imported = await importEvidenceCapsule(bundle);

    expect(imported.project.circuit.nodes.length).toBe(1);
    expect(imported.project.circuit.nodes[0].id).toBe('and1');

    const lab2d = toLab2DModel(imported.project);
    const roundTrip = fromLab2DEdits(imported.project, { circuit: lab2d.circuit });
    expect(roundTrip.circuit.nodes.length).toBe(1);
  });
});
