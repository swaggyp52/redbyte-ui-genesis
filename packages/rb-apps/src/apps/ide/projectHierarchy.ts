import type { Circuit, CompositeNodeDef, Connection, Node, PortRef } from '@redbyte/rb-logic-core';
import { parseVectorLabel } from '@redbyte/rb-logic-core';

export const PROJECT_HIERARCHY_SCHEMA_VERSION = 'rb.project-hierarchy.v1' as const;
export const TOP_MODULE_ID = 'top' as const;

export type ModulePortDirection = 'input' | 'output';

/** One bit of a vector module port and the internal boundary refs it drives. */
export interface ModulePortBit {
  index: number;
  internalRefs: PortRef[];
}

export interface ModulePort {
  id: string;
  name: string;
  direction: ModulePortDirection;
  /** Bit width. 1 = scalar STD_LOGIC. N>1 = STD_LOGIC_VECTOR. */
  width: number;
  /**
   * Declaration order for width>1 (left/right, VHDL downto/to). Absent for
   * scalars. `left`=3,`right`=0 → (3 downto 0).
   */
  range?: { left: number; right: number };
  sourceBoundary: {
    /** Scalar substrate: the internal boundary node(s) for a scalar port
     *  (bit-0 fanout). Vector ports use `bits`, one entry per declared bit. */
    internalRefs: PortRef[];
    bits?: ModulePortBit[];
  };
}

/** Width of a module port; tolerant of legacy documents lacking the field. */
export function modulePortWidth(port: Pick<ModulePort, 'width'>): number {
  return typeof port.width === 'number' && port.width >= 1 ? Math.floor(port.width) : 1;
}

/** Declared bit indices of a vector module port, left→right. */
export function modulePortIndices(port: ModulePort): number[] {
  const width = modulePortWidth(port);
  if (width <= 1) return [0];
  const range = port.range ?? { left: width - 1, right: 0 };
  const step = range.left >= range.right ? -1 : 1;
  const out: number[] = [];
  for (let i = range.left; ; i += step) {
    out.push(i);
    if (i === range.right) break;
  }
  return out;
}

/** Split a connection port name of the form `Name(3)` into base + bit. */
export function splitBitPort(portName: string): { base: string; bitIndex?: number } {
  const match = /^(.*)\((\d+)\)$/.exec(portName);
  if (!match) return { base: portName };
  return { base: match[1], bitIndex: Number.parseInt(match[2], 10) };
}

/** Internal boundary refs for a module port bit (or the scalar port). */
export function modulePortInternalRefs(port: ModulePort, bitIndex?: number): PortRef[] {
  if (modulePortWidth(port) > 1 && port.sourceBoundary.bits && bitIndex !== undefined) {
    const bit = port.sourceBoundary.bits.find((entry) => entry.index === bitIndex);
    return bit ? bit.internalRefs : [];
  }
  return port.sourceBoundary.internalRefs;
}

/** VHDL type for a module port. */
export function modulePortVhdlType(port: ModulePort): string {
  const width = modulePortWidth(port);
  if (width <= 1) return 'STD_LOGIC';
  const range = port.range ?? { left: width - 1, right: 0 };
  const dir = range.left >= range.right ? 'downto' : 'to';
  return `STD_LOGIC_VECTOR(${range.left} ${dir} ${range.right})`;
}

