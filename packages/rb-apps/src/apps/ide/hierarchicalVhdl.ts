import type { Circuit, Connection, Node, PortRef } from '@redbyte/rb-logic-core';
import type { IoMapping } from '@redbyte/rb-utils';
import { canonicalizeSemanticCircuit } from '../../circuit/semanticCircuit';
import { netlistFromCircuit } from '../../export/netlistExport';
import {
  canonicalPrimitiveOutputPort,
  emitPrimitiveVhdl,
  isEmittablePrimitiveType,
  isInitializedSequentialType,
  unresolvedDriverMarker,
  unsupportedPrimitiveMessage,
  vhdlFromNetlist,
  type PrimitiveOutputPort,
  type VhdlNodeSourceSpan,
  type VhdlTopPort,
} from '../../export/vhdlExport';
import { buildBasys3ExportModel } from '../../fpga/boards/basys3/basys3ExportModel';
import type { RBProject } from '../../export/projectFormat';
import type { NativeVisualModuleDefinition, ModulePort } from './projectHierarchy';
import {
  elaborateProjectHierarchy,
  modulePortIndices,
  modulePortVhdlType,
  modulePortWidth,
  splitBitPort,
} from './projectHierarchy';
import { moduleNameCollision, VHDL_RESERVED_WORDS } from './vhdlNames';

/**
 * A construct the hierarchical emitter could not express exactly. Errors mean the
 * shipped HDL would not match the simulated design; the export view model blocks
 * the package on them (the message format maps to the RBEX codes).
 */
export interface HierarchicalVhdlDiagnostic {
  severity: 'error' | 'warning';
  message: string;
  /** 'top' or the module definition id the construct belongs to. */
  definitionId: string;
  /** Package file that carries the construct. */
  path: string;
  /** Node id local to that definition. */
  nodeId?: string;
}

export interface HierarchicalVhdlProject {
  topVhd: string;
  sourceMap: Array<VhdlNodeSourceSpan & { path: string; definitionId: string }>;
  moduleSources: Array<{ path: string; entityName: string; text: string }>;
  diagnostics: HierarchicalVhdlDiagnostic[];
}

export function generateHierarchicalVhdlProject(project: RBProject | Pick<RBProject, 'circuit' | 'hierarchy' | 'ioMapping' | 'hdl' | 'fpga'>): HierarchicalVhdlProject | null {
  const hierarchy = project.hierarchy;
  const ioMapping = project.ioMapping;
  if (!hierarchy || hierarchy.modules.length === 0 || !ioMapping) return null;
  const topEntity = safeIdentifier(project.hdl?.top ?? project.fpga?.top ?? 'top');
  const moduleById = new Map(hierarchy.modules.map((module) => [module.id, module]));
  const moduleByName = new Map(hierarchy.modules.map((module) => [module.name, module]));
  const diagnostics: HierarchicalVhdlDiagnostic[] = [];
  for (const module of hierarchy.modules) {
    const collision = moduleNameCollision(module.name, topEntity);
    if (collision) {
      diagnostics.push({
        severity: 'error',
        definitionId: module.id,
        path: modulePath(module),
        message:
          `Module name "${module.name}" ${collision}, so it cannot be an entity in the exported VHDL. ` +
          'Fix: rename the module; its instances and simulation are unchanged.',
      });
    }
  }
  const sourceMap: HierarchicalVhdlProject['sourceMap'] = [];
  const topMap: VhdlNodeSourceSpan[] = [];
  const topVhd = generateStructuralTop(project.circuit, hierarchy, ioMapping, topEntity, topMap, diagnostics);
  sourceMap.push(...topMap.map(span => ({ ...span, path: 'top.vhd', definitionId: 'top' })));
  return {
    topVhd,
    sourceMap,
    // Leaf definitions first so a module that instantiates another is analyzed
    // after its dependency (Vivado compile order follows source order).
    moduleSources: orderModulesLeafFirst(hierarchy.modules, moduleById, moduleByName).map((module) => {
      const map: VhdlNodeSourceSpan[] = [];
      const path = modulePath(module);
      const text = generateModuleSource(module, moduleById, moduleByName, map, diagnostics);
      sourceMap.push(...map.map(span => ({ ...span, path, definitionId: module.id })));
      return { path, entityName: module.name, text };
    }),
    diagnostics,
  };
}

