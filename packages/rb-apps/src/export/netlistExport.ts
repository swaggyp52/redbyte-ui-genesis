// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { elaborateCircuit, type Circuit, type CircuitIR, type IRPort, type IRPrimitive } from '@redbyte/rb-logic-core';
import { compareCodepoint } from './codepointSort';

export type PortDirection = 'in' | 'out';

export interface NetlistPort {
  name: string;
  direction: PortDirection;
}

export interface NetlistNode {
  id: string;
  type: string;
  label?: string;
  ports: NetlistPort[];
  boundaryKind?: 'input' | 'output' | 'clock' | 'reset';
  clockBinding?: string;
  resetBinding?: string;
}

export interface NetlistNet {
  id: string;
  name?: string;
  from: { nodeId: string; port: string };
  to: { nodeId: string; port: string };
}

export interface Netlist {
  kind: 'rb-netlist';
  version: 1;
  createdAt: string;
  circuitDigest: string;
  nodes: NetlistNode[];
  nets: NetlistNet[];
}

const BUILTIN_PORTS: Record<string, NetlistPort[]> = {
  PowerSource: [{ name: 'out', direction: 'out' }],
  Switch: [{ name: 'out', direction: 'out' }],
  INPUT: [{ name: 'out', direction: 'out' }],
  Lamp: [{ name: 'in', direction: 'in' }],
  OUTPUT: [{ name: 'in', direction: 'in' }],
  Wire: [
    { name: 'in', direction: 'in' },
    { name: 'out', direction: 'out' },
  ],
  Clock: [{ name: 'out', direction: 'out' }],
  Delay: [
    { name: 'in', direction: 'in' },
    { name: 'out', direction: 'out' },
  ],
  AND: [
    { name: 'a', direction: 'in' },
    { name: 'b', direction: 'in' },
    { name: 'out', direction: 'out' },
  ],
  NAND: [
    { name: 'a', direction: 'in' },
    { name: 'b', direction: 'in' },
    { name: 'out', direction: 'out' },
  ],
  OR: [
    { name: 'a', direction: 'in' },
    { name: 'b', direction: 'in' },
    { name: 'out', direction: 'out' },
  ],
  NOR: [
    { name: 'a', direction: 'in' },
    { name: 'b', direction: 'in' },
    { name: 'out', direction: 'out' },
  ],
  XOR: [
    { name: 'a', direction: 'in' },
    { name: 'b', direction: 'in' },
    { name: 'out', direction: 'out' },
  ],
  XNOR: [
    { name: 'a', direction: 'in' },
    { name: 'b', direction: 'in' },
    { name: 'out', direction: 'out' },
  ],
  AND3: [
    { name: 'a', direction: 'in' },
    { name: 'b', direction: 'in' },
    { name: 'c', direction: 'in' },
    { name: 'out', direction: 'out' },
  ],
  OR3: [
    { name: 'a', direction: 'in' },
    { name: 'b', direction: 'in' },
    { name: 'c', direction: 'in' },
    { name: 'out', direction: 'out' },
  ],
  NAND3: [
    { name: 'a', direction: 'in' },
    { name: 'b', direction: 'in' },
    { name: 'c', direction: 'in' },
    { name: 'out', direction: 'out' },
  ],
  NOR3: [
    { name: 'a', direction: 'in' },
    { name: 'b', direction: 'in' },
    { name: 'c', direction: 'in' },
    { name: 'out', direction: 'out' },
  ],
  XOR3: [
    { name: 'a', direction: 'in' },
    { name: 'b', direction: 'in' },
    { name: 'c', direction: 'in' },
    { name: 'out', direction: 'out' },
  ],
  FullAdder: [
    { name: 'a', direction: 'in' },
    { name: 'b', direction: 'in' },
    { name: 'cin', direction: 'in' },
    { name: 'sum', direction: 'out' },
    { name: 'carry', direction: 'out' },
  ],
  MUX4: [
    { name: 'i0', direction: 'in' },
    { name: 'i1', direction: 'in' },
    { name: 'i2', direction: 'in' },
    { name: 'i3', direction: 'in' },
    { name: 's0', direction: 'in' },
    { name: 's1', direction: 'in' },
    { name: 'out', direction: 'out' },
  ],
  DFlipFlop: [
    { name: 'D', direction: 'in' },
    { name: 'CLK', direction: 'in' },
    { name: 'RST', direction: 'in' },
    { name: 'EN', direction: 'in' },
    { name: 'Q', direction: 'out' },
    { name: 'Q_inv', direction: 'out' },
  ],
  Register1: [
    { name: 'D', direction: 'in' },
    { name: 'CLK', direction: 'in' },
    { name: 'RST', direction: 'in' },
    { name: 'EN', direction: 'in' },
    { name: 'Q', direction: 'out' },
    { name: 'Q_inv', direction: 'out' },
  ],
  RegisterBus: [
    { name: 'D', direction: 'in' },
    { name: 'CLK', direction: 'in' },
    { name: 'RST', direction: 'in' },
    { name: 'EN', direction: 'in' },
    { name: 'Q', direction: 'out' },
    { name: 'Q_inv', direction: 'out' },
  ],
  StateBank: [
    { name: 'D', direction: 'in' },
    { name: 'CLK', direction: 'in' },
    { name: 'RST', direction: 'in' },
    { name: 'EN', direction: 'in' },
    { name: 'Q', direction: 'out' },
    { name: 'Q_inv', direction: 'out' },
  ],
  DLatch: [
    { name: 'D', direction: 'in' },
    { name: 'EN', direction: 'in' },
    { name: 'Q', direction: 'out' },
    { name: 'Q_inv', direction: 'out' },
  ],
  TFlipFlop: [
    { name: 'T', direction: 'in' },
    { name: 'CLK', direction: 'in' },
    { name: 'CLR', direction: 'in' },
    { name: 'Q', direction: 'out' },
    { name: 'Q_inv', direction: 'out' },
  ],
  JKFlipFlop: [
    { name: 'J', direction: 'in' },
    { name: 'K', direction: 'in' },
    { name: 'CLK', direction: 'in' },
    { name: 'CLR', direction: 'in' },
    { name: 'Q', direction: 'out' },
    { name: 'Q_inv', direction: 'out' },
  ],
  Counter4Bit: [
    { name: 'CLK', direction: 'in' },
    { name: 'RST', direction: 'in' },
    { name: 'Q0', direction: 'out' },
    { name: 'Q1', direction: 'out' },
    { name: 'Q2', direction: 'out' },
    { name: 'Q3', direction: 'out' },
  ],
};