export interface NativeVisualModuleDefinition {
  id: string;
  name: string;
  displayName: string;
  kind: 'native-visual';
  ports: ModulePort[];
  circuit: Circuit;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectHierarchyDocument {
  schemaVersion: typeof PROJECT_HIERARCHY_SCHEMA_VERSION;
  topModuleId: typeof TOP_MODULE_ID;
  activeModuleId: string;
  modules: NativeVisualModuleDefinition[];
}

export interface ModuleBoundaryDraft {
  id: string;
  suggestedName: string;
  direction: ModulePortDirection;
  internalRefs: PortRef[];
  /** Set when the external boundary node is a `Base[N]` bus member. Lets
   *  create-from-selection fuse sibling drafts into one vector module port. */
  busBase?: string;
  bitIndex?: number;
}

export interface ModuleSelectionAnalysis {
  ok: boolean;
  selectedNodeIds: string[];
  selectedComponentCount: number;
  inputs: ModuleBoundaryDraft[];
  outputs: ModuleBoundaryDraft[];
  warnings: string[];
  errors: string[];
}

export interface CreateModuleInput {
  moduleName: string;
  instanceName: string;
  selectedNodeIds: readonly string[];
  portNames?: Readonly<Record<string, string>>;
  nowIso?: string;
}

export interface CreateModuleResult {
  circuit: Circuit;
  hierarchy: ProjectHierarchyDocument;
  definition: NativeVisualModuleDefinition;
  instance: Node;
  analysis: ModuleSelectionAnalysis;
}

const BOUNDARY_INPUT_TYPE = 'Switch';
const BOUNDARY_OUTPUT_TYPE = 'Lamp';

export function createEmptyProjectHierarchy(): ProjectHierarchyDocument {
  return {
    schemaVersion: PROJECT_HIERARCHY_SCHEMA_VERSION,
    topModuleId: TOP_MODULE_ID,
    activeModuleId: TOP_MODULE_ID,
    modules: [],
  };
}

export function normalizeProjectHierarchy(
  value: unknown,
  legacyDefinitions: readonly CompositeNodeDef[] = [],
): ProjectHierarchyDocument {
  if (!isRecord(value) || value.schemaVersion !== PROJECT_HIERARCHY_SCHEMA_VERSION) {
    return {
      ...createEmptyProjectHierarchy(),
      modules: legacyDefinitions.map((definition, index) =>
        moduleFromCompositeDefinition(definition, index),
      ),
    };
  }

  const modules = Array.isArray(value.modules)
    ? value.modules
        .map((entry, index) => normalizeModuleDefinition(entry, index))
        .filter((entry): entry is NativeVisualModuleDefinition => entry !== null)
    : [];
  const requestedActive = typeof value.activeModuleId === 'string' ? value.activeModuleId : TOP_MODULE_ID;
  const activeModuleId =
    requestedActive === TOP_MODULE_ID || modules.some((module) => module.id === requestedActive)
      ? requestedActive
      : TOP_MODULE_ID;
  return {
    schemaVersion: PROJECT_HIERARCHY_SCHEMA_VERSION,
    topModuleId: TOP_MODULE_ID,
    activeModuleId,
    modules: modules.sort((left, right) => left.name.localeCompare(right.name)),
  };
}

export function analyzeModuleSelection(
  circuit: Circuit,
  selectedNodeIds: readonly string[],
  customModuleNames: readonly string[] = [],
): ModuleSelectionAnalysis {
  const selected = [...new Set(selectedNodeIds.map((id) => id.trim()).filter(Boolean))].sort();
  const selectedSet = new Set(selected);
  const nodes = circuit.nodes.filter((node) => selectedSet.has(node.id));
  const errors: string[] = [];
  const warnings: string[] = [];

  if (nodes.length < 2) errors.push('Select at least two connected components.');
  if (nodes.length !== selected.length) errors.push('The selection contains a missing component.');

  // Nested modules are supported: a selection may include instances of other
  // modules, producing a definition that itself instantiates them (deep
  // hierarchy). A new definition cannot reference itself, so this never
  // creates a cycle at creation time; a later edit that would form a cycle is
  // rejected by hierarchyCycleModules at placement.
  const boundaryNodes = nodes.filter((node) => isTopLevelBoundaryNode(node));
  if (boundaryNodes.length > 0) {
    errors.push('Select the functional logic only; top-level inputs and outputs stay in the parent module.');
  }
  if (nodes.length >= 2 && !isConnectedSelection(circuit, selectedSet)) {
    errors.push('The selected components must form one connected subcircuit.');
  }

  const incoming = circuit.connections.filter((connection) => {
    const from = normalizeEndpoint(connection.from, 'out');
    const to = normalizeEndpoint(connection.to, 'in');
    return !selectedSet.has(from.nodeId) && selectedSet.has(to.nodeId);
  });
  const outgoing = circuit.connections.filter((connection) => {
    const from = normalizeEndpoint(connection.from, 'out');
    const to = normalizeEndpoint(connection.to, 'in');
    return selectedSet.has(from.nodeId) && !selectedSet.has(to.nodeId);
  });

  const inputs = groupBoundaryConnections(circuit, incoming, 'input');
  const outputs = groupBoundaryConnections(circuit, outgoing, 'output');
  if (inputs.length === 0) warnings.push('No input boundary was inferred.');
  if (outputs.length === 0) warnings.push('No output boundary was inferred.');

  return {
    ok: errors.length === 0,
    selectedNodeIds: selected,
    selectedComponentCount: nodes.length,
    inputs,
    outputs,
    warnings,
    errors,
  };
}

export function createModuleFromSelection(
  circuit: Circuit,
  hierarchy: ProjectHierarchyDocument,
  input: CreateModuleInput,
): CreateModuleResult {
  const analysis = analyzeModuleSelection(
    circuit,
    input.selectedNodeIds,
    hierarchy.modules.map((module) => module.name),
  );
  if (!analysis.ok) throw new Error(analysis.errors[0] ?? 'Selection cannot become a module.');

  const displayName = validateModuleName(input.moduleName);
  const instanceName = validateInstanceName(input.instanceName);
  if (hierarchy.modules.some((module) => module.name.toLowerCase() === displayName.toLowerCase())) {
    throw new Error(`A module named "${displayName}" already exists.`);
  }
  if (circuit.nodes.some((node) => readInstanceName(node).toLowerCase() === instanceName.toLowerCase())) {
    throw new Error(`An instance named "${instanceName}" already exists in this module.`);
  }

  const portDrafts = [...analysis.inputs, ...analysis.outputs];
  // Fuse sibling drafts of the same bus (same direction + Base[N]) into one
  // vector module port; unbused drafts stay scalar. A caller-supplied
  // portNames override on any member keeps the drafts scalar (explicit intent).
  const busKey = (draft: ModuleBoundaryDraft): string | null =>
    draft.busBase && draft.bitIndex !== undefined && !input.portNames?.[draft.id]
      ? `${draft.direction}:${draft.busBase}`
      : null;
  const busGroups = new Map<string, ModuleBoundaryDraft[]>();
  const scalarDrafts: ModuleBoundaryDraft[] = [];
  for (const draft of portDrafts) {
    const key = busKey(draft);
    if (key) {
      const list = busGroups.get(key) ?? [];
      list.push(draft);
      busGroups.set(key, list);
    } else {
      scalarDrafts.push(draft);
    }
  }
  const usedPortNames = new Set<string>();
  const claimName = (requested: string): string => {
    const name = validatePortName(requested);
    const key = name.toLowerCase();
    if (usedPortNames.has(key)) throw new Error(`Duplicate module port name "${name}".`);
    usedPortNames.add(key);
    return name;
  };
  interface PortBuild { port: ModulePort; drafts: ModuleBoundaryDraft[] }
  const portBuilds: PortBuild[] = [];
  for (const [, group] of busGroups) {
    if (group.length < 2) {
      scalarDrafts.push(...group);
      continue;
    }
    const sorted = [...group].sort((a, b) => (a.bitIndex ?? 0) - (b.bitIndex ?? 0));
    const indices = sorted.map((d) => d.bitIndex ?? 0);
    const left = Math.max(...indices);
    const right = Math.min(...indices);
    const name = claimName(sorted[0].busBase!);
    portBuilds.push({
      port: {
        id: `bus-${sorted[0].direction}-${name}`,
        name,
        direction: sorted[0].direction,
        width: left - right + 1,
        range: { left, right },
        sourceBoundary: {
          internalRefs: sorted.flatMap((d) => d.internalRefs.map(clonePortRef)),
          bits: sorted.map((d) => ({ index: d.bitIndex ?? 0, internalRefs: d.internalRefs.map(clonePortRef) })),
        },
      },
      drafts: sorted,
    });
  }
  for (const draft of scalarDrafts) {
    const name = claimName(input.portNames?.[draft.id] ?? draft.suggestedName);
    portBuilds.push({
      port: {
        id: draft.id,
        name,
        direction: draft.direction,
        width: 1,
        sourceBoundary: { internalRefs: draft.internalRefs.map(clonePortRef) },
      },
      drafts: [draft],
    });
  }
  const ports = portBuilds.map((build) => build.port);

  const selectedSet = new Set(analysis.selectedNodeIds);
  const selectedNodes = circuit.nodes.filter((node) => selectedSet.has(node.id));
  const internalConnections = circuit.connections.filter((connection) => {
    const from = normalizeEndpoint(connection.from, 'out');
    const to = normalizeEndpoint(connection.to, 'in');
    return selectedSet.has(from.nodeId) && selectedSet.has(to.nodeId);
  });
  const normalized = normalizeModuleCircuit(selectedNodes, internalConnections, ports);
  const moduleId = uniqueModuleId(displayName, hierarchy.modules);
  const nowIso = input.nowIso ?? new Date().toISOString();
  const definition: NativeVisualModuleDefinition = {
    id: moduleId,
    name: toVhdlIdentifier(displayName),
    displayName,
    kind: 'native-visual',
    ports,
    circuit: normalized,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const centroid = selectionCentroid(selectedNodes);
  const instance: Node = {
    id: uniqueNodeId(circuit, instanceName),
    type: definition.name,
    label: instanceName,
    position: centroid,
    x: centroid.x,
    y: centroid.y,
    config: {
      moduleDefinitionId: moduleId,
      moduleName: definition.name,
      instanceName,
      label: instanceName,
      nativeVisualModule: true,
    },
  };

  const nextConnections: Connection[] = [];
  for (const connection of circuit.connections) {
    const from = normalizeEndpoint(connection.from, 'out');
    const to = normalizeEndpoint(connection.to, 'in');
    if (selectedSet.has(from.nodeId) || selectedSet.has(to.nodeId)) continue;
    nextConnections.push(cloneConnection(connection));
  }
  for (const { port, drafts } of portBuilds) {
    const isVector = modulePortWidth(port) > 1;
    for (const draft of drafts) {
      // Scalar ports address the port by name; vector ports address one bit as
      // `PortName(i)` so each bus member wires to its own bit (the elaboration
      // and HDL both read this convention).
      const portRef = isVector
        ? { nodeId: instance.id, portName: `${port.name}(${draft.bitIndex ?? 0})` }
        : { nodeId: instance.id, portName: port.name };
      if (port.direction === 'input') {
        const representative = findIncomingRepresentative(circuit, selectedSet, draft.internalRefs);
        if (representative) {
          nextConnections.push({ from: clonePortRef(representative), to: portRef });
        }
      } else {
        const targets = findOutgoingTargets(circuit, selectedSet, draft.internalRefs[0]);
        for (const target of targets) {
          nextConnections.push({ from: { ...portRef }, to: clonePortRef(target) });
        }
      }
    }
  }

  return {
    circuit: {
      nodes: [...circuit.nodes.filter((node) => !selectedSet.has(node.id)).map(cloneNode), instance],
      connections: nextConnections,
    },
    hierarchy: {
      ...hierarchy,
      activeModuleId: TOP_MODULE_ID,
      modules: [...hierarchy.modules, definition].sort((left, right) => left.name.localeCompare(right.name)),
    },
    definition,
    instance,
    analysis,
  };
}

export function placeModuleInstance(
  circuit: Circuit,
  definition: NativeVisualModuleDefinition,
  position: { x: number; y: number },
  requestedInstanceName?: string,
): { circuit: Circuit; instance: Node } {
  const usage = circuit.nodes.filter(
    (node) => readString(node.config?.moduleDefinitionId) === definition.id,
  ).length;
  const instanceName = validateInstanceName(requestedInstanceName ?? `${toCamelIdentifier(definition.name)}${usage}`);
  const instance: Node = {
    id: uniqueNodeId(circuit, instanceName),
    type: definition.name,
    label: instanceName,
    position: { x: Math.round(position.x), y: Math.round(position.y) },
    x: Math.round(position.x),
    y: Math.round(position.y),
    config: {
      moduleDefinitionId: definition.id,
      moduleName: definition.name,
      instanceName,
      label: instanceName,
      nativeVisualModule: true,
    },
  };
  return {
    circuit: { nodes: [...circuit.nodes.map(cloneNode), instance], connections: circuit.connections.map(cloneConnection) },
    instance,
  };
}

const MAX_ELABORATION_DEPTH = 64;

/**
 * Flatten one level of module instances in `circuit`. Each instance's
 * definition is inlined with an `instanceId__` prefix (boundary nodes dropped),
 * and every connection is rewired through instance ports. A nested instance
 * (an instance node living inside a definition) survives one pass as a prefixed
 * instance node and is expanded on the next pass — iterating this to a fixed
 * point yields deep hierarchy with stable composed instance-path prefixes.
 */
function expandInstancesOnce(
  circuit: Circuit,
  modulesById: Map<string, NativeVisualModuleDefinition>,
  modulesByName: Map<string, NativeVisualModuleDefinition>,
): { circuit: Circuit; expanded: boolean } {
  const instanceNodes = circuit.nodes.filter((node) => resolveModuleForNode(node, modulesById, modulesByName));
  if (instanceNodes.length === 0) return { circuit: cloneCircuit(circuit), expanded: false };
  const instanceIds = new Set(instanceNodes.map((node) => node.id));
  const instancesById = new Map(instanceNodes.map((node) => [node.id, node]));
  const nodes = circuit.nodes.filter((node) => !instanceIds.has(node.id)).map(cloneNode);
  const connections: Connection[] = [];

  for (const instance of instanceNodes) {
    const definition = resolveModuleForNode(instance, modulesById, modulesByName)!;
    const prefix = `${instance.id}__`;
    const parentPath = readString(instance.config?.hierarchyPath) || 'top';
    const instancePath = `${parentPath}.${readInstanceName(instance)}`;
    const boundaryNodeIds = new Set(
      definition.circuit.nodes
        .filter((node) => readString(node.config?.moduleBoundary))
        .map((node) => node.id),
    );
    nodes.push(
      ...definition.circuit.nodes
        .filter((node) => !boundaryNodeIds.has(node.id))
        .map((node) => ({
          ...cloneNode(node),
          id: `${prefix}${node.id}`,
          label: `${readInstanceName(instance)}.${node.label ?? node.id}`,
          // Compose the path so a nested instance carries top.u_outer.u_inner…;
          // the next expansion pass reads this to keep composing.
          config: { ...(node.config ?? {}), hierarchyPath: instancePath },
        })),
    );
    connections.push(
      ...definition.circuit.connections
        .filter((connection) => {
          const from = normalizeEndpoint(connection.from, 'out');
          const to = normalizeEndpoint(connection.to, 'in');
          return !boundaryNodeIds.has(from.nodeId) && !boundaryNodeIds.has(to.nodeId);
        })
        .map((connection) => prefixConnection(connection, prefix)),
    );
  }

  // Rewire every connection in the working circuit (not only original top
  // wires): after inlining, wires from a definition that touched a nested
  // instance are present here and must resolve through that instance's ports.
  for (const connection of circuit.connections) {
    const parentSource = normalizeEndpoint(connection.from, 'out');
    const parentTarget = normalizeEndpoint(connection.to, 'in');
    const sourceInstance = instancesById.get(parentSource.nodeId);
    const targetInstance = instancesById.get(parentTarget.nodeId);

    let source = clonePortRef(parentSource);
    if (sourceInstance) {
      const sourceDefinition = resolveModuleForNode(sourceInstance, modulesById, modulesByName);
      const { base, bitIndex } = splitBitPort(parentSource.portName);
      const outputPort = sourceDefinition?.ports.find(
        (port) => port.direction === 'output' && port.name === base,
      );
      const internalSource = outputPort ? modulePortInternalRefs(outputPort, bitIndex)[0] : undefined;
      if (!internalSource) continue;
      source = {
        nodeId: `${sourceInstance.id}__${internalSource.nodeId}`,
        portName: internalSource.portName,
      };
    }

    let targets: PortRef[] = [clonePortRef(parentTarget)];
    if (targetInstance) {
      const targetDefinition = resolveModuleForNode(targetInstance, modulesById, modulesByName);
      const { base, bitIndex } = splitBitPort(parentTarget.portName);
      const inputPort = targetDefinition?.ports.find(
        (port) => port.direction === 'input' && port.name === base,
      );
      targets = (inputPort ? modulePortInternalRefs(inputPort, bitIndex) : []).map((target) => ({
        nodeId: `${targetInstance.id}__${target.nodeId}`,
        portName: target.portName,
      }));
    }

    for (const target of targets) {
      connections.push({ from: clonePortRef(source), to: clonePortRef(target) });
    }
  }
  return { circuit: { nodes, connections }, expanded: true };
}

export function elaborateProjectHierarchy(
  topCircuit: Circuit,
  hierarchy: ProjectHierarchyDocument | undefined,
): Circuit {
  if (!hierarchy || hierarchy.modules.length === 0) return cloneCircuit(topCircuit);
  const modulesById = new Map(hierarchy.modules.map((module) => [module.id, module]));
  const modulesByName = new Map(hierarchy.modules.map((module) => [module.name, module]));

  let current = topCircuit;
  for (let depth = 0; depth < MAX_ELABORATION_DEPTH; depth += 1) {
    const { circuit: next, expanded } = expandInstancesOnce(current, modulesById, modulesByName);
    if (!expanded) return next;
    current = next;
  }
  // Depth cap reached — a recursive/cyclic definition. Return the last
  // expansion; hierarchyCycleModules() is the authority that rejects cycles
  // before they reach here.
  return cloneCircuit(current);
}

/**
 * Module ids that participate in an instantiation cycle (a module that
 * directly or indirectly instantiates itself). Empty when the hierarchy is a
 * DAG. Used to reject a cycle at authoring time and keep the project valid.
 */
export function hierarchyCycleModules(hierarchy: ProjectHierarchyDocument | undefined): string[] {
  if (!hierarchy || hierarchy.modules.length === 0) return [];
  const byId = new Map(hierarchy.modules.map((module) => [module.id, module]));
  const byName = new Map(hierarchy.modules.map((module) => [module.name, module]));
  const childIds = (module: NativeVisualModuleDefinition): string[] => {
    const ids = new Set<string>();
    for (const node of module.circuit.nodes) {
      const child = byId.get(readString(node.config?.moduleDefinitionId)) ?? byName.get(node.type);
      if (child) ids.add(child.id);
    }
    return [...ids];
  };
  const state = new Map<string, 'visiting' | 'done'>();
  const inCycle = new Set<string>();
  const visit = (id: string, stack: string[]): void => {
    const mark = state.get(id);
    if (mark === 'done') return;
    if (mark === 'visiting') {
      // Everything from where `id` first entered the stack is in the cycle.
      const start = stack.indexOf(id);
      for (const member of stack.slice(start >= 0 ? start : 0)) inCycle.add(member);
      inCycle.add(id);
      return;
    }
    state.set(id, 'visiting');
    const module = byId.get(id);
    if (module) {
      for (const child of childIds(module)) visit(child, [...stack, id]);
    }
    state.set(id, 'done');
  };
  for (const module of hierarchy.modules) visit(module.id, []);
  return [...inCycle];
}

export function toCompositeDefinition(module: NativeVisualModuleDefinition): CompositeNodeDef {
  return {
    name: module.name,
    description: `${module.displayName} · native visual module`,
    subcircuit: cloneCircuit(module.circuit),
    inputMapping: Object.fromEntries(
      module.ports
        .filter((port) => port.direction === 'input')
        .map((port) => {
          const boundary = module.circuit.nodes.find(
            (node) =>
              readString(node.config?.modulePortId) === port.id &&
              readString(node.config?.moduleBoundary) === 'input',
          );
          return [port.name, `${boundary?.id ?? port.sourceBoundary.internalRefs[0]?.nodeId}.isOn`];
        }),
    ),
    outputMapping: Object.fromEntries(
      module.ports
        .filter((port) => port.direction === 'output')
        .map((port) => {
          const ref = port.sourceBoundary.internalRefs[0];
          return [port.name, `${ref.nodeId}.${ref.portName}`];
        }),
    ),
  };
}

export function moduleUsageCount(circuit: Circuit, moduleId: string): number {
  return circuit.nodes.filter((node) => readString(node.config?.moduleDefinitionId) === moduleId).length;
}

export function isModuleInstance(node: Node, hierarchy: ProjectHierarchyDocument): boolean {
  return Boolean(
    hierarchy.modules.find(
      (module) =>
        module.id === readString(node.config?.moduleDefinitionId) || module.name === node.type,
    ),
  );
}

export function readInstanceName(node: Node): string {
  return readString(node.config?.instanceName) || readString(node.config?.label) || node.label || node.id;
}

function groupBoundaryConnections(
  circuit: Circuit,
  connections: Connection[],
  direction: ModulePortDirection,
): ModuleBoundaryDraft[] {
  const groups = new Map<string, { refs: PortRef[]; suggestedName: string; busBase?: string; bitIndex?: number }>();
  for (const connection of connections) {
    const from = normalizeEndpoint(connection.from, 'out');
    const to = normalizeEndpoint(connection.to, 'in');
    const keyRef = direction === 'input' ? from : from;
    const internalRef = direction === 'input' ? to : from;
    const key = `${keyRef.nodeId}.${keyRef.portName}`;
    const externalNodeId = direction === 'input' ? from.nodeId : to.nodeId;
    const externalNode = circuit.nodes.find((node) => node.id === externalNodeId);
    const externalLabel = readString(externalNode?.config?.label) || externalNode?.label || '';
    const bus = parseVectorLabel(externalLabel);
    const suggestedName =
      externalLabel || (direction === 'input' ? `IN${groups.size + 1}` : `OUT${groups.size + 1}`);
    const group = groups.get(key) ?? {
      refs: [],
      suggestedName,
      busBase: bus?.baseName,
      bitIndex: bus?.bitIndex,
    };
    if (!group.refs.some((ref) => ref.nodeId === internalRef.nodeId && ref.portName === internalRef.portName)) {
      group.refs.push(clonePortRef(internalRef));
    }
    groups.set(key, group);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, group], index) => ({
      id: `${direction}-${index + 1}-${key.replace(/[^a-zA-Z0-9]+/g, '-')}`,
      suggestedName: validateSuggestedPortName(group.suggestedName, direction, index),
      direction,
      internalRefs: group.refs.sort((left, right) =>
        `${left.nodeId}.${left.portName}`.localeCompare(`${right.nodeId}.${right.portName}`),
      ),
      ...(group.busBase ? { busBase: group.busBase, bitIndex: group.bitIndex } : {}),
    }));
}