function modulePath(module: NativeVisualModuleDefinition): string {
  return `${snakeCase(module.name)}.vhd`;
}

/** Resolve the child module a node instantiates, or null for a primitive gate. */
function resolveChildModule(
  node: Node,
  moduleById: Map<string, NativeVisualModuleDefinition>,
  moduleByName: Map<string, NativeVisualModuleDefinition>,
): NativeVisualModuleDefinition | null {
  return (
    moduleById.get(readString(node.config?.moduleDefinitionId)) ??
    moduleByName.get(node.type) ??
    null
  );
}

/** Topological (leaf-first) order over the module instantiation DAG. */
function orderModulesLeafFirst(
  modules: readonly NativeVisualModuleDefinition[],
  moduleById: Map<string, NativeVisualModuleDefinition>,
  moduleByName: Map<string, NativeVisualModuleDefinition>,
): NativeVisualModuleDefinition[] {
  const ordered: NativeVisualModuleDefinition[] = [];
  const placed = new Set<string>();
  const visiting = new Set<string>();
  const visit = (module: NativeVisualModuleDefinition): void => {
    if (placed.has(module.id) || visiting.has(module.id)) return;
    visiting.add(module.id);
    for (const node of module.circuit.nodes) {
      const child = resolveChildModule(node, moduleById, moduleByName);
      if (child && child.id !== module.id) visit(child);
    }
    visiting.delete(module.id);
    if (!placed.has(module.id)) {
      placed.add(module.id);
      ordered.push(module);
    }
  };
  for (const module of modules) visit(module);
  return ordered;
}

function generateModuleSource(
  module: NativeVisualModuleDefinition,
  moduleById: Map<string, NativeVisualModuleDefinition>,
  moduleByName: Map<string, NativeVisualModuleDefinition>,
  sourceMap: VhdlNodeSourceSpan[],
  diagnostics: HierarchicalVhdlDiagnostic[],
): string {
  // A definition that itself instantiates another module needs a STRUCTURAL
  // architecture (component instantiations), not the gate-only netlist path.
  const containsInstance = module.circuit.nodes.some(
    (node) =>
      typeof node.config?.moduleBoundary !== 'string' &&
      resolveChildModule(node, moduleById, moduleByName) !== null,
  );
  if (containsInstance) {
    return generateStructuralModuleSource(module, moduleById, moduleByName, sourceMap, diagnostics);
  }
  const path = modulePath(module);
  const boundaryIds = new Set(
    module.circuit.nodes
      .filter((node) => typeof node.config?.moduleBoundary === 'string')
      .map((node) => node.id),
  );
  // Same semantic canonicalization as the flat export (a 4-NAND D-latch becomes
  // the DLatch primitive), so the leaf ships what the gate validated.
  const internalCircuit = canonicalizeSemanticCircuit({
    nodes: module.circuit.nodes.filter((node) => !boundaryIds.has(node.id)).map(cloneNode),
    connections: module.circuit.connections
      .filter((connection) => {
        const from = endpoint(connection.from, 'out');
        const to = endpoint(connection.to, 'in');
        return !boundaryIds.has(from.nodeId) && !boundaryIds.has(to.nodeId);
      })
      .map(cloneConnection),
  });
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
  const netlist = netlistFromCircuit(internalCircuit);
  // The netlist is built from the IR, which does not carry node configuration;
  // reattach it so a Register1's reset/enable contract survives (as the flat
  // export model does).
  const configById = new Map(internalCircuit.nodes.map((node) => [node.id, node.config] as const));
  for (const node of netlist.nodes) {
    const config = configById.get(node.id);
    if (config) (node as typeof node & { config?: Record<string, unknown> }).config = { ...config };
  }
  const emitted = vhdlFromNetlist(netlist, {
    entityName: module.name,
    topPorts,
    topInputBindings,
    topOutputBindings,
    includeFileHeader: true,
    labTitle: `${module.displayName} project component`,
  });
  for (const message of emitted.errors) {
    diagnostics.push({ severity: 'error', message: `${message} [in ${path}]`, definitionId: module.id, path, nodeId: extractQuotedNode(message) });
  }
  sourceMap.push(...emitted.sourceMap);
  return emitted.vhd;
}

