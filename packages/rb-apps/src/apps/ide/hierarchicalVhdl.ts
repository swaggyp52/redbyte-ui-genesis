import type { Circuit, Connection, Node, PortRef } from '@redbyte/rb-logic-core';
import type { IoMapping } from '@redbyte/rb-utils';
import { netlistFromCircuit } from '../../export/netlistExport';
import { vhdlFromNetlist, type VhdlTopPort } from '../../export/vhdlExport';
import { buildVhdlTopLevelBindings } from '../../fpga/boards/basys3/basys3Bundle';
import type { RBProject } from '../../export/projectFormat';
import type { NativeVisualModuleDefinition, ModulePort } from './projectHierarchy';
import { modulePortVhdlType, modulePortWidth } from './projectHierarchy';

export interface HierarchicalVhdlProject {
  topVhd: string;
  moduleSources: Array<{ path: string; entityName: string; text: string }>;
}

export function generateHierarchicalVhdlProject(project: RBProject): HierarchicalVhdlProject | null {
  const hierarchy = project.hierarchy;
  const ioMapping = project.ioMapping;
  if (!hierarchy || hierarchy.modules.length === 0 || !ioMapping) return null;
  const topEntity = safeIdentifier(project.hdl?.top ?? project.fpga?.top ?? 'top');
  return {
    topVhd: generateStructuralTop(project.circuit, hierarchy.modules, ioMapping, topEntity),
    moduleSources: hierarchy.modules.map((module) => ({
      path: `${snakeCase(module.name)}.vhd`,
      entityName: module.name,
      text: generateModuleSource(module),
    })),
  };
}

function generateModuleSource(module: NativeVisualModuleDefinition): string {
  const boundaryIds = new Set(
    module.circuit.nodes
      .filter((node) => typeof node.config?.moduleBoundary === 'string')
      .map((node) => node.id),
  );
  const internalCircuit: Circuit = {
    nodes: module.circuit.nodes.filter((node) => !boundaryIds.has(node.id)).map(cloneNode),
    connections: module.circuit.connections
      .filter((connection) => {
        const from = endpoint(connection.from, 'out');
        const to = endpoint(connection.to, 'in');
        return !boundaryIds.has(from.nodeId) && !boundaryIds.has(to.nodeId);
      })
      .map(cloneConnection),
  };
  const topPorts: VhdlTopPort[] = module.ports.map((port) => ({
    name: port.name,
    dir: port.direction === 'input' ? 'in' : 'out',
    vhdlType: modulePortVhdlType(port),
  }));
  // Vector module ports bind per declared bit (portName + bitIndex); scalar
  // ports keep their single binding. The netlist emitter turns bitIndex into
  // `PORT(i)` associations inside the module architecture.
  const portBits = (port: ModulePort): Array<{ bitIndex?: number; refs: typeof port.sourceBoundary.internalRefs }> =>
    modulePortWidth(port) > 1 && port.sourceBoundary.bits
      ? port.sourceBoundary.bits.map((bit) => ({ bitIndex: bit.index, refs: bit.internalRefs }))
      : [{ bitIndex: undefined, refs: port.sourceBoundary.internalRefs }];
  const topInputBindings = module.ports
    .filter((port) => port.direction === 'input')
    .flatMap((port) => portBits(port).flatMap((bit) => bit.refs.map((ref) => ({
      portName: port.name,
      bitIndex: bit.bitIndex,
      toNodeId: ref.nodeId,
      toPort: ref.portName,
    }))));
  const topOutputBindings = module.ports
    .filter((port) => port.direction === 'output')
    .flatMap((port) => portBits(port).flatMap((bit) => bit.refs.slice(0, 1).map((ref) => ({
      portName: port.name,
      bitIndex: bit.bitIndex,
      fromNodeId: ref.nodeId,
      fromPort: ref.portName,
    }))));
  return vhdlFromNetlist(netlistFromCircuit(internalCircuit), {
    entityName: module.name,
    topPorts,
    topInputBindings,
    topOutputBindings,
    includeFileHeader: true,
    labTitle: `${module.displayName} project component`,
  }).vhd;
}