function normalizeModuleCircuit(
  selectedNodes: Node[],
  internalConnections: Connection[],
  ports: ModulePort[],
): Circuit {
  const xs = selectedNodes.map((node) => node.position?.x ?? node.x ?? 0);
  const ys = selectedNodes.map((node) => node.position?.y ?? node.y ?? 0);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const nodes = selectedNodes.map((node) => {
    const position = {
      x: Math.round((node.position?.x ?? node.x ?? 0) - minX + 220),
      y: Math.round((node.position?.y ?? node.y ?? 0) - minY + 80),
    };
    return { ...cloneNode(node), position, x: position.x, y: position.y };
  });
  const connections = internalConnections.map(cloneConnection);
  const inputs = ports.filter((port) => port.direction === 'input');
  const outputs = ports.filter((port) => port.direction === 'output');
  let rowIn = 0;
  inputs.forEach((port) => {
    // A vector port materializes one boundary node per bit, each labeled
    // `Port[i]` and carrying its bit index, so the scalar substrate inside the
    // definition stays complete and the export/elaboration can address bits.
    const bits = modulePortWidth(port) > 1 && port.sourceBoundary.bits
      ? [...port.sourceBoundary.bits]
      : [{ index: 0, internalRefs: port.sourceBoundary.internalRefs }];
    bits.forEach((bit) => {
      const index = rowIn++;
      const id = `port_in_${index + 1}`;
      const label = modulePortWidth(port) > 1 ? `${port.name}[${bit.index}]` : port.name;
      nodes.push({
        id, type: BOUNDARY_INPUT_TYPE, label,
        position: { x: 20, y: 80 + index * 120 }, x: 20, y: 80 + index * 120,
        config: { label, moduleBoundary: 'input', modulePortId: port.id, portBitIndex: bit.index },
      });
      for (const target of bit.internalRefs) {
        connections.push({ from: { nodeId: id, portName: 'out' }, to: clonePortRef(target) });
      }
    });
  });
  let rowOut = 0;
  outputs.forEach((port) => {
    const bits = modulePortWidth(port) > 1 && port.sourceBoundary.bits
      ? [...port.sourceBoundary.bits]
      : [{ index: 0, internalRefs: port.sourceBoundary.internalRefs }];
    bits.forEach((bit) => {
      const index = rowOut++;
      const id = `port_out_${index + 1}`;
      const label = modulePortWidth(port) > 1 ? `${port.name}[${bit.index}]` : port.name;
      const source = bit.internalRefs[0];
      nodes.push({
        id, type: BOUNDARY_OUTPUT_TYPE, label,
        position: { x: Math.round(maxX - minX + 440), y: 80 + index * 120 },
        x: Math.round(maxX - minX + 440), y: 80 + index * 120,
        config: { label, moduleBoundary: 'output', modulePortId: port.id, portBitIndex: bit.index },
      });
      if (source) connections.push({ from: clonePortRef(source), to: { nodeId: id, portName: 'in' } });
    });
  });
  return { nodes, connections };
}