/** How a structural architecture reaches its boundary (top board ports or module ports). */
interface StructuralBoundary {
  /** Port expression for a boundary input node, or undefined when the node is not one. */
  inputExpr: (nodeId: string) => string | undefined;
  /** True for nodes that are boundary markers, not logic. */
  isBoundary: (node: Node) => boolean;
}

interface StructuralBody {
  statements: string[];
  /** Declared signal -> declaration type and optional initial value. */
  signals: Map<string, { type: string; init?: string }>;
  signalFor: (nodeId: string, portName: string) => string;
  incoming: Map<string, PortRef>;
}

/**
 * Concurrent statements for one structural architecture (the top or a module
 * that instantiates other modules). Primitives use the shared emitter, module
 * instances become `entity work.<Child>` port maps with per-bit association for
 * vector ports, and anything else is a diagnostic plus a marker, never a
 * constant.
 */
function emitStructuralBody(
  rawCircuit: Circuit,
  boundary: StructuralBoundary,
  context: {
    definitionId: string;
    path: string;
    moduleById: Map<string, NativeVisualModuleDefinition>;
    moduleByName: Map<string, NativeVisualModuleDefinition>;
    sourceMap: VhdlNodeSourceSpan[];
    diagnostics: HierarchicalVhdlDiagnostic[];
  },
): StructuralBody {
  const circuit = canonicalizeSemanticCircuit(rawCircuit);
  const { moduleById, moduleByName, diagnostics } = context;
  const nodeById = new Map(circuit.nodes.map((node) => [node.id, node]));
  const incoming = new Map<string, PortRef>();
  for (const connection of circuit.connections) {
    const from = endpoint(connection.from, 'out');
    const to = endpoint(connection.to, 'in');
    incoming.set(`${to.nodeId}.${to.portName}`, from);
  }
  const signals = new Map<string, { type: string; init?: string }>();
  const report = (message: string, nodeId?: string) => {
    if (diagnostics.some((entry) => entry.message === message)) return;
    diagnostics.push({ severity: 'error', message, definitionId: context.definitionId, path: context.path, nodeId });
  };

  /** Signal carrying a node's output port; vector instance outputs are bit-selected. */
  const signalFor = (nodeId: string, portName: string): string => {
    const node = nodeById.get(nodeId);
    const child = node ? resolveChildModule(node, moduleById, moduleByName) : null;
    if (child) {
      const { base, bitIndex } = splitBitPort(portName);
      const port = child.ports.find((entry) => entry.direction === 'output' && entry.name === base);
      if (!port) {
        report(`Unresolved driver "${nodeId}.${portName}" on node "${nodeId}": module ${child.name} has no output ${base} [in ${context.path}].`, nodeId);
        return unresolvedDriverMarker(nodeId, portName);
      }
      const name = structuralSignalName(nodeId, port.name);
      const vector = modulePortWidth(port) > 1;
      signals.set(name, { type: vector ? modulePortVhdlType(port) : 'STD_LOGIC' });
      return vector && bitIndex !== undefined ? `${name}(${bitIndex})` : name;
    }
    const canonical: PrimitiveOutputPort | null = node && isEmittablePrimitiveType(node.type)
      ? canonicalPrimitiveOutputPort(node.type, portName, node.config)
      : 'out';
    if (!canonical) {
      report(`Unresolved driver "${nodeId}.${portName}" on node "${nodeId}": a ${node?.type} has no output ${portName} [in ${context.path}].`, nodeId);
      return unresolvedDriverMarker(nodeId, portName);
    }
    return primitiveOutputSignal(nodeId, canonical);
  };
  /** The structural signal carrying one canonical output of a primitive (emitPrimitiveVhdl's own outputs). */
  const primitiveOutputSignal = (nodeId: string, port: PrimitiveOutputPort): string => {
    const name = structuralSignalName(nodeId, port);
    if (!signals.has(name)) signals.set(name, { type: 'STD_LOGIC' });
    return name;
  };
  const sourceFor = (ref: PortRef): string => boundary.inputExpr(ref.nodeId) ?? signalFor(ref.nodeId, ref.portName);
  // Exact port names, as the simulator and hierarchy flattening read them: 'A' is not 'a'.
  const sourceForInput = (nodeId: string, portName: string): string | undefined => {
    const ref = incoming.get(`${nodeId}.${portName}`);
    return ref ? sourceFor(ref) : undefined;
  };
  const incomingPortsOf = (nodeId: string): string[] =>
    circuit.connections.map((connection) => endpoint(connection.to, 'in')).filter((to) => to.nodeId === nodeId).map((to) => to.portName);

  const statements: string[] = [];
  const mapped = new StatementSourceMap(statements, context.sourceMap);
  for (const node of circuit.nodes) {
    if (boundary.isBoundary(node)) continue;
    const before = statements.length;
    const child = resolveChildModule(node, moduleById, moduleByName);
    if (child) {
      // Flattening binds a wire to the input port of exactly that name; any other wire is ignored.
      const declaredInputs = child.ports.filter((port) => port.direction !== 'output');
      for (const portName of incomingPortsOf(node.id)) {
        const base = portName.replace(/\(\d+\)$|\[\d+\]$/, '');
        if (declaredInputs.some((port) => port.name === base)) continue;
        report(
          `Wire into port "${portName}" on node "${node.id}" (module ${child.name}) is ignored: the module has no input of that name ` +
            `(its inputs are ${declaredInputs.map((port) => `"${port.name}"`).join(', ') || 'none'}), so the simulator ignores this wire ` +
            `and exported hardware could only copy that [in ${context.path}]. Fix: move the wire to one of those inputs or remove it; the design and its simulation are unchanged.`,
          node.id,
        );
      }
      const associations = child.ports.flatMap((port) => {
        const vector = modulePortWidth(port) > 1;
        // A vector output associates whole: the instance's output signal is declared as that vector.
        if (port.direction === 'output') return [`      ${port.name} => ${signalFor(node.id, port.name)}`];
        if (!vector) return [`      ${port.name} => ${sourceForInput(node.id, port.name) ?? "'0'"}`];
        // One association per declared bit; an unconnected bit reads '0', as in the simulator.
        return modulePortIndices(port).map((bit) =>
          `      ${port.name}(${bit}) => ${sourceForInput(node.id, `${port.name}(${bit})`) ?? "'0'"}`);
      });
      statements.push(
        `  ${instanceLabel(readString(node.config?.instanceName) || node.label || node.id)} : entity work.${child.name}`,
        '    port map (',
        associations.join(',\n'),
        '    );',
      );
      mapped.add(node.id, before, 'instance');
      continue;
    }
    const definitionId = readString(node.config?.moduleDefinitionId);
    if (definitionId) {
      report(
        `Module instance "${node.id}" references missing definition "${definitionId}" [in ${context.path}]. ` +
          'Fix: restore the module definition or delete the instance; the design and its simulation are unchanged.',
        node.id,
      );
      statements.push(`  -- RBEX4100 missing module definition ${definitionId} (${node.id}): not exported`);
      mapped.add(node.id, before, 'evaluation');
      continue;
    }
    if (!isEmittablePrimitiveType(node.type)) {
      report(unsupportedPrimitiveMessage(node.type, node.id, `in ${context.path}`), node.id);
      statements.push(`  -- RBEX4100 unsupported primitive ${node.type} (${node.id}): not exported`);
      mapped.add(node.id, before, 'evaluation');
      continue;
    }
    const emitted = emitPrimitiveVhdl({
      id: node.id,
      type: node.type,
      config: node.config,
      output: (port) => primitiveOutputSignal(node.id, port),
      input: (port) => sourceForInput(node.id, port),
      connectedPorts: incomingPortsOf(node.id),
    });
    for (const error of emitted.errors) report(`${error} [in ${context.path}]`, node.id);
    if (isInitializedSequentialType(node.type)) {
      // Registers and latches power up at Q=0 / Q_inv=1, like the simulator.
      signals.set(structuralSignalName(node.id, 'Q'), { type: 'STD_LOGIC', init: "'0'" });
      signals.set(structuralSignalName(node.id, 'Q_inv'), { type: 'STD_LOGIC', init: "'1'" });
    }
    statements.push(...emitted.lines);
    mapped.add(node.id, before, 'evaluation');
  }
  return { statements, signals, signalFor, incoming };
}

