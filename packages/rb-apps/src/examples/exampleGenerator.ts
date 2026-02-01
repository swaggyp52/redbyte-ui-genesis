// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Example Project Generator
 * 
 * Converts legacy circuit JSON examples to full LabProjectV1 format
 * with probes, IO mappings, and metadata.
 */

import type { LabProjectV1, CircuitV1, CircuitNode, CircuitConnection } from '@redbyte/rb-utils';
import type { SerializedCircuitV1 as LegacyCircuit } from '@redbyte/rb-logic-core';

export interface ExampleSource {
  id: string;
  name: string;
  description: string;
  legacyCircuit: LegacyCircuit;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  layer: number;
}

export function convertLegacyCircuitToV1(legacy: LegacyCircuit): CircuitV1 {
  const nodes: CircuitNode[] = legacy.nodes.map((node: any) => ({
    id: node.id,
    type: node.type,
    x: node.position?.x ?? 0,
    y: node.position?.y ?? 0,
    rotation: node.rotation ?? 0,
    params: node.config ?? {},
    label: node.label,
    state: node.state,
  }));

  const connections: CircuitConnection[] = legacy.connections.map((conn: any) => ({
    id: `${conn.from.nodeId}-${conn.from.portName}-${conn.to.nodeId}-${conn.to.portName}`,
    fromNodeId: conn.from.nodeId,
    fromPin: conn.from.portName || 'out',
    toNodeId: conn.to.nodeId,
    toPin: conn.to.portName || 'in',
  }));

  return {
    schemaVersion: '1.0',
    nodes,
    connections,
    customChips: [],
  };
}

export function generateExampleProject(source: ExampleSource): LabProjectV1 {
  const circuit = convertLegacyCircuitToV1(source.legacyCircuit);
  const now = new Date().toISOString();

  // Auto-detect probe candidates (outputs, LEDs, significant intermediate nodes)
  const probes = circuit.nodes
    .filter((n) => ['Lamp', 'LED', 'OUTPUT'].includes(n.type) || n.label)
    .slice(0, 4) // Limit to 4 probes for cleanliness
    .map((n, idx) => ({
      id: `probe${idx}`,
      signal: n.id,
      label: n.label || n.id,
      color: ['#00d4ff', '#00ff88', '#aa88ff', '#ffa500'][idx],
    }));

  // Auto-detect IO mapping candidates
  const inputCandidates = circuit.nodes.filter((n) =>
    ['SWITCH', 'PowerSource', 'INPUT'].includes(n.type)
  );
  const outputCandidates = circuit.nodes.filter((n) =>
    ['Lamp', 'LED', 'OUTPUT'].includes(n.type)
  );

  const ioMapping = {
    inputs: inputCandidates.slice(0, 8).map((n, idx) => ({
      id: `in:${n.id}`,
      nodeId: n.id,
      port: 'out',
      label: n.label || `Input ${idx}`,
      pin: `SW${idx}`,
    })),
    outputs: outputCandidates.slice(0, 8).map((n, idx) => ({
      id: `out:${n.id}`,
      nodeId: n.id,
      port: 'in',
      label: n.label || `Output ${idx}`,
      pin: `LD${idx}`,
    })),
  };

  return {
    schemaVersion: '1.0',
    projectId: `example-${source.id}`,
    name: source.name,
    description: source.description,
    createdAt: now,
    updatedAt: now,
    circuit,
    simulation: {
      tickRate: 10,
      currentTick: 0,
      probes,
      breakpoints: [],
    },
    boardMap: {
      boardProfileId: 'basys3',
      signalToPinMap: {},
      virtualIOState: {
        switches: Array(16).fill(false),
        buttons: Array(5).fill(false),
      },
    },
    ioMapping,
    evidence: {
      actions: [],
      snapshots: [],
    },
    recordings: [],
  };
}

export function generateAllExampleProjects(sources: ExampleSource[]): Record<string, LabProjectV1> {
  const projects: Record<string, LabProjectV1> = {};
  for (const source of sources) {
    projects[source.id] = generateExampleProject(source);
  }
  return projects;
}