function findIncomingRepresentative(
  circuit: Circuit,
  selectedSet: Set<string>,
  internalRefs: readonly PortRef[],
): PortRef | null {
  const targets = new Set(internalRefs.map((ref) => `${ref.nodeId}.${ref.portName}`));
  const match = circuit.connections.find((connection) => {
    const from = normalizeEndpoint(connection.from, 'out');
    const to = normalizeEndpoint(connection.to, 'in');
    return !selectedSet.has(from.nodeId) && selectedSet.has(to.nodeId) && targets.has(`${to.nodeId}.${to.portName}`);
  });
  return match ? normalizeEndpoint(match.from, 'out') : null;
}

function findOutgoingTargets(
  circuit: Circuit,
  selectedSet: Set<string>,
  internalRef: PortRef | undefined,
): PortRef[] {
  if (!internalRef) return [];
  return circuit.connections
    .filter((connection) => {
      const from = normalizeEndpoint(connection.from, 'out');
      const to = normalizeEndpoint(connection.to, 'in');
      return (
        selectedSet.has(from.nodeId) &&
        !selectedSet.has(to.nodeId) &&
        from.nodeId === internalRef.nodeId &&
        from.portName === internalRef.portName
      );
    })
    .map((connection) => normalizeEndpoint(connection.to, 'in'));
}