function signalDeclarations(signals: StructuralBody['signals']): string[] {
  return [...signals.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([name, { type, init }]) => `  signal ${name} : ${type}${init ? ` := ${init}` : ''};`);
}

/**
 * Structural VHDL for a definition that itself instantiates other modules.
 * Boundary nodes become entity ports; internal primitives and nested module
 * instances go through the shared structural body.
 */
function generateStructuralModuleSource(
  module: NativeVisualModuleDefinition,
  moduleById: Map<string, NativeVisualModuleDefinition>,
  moduleByName: Map<string, NativeVisualModuleDefinition>,
  sourceMap: VhdlNodeSourceSpan[],
  diagnostics: HierarchicalVhdlDiagnostic[],
): string {
  const path = modulePath(module);
  const portById = new Map(module.ports.map((port) => [port.id, port]));
  // boundary node id -> the port expression it stands for (NAME or NAME(bit)).
  interface BoundaryRef { direction: 'input' | 'output'; expr: string }
  const boundaryByNode = new Map<string, BoundaryRef>();
  for (const node of module.circuit.nodes) {
    const direction = readString(node.config?.moduleBoundary);
    if (direction !== 'input' && direction !== 'output') continue;
    const port = portById.get(readString(node.config?.modulePortId));
    if (!port) {
      diagnostics.push({
        severity: 'error',
        definitionId: module.id,
        path,
        nodeId: node.id,
        message:
          `Module boundary "${node.id}" references missing port "${readString(node.config?.modulePortId)}" [in ${path}]. ` +
          'Fix: recreate the module port or remove the boundary marker; the design and its simulation are unchanged.',
      });
      continue;
    }
    const vector = modulePortWidth(port) > 1;
    if (vector && typeof node.config?.portBitIndex !== 'number') {
      diagnostics.push({
        severity: 'error',
        definitionId: module.id,
        path,
        nodeId: node.id,
        message:
          `Module boundary "${node.id}" of vector port "${port.name}" has no bit index [in ${path}]. ` +
          'Fix: recreate the bus port; the design and its simulation are unchanged.',
      });
      continue;
    }
    boundaryByNode.set(node.id, { direction, expr: vector ? `${port.name}(${node.config?.portBitIndex})` : port.name });
  }

  const body = emitStructuralBody(
    module.circuit,
    {
      inputExpr: (nodeId) => {
        const ref = boundaryByNode.get(nodeId);
        return ref?.direction === 'input' ? ref.expr : undefined;
      },
      isBoundary: (node) => typeof node.config?.moduleBoundary === 'string',
    },
    { definitionId: module.id, path, moduleById, moduleByName, sourceMap, diagnostics },
  );
  const statements = [...body.statements];
  const mapped = new StatementSourceMap(statements, sourceMap);
  // Drive each output port bit from whatever feeds its boundary node.
  for (const node of module.circuit.nodes) {
    const boundary = boundaryByNode.get(node.id);
    if (boundary?.direction !== 'output') continue;
    const before = statements.length;
    const ref = body.incoming.get(`${node.id}.in`);
    // An undriven module output reads '0' in the simulator; keep it explicit.
    const driver = ref ? (boundaryByNode.get(ref.nodeId)?.direction === 'input' ? boundaryByNode.get(ref.nodeId)!.expr : body.signalFor(ref.nodeId, ref.portName)) : "'0'";
    statements.push(`  ${boundary.expr} <= ${driver};${ref ? '' : ' -- undriven output'}`);
    mapped.add(node.id, before, 'boundary');
  }
  for (const port of module.ports) {
    if (port.direction !== 'output') continue;
    const driven = module.circuit.nodes.some((node) => boundaryByNode.get(node.id)?.direction === 'output'
      && readString(node.config?.modulePortId) === port.id);
    if (!driven) {
      diagnostics.push({
        severity: 'warning',
        definitionId: module.id,
        path,
        message: `Module output port "${port.name}" has no boundary driver [in ${path}] and is left unassigned.`,
      });
    }
  }

  const ports = module.ports.map((port) =>
    `    ${port.name} : ${port.direction === 'input' ? 'IN' : 'OUT'} ${modulePortVhdlType(port)}`,
  );
  const header = [
    '-- Generated by RedByte from a native visual module (structural).',
    'library IEEE;',
    'use IEEE.STD_LOGIC_1164.ALL;',
    '',
    `entity ${module.name} is`,
    ports.length > 0 ? '  port (' : '',
    ports.join(';\n'),
    ports.length > 0 ? '  );' : '',
    `end entity ${module.name};`,
    '',
    `architecture structural of ${module.name} is`,
    ...signalDeclarations(body.signals),
    'begin',
  ];
  new StatementSourceMap([], sourceMap).offset(header);
  return [...header, ...statements,
    'end structural;',
    '',
  ].filter((line) => line !== '').join('\n');
}