export const netlistFromIr = (ir: CircuitIR): Netlist => {
  const portDirectionsByNode = buildPortDirectionsByNode(ir);

  const nodes: NetlistNode[] = [
    ...ir.ports.map((port) => buildPortNode(port, portDirectionsByNode.get(port.sourceNodeId))),
    ...ir.primitives.map((primitive) => buildPrimitiveNode(primitive, portDirectionsByNode.get(primitive.sourceNodeId))),
  ].sort((left, right) => compareCodepoint(left.id, right.id));

  const nets = ir.nets
    .flatMap((net) =>
      net.drivers.flatMap((driver) =>
        net.sinks.map((sink) => ({
          id: `${driver.nodeId}.${driver.port}->${sink.nodeId}.${sink.port}`,
          name: net.name,
          from: {
            nodeId: driver.nodeId,
            port: driver.port,
          },
          to: {
            nodeId: sink.nodeId,
            port: sink.port,
          },
        }))
      )
    )
    .sort((left, right) => compareCodepoint(left.id, right.id));

  return {
    kind: 'rb-netlist',
    version: 1,
    createdAt: '1970-01-01T00:00:00.000Z',
    circuitDigest: ir.irHash,
    nodes,
    nets,
  };
};

export const netlistFromCircuit = (circuit: Circuit): Netlist => {
  // TODO(slice4-migration): remove this raw-circuit wrapper once all export callers
  // build CircuitIR upstream and delegate through netlistFromIr(...) directly.
  const { ir } = elaborateCircuit(circuit);
  return netlistFromIr(ir);
};

function buildPortDirectionsByNode(ir: CircuitIR): Map<string, Map<string, PortDirection>> {
  const portDirectionsByNode = new Map<string, Map<string, PortDirection>>();

  const register = (nodeId: string, portName: string, direction: PortDirection): void => {
    if (!portDirectionsByNode.has(nodeId)) {
      portDirectionsByNode.set(nodeId, new Map<string, PortDirection>());
    }
    portDirectionsByNode.get(nodeId)?.set(portName, direction);
  };

  for (const net of ir.nets) {
    for (const driver of net.drivers) {
      register(driver.nodeId, driver.port, 'out');
    }
    for (const sink of net.sinks) {
      register(sink.nodeId, sink.port, 'in');
    }
  }

  return portDirectionsByNode;
}

function buildPortNode(
  port: IRPort,
  portDirections: Map<string, PortDirection> | undefined,
): NetlistNode {
  const type = port.kind === 'output' ? 'Lamp' : port.kind === 'clock' ? 'Clock' : 'Switch';
  return {
    id: port.sourceNodeId,
    type,
    label: port.name,
    ports: mergePorts(type, portDirections),
    boundaryKind: port.kind,
  };
}

function buildPrimitiveNode(
  primitive: IRPrimitive,
  portDirections: Map<string, PortDirection> | undefined,
): NetlistNode {
  return {
    id: primitive.sourceNodeId,
    type: primitive.type,
    label: primitive.label,
    ports: mergePorts(primitive.type, portDirections),
    clockBinding: primitive.clockBinding,
    resetBinding: primitive.resetBinding,
  };
}

function mergePorts(
  type: string,
  portDirections: Map<string, PortDirection> | undefined,
): NetlistPort[] {
  const merged = new Map<string, PortDirection>();

  for (const port of BUILTIN_PORTS[type] ?? []) {
    merged.set(port.name, port.direction);
  }
  for (const [name, direction] of portDirections ?? []) {
    merged.set(name, direction);
  }

  return Array.from(merged.entries())
    .map(([name, direction]) => ({ name, direction }))
    .sort((left, right) => compareCodepoint(left.name, right.name));
}