function isConnectedSelection(circuit: Circuit, selected: Set<string>): boolean {
  const first = selected.values().next().value as string | undefined;
  if (!first) return false;
  const adjacency = new Map<string, Set<string>>();
  selected.forEach((id) => adjacency.set(id, new Set()));
  for (const connection of circuit.connections) {
    const from = normalizeEndpoint(connection.from, 'out');
    const to = normalizeEndpoint(connection.to, 'in');
    if (!selected.has(from.nodeId) || !selected.has(to.nodeId)) continue;
    adjacency.get(from.nodeId)?.add(to.nodeId);
    adjacency.get(to.nodeId)?.add(from.nodeId);
  }
  // Parallel gates in a functional block (for example the XOR and AND in a
  // Half Adder) are connected through their shared parent signals even when
  // no internal wire runs directly between them.
  const selectedTargetsByExternalSource = new Map<string, Set<string>>();
  for (const connection of circuit.connections) {
    const from = normalizeEndpoint(connection.from, 'out');
    const to = normalizeEndpoint(connection.to, 'in');
    if (selected.has(from.nodeId) || !selected.has(to.nodeId)) continue;
    const sourceKey = `${from.nodeId}.${from.portName}`;
    const targets = selectedTargetsByExternalSource.get(sourceKey) ?? new Set<string>();
    targets.add(to.nodeId);
    selectedTargetsByExternalSource.set(sourceKey, targets);
  }
  for (const targets of selectedTargetsByExternalSource.values()) {
    const ids = [...targets];
    for (let index = 1; index < ids.length; index += 1) {
      adjacency.get(ids[0]!)?.add(ids[index]!);
      adjacency.get(ids[index]!)?.add(ids[0]!);
    }
  }
  const visited = new Set<string>();
  const queue = [first];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const next of adjacency.get(id) ?? []) queue.push(next);
  }
  return visited.size === selected.size;
}