function generateStructuralTop(
  rawCircuit: Circuit,
  hierarchy: NonNullable<RBProject['hierarchy']>,
  ioMapping: IoMapping,
  entityName: string,
  sourceMap: VhdlNodeSourceSpan[],
  diagnostics: HierarchicalVhdlDiagnostic[],
): string {
  const modules = hierarchy.modules;
  // One naming authority for top.vhd and top.xdc: the same export model the
  // flat bundle (and therefore the XDC) is built from, with declared buses.
  const exportModel = buildBasys3ExportModel(elaborateProjectHierarchy(rawCircuit, hierarchy), ioMapping);
  const bindings = { topPorts: exportModel.topPorts, topInputBindings: exportModel.topInputBindings, topOutputBindings: exportModel.topOutputBindings };
  const moduleById = new Map(modules.map((module) => [module.id, module]));
  const moduleByName = new Map(modules.map((module) => [module.name, module]));
  const nodeById = new Map(rawCircuit.nodes.map((node) => [node.id, node]));
  // A boundary node maps to a top-level port; for a vector port it maps to one
  // BIT of that port. Emit the bit-selected reference `NAME(i)` so a bus member
  // wires to A(0) rather than the whole vector A.
  const topPortRef = (binding: { portName: string; bitIndex?: number }): string =>
    binding.bitIndex === undefined ? binding.portName : `${binding.portName}(${binding.bitIndex})`;
  const inputPortByNode = new Map(bindings.topInputBindings.map((binding) => [binding.toNodeId, topPortRef(binding)]));
  const outputPortByNode = new Map(bindings.topOutputBindings.map((binding) => [binding.fromNodeId, topPortRef(binding)]));

  const body = emitStructuralBody(
    rawCircuit,
    {
      inputExpr: (nodeId) => inputPortByNode.get(nodeId),
      isBoundary: (node) => isBoundaryInput(node) || isBoundaryOutput(node),
    },
    { definitionId: 'top', path: 'top.vhd', moduleById, moduleByName, sourceMap, diagnostics },
  );
  const statements = [...body.statements];
  const mapped = new StatementSourceMap(statements, sourceMap);
  for (const [nodeId, portName] of outputPortByNode) {
    const before = statements.length;
    const node = nodeById.get(nodeId);
    const inputPort = node && isBoundaryOutput(node) ? 'in' : 'out';
    const ref = body.incoming.get(`${nodeId}.${inputPort}`);
    const driver = ref ? (inputPortByNode.get(ref.nodeId) ?? body.signalFor(ref.nodeId, ref.portName)) : "'0'";
    statements.push(`  ${portName} <= ${driver};${ref ? '' : ' -- undriven output'}`);
    mapped.add(nodeId, before, 'boundary');
  }

  const ports = bindings.topPorts.map((port) =>
    `    ${port.name} : ${port.dir.toUpperCase()} ${port.vhdlType ?? 'STD_LOGIC'}`,
  );
  const header = [
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
    ...signalDeclarations(body.signals),
    'begin',
  ];
  new StatementSourceMap([], sourceMap).offset(header);
  const declarationStart = header.slice(0,6).filter(line=>line!=='').join('\n').split('\n').length+1;
  for(const binding of bindings.topInputBindings){
    const index=bindings.topPorts.findIndex(port=>port.name===binding.portName);
    if(index>=0)sourceMap.push({nodeId:binding.toNodeId,kind:'boundary',startLine:declarationStart+index,endLine:declarationStart+index});
  }
  return [...header, ...statements,
    'end structural;',
    '',
  ].filter((line) => line !== '').join('\n');
}

