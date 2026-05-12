// Copyright © 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { CircuitIR, IRDiagnostic, IRNet, IRPort } from './circuitIR';

export interface SimulationModelPortRef {
  portId: string;
  sourceNodeId: string;
  canonicalName: string;
  kind: 'input' | 'output' | 'clock' | 'reset';
  width: number;
}

export interface SimulationModelOutputBinding {
  outputPortId: string;
  driverNetName?: string;
  driverSourceNodeId?: string;
}

export interface SimulationModelTemporalBinding {
  primitiveId: string;
  netName?: string;
  boundarySourceNodeId?: string;
  canonicalName?: string;
}

export interface SimulationModel {
  irHash: string;
  ports: SimulationModelPortRef[];
  inputs: SimulationModelPortRef[];
  outputs: SimulationModelPortRef[];
  clocks: SimulationModelPortRef[];
  resets: SimulationModelPortRef[];
  outputBindings: SimulationModelOutputBinding[];
  clockBindings: SimulationModelTemporalBinding[];
  resetBindings: SimulationModelTemporalBinding[];
  blockingDiagnostics: IRDiagnostic[];
  isRunnable: boolean;
}

export function buildSimulationModel(ir: CircuitIR): SimulationModel {
  const ports = ir.ports
    .map((port) => toSimulationPortRef(port, port.kind === 'reset' ? 'reset' : port.kind))
    .sort(comparePortRef);
  const inputs = ir.inputs.map((port) => toSimulationPortRef(port, 'input')).sort(comparePortRef);
  const outputs = ir.outputs.map((port) => toSimulationPortRef(port, 'output')).sort(comparePortRef);
  const clocks = ir.clocks.map((port) => toSimulationPortRef(port, 'clock')).sort(comparePortRef);

  const portsBySourceNodeId = new Map<string, SimulationModelPortRef>();
  for (const port of ports) {
    portsBySourceNodeId.set(port.sourceNodeId, port);
  }

  const netsByName = new Map<string, IRNet>();
  for (const net of ir.nets) {
    netsByName.set(net.name, net);
  }

  const outputBindings = outputs
    .map((output) => {
      const net = findBoundarySinkNet(ir.nets, output.sourceNodeId);
      const driverSourceNodeId = net && net.drivers.length === 1 ? net.drivers[0]?.nodeId : undefined;
      return {
        outputPortId: output.portId,
        driverNetName: net?.name,
        driverSourceNodeId,
      };
    })
    .sort((left, right) => compareText(left.outputPortId, right.outputPortId));

  const clockBindings = ir.primitives
    .filter((primitive) => primitive.clockBinding)
    .map((primitive) =>
      toTemporalBinding(primitive.id, primitive.clockBinding, netsByName, portsBySourceNodeId)
    )
    .sort(compareTemporalBinding);

  const resetBindings = ir.primitives
    .filter((primitive) => primitive.resetBinding)
    .map((primitive) =>
      toTemporalBinding(primitive.id, primitive.resetBinding, netsByName, portsBySourceNodeId)
    )
    .sort(compareTemporalBinding);

  const resetEntries: Array<readonly [string, SimulationModelPortRef]> = [];
  for (const binding of resetBindings) {
    if (!binding.boundarySourceNodeId) continue;
    const port = portsBySourceNodeId.get(binding.boundarySourceNodeId);
    if (!port) continue;
    resetEntries.push([
      port.portId,
      {
        ...port,
        kind: 'reset',
      },
    ] as const);
  }

  const resets = Array.from(new Map(resetEntries).values()).sort(comparePortRef);

  const blockingDiagnostics = ir.diagnostics
    .filter((diagnostic) => diagnostic.severity === 'error')
    .map((diagnostic) => ({ ...diagnostic }))
    .sort(compareDiagnostic);

  return {
    irHash: ir.irHash,
    ports,
    inputs,
    outputs,
    clocks,
    resets,
    outputBindings,
    clockBindings,
    resetBindings,
    blockingDiagnostics,
    isRunnable: blockingDiagnostics.length === 0,
  };
}

function toSimulationPortRef(
  port: IRPort,
  kind: SimulationModelPortRef['kind']
): SimulationModelPortRef {
  return {
    portId: port.id,
    sourceNodeId: port.sourceNodeId,
    canonicalName: port.name,
    kind,
    width: port.signalType.width,
  };
}

function findBoundarySinkNet(nets: IRNet[], sourceNodeId: string): IRNet | undefined {
  return nets.find((net) =>
    net.sinks.some((sink) => sink.nodeId === sourceNodeId && sink.port === 'in')
  );
}

function toTemporalBinding(
  primitiveId: string,
  netName: string | undefined,
  netsByName: Map<string, IRNet>,
  portsBySourceNodeId: Map<string, SimulationModelPortRef>
): SimulationModelTemporalBinding {
  const net = netName ? netsByName.get(netName) : undefined;
  const boundaryDriver =
    net?.drivers.length === 1
      ? portsBySourceNodeId.get(net.drivers[0]?.nodeId ?? '')
      : undefined;
  return {
    primitiveId,
    netName,
    boundarySourceNodeId: boundaryDriver?.sourceNodeId,
    canonicalName: boundaryDriver?.canonicalName,
  };
}

function comparePortRef(left: SimulationModelPortRef, right: SimulationModelPortRef): number {
  const byKind = compareText(left.kind, right.kind);
  if (byKind !== 0) return byKind;
  const byPortId = compareText(left.portId, right.portId);
  if (byPortId !== 0) return byPortId;
  return compareText(left.sourceNodeId, right.sourceNodeId);
}

function compareTemporalBinding(
  left: SimulationModelTemporalBinding,
  right: SimulationModelTemporalBinding
): number {
  const byPrimitiveId = compareText(left.primitiveId, right.primitiveId);
  if (byPrimitiveId !== 0) return byPrimitiveId;
  return compareText(left.netName ?? '', right.netName ?? '');
}

function compareDiagnostic(left: IRDiagnostic, right: IRDiagnostic): number {
  const byCode = compareText(left.code, right.code);
  if (byCode !== 0) return byCode;
  const byNodeId = compareText(left.nodeId ?? '', right.nodeId ?? '');
  if (byNodeId !== 0) return byNodeId;
  const byPort = compareText(left.port ?? '', right.port ?? '');
  if (byPort !== 0) return byPort;
  return compareText(left.message, right.message);
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