function moduleFromCompositeDefinition(
  definition: CompositeNodeDef,
  index: number,
): NativeVisualModuleDefinition {
  const ports: ModulePort[] = [
    ...Object.entries(definition.inputMapping).map(([name, ref], portIndex) => ({
      id: `legacy-input-${portIndex + 1}`,
      name,
      direction: 'input' as const,
      width: 1,
      sourceBoundary: { internalRefs: [parseInternalRef(ref)] },
    })),
    ...Object.entries(definition.outputMapping).map(([name, ref], portIndex) => ({
      id: `legacy-output-${portIndex + 1}`,
      name,
      direction: 'output' as const,
      width: 1,
      sourceBoundary: { internalRefs: [parseInternalRef(ref)] },
    })),
  ];
  return {
    id: `legacy-${slug(definition.name)}-${index + 1}`,
    name: toVhdlIdentifier(definition.name),
    displayName: definition.name,
    kind: 'native-visual',
    ports,
    circuit: cloneCircuit(definition.subcircuit),
    createdAt: '1970-01-01T00:00:00.000Z',
    updatedAt: '1970-01-01T00:00:00.000Z',
  };
}

function normalizeModuleDefinition(value: unknown, index: number): NativeVisualModuleDefinition | null {
  if (!isRecord(value) || !isRecord(value.circuit)) return null;
  if (!Array.isArray(value.circuit.nodes) || !Array.isArray(value.circuit.connections)) return null;
  const displayName = readString(value.displayName) || readString(value.name) || `Module ${index + 1}`;
  const name = toVhdlIdentifier(readString(value.name) || displayName);
  const id = readString(value.id) || `module-${slug(name)}-${index + 1}`;
  const ports = Array.isArray(value.ports)
    ? value.ports.map((port, portIndex) => normalizeModulePort(port, portIndex)).filter((port): port is ModulePort => port !== null)
    : [];
  return {
    id,
    name,
    displayName,
    kind: 'native-visual',
    ports,
    circuit: cloneCircuit(value.circuit as unknown as Circuit),
    createdAt: readString(value.createdAt) || '1970-01-01T00:00:00.000Z',
    updatedAt: readString(value.updatedAt) || '1970-01-01T00:00:00.000Z',
  };
}

