import type { LabProjectV1, CircuitV1, CircuitNode, CircuitConnection } from '@redbyte/rb-utils';
import type { Circuit, Node, Connection } from '@redbyte/rb-logic-core';
import type { RBProject } from '../export/projectFormat';

export function labCircuitToLogicCircuit(circuit: CircuitV1): Circuit {
  return {
    nodes: (circuit.nodes ?? []).map((n): Node => ({
      id: n.id,
      type: n.type,
      x: n.x,
      y: n.y,
      rotation: n.rotation ?? 0,
      params: n.params ?? {},
      config: n.params ?? {},
      label: n.label,
      state: n.state ?? {},
    })),
    connections: (circuit.connections ?? []).map((c): Connection => ({
      id: c.id,
      from: { nodeId: c.fromNodeId, portName: c.fromPin },
      to: { nodeId: c.toNodeId, portName: c.toPin },
    })),
  };
}

export function logicCircuitToLabCircuit(circuit: Circuit): CircuitV1 {
  const nodes: CircuitNode[] = (circuit.nodes ?? []).map((n): CircuitNode => ({
    id: n.id,
    type: n.type,
    x: typeof n.x === 'number' ? n.x : n.position?.x ?? 0,
    y: typeof n.y === 'number' ? n.y : n.position?.y ?? 0,
    rotation: n.rotation ?? 0,
    params: (n.config ?? n.params ?? {}) as Record<string, unknown>,
    label: n.label,
    state: (n.state ?? {}) as Record<string, unknown>,
  }));

  const connections: CircuitConnection[] = (circuit.connections ?? []).map((c): CircuitConnection => {
    const from = typeof c.from === 'string' ? { nodeId: '', portName: '' } : c.from;
    const to = typeof c.to === 'string' ? { nodeId: '', portName: '' } : c.to;
    return {
      id: c.id ?? `${from.nodeId}.${from.portName}->${to.nodeId}.${to.portName}`,
      fromNodeId: (from as any).nodeId ?? '',
      fromPin: (from as any).portName ?? '',
      toNodeId: (to as any).nodeId ?? '',
      toPin: (to as any).portName ?? '',
    };
  });

  return {
    schemaVersion: '1.0',
    nodes,
    connections,
    customChips: [],
  };
}

export function labProjectToRBProject(
  project: LabProjectV1,
  opts?: { appSurface?: string; labId?: string; labStepIndex?: number },
): RBProject {
  const circuit = labCircuitToLogicCircuit(project.circuit);
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    name: project.name,
    description: project.description,
    circuit,
    meta: {
      tickRate: project.simulation?.tickRate,
      projectId: project.projectId,
      labId: opts?.labId,
      labStepIndex: opts?.labStepIndex,
      appSurface: opts?.appSurface,
    },
  };
}

export function rbProjectToLabProject(project: RBProject, base?: LabProjectV1 | null): LabProjectV1 {
  const projectId =
    project.meta?.projectId ??
    base?.projectId ??
    (project.createdAt ? `proj-${project.createdAt}` : `proj-${crypto.randomUUID?.() ?? Date.now()}`);

  const circuit = logicCircuitToLabCircuit(project.circuit ?? { nodes: [], connections: [] });
  const createdAt = base?.createdAt ?? project.createdAt ?? new Date().toISOString();
  const updatedAt = project.updatedAt ?? base?.updatedAt ?? new Date().toISOString();
  const tickRate = project.meta?.tickRate ?? base?.simulation?.tickRate ?? 1;

  return {
    schemaVersion: '1.0',
    projectId,
    name: project.name ?? base?.name ?? 'Untitled Project',
    description: project.description ?? base?.description,
    createdAt,
    updatedAt,
    circuit,
    simulation: base?.simulation
      ? { ...base.simulation, tickRate }
      : { tickRate, currentTick: 0, probes: [] },
    evidence: base?.evidence ?? { actions: [], snapshots: [] },
    boardMap: base?.boardMap,
    ioMapping: base?.ioMapping,
    savedBoards: base?.savedBoards,
    labSpec: base?.labSpec,
    recordings: base?.recordings,
    fpgaArtifacts: base?.fpgaArtifacts,
  };
}