/** Line spans recorded at emission; no searching generated text for labels. */
class StatementSourceMap {
  constructor(private statements: string[], private spans: VhdlNodeSourceSpan[]) {}
  add(nodeId: string, before: number, kind: VhdlNodeSourceSpan['kind']) {
    if (this.statements.length === before) return;
    const lineCount = (items: string[]) => items.filter(line => line !== '').join('\n').split('\n').length;
    this.spans.push({ nodeId, kind, startLine: before ? lineCount(this.statements.slice(0, before)) + 1 : 1,
      endLine: lineCount(this.statements) });
  }
  /** Shift every span recorded so far by the header's line count. */
  offset(header: string[]) {
    const count = header.filter(line => line !== '').join('\n').split('\n').length;
    for (const span of this.spans) { span.startLine += count; span.endLine += count; }
  }
}

function structuralSignalName(nodeId: string, portName: string): string {
  return `n_${safeIdentifier(nodeId)}_${safeIdentifier(portName)}`;
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

/** A legal VHDL basic identifier: letter first, no `__`, no trailing `_`. */
function safeIdentifier(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!cleaned) return 'top';
  return /^[A-Za-z]/.test(cleaned) ? cleaned : `n${cleaned}`;
}

/** Instance labels share the VHDL namespace with reserved words; `signal` becomes `u_signal`. */
function instanceLabel(value: string): string {
  const label = safeIdentifier(value);
  return VHDL_RESERVED_WORDS.has(label.toLowerCase()) ? `u_${label}` : label;
}

function snakeCase(value: string): string {
  return safeIdentifier(value).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function extractQuotedNode(message: string): string | undefined {
  return message.match(/on node "([^"]+)"/)?.[1];
}