function normalizeModulePort(value: unknown, index: number): ModulePort | null {
  if (!isRecord(value)) return null;
  const direction = value.direction === 'output' ? 'output' : value.direction === 'input' ? 'input' : null;
  const name = readString(value.name);
  if (!direction || !name) return null;
  const sourceBoundary = isRecord(value.sourceBoundary) ? value.sourceBoundary : {};
  const fallbackPort = direction === 'input' ? 'in' : 'out';
  const internalRefs = Array.isArray(sourceBoundary.internalRefs)
    ? sourceBoundary.internalRefs.map((ref) => normalizeEndpoint(ref, fallbackPort))
    : [];
  const rawWidth = value.width;
  const width = typeof rawWidth === 'number' && rawWidth >= 1 ? Math.floor(rawWidth) : 1;
  const range =
    isRecord(value.range) &&
    typeof value.range.left === 'number' &&
    typeof value.range.right === 'number'
      ? { left: Math.floor(value.range.left), right: Math.floor(value.range.right) }
      : width > 1
        ? { left: width - 1, right: 0 }
        : undefined;
  const bits = Array.isArray(sourceBoundary.bits)
    ? sourceBoundary.bits
        .filter((bit): bit is Record<string, unknown> => isRecord(bit) && typeof bit.index === 'number')
        .map((bit) => ({
          index: Math.floor(bit.index as number),
          internalRefs: Array.isArray(bit.internalRefs)
            ? bit.internalRefs.map((ref) => normalizeEndpoint(ref, fallbackPort))
            : [],
        }))
    : undefined;
  return {
    id: readString(value.id) || `${direction}-${index + 1}`,
    name: validatePortName(name),
    direction,
    width,
    ...(range ? { range } : {}),
    sourceBoundary: { internalRefs, ...(bits && bits.length > 0 ? { bits } : {}) },
  };
}