function generateStructuralTop(
  circuit: Circuit,
  modules: readonly NativeVisualModuleDefinition[],
  ioMapping: IoMapping,
  entityName: string,
): string {
  const bindings = buildVhdlTopLevelBindings(ioMapping);
  const moduleById = new Map(modules.map((module) => [module.id, module]));
  const moduleByName = new Map(modules.map((module) => [module.name, module]));
  const nodeById = new Map(circuit.nodes.map((node) => [node.id, node]));
  // A boundary node maps to a top-level port; for a vector port it maps to one
  // BIT of that port. Emit the bit-selected reference `NAME(i)` so a bus member
  // wires to A(0) rather than the whole vector A (which would be a width
  // mismatch and, on outputs, a multi-driver).
  const topPortRef = (binding: { portName: string; bitIndex?: number }): string =>
    binding.bitIndex === undefined ? binding.portName : `${binding.portName}(${binding.bitIndex})`;
  const inputPortByNode = new Map(bindings.topInputBindings.map((binding) => [binding.toNodeId, topPortRef(binding)]));
  const outputPortByNode = new Map(bindings.topOutputBindings.map((binding) => [binding.fromNodeId, topPortRef(binding)]));
  const incoming = new Map<string, PortRef>();
  for (const connection of circuit.connections) {
    const from = endpoint(connection.from, 'out');
    const to = endpoint(connection.to, 'in');
    incoming.set(`${to.nodeId}.${to.portName}`, from);
  }

  const signalNames = new Set<string>();
  const signalFor = (nodeId: string, portName = 'out') => {
    const name = `n_${safeIdentifier(nodeId)}_${safeIdentifier(portName)}`;
    signalNames.add(name);
    return name;
  };
  const sourceForInput = (nodeId: string, portName: string): string => {
    const ref = incoming.get(`${nodeId}.${portName}`);
    if (!ref) return "'0'";
    const topPort = inputPortByNode.get(ref.nodeId);
    if (topPort) return topPort;
    return signalFor(ref.nodeId, ref.portName);
  };

  const statements: string[] = [];
  for (const node of circuit.nodes) {
    const module = moduleById.get(readString(node.config?.moduleDefinitionId)) ?? moduleByName.get(node.type);
    if (module) {
      const associations = module.ports.map((port) => {
        const expression = port.direction === 'input'
          ? sourceForInput(node.id, port.name)
          : signalFor(node.id, port.name);
        return `      ${port.name} => ${expression}`;
      });
      statements.push(
        `  ${safeIdentifier(readString(node.config?.instanceName) || node.label || node.id)} : entity work.${module.name}`,
        '    port map (',
        associations.join(',\n'),
        '    );',
      );
      continue;
    }
    if (isBoundaryInput(node) || isBoundaryOutput(node)) continue;
    const target = signalFor(node.id, 'out');
    const a = sourceForInput(node.id, firstConnectedPort(node, incoming, ['a', 'in', 'd']) ?? 'a');
    const b = sourceForInput(node.id, firstConnectedPort(node, incoming, ['b']) ?? 'b');
    const c = sourceForInput(node.id, firstConnectedPort(node, incoming, ['c']) ?? 'c');
    const expression = gateExpression(node.type, a, b, c);
    statements.push(`  ${target} <= ${expression};`);
  }
  for (const [nodeId, portName] of outputPortByNode) {
    const node = nodeById.get(nodeId);
    const inputPort = node && isBoundaryOutput(node) ? 'in' : 'out';
    const ref = incoming.get(`${nodeId}.${inputPort}`);
    statements.push(`  ${portName} <= ${ref ? (inputPortByNode.get(ref.nodeId) ?? signalFor(ref.nodeId, ref.portName)) : "'0'"};`);
  }

  const ports = bindings.topPorts.map((port) =>
    `    ${port.name} : ${port.dir.toUpperCase()} ${port.vhdlType ?? 'STD_LOGIC'}`,
  );
  return [
    '-- Generated by RedByte from the native visual project hierarchy.',
    'library IEEE;',
    'use IEEE.STD_LOGIC_1164.ALL;',
    '',
    `entity ${entityName} is`,
    ports.length > 0 ? '  port (' : '',
    ports.join(';\n'),
    ports.length > 0 ? '  );' : '',
    `end entity ${entityName};`,
    '',
    `architecture structural of ${entityName} is`,
    ...[...signalNames].sort().map((signal) => `  signal ${signal} : STD_LOGIC := '0';`),
    'begin',
    ...statements,
    'end structural;',
    '',
  ].filter((line) => line !== '').join('\n');
}

function gateExpression(type: string, a: string, b: string, c: string): string {
  switch (type.toUpperCase()) {
    case 'AND': return `${a} and ${b}`;
    case 'AND3': return `${a} and ${b} and ${c}`;
    case 'OR': return `${a} or ${b}`;
    case 'OR3': return `${a} or ${b} or ${c}`;
    case 'XOR': return `${a} xor ${b}`;
    case 'XOR3': return `${a} xor ${b} xor ${c}`;
    case 'NAND': return `not (${a} and ${b})`;
    case 'NOR': return `not (${a} or ${b})`;
    case 'XNOR': return `not (${a} xor ${b})`;
    case 'NOT': return `not ${a}`;
    case 'BUF':
    case 'BUFFER': return a;
    case 'GROUND': return "'0'";
    default: return "'0'";
  }
}

function firstConnectedPort(node: Node, incoming: Map<string, PortRef>, candidates: string[]): string | null {
  return candidates.find((port) => incoming.has(`${node.id}.${port}`)) ?? null;
}

function isBoundaryInput(node: Node): boolean {
  return ['INPUT', 'SWITCH', 'CLOCK'].includes(node.type.toUpperCase());
}

function isBoundaryOutput(node: Node): boolean {
  return ['OUTPUT', 'LAMP', 'LED'].includes(node.type.toUpperCase());
}

function endpoint(value: Connection['from'] | Connection['to'], fallback: string): PortRef {
  if (typeof value === 'string') return { nodeId: value, portName: fallback };
  return { nodeId: value.nodeId, portName: value.portName ?? value.port ?? fallback };
}

function cloneNode(node: Node): Node {
  return { ...node, config: node.config ? { ...node.config } : node.config, position: node.position ? { ...node.position } : node.position };
}

function cloneConnection(connection: Connection): Connection {
  return { ...connection, from: endpoint(connection.from, 'out'), to: endpoint(connection.to, 'in') };
}

function safeIdentifier(value: string): string {
  const cleaned = value.trim().replace(/[^A-Za-z0-9_]+/g, '_').replace(/^([^A-Za-z])/, '_$1');
  return cleaned || 'top';
}

function snakeCase(value: string): string {
  return safeIdentifier(value).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