function resolveModuleForNode(
  node: Node,
  modulesById: Map<string, NativeVisualModuleDefinition>,
  modulesByName: Map<string, NativeVisualModuleDefinition>,
): NativeVisualModuleDefinition | undefined {
  return modulesById.get(readString(node.config?.moduleDefinitionId)) ?? modulesByName.get(node.type);
}

function prefixConnection(connection: Connection, prefix: string): Connection {
  const from = normalizeEndpoint(connection.from, 'out');
  const to = normalizeEndpoint(connection.to, 'in');
  return {
    ...(connection.id ? { id: `${prefix}${connection.id}` } : {}),
    from: { nodeId: `${prefix}${from.nodeId}`, portName: from.portName },
    to: { nodeId: `${prefix}${to.nodeId}`, portName: to.portName },
  };
}

function selectionCentroid(nodes: readonly Node[]): { x: number; y: number } {
  const total = nodes.reduce(
    (sum, node) => ({
      x: sum.x + (node.position?.x ?? node.x ?? 0),
      y: sum.y + (node.position?.y ?? node.y ?? 0),
    }),
    { x: 0, y: 0 },
  );
  return { x: Math.round(total.x / nodes.length), y: Math.round(total.y / nodes.length) };
}

function isTopLevelBoundaryNode(node: Node): boolean {
  return ['INPUT', 'OUTPUT', 'Switch', 'Lamp'].includes(node.type);
}

function validateModuleName(value: string): string {
  const trimmed = value.trim();
  if (!/^[A-Za-z][A-Za-z0-9_ ]{1,47}$/.test(trimmed)) {
    throw new Error('Module name must start with a letter and use letters, numbers, spaces, or underscores.');
  }
  return trimmed;
}

function validateInstanceName(value: string): string {
  const trimmed = value.trim();
  if (!/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(trimmed)) {
    throw new Error('Instance name must start with a letter and use only letters, numbers, or underscores.');
  }
  return trimmed;
}

function validatePortName(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, '_');
  if (!/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(trimmed)) {
    throw new Error(`Invalid port name "${value}".`);
  }
  return trimmed.toUpperCase();
}

function validateSuggestedPortName(value: string, direction: ModulePortDirection, index: number): string {
  try {
    return validatePortName(value);
  } catch {
    return `${direction === 'input' ? 'IN' : 'OUT'}${index + 1}`;
  }
}

function uniqueModuleId(name: string, modules: readonly NativeVisualModuleDefinition[]): string {
  const base = `module-${slug(name)}`;
  let candidate = base;
  let index = 2;
  while (modules.some((module) => module.id === candidate)) candidate = `${base}-${index++}`;
  return candidate;
}

function uniqueNodeId(circuit: Circuit, name: string): string {
  const base = slug(name) || 'module-instance';
  let candidate = base;
  let index = 2;
  while (circuit.nodes.some((node) => node.id === candidate)) candidate = `${base}-${index++}`;
  return candidate;
}

function toVhdlIdentifier(value: string): string {
  const words = value.trim().split(/[^A-Za-z0-9]+/).filter(Boolean);
  const joined = words.map((word) => word[0]?.toUpperCase() + word.slice(1)).join('') || 'Module';
  return /^[A-Za-z]/.test(joined) ? joined : `Module${joined}`;
}

function toCamelIdentifier(value: string): string {
  const pascal = toVhdlIdentifier(value);
  return pascal[0].toLowerCase() + pascal.slice(1);
}

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function parseInternalRef(value: string): PortRef {
  const dot = value.lastIndexOf('.');
  return dot > 0
    ? { nodeId: value.slice(0, dot), portName: value.slice(dot + 1) }
    : { nodeId: value, portName: 'out' };
}

function normalizeEndpoint(value: unknown, fallbackPortName: string): PortRef {
  if (typeof value === 'string') return { nodeId: value, portName: fallbackPortName };
  if (isRecord(value)) {
    return {
      nodeId: readString(value.nodeId),
      portName: readString(value.portName) || readString(value.port) || fallbackPortName,
    };
  }
  return { nodeId: '', portName: fallbackPortName };
}

function clonePortRef(ref: PortRef): PortRef {
  return { nodeId: ref.nodeId, portName: ref.portName || ref.port || 'out' };
}

function cloneConnection(connection: Connection): Connection {
  return {
    ...(connection.id ? { id: connection.id } : {}),
    from: clonePortRef(normalizeEndpoint(connection.from, 'out')),
    to: clonePortRef(normalizeEndpoint(connection.to, 'in')),
  };
}

function cloneNode(node: Node): Node {
  return {
    ...node,
    position: node.position ? { ...node.position } : undefined,
    config: node.config ? { ...node.config } : undefined,
    state: node.state ? { ...node.state } : undefined,
  };
}

function cloneCircuit(circuit: Circuit): Circuit {
  return { nodes: circuit.nodes.map(cloneNode), connections: circuit.connections.map(cloneConnection) };
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
